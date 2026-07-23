import { createServerFn } from "@tanstack/react-start";
import { auth } from "@clerk/tanstack-react-start/server";
import { db } from "../../db/index";
import {
  payments,
  paymentGateways,
  flowExecutions,
  flows,
  forms,
  formPages,
  formSubmissionSessions,
  paymentEvents,
  profiles,
  subscriptionCycles,
} from "../../db/schema";
import { eq, desc, asc, and, or, sql, type SQL } from "drizzle-orm";
import { reconcilePayment } from "../payments/reconciliation";
import { paymentRegistry } from "../../integrations/payments";
import {
  getIntegrationConfig,
  loadIntegrationConfigs,
  paypalCredentialsForEnvironment,
  xenditCredentialsForEnvironment,
} from "../integrations/credentials";
import type { GatewayCredentials } from "../../integrations/payments/types";
import type { ResendConfig } from "../integrations/types";
import { sendPaymentReminderEmail } from "../email/resend";
import { publicRequestOrigin } from "./request-origin";

/**
 * Payment view model returned to the form creator's Payments page.
 * Lightweight — only the data needed for the table + detail popup.
 */
export interface PaymentViewRow {
  id: number;
  invoiceNo: string;
  amount: number; // smallest currency unit
  currency: string;
  status: "pending" | "completed" | "failed" | "refunded";
  paymentKind: "one_time" | "subscription";
  respondentName: string | null;
  respondentEmail: string | null;
  subscriptionPlanId: string | null;
  subscriptionStatus: string | null;
  subscriptionCheckoutStatus: string | null;
  subscriptionInterval: "WEEK" | "MONTH" | null;
  subscriptionIntervalCount: number | null;
  subscriptionMaxCycles: number | null;
  subscriptionTrialDays: number | null;
  subscriptionNextChargeAt: string | null;
  subscriptionEndedAt: string | null;
  gatewayName: string;
  gatewaySlug: string;
  gatewayPaymentId: string | null;
  /** Payment channel/method extracted from gateway response (e.g. "GCash", "credit_card"). */
  paymentChannel: string | null;
  /** Raw gateway response JSON for debugging / detail view. */
  gatewayResponse: Record<string, unknown> | null;
  executionId: number | null;
  pageSessionId: number | null;
  submissionId: number | null;
  createdAt: string;
  updatedAt: string;
  externalId: string | null;
  paymentUrl: string | null;
  expiresAt: string | null;
  reminderCount: number;
  lastReminderAt: string | null;
  paidAmount: number | null;
  paidAt: string | null;
  failedAt: string | null;
  refundedAt: string | null;
  lastVerifiedAt: string | null;
  verificationSource: string | null;
  failureReason: string | null;
  events: Array<{
    id: number; eventType: string; providerStatus: string | null; normalizedStatus: string | null;
    source: string; processingStatus: string; receivedAt: string; payload: Record<string, unknown> | null;
  }>;
  cycles: Array<{
    id: number; gatewayCycleId: string; cycleNumber: number | null; status: string;
    amount: number; currency: string; scheduledAt: string | null; paidAt: string | null;
    failedAt: string | null; failureCode: string | null; verificationSource: string | null;
  }>;
}

const paymentPageSizes = new Set([10, 25, 50, 100]);
const basePaymentStatuses = new Set(["pending", "completed", "failed", "refunded"]);
const subscriptionPaymentStatuses = new Set([
  "pending",
  "active",
  "paused",
  "past_due",
  "cancelled",
  "deactivated",
  "completed",
]);

export function normalizePaymentPageSize(value?: number) {
  return value && paymentPageSizes.has(value) ? value : 25;
}

function paymentScopeCondition(formId: number) {
  return sql`(${flows.formId} = ${formId} OR ${formSubmissionSessions.formId} = ${formId})`;
}

function paymentQueryConditions({
  formId,
  filters,
  search,
}: {
  formId: number;
  filters?: Record<string, unknown>;
  search?: string;
}) {
  const conditions: SQL[] = [paymentScopeCondition(formId)];

  for (const [key, value] of Object.entries(filters ?? {})) {
    if (value == null || value === "") continue;

    if (key === "status" && typeof value === "string") {
      const [kind, status] = value.split(":");
      if (kind === "one_time" && basePaymentStatuses.has(status)) {
        conditions.push(
          sql`${payments.paymentKind} = 'one_time' AND ${payments.status}::text = ${status}`,
        );
      } else if (kind === "subscription" && subscriptionPaymentStatuses.has(status)) {
        conditions.push(
          status === "pending"
            ? sql`${payments.paymentKind} = 'subscription' AND COALESCE(${payments.subscriptionStatus}, 'pending') = 'pending'`
            : sql`${payments.paymentKind} = 'subscription' AND ${payments.subscriptionStatus} = ${status}`,
        );
      }
      continue;
    }

    if (key === "paymentKind" && (value === "one_time" || value === "subscription")) {
      conditions.push(sql`${payments.paymentKind} = ${value}`);
      continue;
    }

    if (key === "gateway" && typeof value === "string" && value.trim()) {
      conditions.push(sql`${paymentGateways.slug} = ${value.trim()}`);
      continue;
    }

    if (key === "createdAt" && typeof value === "object") {
      const range = value as { from?: string; to?: string };
      const from = range.from ? new Date(`${range.from}T00:00:00`) : null;
      const to = range.to ? new Date(`${range.to}T23:59:59.999`) : null;
      if (from && !Number.isNaN(from.getTime())) {
        conditions.push(sql`${payments.createdAt} >= ${from}`);
      }
      if (to && !Number.isNaN(to.getTime())) {
        conditions.push(sql`${payments.createdAt} <= ${to}`);
      }
      continue;
    }

    if (key === "amount" && typeof value === "object") {
      const range = value as { min?: number; max?: number };
      if (typeof range.min === "number" && Number.isFinite(range.min)) {
        conditions.push(sql`${payments.amount} >= ${Math.round(range.min * 100)}`);
      }
      if (typeof range.max === "number" && Number.isFinite(range.max)) {
        conditions.push(sql`${payments.amount} <= ${Math.round(range.max * 100)}`);
      }
    }
  }

  const term = search?.trim();
  if (term) {
    const pattern = `%${term}%`;
    conditions.push(sql`(
      CONCAT('PAY-', LPAD(${payments.id}::text, 6, '0')) ILIKE ${pattern}
      OR COALESCE(${payments.respondentName}, '') ILIKE ${pattern}
      OR COALESCE(${payments.respondentEmail}, '') ILIKE ${pattern}
      OR COALESCE(${payments.gatewayPaymentId}, '') ILIKE ${pattern}
      OR COALESCE(${payments.externalId}, '') ILIKE ${pattern}
      OR COALESCE(${payments.paymentChannel}, '') ILIKE ${pattern}
      OR ${paymentGateways.name} ILIKE ${pattern}
    )`);
  }

  return conditions;
}

function paymentOrderBy(sortKey?: string, sortDir?: "asc" | "desc") {
  const direction = sortDir === "asc" ? asc : desc;
  let expression: SQL | typeof payments.createdAt = payments.createdAt;

  if (sortKey === "invoice") expression = sql`${payments.id}`;
  else if (sortKey === "amount") expression = sql`${payments.amount}`;
  else if (sortKey === "subscriber") {
    expression = sql`LOWER(COALESCE(${payments.respondentName}, ${payments.respondentEmail}, ''))`;
  } else if (sortKey === "status") {
    expression = sql`LOWER(COALESCE(${payments.subscriptionStatus}, ${payments.status}::text))`;
  } else if (sortKey === "gateway") {
    expression = sql`LOWER(${paymentGateways.name})`;
  } else if (sortKey === "channel") {
    expression = sql`LOWER(COALESCE(${payments.paymentChannel}, ''))`;
  } else if (sortKey === "reference") {
    expression = sql`LOWER(COALESCE(${payments.gatewayPaymentId}, ''))`;
  }

  return [direction(expression), desc(payments.id)] as const;
}

/**
 * getFormPayments({ formId })
 * Returns all payment transactions for the given form, ordered newest first.
 * The form creator must own the form.
 */
export const getFormPayments = createServerFn({ method: "GET", strict: false })
  .inputValidator(
    (data: {
      formId: number;
      page?: number;
      pageSize?: number;
      sortKey?: string;
      sortDir?: "asc" | "desc";
      filters?: Record<string, unknown>;
      search?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.clerkId, userId))
      .limit(1);
    if (!profile) throw new Error("Unauthorized");

    const [form] = await db
      .select()
      .from(forms)
      .where(eq(forms.id, data.formId))
      .limit(1);
    if (!form || form.profileId !== profile.id) throw new Error("Not found");

    const page = Math.max(1, Math.floor(data.page ?? 1));
    const pageSize = normalizePaymentPageSize(data.pageSize);
    const offset = (page - 1) * pageSize;
    const conditions = paymentQueryConditions({
      formId: data.formId,
      filters: data.filters,
      search: data.search,
    });
    const orderBy = paymentOrderBy(data.sortKey, data.sortDir);

    const rowsQuery = db
      .select({
        id: payments.id,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        paymentKind: payments.paymentKind,
        respondentName: payments.respondentName,
        respondentEmail: payments.respondentEmail,
        subscriptionPlanId: payments.subscriptionPlanId,
        subscriptionStatus: payments.subscriptionStatus,
        subscriptionCheckoutStatus: payments.subscriptionCheckoutStatus,
        subscriptionInterval: payments.subscriptionInterval,
        subscriptionIntervalCount: payments.subscriptionIntervalCount,
        subscriptionMaxCycles: payments.subscriptionMaxCycles,
        subscriptionTrialDays: payments.subscriptionTrialDays,
        subscriptionNextChargeAt: payments.subscriptionNextChargeAt,
        subscriptionEndedAt: payments.subscriptionEndedAt,
        gatewayPaymentId: payments.gatewayPaymentId,
        gatewayResponse: payments.gatewayResponse,
        paymentChannel: payments.paymentChannel,
        createdAt: payments.createdAt,
        updatedAt: payments.updatedAt,
        externalId: payments.externalId,
        paymentUrl: payments.paymentUrl,
        expiresAt: payments.expiresAt,
        reminderCount: payments.reminderCount,
        lastReminderAt: payments.lastReminderAt,
        paidAmount: payments.paidAmount,
        paidAt: payments.paidAt,
        failedAt: payments.failedAt,
        refundedAt: payments.refundedAt,
        lastVerifiedAt: payments.lastVerifiedAt,
        verificationSource: payments.verificationSource,
        failureReason: payments.failureReason,
        pageSessionId: payments.pageSessionId,
        gatewayName: paymentGateways.name,
        gatewaySlug: paymentGateways.slug,
        executionId: flowExecutions.id,
        submissionId: payments.formSubmissionId,
      })
      .from(payments)
      .innerJoin(
        paymentGateways,
        eq(payments.paymentGatewayId, paymentGateways.id),
      )
      .leftJoin(
        flowExecutions,
        eq(payments.flowExecutionId, flowExecutions.id),
      )
      .leftJoin(flows, eq(flowExecutions.flowId, flows.id))
      .leftJoin(formSubmissionSessions, eq(payments.pageSessionId, formSubmissionSessions.id))
      .where(and(...conditions))
      .orderBy(...orderBy)
      .limit(pageSize)
      .offset(offset);

    const countQuery = db
      .select({ count: sql<number>`count(DISTINCT ${payments.id})::int` })
      .from(payments)
      .innerJoin(
        paymentGateways,
        eq(payments.paymentGatewayId, paymentGateways.id),
      )
      .leftJoin(
        flowExecutions,
        eq(payments.flowExecutionId, flowExecutions.id),
      )
      .leftJoin(flows, eq(flowExecutions.flowId, flows.id))
      .leftJoin(
        formSubmissionSessions,
        eq(payments.pageSessionId, formSubmissionSessions.id),
      )
      .where(and(...conditions));

    const [rows, [countResult]] = await Promise.all([rowsQuery, countQuery]);
    const totalCount = countResult?.count ?? 0;

    const result: PaymentViewRow[] = rows.map((r) => ({
      id: r.id,
      invoiceNo: `PAY-${String(r.id).padStart(6, "0")}`,
      amount: r.amount,
      currency: r.currency,
      status: r.status,
      paymentKind: r.paymentKind,
      respondentName: r.respondentName,
      respondentEmail: r.respondentEmail,
      subscriptionPlanId: r.subscriptionPlanId,
      subscriptionStatus: r.subscriptionStatus,
      subscriptionCheckoutStatus: r.subscriptionCheckoutStatus,
      subscriptionInterval: r.subscriptionInterval,
      subscriptionIntervalCount: r.subscriptionIntervalCount,
      subscriptionMaxCycles: r.subscriptionMaxCycles,
      subscriptionTrialDays: r.subscriptionTrialDays,
      subscriptionNextChargeAt: r.subscriptionNextChargeAt as unknown as string | null,
      subscriptionEndedAt: r.subscriptionEndedAt as unknown as string | null,
      gatewayName: r.gatewayName,
      gatewaySlug: r.gatewaySlug,
      gatewayPaymentId: r.gatewayPaymentId,
      paymentChannel: r.paymentChannel ?? extractPaymentChannel(r.gatewaySlug, r.gatewayResponse),
      gatewayResponse: null,
      executionId: r.executionId,
      pageSessionId: r.pageSessionId,
      submissionId: r.submissionId,
      createdAt: r.createdAt as unknown as string,
      updatedAt: r.updatedAt as unknown as string,
      externalId: r.externalId,
      paymentUrl: r.paymentUrl,
      expiresAt: r.expiresAt as unknown as string | null,
      reminderCount: r.reminderCount,
      lastReminderAt: r.lastReminderAt as unknown as string | null,
      paidAmount: r.paidAmount,
      paidAt: r.paidAt as unknown as string | null,
      failedAt: r.failedAt as unknown as string | null,
      refundedAt: r.refundedAt as unknown as string | null,
      lastVerifiedAt: r.lastVerifiedAt as unknown as string | null,
      verificationSource: r.verificationSource,
      failureReason: r.failureReason,
      events: [],
      cycles: [],
    }));

    // Check if this form has any payment flow (to show/hide the tab).
    const [paymentNode] = await db
      .select({ id: sql`1` })
      .from(flows)
      .innerJoin(
        sql`flow_nodes`,
        sql`flow_nodes.flow_id = flows.id AND flow_nodes.type = 'payment'`,
      )
      .where(eq(flows.formId, data.formId))
      .limit(1);

    const [pagePayment] = await db
      .select({ id: formPages.id })
      .from(formPages)
      .where(
        and(eq(formPages.formId, data.formId), eq(formPages.hasPayment, true)),
      )
      .limit(1);

    return {
      payments: result,
      hasPaymentFlow: !!paymentNode || !!pagePayment,
      formTitle: form.title,
      totalCount,
      page,
      pageSize,
    };
  });

export const verifyFormPayment = createServerFn({ method: "POST", strict: false })
  .inputValidator((data: { formId: number; paymentId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");
    const [profile] = await db.select().from(profiles).where(eq(profiles.clerkId, userId)).limit(1);
    const [form] = await db.select().from(forms).where(eq(forms.id, data.formId)).limit(1);
    if (!profile || !form || form.profileId !== profile.id) throw new Error("Not found");
    const [ownedPayment] = await db.select({ id: payments.id })
      .from(payments)
      .leftJoin(flowExecutions, eq(payments.flowExecutionId, flowExecutions.id))
      .leftJoin(flows, eq(flowExecutions.flowId, flows.id))
      .leftJoin(formSubmissionSessions, eq(payments.pageSessionId, formSubmissionSessions.id))
      .where(or(
        sql`${payments.id} = ${data.paymentId} AND ${flows.formId} = ${data.formId}`,
        sql`${payments.id} = ${data.paymentId} AND ${formSubmissionSessions.formId} = ${data.formId}`,
      )).limit(1);
    if (!ownedPayment) throw new Error("Payment not found");
    return reconcilePayment({ paymentId: data.paymentId, source: "manual" });
  });

async function ownedPayment(formId: number, paymentId: number, clerkId: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.clerkId, clerkId)).limit(1);
  const [form] = await db.select().from(forms).where(eq(forms.id, formId)).limit(1);
  if (!profile || !form || form.profileId !== profile.id) throw new Error("Not found");
  const [row] = await db.select({ payment: payments, gatewaySlug: paymentGateways.slug })
    .from(payments)
    .innerJoin(paymentGateways, eq(payments.paymentGatewayId, paymentGateways.id))
    .leftJoin(flowExecutions, eq(payments.flowExecutionId, flowExecutions.id))
    .leftJoin(flows, eq(flowExecutions.flowId, flows.id))
    .leftJoin(formSubmissionSessions, eq(payments.pageSessionId, formSubmissionSessions.id))
    .where(or(
      sql`${payments.id} = ${paymentId} AND ${flows.formId} = ${formId}`,
      sql`${payments.id} = ${paymentId} AND ${formSubmissionSessions.formId} = ${formId}`,
    )).limit(1);
  if (!row) throw new Error("Payment not found");
  return { ...row, profileId: profile.id, formTitle: form.title };
}

export const getPaymentActivity = createServerFn({ method: "GET", strict: false })
  .inputValidator((data: { formId: number; paymentId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");
    const { payment, gatewaySlug } = await ownedPayment(
      data.formId,
      data.paymentId,
      userId,
    );

    const [events, cycles] = await Promise.all([
      db
        .select()
        .from(paymentEvents)
        .where(eq(paymentEvents.paymentId, payment.id))
        .orderBy(desc(paymentEvents.receivedAt)),
      db
        .select()
        .from(subscriptionCycles)
        .where(eq(subscriptionCycles.paymentId, payment.id))
        .orderBy(desc(subscriptionCycles.scheduledAt), desc(subscriptionCycles.id)),
    ]);

    return {
      gatewayResponse: payment.gatewayResponse,
      paymentChannel:
        payment.paymentChannel ??
        extractPaymentChannel(gatewaySlug, payment.gatewayResponse),
      events: events.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        providerStatus: event.providerStatus,
        normalizedStatus: event.normalizedStatus,
        source: event.source,
        processingStatus: event.processingStatus,
        receivedAt: event.receivedAt as unknown as string,
        payload: event.payload,
      })),
      cycles: cycles.map((cycle) => ({
        id: cycle.id,
        gatewayCycleId: cycle.gatewayCycleId,
        cycleNumber: cycle.cycleNumber,
        status: cycle.status,
        amount: cycle.amount,
        currency: cycle.currency,
        scheduledAt: cycle.scheduledAt as unknown as string | null,
        paidAt: cycle.paidAt as unknown as string | null,
        failedAt: cycle.failedAt as unknown as string | null,
        failureCode: cycle.failureCode,
        verificationSource: cycle.verificationSource,
      })),
    };
  });

export const getPaymentRecoveryLink = createServerFn({ method: "POST", strict: false })
  .inputValidator((data: { formId: number; paymentId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");
    const { payment } = await ownedPayment(data.formId, data.paymentId, userId);
    if (!payment.paymentUrl) throw new Error("This payment does not have a reusable checkout link")
    if (payment.status !== "pending") throw new Error(`This payment is already ${payment.status}`)
    if (payment.expiresAt && payment.expiresAt.getTime() <= Date.now()) throw new Error("This payment link has expired. Create a replacement link.")
    await db.update(payments).set({
      reminderCount: payment.reminderCount + 1,
      lastReminderAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(payments.id, payment.id));
    return { paymentUrl: payment.paymentUrl };
  });

export const replaceExpiredPaymentLink = createServerFn({ method: "POST", strict: false })
  .inputValidator((data: { formId: number; paymentId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");
    const { payment, gatewaySlug, profileId } = await ownedPayment(data.formId, data.paymentId, userId);
    if (payment.status === "completed" || payment.status === "refunded") throw new Error("A successful payment cannot be replaced")
    if (payment.paymentUrl && payment.expiresAt && payment.expiresAt.getTime() > Date.now() && payment.status === "pending") {
      return { paymentUrl: payment.paymentUrl, paymentId: payment.id, reused: true }
    }
    const gateway = paymentRegistry.get(gatewaySlug);
    if (!gateway) throw new Error("Payment gateway is unavailable")
    const configs = await loadIntegrationConfigs(profileId);
    const response = payment.gatewayResponse ?? {};
    const environment = response.environment === "live" || response.environment === "sandbox"
      ? response.environment
      : gatewaySlug === "xendit" ? configs.xendit?.mode : configs.paypal?.mode;
    const credentials: GatewayCredentials | undefined = gatewaySlug === "xendit" && configs.xendit && environment
      ? { ...xenditCredentialsForEnvironment(configs.xendit, environment), mode: environment }
      : gatewaySlug === "paypal" && configs.paypal && environment
        ? { ...paypalCredentialsForEnvironment(configs.paypal, environment), mode: environment }
        : undefined;
    if (!credentials) throw new Error("Payment gateway credentials are unavailable")
    const baseUrl = publicRequestOrigin()
    const [replacement] = await db.insert(payments).values({
      formSubmissionId: payment.formSubmissionId,
      pageSessionId: payment.pageSessionId,
      flowExecutionId: payment.flowExecutionId,
      paymentGatewayId: payment.paymentGatewayId,
      amount: payment.amount,
      currency: payment.currency,
      status: "pending",
      gatewayResponse: { ...response, environment },
    }).returning({ id: payments.id });
    const externalId = `ponkoform-payment-${replacement.id}`;
    const returnPath = payment.pageSessionId
      ? `/forms/payment-return?pageSessionId=${payment.pageSessionId}&pageId=${String(response.pageId ?? "")}`
      : `/forms/payment-return?executionId=${payment.flowExecutionId}`;
    const result = await gateway.createPayment({
      amount: payment.amount,
      currency: payment.currency,
      externalId,
      metadata: {
        paymentId: String(replacement.id),
        ...(payment.pageSessionId ? { pageSessionId: String(payment.pageSessionId), pageId: String(response.pageId ?? "") } : {}),
        ...(payment.flowExecutionId ? { executionId: String(payment.flowExecutionId) } : {}),
      },
      returnUrl: `${baseUrl}${returnPath}`,
      cancelUrl: `${baseUrl}${returnPath}${returnPath.includes("?") ? "&" : "?"}cancelled=1`,
    }, credentials);
    if (!result.success || !result.paymentUrl) {
      await db.update(payments).set({ status: "failed", failureReason: result.error ?? "Replacement creation failed", failedAt: new Date(), updatedAt: new Date() })
        .where(eq(payments.id, replacement.id));
      throw new Error(result.error ?? "Could not create replacement payment link")
    }
    await db.update(payments).set({
      externalId,
      gatewayPaymentId: result.gatewayPaymentId,
      paymentUrl: result.paymentUrl,
      expiresAt: result.expiresAt ? new Date(result.expiresAt) : null,
      gatewayResponse: response,
      updatedAt: new Date(),
    }).where(eq(payments.id, replacement.id));
    await db.update(payments).set({ status: "failed", failureReason: "Replaced by a new payment link", failedAt: new Date(), updatedAt: new Date() })
      .where(eq(payments.id, payment.id));
    if (payment.pageSessionId) {
      await db.update(formSubmissionSessions).set({
        collectedData: sql`coalesce(${formSubmissionSessions.collectedData}, '{}'::jsonb) || jsonb_build_object('__paymentId', ${replacement.id})`,
        status: "payment_pending",
        updatedAt: new Date(),
      }).where(eq(formSubmissionSessions.id, payment.pageSessionId));
    }
    return { paymentUrl: result.paymentUrl, paymentId: replacement.id, reused: false };
  });

export const emailPaymentRecoveryLink = createServerFn({ method: "POST", strict: false })
  .inputValidator((data: { formId: number; paymentId: number; recipientEmail: string }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");
    const recipient = data.recipientEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new Error("Enter a valid recipient email")
    const { payment, profileId, formTitle } = await ownedPayment(data.formId, data.paymentId, userId);
    if (!payment.paymentUrl) throw new Error("This payment does not have a checkout link")
    if (payment.status !== "pending") throw new Error(`This payment is already ${payment.status}`)
    if (payment.expiresAt && payment.expiresAt.getTime() <= Date.now()) throw new Error("This payment link has expired. Create a replacement first.")
    const resend = await getIntegrationConfig<ResendConfig>(profileId, "resend");
    if (!resend) throw new Error("Configure Resend before sending payment reminders")
    const formattedAmount = new Intl.NumberFormat("en-US", { style: "currency", currency: payment.currency })
      .format(payment.amount / 100);
    const delivery = await sendPaymentReminderEmail({
      config: resend,
      recipient,
      formTitle,
      amount: formattedAmount,
      paymentUrl: payment.paymentUrl,
      expiresAt: payment.expiresAt,
    });
    const now = new Date();
    await db.update(payments).set({
      reminderCount: payment.reminderCount + 1,
      lastReminderAt: now,
      updatedAt: now,
    }).where(eq(payments.id, payment.id));
    await db.insert(paymentEvents).values({
      paymentId: payment.id,
      eventKey: crypto.randomUUID().replaceAll('-', ''),
      gatewayEventId: delivery.messageId,
      eventType: "payment.reminder_sent",
      providerStatus: "ACCEPTED_BY_RESEND",
      normalizedStatus: payment.status,
      source: "manual",
      payload: { paymentId: payment.id },
      processingStatus: "processed",
      processedAt: now,
    });
    return { success: true, messageId: delivery.messageId };
  });

/**
 * Extract a human-readable payment channel name from the gateway response.
 * Each gateway returns this in a different field.
 */
function extractPaymentChannel(
  slug: string,
  response: Record<string, unknown> | null,
): string | null {
  if (!response) return null;

  switch (slug) {
    case "xendit":
      // Xendit invoices return `payment_channel` (e.g. "GCash", "BCA", "OVO")
      return (
        (response.payment_channel as string) ??
        (response.payment_method as string) ??
        null
      );
    case "paypal":
      // PayPal returns payer info; channel could be from `payer.payer_info`
      return (response.status as string) === "COMPLETED" ? "PayPal" : null;
    default:
      return null;
  }
}
