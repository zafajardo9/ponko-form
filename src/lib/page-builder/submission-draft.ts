import { and, eq, sql } from 'drizzle-orm'
import { db } from '../../db/index'
import {
  formSubmissionSessions,
  formSubmissions,
} from '../../db/schema'

export async function ensurePageSubmissionDraft(
  session: typeof formSubmissionSessions.$inferSelect,
  status: 'incomplete' | 'pending_payment',
): Promise<number> {
  if (session.formSubmissionId) return session.formSubmissionId
  const [draft] = await db
    .insert(formSubmissions)
    .values({
      formId: session.formId,
      formData: session.collectedData as Record<string, unknown>,
      status,
    })
    .returning({ id: formSubmissions.id })
  const [claimed] = await db
    .update(formSubmissionSessions)
    .set({ formSubmissionId: draft.id, updatedAt: new Date() })
    .where(
      and(
        eq(formSubmissionSessions.id, session.id),
        sql`${formSubmissionSessions.formSubmissionId} IS NULL`,
      ),
    )
    .returning({ id: formSubmissionSessions.id })
  if (claimed) return draft.id

  await db.delete(formSubmissions).where(eq(formSubmissions.id, draft.id))
  const [current] = await db
    .select({ submissionId: formSubmissionSessions.formSubmissionId })
    .from(formSubmissionSessions)
    .where(eq(formSubmissionSessions.id, session.id))
    .limit(1)
  if (!current?.submissionId) {
    throw new Error('Could not initialize form response')
  }
  return current.submissionId
}
