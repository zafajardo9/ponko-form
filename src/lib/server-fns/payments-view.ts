import { createServerFn } from "@tanstack/react-start";
import { auth } from "@clerk/tanstack-react-start/server";
import { db } from "../../db/index";
import {
  payments,
  paymentGateways,
  flowExecutions,
  flows,
  formSubmissions,
  forms,
  profiles,
} from "../../db/schema";
import { eq, desc, sql } from "drizzle-orm";

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
  gatewayName: string;
  gatewaySlug: string;
  gatewayPaymentId: string | null;
  /** Payment channel/method extracted from gateway response (e.g. "GCash", "credit_card"). */
  paymentChannel: string | null;
  /** Raw gateway response JSON for debugging / detail view. */
  gatewayResponse: Record<string, unknown> | null;
  executionId: number;
  submissionId: number | null;
  createdAt: string;
}

/**
 * getFormPayments({ formId })
 * Returns all payment transactions for the given form, ordered newest first.
 * The form creator must own the form.
 */
export const getFormPayments = createServerFn({ method: "GET", strict: false })
  .inputValidator((data: { formId: number; page?: number }) => data)
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

    const page = data.page ?? 1;
    const limit = 50;
    const offset = (page - 1) * limit;

    const rows = await db
      .select({
        id: payments.id,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        gatewayPaymentId: payments.gatewayPaymentId,
        gatewayResponse: payments.gatewayResponse,
        createdAt: payments.createdAt,
        gatewayName: paymentGateways.name,
        gatewaySlug: paymentGateways.slug,
        executionId: flowExecutions.id,
        submissionId: formSubmissions.id,
      })
      .from(payments)
      .innerJoin(
        paymentGateways,
        eq(payments.paymentGatewayId, paymentGateways.id),
      )
      .innerJoin(
        flowExecutions,
        eq(payments.flowExecutionId, flowExecutions.id),
      )
      .innerJoin(flows, eq(flowExecutions.flowId, flows.id))
      .leftJoin(
        formSubmissions,
        eq(payments.formSubmissionId, formSubmissions.id),
      )
      .where(eq(flows.formId, data.formId))
      .orderBy(desc(payments.createdAt))
      .limit(limit)
      .offset(offset);

    // Build invoice numbers and extract payment channel from gateway response.
    const result: PaymentViewRow[] = rows.map((r) => ({
      id: r.id,
      invoiceNo: `INV-${String(r.executionId).padStart(6, "0")}`,
      amount: r.amount,
      currency: r.currency,
      status: r.status,
      gatewayName: r.gatewayName,
      gatewaySlug: r.gatewaySlug,
      gatewayPaymentId: r.gatewayPaymentId,
      paymentChannel: extractPaymentChannel(r.gatewaySlug, r.gatewayResponse),
      gatewayResponse: r.gatewayResponse,
      executionId: r.executionId,
      submissionId: r.submissionId,
      createdAt: r.createdAt as unknown as string,
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

    return {
      payments: result,
      hasPaymentFlow: !!paymentNode,
      formTitle: form.title,
    };
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
