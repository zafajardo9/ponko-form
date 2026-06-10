import { createServerFn } from "@tanstack/react-start";
import { auth } from "@clerk/tanstack-react-start/server";
import { db } from "../../db/index";
import {
  formSubmissions,
  forms,
  formFields,
  flows,
  flowNodes,
  payments,
  profiles,
} from "../../db/schema";
import { eq, desc, inArray } from "drizzle-orm";

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

    const submissions = await db
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.formId, data.formId))
      .orderBy(desc(formSubmissions.submittedAt))
      .limit(limit)
      .offset(offset);

    const columns = await getResponseColumns(data.formId);

    // Attach payment status to each submission (for flow-backed forms).
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

    return {
      submissions,
      columns,
      form,
      paymentMap: Object.fromEntries(paymentMap),
    };
  });
