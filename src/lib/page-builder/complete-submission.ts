import { and, eq, sql } from 'drizzle-orm'
import { db } from '../../db/index'
import {
  formSubmissionSessions,
  formSubmissions,
  emailSurveyInvitations,
  payments,
} from '../../db/schema'
import {
  missingAddressParts,
  pruneHiddenValues,
  validateFieldRules,
  visibleFields,
} from './conditions'
import { applyComputedFieldValues, buildReferenceMap } from './references'
import { hydratePages, loadFormReferences } from './server-data'
import type { PageField } from './types'
import {
  replaceRecaptchaTokensWithResult,
  verifiedRecaptchaFieldIds,
  verifyRecaptchaFields,
} from '../integrations/recaptcha'
import { dispatchSubmissionEmails } from '../invoicing/delivery'
import { ensurePageSubmissionDraft } from './submission-draft'

function pageFieldValueIsEmpty(field: PageField, value: unknown) {
  if (field.fieldType === 'address') {
    return missingAddressParts(field, value).length > 0
  }
  return value == null ||
    (Array.isArray(value) ? value.length === 0 : String(value).trim() === '')
}

export async function completePageSubmissionRecord(
  sessionId: number,
  collectedData: Record<string, unknown>,
) {
  const [session] = await db
    .select()
    .from(formSubmissionSessions)
    .where(eq(formSubmissionSessions.id, sessionId))
    .limit(1)
  if (!session) throw new Error('Session not found')
  if (session.status === 'completed' && session.formSubmissionId) {
    const [submission] = await db.select().from(formSubmissions)
      .where(eq(formSubmissions.id, session.formSubmissionId))
      .limit(1)
    if (submission) return { session, submission }
  }
  const pages = await hydratePages(session.formId)
  const references = await loadFormReferences(session.formId)
  const referenceMap = buildReferenceMap(references)
  const allFields = pages.flatMap((page) => page.fields)
  const withComputations = applyComputedFieldValues(allFields, collectedData, references)
  const pruned = pruneHiddenValues(allFields, withComputations, referenceMap)
  const verifiedFieldIds = await verifyRecaptchaFields(
    session.formId,
    visibleFields(allFields, pruned, referenceMap),
    pruned,
    verifiedRecaptchaFieldIds((session.collectedData ?? {}) as Record<string, unknown>),
  )
  const paymentPage = pages.find((page) => page.hasPayment)
  if (paymentPage) {
    const meta = (session.collectedData ?? {}) as Record<string, unknown>
    const paymentId = Number(meta.__paymentId)
    if (!Number.isFinite(paymentId)) {
      throw new Error('Payment is required before submitting this form.')
    }
    const [payment] = await db
      .select({ status: payments.status })
      .from(payments)
      .where(
        and(
          eq(payments.id, paymentId),
          eq(payments.pageSessionId, session.id),
        ),
      )
      .limit(1)
    if (payment?.status !== 'completed') {
      throw new Error('Payment has not been completed yet.')
    }
  }

  for (const field of visibleFields(allFields, pruned, referenceMap)) {
    const value = pruned[field.bindVariable]
    const empty = field.fieldType === 'recaptcha' && verifiedFieldIds.includes(field.id)
      ? false
      : pageFieldValueIsEmpty(field, value)
    if (field.required && empty) {
      const missing = field.fieldType === 'address' ? missingAddressParts(field, value) : []
      throw new Error(
        missing.length > 0
          ? `Field "${field.label}" is missing: ${missing.join(', ')}`
          : `Field "${field.label}" is required`,
      )
    }
    const ruleError = validateFieldRules(field, value)
    if (!empty && ruleError) throw new Error(ruleError)
  }

  const finalFormData = {
    ...referenceMap,
    ...replaceRecaptchaTokensWithResult(pages, pruned, verifiedFieldIds),
  }
  const submissionId = await ensurePageSubmissionDraft(session, 'incomplete')
  const [submission] = await db
    .update(formSubmissions)
    .set({ formData: finalFormData, status: 'completed', submittedAt: new Date() })
    .where(and(eq(formSubmissions.id, submissionId), eq(formSubmissions.formId, session.formId)))
    .returning()
  if (!submission) throw new Error('Form response not found')

  const meta = (session.collectedData ?? {}) as Record<string, unknown>
  const paymentId = Number(meta.__paymentId)
  if (Number.isFinite(paymentId)) {
    await db
      .update(payments)
      .set({ formSubmissionId: submission.id })
      .where(
        and(
          eq(payments.id, paymentId),
          eq(payments.pageSessionId, session.id),
        ),
      )
  }
  if (session.emailSurveyInvitationId) {
    await db
      .update(emailSurveyInvitations)
      .set({
        formSubmissionId: submission.id,
        usedAt: sql`coalesce(${emailSurveyInvitations.usedAt}, now())`,
      })
      .where(eq(emailSurveyInvitations.id, session.emailSurveyInvitationId))
  }

  const [updated] = await db
    .update(formSubmissionSessions)
    .set({
      formSubmissionId: submission.id,
      collectedData: finalFormData,
      status: 'completed',
      currentPageIndex: pages.length - 1,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(formSubmissionSessions.id, session.id))
    .returning()
  await dispatchSubmissionEmails(submission.id).catch((error) => {
    console.error(`[submission:${submission.id}] Email dispatch failed`, error)
  })
  return { session: updated, submission }
}

export async function completePaidPageSubmission(sessionId: number) {
  const [session] = await db
    .select({ collectedData: formSubmissionSessions.collectedData })
    .from(formSubmissionSessions)
    .where(eq(formSubmissionSessions.id, sessionId))
    .limit(1)
  if (!session) throw new Error('Session not found')
  return completePageSubmissionRecord(
    sessionId,
    (session.collectedData ?? {}) as Record<string, unknown>,
  )
}
