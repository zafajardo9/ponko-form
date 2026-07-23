import { and, eq, sql } from 'drizzle-orm'
import { db } from '../../db/index'
import {
  flowExecutions,
  formSubmissions,
} from '../../db/schema'

export async function ensureFlowSubmissionDraft(
  execution: typeof flowExecutions.$inferSelect,
  formId: number,
  status: 'incomplete' | 'pending_payment',
): Promise<number> {
  if (execution.formSubmissionId) return execution.formSubmissionId
  if (!execution.clientToken) throw new Error('Execution token not found')

  const [draft] = await db
    .insert(formSubmissions)
    .values({
      formId,
      formData: execution.variables as Record<string, unknown>,
      status,
    })
    .returning({ id: formSubmissions.id })
  const [claimed] = await db
    .update(flowExecutions)
    .set({ formSubmissionId: draft.id })
    .where(
      and(
        eq(flowExecutions.id, execution.id),
        eq(flowExecutions.clientToken, execution.clientToken),
        sql`${flowExecutions.formSubmissionId} IS NULL`,
      ),
    )
    .returning({ id: flowExecutions.id })
  if (claimed) return draft.id

  await db.delete(formSubmissions).where(eq(formSubmissions.id, draft.id))
  const [current] = await db
    .select({ submissionId: flowExecutions.formSubmissionId })
    .from(flowExecutions)
    .where(
      and(
        eq(flowExecutions.id, execution.id),
        eq(flowExecutions.clientToken, execution.clientToken),
      ),
    )
    .limit(1)
  if (!current?.submissionId) {
    throw new Error('Could not initialize flow response')
  }
  return current.submissionId
}
