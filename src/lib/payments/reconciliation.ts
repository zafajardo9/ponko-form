import { createHash } from 'node:crypto'
import { and, desc, eq, inArray, isNull, lt, or } from 'drizzle-orm'
import { db } from '../../db/index'
import {
  flowExecutions,
  flows,
  formSubmissionSessions,
  formSubmissions,
  forms,
  paymentEvents,
  paymentGateways,
  payments,
} from '../../db/schema'
import { paymentRegistry } from '../../integrations/payments/index'
import type { GatewayCredentials, PaymentDetails, PaymentStatus } from '../../integrations/payments/types'
import {
  loadIntegrationConfigs,
  paypalCredentialsForEnvironment,
  xenditCredentialsForEnvironment,
} from '../integrations/credentials'
import type { PaymentEnvironment } from '../integrations/types'
import { nextPaymentStatus, paymentOwnerStatus, sanitizePaymentPayload } from './reconciliation-utils'

export type VerificationSource = 'webhook' | 'return' | 'reconciliation' | 'manual'

function eventKey(input: {
  gatewayEventId?: string | null
  gatewayPaymentId: string
  eventType: string
  providerStatus?: string | null
  providerTimestamp?: string | null
}) {
  return createHash('sha256').update([
    input.gatewayEventId,
    input.gatewayPaymentId,
    input.eventType,
    input.providerStatus,
    input.providerTimestamp,
  ].filter(Boolean).join('|')).digest('hex')
}

function credentialsForSlug(
  slug: string,
  configs: Awaited<ReturnType<typeof loadIntegrationConfigs>>,
  environment: PaymentEnvironment,
): GatewayCredentials | null {
  if (slug === 'xendit' && configs.xendit) {
    const credentials = xenditCredentialsForEnvironment(configs.xendit, environment)
    return credentials ? { ...credentials, mode: environment } : null
  }
  if (slug === 'paypal' && configs.paypal) {
    const credentials = paypalCredentialsForEnvironment(configs.paypal, environment)
    return credentials ? { ...credentials, mode: environment } : null
  }
  return null
}

function paymentEnvironment(payment: typeof payments.$inferSelect): PaymentEnvironment | null {
  const response = payment.gatewayResponse as Record<string, unknown> | null
  return response?.environment === 'live' || response?.environment === 'sandbox'
    ? response.environment
    : null
}

async function paymentOwnerProfileId(payment: typeof payments.$inferSelect): Promise<number> {
  if (payment.pageSessionId) {
    const [row] = await db.select({ profileId: forms.profileId })
      .from(formSubmissionSessions)
      .innerJoin(forms, eq(formSubmissionSessions.formId, forms.id))
      .where(eq(formSubmissionSessions.id, payment.pageSessionId)).limit(1)
    if (row) return row.profileId
  }
  if (payment.flowExecutionId) {
    const [row] = await db.select({ profileId: forms.profileId })
      .from(flowExecutions)
      .innerJoin(flows, eq(flowExecutions.flowId, flows.id))
      .innerJoin(forms, eq(flows.formId, forms.id))
      .where(eq(flowExecutions.id, payment.flowExecutionId)).limit(1)
    if (row) return row.profileId
  }
  throw new Error('Payment owner could not be resolved')
}

async function markRecoverableResponse(payment: typeof payments.$inferSelect, status: PaymentStatus) {
  if (!payment.formSubmissionId) return
  if (status === 'completed') {
    await db.update(formSubmissions).set({ status: 'incomplete' })
      .where(and(
        eq(formSubmissions.id, payment.formSubmissionId),
        inArray(formSubmissions.status, ['pending_payment', 'payment_failed']),
      ))
  } else if (status === 'failed') {
    await db.update(formSubmissions).set({ status: 'payment_failed' })
      .where(and(eq(formSubmissions.id, payment.formSubmissionId), eq(formSubmissions.status, 'pending_payment')))
  }
}

async function syncPaymentOwnerStatus(payment: typeof payments.$inferSelect, status: PaymentStatus) {
  const ownerStatus = paymentOwnerStatus(status)
  if (!ownerStatus) return
  if (payment.pageSessionId) {
    await db.update(formSubmissionSessions)
      .set({ status: ownerStatus, updatedAt: new Date() })
      .where(eq(formSubmissionSessions.id, payment.pageSessionId))
  }
  if (payment.flowExecutionId && status === 'failed') {
    await db.update(flowExecutions)
      .set({ status: 'payment_failed' })
      .where(eq(flowExecutions.id, payment.flowExecutionId))
  }
}

export async function reconcilePayment(input: {
  paymentId: number
  source: VerificationSource
  eventType?: string
  gatewayEventId?: string | null
  providerTimestamp?: string | null
  payload?: unknown
  forcedStatus?: PaymentStatus
  expectedProfileId?: number
}) {
  const [row] = await db.select({ payment: payments, slug: paymentGateways.slug })
    .from(payments)
    .innerJoin(paymentGateways, eq(payments.paymentGatewayId, paymentGateways.id))
    .where(eq(payments.id, input.paymentId)).limit(1)
  if (!row?.payment.gatewayPaymentId) throw new Error('Payment reference is unavailable')

  const profileId = await paymentOwnerProfileId(row.payment)
  if (input.expectedProfileId != null && profileId !== input.expectedProfileId) {
    throw new Error('Payment does not belong to this webhook endpoint')
  }
  const gateway = paymentRegistry.get(row.slug)
  if (!gateway) throw new Error(`Unknown payment gateway: ${row.slug}`)
  const configs = await loadIntegrationConfigs(profileId)
  const environment = paymentEnvironment(row.payment) ?? (
    row.slug === 'xendit' ? configs.xendit?.mode : configs.paypal?.mode
  ) ?? 'sandbox'
  const credentials = credentialsForSlug(row.slug, configs, environment)
  if (!credentials) throw new Error('Gateway credentials are unavailable')

  let details: PaymentDetails
  if (input.forcedStatus === 'refunded') {
    details = { status: 'refunded', providerStatus: 'REFUNDED' }
  } else {
    details = await gateway.getPaymentDetails(row.payment.gatewayPaymentId, credentials)
    if (details.amount != null && details.amount !== row.payment.amount) throw new Error('Provider amount mismatch')
    if (details.currency && details.currency !== row.payment.currency) throw new Error('Provider currency mismatch')
  }

  const normalized = nextPaymentStatus(row.payment.status, input.forcedStatus ?? details.status)
  const sanitizedPayload = sanitizePaymentPayload(input.payload ?? details.raw)
  const key = eventKey({
    gatewayEventId: input.gatewayEventId,
    gatewayPaymentId: row.payment.gatewayPaymentId,
    eventType: input.eventType ?? 'payment.verification',
    providerStatus: details.providerStatus,
    providerTimestamp: input.providerTimestamp,
  })
  const [createdEvent] = await db.insert(paymentEvents).values({
    paymentId: row.payment.id,
    eventKey: key,
    gatewayEventId: input.gatewayEventId,
    eventType: input.eventType ?? 'payment.verification',
    providerStatus: details.providerStatus,
    normalizedStatus: normalized,
    source: input.source,
    payload: sanitizedPayload,
    processingStatus: normalized === row.payment.status ? 'ignored' : 'processed',
    processedAt: new Date(),
  }).onConflictDoNothing({ target: paymentEvents.eventKey }).returning({ id: paymentEvents.id })

  if (!createdEvent) {
    await syncPaymentOwnerStatus(row.payment, row.payment.status)
    return { status: row.payment.status, duplicate: true, paymentId: row.payment.id }
  }

  const now = new Date()
  await db.update(payments).set({
    status: normalized,
    paidAmount: details.paidAmount ?? (normalized === 'completed' ? row.payment.amount : row.payment.paidAmount),
    paymentMethod: details.paymentMethod ?? row.payment.paymentMethod,
    paymentChannel: details.paymentChannel ?? row.payment.paymentChannel,
    failureReason: details.failureReason ?? row.payment.failureReason,
    gatewayResponse: {
      ...((row.payment.gatewayResponse as Record<string, unknown> | null) ?? {}),
      ...sanitizedPayload,
      environment,
    },
    verificationSource: input.source,
    lastVerifiedAt: now,
    paidAt: normalized === 'completed' && !row.payment.paidAt ? (details.paidAt ? new Date(details.paidAt) : now) : row.payment.paidAt,
    failedAt: normalized === 'failed' && !row.payment.failedAt ? now : row.payment.failedAt,
    refundedAt: normalized === 'refunded' && !row.payment.refundedAt ? now : row.payment.refundedAt,
    updatedAt: now,
  }).where(eq(payments.id, row.payment.id))
  await markRecoverableResponse(row.payment, normalized)
  await syncPaymentOwnerStatus(row.payment, normalized)

  console.info('[payment-status-reconciled]', {
    paymentId: row.payment.id,
    gatewayPaymentId: row.payment.gatewayPaymentId,
    eventId: createdEvent.id,
    previousStatus: row.payment.status,
    status: normalized,
    source: input.source,
  })
  return { status: normalized, duplicate: false, paymentId: row.payment.id }
}

export async function paymentByGatewayReference(reference: string) {
  const [payment] = await db.select().from(payments)
    .where(or(eq(payments.gatewayPaymentId, reference), eq(payments.externalId, reference)))
    .orderBy(desc(payments.id)).limit(1)
  return payment ?? null
}

export async function reconcileStalePayments(limit = 50) {
  const cutoff = new Date(Date.now() - 10 * 60_000)
  const stale = await db.select({ id: payments.id, pageSessionId: payments.pageSessionId }).from(payments)
    .where(and(
      eq(payments.status, 'pending'),
      or(isNull(payments.lastVerifiedAt), lt(payments.lastVerifiedAt, cutoff)),
    ))
    .orderBy(payments.createdAt)
    .limit(Math.min(Math.max(limit, 1), 100))
  const results = []
  for (const payment of stale) {
    try {
      const result = await reconcilePayment({ paymentId: payment.id, source: 'reconciliation' })
      results.push(result)
      if (payment.pageSessionId && result.status === 'completed') {
        const { completePaidPageSubmission } = await import('../page-builder/complete-submission')
        await completePaidPageSubmission(payment.pageSessionId)
      }
    } catch (error) {
      console.error('[payment-reconciliation-failed]', {
        paymentId: payment.id,
        category: error instanceof Error ? error.name : 'UnknownError',
      })
    }
  }
  return { checked: stale.length, updated: results.filter((result) => !result.duplicate).length }
}
