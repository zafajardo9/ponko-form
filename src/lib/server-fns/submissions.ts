import { createServerFn } from "@tanstack/react-start";
import { auth } from "@clerk/tanstack-react-start/server";
import { db } from "../../db/index";
import {
  formSubmissions,
  forms,
  formFields,
  payments,
  profiles,
} from "../../db/schema";
import {
  eq,
  inArray,
  sql,
  and,
} from "drizzle-orm";
import { dispatchSubmissionEmails } from "../invoicing/delivery";
import { sanitizeLegacySubmission } from "../legacy-submission";
import { isValidPublicSessionToken } from "../public-session-access";
export type { ResponseColumn } from "../submissions/response-columns";

function paymentStatusPriority(status: string) {
  return status === 'refunded' ? 4 : status === 'completed' ? 3 : status === 'pending' ? 2 : 1
}

const allowedPageSizes = new Set([10, 25, 50, 100]);

export function normalizeSubmissionPageSize(value?: number) {
  return value && allowedPageSizes.has(value) ? value : 25;
}

export const submitFormResponse = createServerFn({
  method: "POST",
  strict: false,
})
  .validator(
    (data: {
      formId: number;
      clientToken: string;
      formData: Record<string, unknown>;
    }) => data,
  )
  .handler(async ({ data }) => {
    if (!isValidPublicSessionToken(data.clientToken)) {
      throw new Error("Invalid submission token");
    }
    const [[form], fields] = await Promise.all([
      db
        .select()
        .from(forms)
        .where(eq(forms.id, data.formId))
        .limit(1),
      db
        .select()
        .from(formFields)
        .where(eq(formFields.formId, data.formId))
        .orderBy(formFields.order),
    ]);
    if (!form || form.status !== "published")
      throw new Error("Form not found or not published");

    const formData = sanitizeLegacySubmission(fields, data.formData);

    const [created] = await db
      .insert(formSubmissions)
      .values({
        formId: data.formId,
        clientToken: data.clientToken,
        formData,
        status: "completed",
      })
      .onConflictDoNothing({
        target: [formSubmissions.formId, formSubmissions.clientToken],
      })
      .returning({ id: formSubmissions.id });
    const submission = created ?? (await db
      .select({ id: formSubmissions.id })
      .from(formSubmissions)
      .where(
        and(
          eq(formSubmissions.formId, data.formId),
          eq(formSubmissions.clientToken, data.clientToken),
        ),
      )
      .limit(1))[0];
    if (!submission) throw new Error("Could not record form response");
    await dispatchSubmissionEmails(submission.id).catch((error) => {
      console.error(`[submission:${submission.id}] Email dispatch failed`, error);
    });
    return { success: true };
  });

export const getSubmissions = createServerFn({ method: "GET", strict: false })
  .validator(
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

    const {
      buildSubmissionOrderBy,
      buildSubmissionWhereConditions,
      getResponseColumns,
      publicSubmissionSelection,
      requireOwnedForm,
    } = await import("../submissions/response-query.server");
    const form = await requireOwnedForm(data.formId, userId);

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
        .select(publicSubmissionSelection)
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
  .validator(
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
  .validator((data: { formId: number; submissionId: number }) => data)
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
