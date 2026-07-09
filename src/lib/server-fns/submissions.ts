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
import { eq, desc, asc, inArray, sql, and } from "drizzle-orm";

/** A response column: the key to read from a submission's formData + its label. */
export interface ResponseColumn {
  key: string;
  label: string;
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
    return submission;
  });

export const getSubmissions = createServerFn({ method: "GET", strict: false })
  .inputValidator(
    (data: {
      formId: number;
      page?: number;
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

    const page = data.page ?? 1;
    const limit = 50;
    const offset = (page - 1) * limit;

    // Build WHERE conditions
    const whereConditions: ReturnType<typeof eq>[] = [
      eq(formSubmissions.formId, data.formId),
    ];

    // Apply filters
    if (data.filters) {
      for (const [key, value] of Object.entries(data.filters)) {
        if (value == null || value === "") continue;

        if (key === "payment_status" && typeof value === "string") {
          // Payment status filter is handled post-query via paymentMap
        } else if (key === "submitted_at") {
          // Date range filter
          if (typeof value === "object" && value !== null) {
            const range = value as { from?: string; to?: string };
            if (range.from) {
              whereConditions.push(
                sql`${formSubmissions.submittedAt} >= ${new Date(range.from)}`,
              );
            }
            if (range.to) {
              // End of day for "to" date
              const toDate = new Date(range.to);
              toDate.setHours(23, 59, 59, 999);
              whereConditions.push(
                sql`${formSubmissions.submittedAt} <= ${toDate}`,
              );
            }
          }
        } else if (key === "status" && typeof value === "string") {
          whereConditions.push(sql`${formSubmissions.status} = ${value}`);
        } else if (typeof value === "string") {
          // Text / form data field filter — jsonb contains (case-insensitive)
          whereConditions.push(
            sql`LOWER(${formSubmissions.formData}->>${sql.raw(key)}) LIKE LOWER(${"%" + value + "%"})`,
          );
        }
      }
    }

    // Global search across all formData values
    if (data.search && data.search.trim()) {
      const searchTerm = `%${data.search.trim()}%`;
      whereConditions.push(
        sql`LOWER(${formSubmissions.formData}::text) LIKE LOWER(${searchTerm})`,
      );
    }

    // Build ORDER BY
    const sortKey = data.sortKey ?? "submitted_at";
    const sortDir = data.sortDir ?? "desc";

    let orderByClause:
      | ReturnType<typeof desc>
      | ReturnType<typeof asc>
      | ReturnType<typeof sql>;
    if (sortKey === "submitted_at") {
      orderByClause =
        sortDir === "desc"
          ? desc(formSubmissions.submittedAt)
          : asc(formSubmissions.submittedAt);
    } else if (sortKey === "status") {
      orderByClause =
        sortDir === "desc"
          ? desc(formSubmissions.status)
          : asc(formSubmissions.status);
    } else {
      // Form data JSONB field sorting
      orderByClause = sql`${formSubmissions.formData}->>${sql.raw(sortKey)} ${sql.raw(sortDir.toUpperCase())}`;
    }

    // Count total for pagination
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(formSubmissions)
      .where(and(...whereConditions));

    const totalCount = countResult?.count ?? 0;

    // Fetch submissions
    const submissions = await db
      .select()
      .from(formSubmissions)
      .where(and(...whereConditions))
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    const columns = await getResponseColumns(data.formId);

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
          paymentMap.set(p.submissionId, {
            status: p.status,
            amount: p.amount,
            currency: p.currency,
          });
        }
      }
    }

    // Post-filter by payment_status if needed
    let filteredSubmissions = submissions;
    if (
      data.filters?.payment_status &&
      typeof data.filters.payment_status === "string"
    ) {
      const targetStatus = data.filters.payment_status;
      filteredSubmissions = submissions.filter((sub) => {
        const payment = paymentMap.get(sub.id);
        if (targetStatus === "none") return !payment;
        return payment?.status === targetStatus;
      });
    }

    return {
      submissions: filteredSubmissions,
      columns,
      form,
      paymentMap: Object.fromEntries(paymentMap),
      totalCount,
    };
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

    // Build WHERE conditions (same as getSubmissions but no pagination)
    const whereConditions: ReturnType<typeof eq>[] = [
      eq(formSubmissions.formId, data.formId),
    ];

    if (data.filters) {
      for (const [key, value] of Object.entries(data.filters)) {
        if (value == null || value === "") continue;
        if (key === "payment_status") continue; // post-filter
        if (key === "submitted_at") {
          if (typeof value === "object" && value !== null) {
            const range = value as { from?: string; to?: string };
            if (range.from) {
              whereConditions.push(
                sql`${formSubmissions.submittedAt} >= ${new Date(range.from)}`,
              );
            }
            if (range.to) {
              const toDate = new Date(range.to);
              toDate.setHours(23, 59, 59, 999);
              whereConditions.push(
                sql`${formSubmissions.submittedAt} <= ${toDate}`,
              );
            }
          }
        } else if (key === "status" && typeof value === "string") {
          whereConditions.push(sql`${formSubmissions.status} = ${value}`);
        } else if (typeof value === "string") {
          whereConditions.push(
            sql`LOWER(${formSubmissions.formData}->>${sql.raw(key)}) LIKE LOWER(${"%" + value + "%"})`,
          );
        }
      }
    }

    if (data.search && data.search.trim()) {
      const searchTerm = `%${data.search.trim()}%`;
      whereConditions.push(
        sql`LOWER(${formSubmissions.formData}::text) LIKE LOWER(${searchTerm})`,
      );
    }

    // Build ORDER BY
    const sortKey = data.sortKey ?? "submitted_at";
    const sortDir = data.sortDir ?? "desc";
    let orderByClause:
      | ReturnType<typeof desc>
      | ReturnType<typeof asc>
      | ReturnType<typeof sql>;
    if (sortKey === "submitted_at") {
      orderByClause =
        sortDir === "desc"
          ? desc(formSubmissions.submittedAt)
          : asc(formSubmissions.submittedAt);
    } else if (sortKey === "status") {
      orderByClause =
        sortDir === "desc"
          ? desc(formSubmissions.status)
          : asc(formSubmissions.status);
    } else {
      orderByClause = sql`${formSubmissions.formData}->>${sql.raw(sortKey)} ${sql.raw(sortDir.toUpperCase())}`;
    }

    const submissions = await db
      .select()
      .from(formSubmissions)
      .where(and(...whereConditions))
      .orderBy(orderByClause);

    const columns = await getResponseColumns(data.formId);

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
          paymentMap.set(p.submissionId, {
            status: p.status,
            amount: p.amount,
            currency: p.currency,
          });
        }
      }
    }

    // Post-filter
    let filteredSubmissions = submissions;
    if (
      data.filters?.payment_status &&
      typeof data.filters.payment_status === "string"
    ) {
      const targetStatus = data.filters.payment_status;
      filteredSubmissions = submissions.filter((sub) => {
        const payment = paymentMap.get(sub.id);
        if (targetStatus === "none") return !payment;
        return payment?.status === targetStatus;
      });
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

    const rows = filteredSubmissions.map((sub, i) => {
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
