import { createServerFn } from "@tanstack/react-start";
import { auth } from "@clerk/tanstack-react-start/server";
import { db } from "../../db/index";
import {
  formSubmissions,
  forms,
  formFields,
  formPageFields,
  formPages,
  flows,
  flowNodes,
  payments,
  profiles,
} from "../../db/schema";
import {
  eq,
  desc,
  asc,
  inArray,
  sql,
  and,
  isNull,
  isNotNull,
  type SQL,
} from "drizzle-orm";
import { dispatchSubmissionEmails } from "../invoicing/delivery";

/** A response column: the key to read from a submission's formData + its label. */
export interface ResponseColumn {
  key: string;
  label: string;
}

function paymentStatusPriority(status: string) {
  return status === 'refunded' ? 4 : status === 'completed' ? 3 : status === 'pending' ? 2 : 1
}

const submissionStatuses = new Set([
  "pending_payment",
  "incomplete",
  "completed",
  "payment_failed",
]);
const paymentStatuses = new Set(["pending", "completed", "failed", "refunded"]);
const allowedPageSizes = new Set([10, 25, 50, 100]);

export function normalizeSubmissionPageSize(value?: number) {
  return value && allowedPageSizes.has(value) ? value : 25;
}

function paymentStatusExpression() {
  return sql<string | null>`(
    SELECT p.status::text
    FROM payments p
    WHERE p.form_submission_id = ${formSubmissions.id}
    ORDER BY
      CASE p.status::text
        WHEN 'refunded' THEN 4
        WHEN 'completed' THEN 3
        WHEN 'pending' THEN 2
        ELSE 1
      END DESC,
      p.id DESC
    LIMIT 1
  )`;
}

function buildSubmissionWhereConditions({
  formId,
  archived,
  filters,
  search,
  columns,
}: {
  formId: number;
  archived?: boolean;
  filters?: Record<string, unknown>;
  search?: string;
  columns: ResponseColumn[];
}) {
  const conditions: SQL[] = [
    eq(formSubmissions.formId, formId),
    archived
      ? isNotNull(formSubmissions.archivedAt)
      : isNull(formSubmissions.archivedAt),
  ];
  const answerKeys = new Set(columns.map((column) => column.key));

  for (const [key, value] of Object.entries(filters ?? {})) {
    if (value == null || value === "") continue;

    if (key === "payment_status" && typeof value === "string") {
      if (value === "none") {
        conditions.push(sql`NOT EXISTS (
          SELECT 1 FROM payments p
          WHERE p.form_submission_id = ${formSubmissions.id}
        )`);
      } else if (paymentStatuses.has(value)) {
        conditions.push(sql`${paymentStatusExpression()} = ${value}`);
      }
      continue;
    }

    if (key === "submitted_at" && typeof value === "object") {
      const range = value as { from?: string; to?: string };
      const from = range.from ? new Date(`${range.from}T00:00:00`) : null;
      const to = range.to ? new Date(`${range.to}T23:59:59.999`) : null;
      if (from && !Number.isNaN(from.getTime())) {
        conditions.push(sql`${formSubmissions.submittedAt} >= ${from}`);
      }
      if (to && !Number.isNaN(to.getTime())) {
        conditions.push(sql`${formSubmissions.submittedAt} <= ${to}`);
      }
      continue;
    }

    if (key === "status" && typeof value === "string") {
      if (submissionStatuses.has(value)) {
        conditions.push(sql`${formSubmissions.status}::text = ${value}`);
      }
      continue;
    }

    if (answerKeys.has(key) && typeof value === "string" && value.trim()) {
      conditions.push(
        sql`LOWER(COALESCE(${formSubmissions.formData} ->> ${key}, '')) LIKE LOWER(${"%" + value.trim() + "%"})`,
      );
    }
  }

  const normalizedSearch = search?.trim();
  if (normalizedSearch) {
    conditions.push(
      sql`LOWER(${formSubmissions.formData}::text) LIKE LOWER(${"%" + normalizedSearch + "%"})`,
    );
  }

  return conditions;
}

function buildSubmissionOrderBy({
  sortKey,
  sortDir,
  columns,
}: {
  sortKey?: string;
  sortDir?: "asc" | "desc";
  columns: ResponseColumn[];
}) {
  const direction = sortDir === "asc" ? asc : desc;
  const answerKeys = new Set(columns.map((column) => column.key));
  let expression: SQL | typeof formSubmissions.submittedAt =
    formSubmissions.submittedAt;

  if (sortKey === "status") {
    expression = sql`${formSubmissions.status}::text`;
  } else if (sortKey === "payment_status") {
    expression = paymentStatusExpression();
  } else if (sortKey && answerKeys.has(sortKey)) {
    expression = sql`LOWER(COALESCE(${formSubmissions.formData} ->> ${sortKey}, ''))`;
  }

  return [direction(expression), desc(formSubmissions.id)] as const;
}

/**
 * Build the response columns for a form.
 *
 * Flow-backed forms store answers keyed by variable name, so columns come from
 * the flow's form_field / group node bindings (label → bound variable). Legacy
 * linear forms store answers keyed by form_fields.id, so columns come from
 * form_fields directly.
 */
async function getResponseColumns(formId: number): Promise<ResponseColumn[]> {
  const pages = await db
    .select()
    .from(formPages)
    .where(eq(formPages.formId, formId))
    .orderBy(formPages.position, formPages.id);

  if (pages.length > 0) {
    const pageIds = pages.map((page) => page.id);
    const fields = await db
      .select()
      .from(formPageFields)
      .where(inArray(formPageFields.pageId, pageIds))
      .orderBy(formPageFields.position, formPageFields.id);
    return fields.map((field) => ({
      key: field.bindVariable,
      label: field.label,
    }));
  }

  const [flow] = await db
    .select()
    .from(flows)
    .where(eq(flows.formId, formId))
    .limit(1);

  if (flow) {
    const nodes = await db
      .select()
      .from(flowNodes)
      .where(eq(flowNodes.flowId, flow.id))
      .orderBy(flowNodes.id);

    const columns: ResponseColumn[] = [];
    for (const node of nodes) {
      const config = node.config as Record<string, unknown>;
      if (node.type === "form_field") {
        const key = config.bindToVariable as string | undefined;
        if (key)
          columns.push({
            key,
            label: (config.label as string) || node.label || key,
          });
      } else if (node.type === "group") {
        const fields =
          (config.fields as
            | { label?: string; bindToVariable?: string }[]
            | undefined) ?? [];
        for (const f of fields) {
          if (f.bindToVariable)
            columns.push({
              key: f.bindToVariable,
              label: f.label || f.bindToVariable,
            });
        }
      }
    }
    return columns;
  }

  const dbFields = await db
    .select()
    .from(formFields)
    .where(eq(formFields.formId, formId))
    .orderBy(formFields.order);
  return dbFields.map((f) => ({ key: String(f.id), label: f.label }));
}

export const submitFormResponse = createServerFn({
  method: "POST",
  strict: false,
})
  .inputValidator(
    (data: { formId: number; formData: Record<string, unknown> }) => data,
  )
  .handler(async ({ data }) => {
    const [form] = await db
      .select()
      .from(forms)
      .where(eq(forms.id, data.formId))
      .limit(1);
    if (!form || form.status !== "published")
      throw new Error("Form not found or not published");

    const fields = await db
      .select()
      .from(formFields)
      .where(eq(formFields.formId, data.formId))
      .orderBy(formFields.order);

    for (const field of fields) {
      if (field.required) {
        const val = data.formData[String(field.id)];
        const isEmpty =
          !val ||
          (Array.isArray(val) ? val.length === 0 : String(val).trim() === "");
        if (isEmpty) throw new Error(`Field "${field.label}" is required`);
      }
    }

    const [submission] = await db
      .insert(formSubmissions)
      .values({
        formId: data.formId,
        formData: data.formData,
        status: "completed",
      })
      .returning();
    await dispatchSubmissionEmails(submission.id).catch((error) => {
      console.error(`[submission:${submission.id}] Email dispatch failed`, error);
    });
    return submission;
  });

export const getSubmissions = createServerFn({ method: "GET", strict: false })
  .inputValidator(
    (data: {
      formId: number;
      page?: number;
      pageSize?: number;
      sortKey?: string;
      sortDir?: "asc" | "desc";
      filters?: Record<string, unknown>;
      search?: string;
      archived?: boolean;
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

    const columns = await getResponseColumns(data.formId);
    const pageSize = normalizeSubmissionPageSize(data.pageSize);
    const page = Math.max(1, Math.floor(data.page ?? 1));
    const offset = (page - 1) * pageSize;
    const whereConditions = buildSubmissionWhereConditions({
      formId: data.formId,
      archived: data.archived,
      filters: data.filters,
      search: data.search,
      columns,
    });
    const orderBy = buildSubmissionOrderBy({
      sortKey: data.sortKey,
      sortDir: data.sortDir,
      columns,
    });

    const [[countResult], submissions, [paymentRecord]] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(formSubmissions)
        .where(and(...whereConditions)),
      db
        .select()
        .from(formSubmissions)
        .where(and(...whereConditions))
        .orderBy(...orderBy)
        .limit(pageSize)
        .offset(offset),
      db
        .select({ id: payments.id })
        .from(payments)
        .innerJoin(
          formSubmissions,
          eq(payments.formSubmissionId, formSubmissions.id),
        )
        .where(eq(formSubmissions.formId, data.formId))
        .limit(1),
    ]);
    const totalCount = countResult?.count ?? 0;

    // Attach payment status to each submission
    const subIds = submissions.map((s) => s.id).filter(Boolean);
    const paymentMap = new Map<
      number,
      { status: string; amount: number; currency: string }
    >();
    if (subIds.length > 0) {
      const paymentRows = await db
        .select({
          submissionId: payments.formSubmissionId,
          status: payments.status,
          amount: payments.amount,
          currency: payments.currency,
        })
        .from(payments)
        .where(inArray(payments.formSubmissionId, subIds))
        .groupBy(
          payments.formSubmissionId,
          payments.status,
          payments.amount,
          payments.currency,
        );
      for (const p of paymentRows) {
        if (p.submissionId != null) {
          const existing = paymentMap.get(p.submissionId);
          if (existing && paymentStatusPriority(existing.status) >= paymentStatusPriority(p.status)) continue;
          paymentMap.set(p.submissionId, {
            status: p.status,
            amount: p.amount,
            currency: p.currency,
          });
        }
      }
    }

    return {
      submissions,
      columns,
      form,
      paymentMap: Object.fromEntries(paymentMap),
      totalCount,
      page,
      pageSize,
      hasPaymentData: !!paymentRecord,
    };
  });

async function requireOwnedSubmission(formId: number, submissionId: number) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const [ownedSubmission] = await db
    .select({ id: formSubmissions.id })
    .from(formSubmissions)
    .innerJoin(forms, eq(forms.id, formSubmissions.formId))
    .innerJoin(profiles, eq(profiles.id, forms.profileId))
    .where(
      and(
        eq(formSubmissions.id, submissionId),
        eq(formSubmissions.formId, formId),
        eq(profiles.clerkId, userId),
      ),
    )
    .limit(1);

  if (!ownedSubmission) throw new Error("Response not found");
}

export const setSubmissionArchived = createServerFn({
  method: "POST",
  strict: false,
})
  .inputValidator(
    (data: { formId: number; submissionId: number; archived: boolean }) => data,
  )
  .handler(async ({ data }) => {
    await requireOwnedSubmission(data.formId, data.submissionId);

    const [submission] = await db
      .update(formSubmissions)
      .set({ archivedAt: data.archived ? new Date() : null })
      .where(
        and(
          eq(formSubmissions.id, data.submissionId),
          eq(formSubmissions.formId, data.formId),
        ),
      )
      .returning({ id: formSubmissions.id, archivedAt: formSubmissions.archivedAt });

    return submission;
  });

export const deleteSubmission = createServerFn({
  method: "POST",
  strict: false,
})
  .inputValidator((data: { formId: number; submissionId: number }) => data)
  .handler(async ({ data }) => {
    await requireOwnedSubmission(data.formId, data.submissionId);

    const [deleted] = await db
      .delete(formSubmissions)
      .where(
        and(
          eq(formSubmissions.id, data.submissionId),
          eq(formSubmissions.formId, data.formId),
        ),
      )
      .returning({ id: formSubmissions.id });

    return deleted;
  });

/**
 * CSV export — fetches all matching submissions without pagination
 * and returns a CSV string.
 */
export const exportSubmissionsCsv = createServerFn({ method: "GET" })
  .inputValidator(
    (data: {
      formId: number;
      filters?: Record<string, unknown>;
      sortKey?: string;
      sortDir?: "asc" | "desc";
      search?: string;
      archived?: boolean;
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

    const columns = await getResponseColumns(data.formId);
    const whereConditions = buildSubmissionWhereConditions({
      formId: data.formId,
      archived: data.archived,
      filters: data.filters,
      search: data.search,
      columns,
    });
    const orderBy = buildSubmissionOrderBy({
      sortKey: data.sortKey,
      sortDir: data.sortDir,
      columns,
    });

    const submissions = await db
      .select()
      .from(formSubmissions)
      .where(and(...whereConditions))
      .orderBy(...orderBy);

    // Fetch payment info (needed for payment_status filter)
    const subIds = submissions.map((s) => s.id).filter(Boolean);
    const paymentMap = new Map<
      number,
      { status: string; amount: number; currency: string }
    >();
    if (subIds.length > 0) {
      const paymentRows = await db
        .select({
          submissionId: payments.formSubmissionId,
          status: payments.status,
          amount: payments.amount,
          currency: payments.currency,
        })
        .from(payments)
        .where(inArray(payments.formSubmissionId, subIds))
        .groupBy(
          payments.formSubmissionId,
          payments.status,
          payments.amount,
          payments.currency,
        );
      for (const p of paymentRows) {
        if (p.submissionId != null) {
          const existing = paymentMap.get(p.submissionId);
          if (existing && paymentStatusPriority(existing.status) >= paymentStatusPriority(p.status)) continue;
          paymentMap.set(p.submissionId, {
            status: p.status,
            amount: p.amount,
            currency: p.currency,
          });
        }
      }
    }

    // Build CSV with BOM for Excel compatibility
    const headers = [
      "#",
      "Submitted",
      ...columns.map((c) => c.label),
      "Payment Status",
      "Payment Amount",
    ];

    const escapeCSV = (val: unknown): string => {
      if (val == null || val === "") return "";
      const str = String(val);
      // Prefix with ' to neutralize CSV injection
      if (/^[=+\-@]/.test(str)) return `'${str}`;
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
      return str;
    };

    const rows = submissions.map((sub, i) => {
      const formData = sub.formData as Record<string, unknown>;
      const payment = paymentMap.get(sub.id);
      return [
        String(i + 1),
        sub.submittedAt ? new Date(sub.submittedAt).toISOString() : "",
        ...columns.map((c) => escapeCSV(formData[c.key])),
        payment?.status ?? "—",
        payment
          ? `${(payment.amount / 100).toFixed(2)} ${payment.currency}`
          : "—",
      ].join(",");
    });

    const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    return csv;
  });
