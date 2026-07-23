import { and, desc, eq, isNull, lt, lte, or, sql } from 'drizzle-orm'
import { db } from '../../db/index'
import {
  emailDeliveryLogs,
  formConfirmationConfigs,
  formInvoiceConfigs,
  formSubmissions,
  forms,
  paymentGateways,
  payments,
  type EmailTemplateKind,
  type EmailTemplateSnapshot,
} from '../../db/schema'
import { sendTransactionalEmail } from '../email/transactional'
import {
  EMAIL_DELIVERY_LEASE_MS,
  EMAIL_DELIVERY_RETRY_COOLDOWN_MS,
  MAX_EMAIL_DELIVERY_ATTEMPTS,
} from './delivery-state'
import { formatDate, formatMoney, renderTemplateMessage } from './template'
import type { InvoiceTemplateContext } from './types'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function completedPaymentForSubmission(submissionId: number) {
  const [payment] = await db
    .select({
      id: payments.id,
      amount: payments.amount,
      paidAmount: payments.paidAmount,
      currency: payments.currency,
      paidAt: payments.paidAt,
      gatewayPaymentId: payments.gatewayPaymentId,
      paymentMethod: payments.paymentMethod,
      gatewayName: paymentGateways.name,
    })
    .from(payments)
    .innerJoin(paymentGateways, eq(payments.paymentGatewayId, paymentGateways.id))
    .where(and(eq(payments.formSubmissionId, submissionId), eq(payments.status, 'completed')))
    .orderBy(desc(payments.id))
    .limit(1)
  return payment ?? null
}

async function allocateInvoiceNumber(configId: number, deliveryId: number) {
  const [allocated] = await db
    .update(formInvoiceConfigs)
    .set({
      nextInvoiceNumber: sql`${formInvoiceConfigs.nextInvoiceNumber} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(formInvoiceConfigs.id, configId))
    .returning({
      prefix: formInvoiceConfigs.invoicePrefix,
      nextNumber: formInvoiceConfigs.nextInvoiceNumber,
    })
  if (!allocated) throw new Error('Invoice configuration was removed')
  const invoiceNumber = `${allocated.prefix}${allocated.nextNumber - 1}`
  await db
    .update(emailDeliveryLogs)
    .set({ invoiceNumber, updatedAt: new Date() })
    .where(eq(emailDeliveryLogs.id, deliveryId))
  return invoiceNumber
}

async function deliveryContext(deliveryId: number) {
  const [row] = await db
    .select({
      delivery: emailDeliveryLogs,
      submission: formSubmissions,
      form: forms,
    })
    .from(emailDeliveryLogs)
    .innerJoin(formSubmissions, eq(emailDeliveryLogs.formSubmissionId, formSubmissions.id))
    .innerJoin(forms, eq(emailDeliveryLogs.formId, forms.id))
    .where(eq(emailDeliveryLogs.id, deliveryId))
    .limit(1)
  if (!row) throw new Error('Delivery not found')
  const payment = row.delivery.paymentId
    ? await completedPaymentForSubmission(row.submission.id)
    : null
  const context: InvoiceTemplateContext = {
    values: row.submission.formData,
    formTitle: row.form.title,
    submissionId: row.submission.id,
    submittedAt: row.submission.submittedAt,
    invoiceNumber: row.delivery.invoiceNumber ?? undefined,
    ...(payment ? {
      paymentAmount: formatMoney(payment.paidAmount ?? payment.amount, payment.currency),
      paymentCurrency: payment.currency.toUpperCase(),
      paymentDate: formatDate(payment.paidAt ?? row.submission.submittedAt),
      paymentGateway: payment.paymentMethod || payment.gatewayName,
      paymentId: payment.gatewayPaymentId ?? String(payment.id),
    } : {}),
  }
  return { ...row, context }
}

export async function attemptEmailDelivery(deliveryId: number) {
  const now = new Date()
  const retryBefore = new Date(now.getTime() - EMAIL_DELIVERY_RETRY_COOLDOWN_MS)
  const staleLeaseBefore = new Date(now.getTime() - EMAIL_DELIVERY_LEASE_MS)
  const [claimed] = await db
    .update(emailDeliveryLogs)
    .set({
      status: 'sending',
      attemptCount: sql`${emailDeliveryLogs.attemptCount} + 1`,
      lastAttemptAt: now,
      errorMessage: null,
      updatedAt: now,
    })
    .where(and(
      eq(emailDeliveryLogs.id, deliveryId),
      lt(emailDeliveryLogs.attemptCount, MAX_EMAIL_DELIVERY_ATTEMPTS),
      or(
        eq(emailDeliveryLogs.status, 'queued'),
        and(
          eq(emailDeliveryLogs.status, 'failed'),
          or(
            isNull(emailDeliveryLogs.lastAttemptAt),
            lte(emailDeliveryLogs.lastAttemptAt, retryBefore),
          ),
        ),
        and(
          eq(emailDeliveryLogs.status, 'sending'),
          or(
            isNull(emailDeliveryLogs.lastAttemptAt),
            lte(emailDeliveryLogs.lastAttemptAt, staleLeaseBefore),
          ),
        ),
      ),
    ))
    .returning({
      id: emailDeliveryLogs.id,
      formId: emailDeliveryLogs.formId,
      templateKind: emailDeliveryLogs.templateKind,
      invoiceNumber: emailDeliveryLogs.invoiceNumber,
    })
  if (!claimed) return null

  try {
    if (claimed.templateKind === 'invoice' && !claimed.invoiceNumber) {
      const [config] = await db
        .select({ id: formInvoiceConfigs.id })
        .from(formInvoiceConfigs)
        .where(and(
          eq(formInvoiceConfigs.formId, claimed.formId),
          eq(formInvoiceConfigs.enabled, true),
        ))
        .limit(1)
      if (!config) throw new Error('Invoice configuration is unavailable')
      await allocateInvoiceNumber(config.id, deliveryId)
    }
    const { delivery, form, context } = await deliveryContext(deliveryId)
    if (!EMAIL_PATTERN.test(delivery.recipientEmail)) {
      throw new Error('Could not resolve a valid respondent email address')
    }
    const message = renderTemplateMessage(delivery.templateKind, delivery.templateSnapshot, context)
    const result = await sendTransactionalEmail(form.profileId, {
      recipient: delivery.recipientEmail,
      fromName: delivery.templateSnapshot.fromName,
      idempotencyKey: `submission-delivery/${delivery.id}`,
      ...message,
    })
    const [sent] = await db
      .update(emailDeliveryLogs)
      .set({
        status: 'sent',
        subject: message.subject,
        provider: result.provider,
        messageId: result.messageId,
        errorMessage: null,
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(emailDeliveryLogs.id, deliveryId),
        eq(emailDeliveryLogs.status, 'sending'),
        eq(emailDeliveryLogs.lastAttemptAt, now),
      ))
      .returning()
    return sent
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Email delivery failed'
    const [failed] = await db
      .update(emailDeliveryLogs)
      .set({ status: 'failed', errorMessage: errorMessage.slice(0, 1000), updatedAt: new Date() })
      .where(and(
        eq(emailDeliveryLogs.id, deliveryId),
        eq(emailDeliveryLogs.status, 'sending'),
        eq(emailDeliveryLogs.lastAttemptAt, now),
      ))
      .returning()
    console.error(`[email-delivery:${deliveryId}] ${errorMessage}`)
    return failed
  }
}

export async function dispatchSubmissionEmails(submissionId: number) {
  const [submission] = await db
    .select({ submission: formSubmissions, form: forms })
    .from(formSubmissions)
    .innerJoin(forms, eq(formSubmissions.formId, forms.id))
    .where(and(eq(formSubmissions.id, submissionId), eq(formSubmissions.status, 'completed')))
    .limit(1)
  if (!submission) return null

  const payment = await completedPaymentForSubmission(submissionId)
  let kind: EmailTemplateKind
  let respondentEmailField: string | null
  let snapshot: EmailTemplateSnapshot

  if (payment) {
    const [config] = await db
      .select()
      .from(formInvoiceConfigs)
      .where(and(eq(formInvoiceConfigs.formId, submission.form.id), eq(formInvoiceConfigs.enabled, true)))
      .limit(1)
    if (!config) return null
    kind = 'invoice'
    respondentEmailField = config.respondentEmailField
    snapshot = {
      subjectTemplate: config.subjectTemplate,
      bodyTemplate: config.bodyTemplate,
      bodyTemplatePlain: config.bodyTemplatePlain,
      fromName: config.fromName,
      logoUrl: config.logoUrl,
      accentColor: config.accentColor,
      includePaymentDetails: config.includePaymentDetails,
      includeLineItems: config.includeLineItems,
      lineItemFields: config.lineItemFields,
    }
  } else {
    const [config] = await db
      .select()
      .from(formConfirmationConfigs)
      .where(and(
        eq(formConfirmationConfigs.formId, submission.form.id),
        eq(formConfirmationConfigs.enabled, true),
      ))
      .limit(1)
    if (!config) return null
    kind = 'confirmation'
    respondentEmailField = config.respondentEmailField
    snapshot = {
      subjectTemplate: config.subjectTemplate,
      bodyTemplate: config.bodyTemplate,
      bodyTemplatePlain: config.bodyTemplatePlain,
      fromName: config.fromName,
    }
  }

  const rawRecipient = respondentEmailField
    ? submission.submission.formData[respondentEmailField]
    : null
  const recipientEmail = typeof rawRecipient === 'string' ? rawRecipient.trim() : '(missing)'
  const [created] = await db
    .insert(emailDeliveryLogs)
    .values({
      formId: submission.form.id,
      formSubmissionId: submission.submission.id,
      paymentId: payment?.id ?? null,
      templateKind: kind,
      recipientEmail,
      subject: snapshot.subjectTemplate.slice(0, 255),
      templateSnapshot: snapshot,
      status: 'queued',
    })
    .onConflictDoNothing({
      target: [emailDeliveryLogs.formSubmissionId, emailDeliveryLogs.templateKind],
    })
    .returning()

  const delivery = created ?? (await db
    .select()
    .from(emailDeliveryLogs)
    .where(and(
      eq(emailDeliveryLogs.formSubmissionId, submission.submission.id),
      eq(emailDeliveryLogs.templateKind, kind),
    ))
    .limit(1))[0]
  if (!delivery || delivery.status === 'sent') return delivery ?? null
  return attemptEmailDelivery(delivery.id)
}
