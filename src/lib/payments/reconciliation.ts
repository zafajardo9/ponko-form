import { createHash } from 'node:crypto'
import { and, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import { db } from '@/db/index'
import {
  flowExecutions,
  flows,
  formSubmissionSessions,
  formSubmissions,
  forms,
  paymentEvents,
  paymentGateways,
  payments,
  subscriptionCycles,
} from '@/db/schema'
import { paymentRegistry } from '@/integrations/payments/index'
import type {
  GatewayCredentials,
  PaymentDetails,
  PaymentStatus,
  SubscriptionCycleDetails,
  SubscriptionCycleStatus,
  SubscriptionPlanStatus,
} from '@/integrations/payments/types'
import {
  loadIntegrationConfigs,
  paypalCredentialsForEnvironment,
  xenditCredentialsForEnvironment,
} from '../integrations/credentials'
import type { PaymentEnvironment } from '../integrations/types'
import {
  nextPaymentStatus,
  nextSubscriptionPlanStatus,
  paymentOwnerStatus,
  sanitizePaymentPayload,
} from './reconciliation-utils'

export type VerificationSource = 'webhook' | 'return' | 'reconciliation' | 'manual'
const PAYMENT_EVENT_LEASE_MS = 5 * 60_000

type PaymentEventInput = Omit<
  typeof paymentEvents.$inferInsert,
  'id' | 'processingStatus' | 'processedAt' | 'receivedAt'
>

async function claimPaymentEvent(event: PaymentEventInput) {
  const now = new Date()
  const [created] = await db.insert(paymentEvents).values({
    ...event,
    processingStatus: 'processing',
    processedAt: now,
  }).onConflictDoNothing({ target: paymentEvents.eventKey }).returning({ id: paymentEvents.id })
  if (created) return { ...created, leaseStartedAt: now }

  const [reclaimed] = await db.update(paymentEvents).set({
    processingStatus: 'processing',
    error: null,
    processedAt: now,
  }).where(and(
    eq(paymentEvents.eventKey, event.eventKey),
    or(
      eq(paymentEvents.processingStatus, 'failed'),
      and(
        eq(paymentEvents.processingStatus, 'processing'),
        lt(paymentEvents.processedAt, new Date(now.getTime() - PAYMENT_EVENT_LEASE_MS)),
      ),
    ),
  )).returning({ id: paymentEvents.id })
  return reclaimed ? { ...reclaimed, leaseStartedAt: now } : null
}

async function completePaymentEvent(
  event: { id: number; leaseStartedAt: Date },
  processingStatus: 'processed' | 'ignored',
) {
  await db.update(paymentEvents).set({
    processingStatus,
    error: null,
    processedAt: new Date(),
  }).where(and(
    eq(paymentEvents.id, event.id),
    eq(paymentEvents.processingStatus, 'processing'),
    eq(paymentEvents.processedAt, event.leaseStartedAt),
  ))
}

async function failPaymentEvent(
  event: { id: number; leaseStartedAt: Date },
  error: unknown,
) {
  const message = error instanceof Error ? error.message : 'Payment event processing failed'
  await db.update(paymentEvents).set({
    processingStatus: 'failed',
    error: message.slice(0, 1000),
    processedAt: new Date(),
  }).where(and(
    eq(paymentEvents.id, event.id),
    eq(paymentEvents.processingStatus, 'processing'),
    eq(paymentEvents.processedAt, event.leaseStartedAt),
  ))
}

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
  if (row.payment.paymentKind === 'subscription') {
    return reconcileSubscriptionPayment(input)
  }

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
  const claimedEvent = await claimPaymentEvent({
    paymentId: row.payment.id,
    eventKey: key,
    gatewayEventId: input.gatewayEventId,
    eventType: input.eventType ?? 'payment.verification',
    providerStatus: details.providerStatus,
    normalizedStatus: normalized,
    source: input.source,
    payload: sanitizedPayload,
  })

  if (!claimedEvent) {
    return { status: row.payment.status, duplicate: true, paymentId: row.payment.id }
  }

  try {
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
    await completePaymentEvent(
      claimedEvent,
      normalized === row.payment.status ? 'ignored' : 'processed',
    )

    console.info('[payment-status-reconciled]', {
      paymentId: row.payment.id,
      gatewayPaymentId: row.payment.gatewayPaymentId,
      eventId: claimedEvent.id,
      previousStatus: row.payment.status,
      status: normalized,
      source: input.source,
    })
    return { status: normalized, duplicate: false, paymentId: row.payment.id }
  } catch (error) {
    await failPaymentEvent(claimedEvent, error)
    throw error
  }
}

async function subscriptionContext(paymentId: number, expectedProfileId?: number) {
  const [row] = await db.select({ payment: payments, slug: paymentGateways.slug })
    .from(payments)
    .innerJoin(paymentGateways, eq(payments.paymentGatewayId, paymentGateways.id))
    .where(eq(payments.id, paymentId))
    .limit(1)
  if (!row?.payment.gatewayPaymentId || row.payment.paymentKind !== 'subscription') {
    throw new Error('Subscription payment reference is unavailable')
  }
  const profileId = await paymentOwnerProfileId(row.payment)
  if (expectedProfileId != null && profileId !== expectedProfileId) {
    throw new Error('Payment does not belong to this webhook endpoint')
  }
  const gateway = paymentRegistry.get(row.slug)
  if (!gateway?.supportsSubscriptions()) throw new Error('Subscription gateway is unavailable')
  const configs = await loadIntegrationConfigs(profileId)
  const environment = paymentEnvironment(row.payment) ?? configs.xendit?.mode ?? 'sandbox'
  const credentials = credentialsForSlug(row.slug, configs, environment)
  if (!credentials) throw new Error('Gateway credentials are unavailable')
  return { ...row, profileId, gateway, environment, credentials }
}

function webhookRecord(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {}
  const root = payload as Record<string, unknown>
  return root.data && typeof root.data === 'object' && !Array.isArray(root.data)
    ? root.data as Record<string, unknown>
    : root
}

function optionalDate(value: unknown) {
  if (typeof value !== 'string' || !value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function normalizedPlanStatus(value: unknown): SubscriptionPlanStatus {
  switch (String(value ?? '').toUpperCase()) {
    case 'ACTIVE': return 'active'
    case 'PAUSED': return 'paused'
    case 'PAST_DUE': return 'past_due'
    case 'COMPLETED': return 'completed'
    case 'CANCELLED':
    case 'CANCELED': return 'cancelled'
    case 'INACTIVE':
    case 'DEACTIVATED': return 'deactivated'
    case 'FAILED': return 'failed'
    default: return 'pending'
  }
}

function normalizedCycleStatus(value: unknown): SubscriptionCycleStatus {
  switch (String(value ?? '').toUpperCase()) {
    case 'SUCCEEDED':
    case 'PAID':
    case 'COMPLETED': return 'paid'
    case 'RETRYING':
    case 'ATTEMPTING': return 'retrying'
    case 'FAILED': return 'failed'
    case 'CANCELLED':
    case 'CANCELED': return 'cancelled'
    case 'SKIPPED': return 'skipped'
    case 'SCHEDULED': return 'scheduled'
    default: return 'pending'
  }
}

async function upsertSubscriptionCycle(
  payment: typeof payments.$inferSelect,
  cycle: SubscriptionCycleDetails,
  source: Exclude<VerificationSource, 'return'>,
) {
  const now = new Date()
  await db.insert(subscriptionCycles).values({
    paymentId: payment.id,
    gatewayCycleId: cycle.gatewayCycleId,
    cycleNumber: cycle.cycleNumber,
    status: cycle.status,
    amount: cycle.amount || payment.amount,
    currency: cycle.currency || payment.currency,
    scheduledAt: optionalDate(cycle.scheduledAt),
    paidAt: optionalDate(cycle.paidAt),
    failedAt: optionalDate(cycle.failedAt),
    failureCode: cycle.failureCode,
    verificationSource: source,
    lastVerifiedAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: subscriptionCycles.gatewayCycleId,
    set: {
      cycleNumber: cycle.cycleNumber,
      status: sql`CASE
        WHEN ${subscriptionCycles.status} IN ('paid', 'cancelled', 'skipped') THEN ${subscriptionCycles.status}
        ELSE ${cycle.status}
      END`,
      amount: cycle.amount || payment.amount,
      currency: cycle.currency || payment.currency,
      scheduledAt: optionalDate(cycle.scheduledAt),
      paidAt: optionalDate(cycle.paidAt),
      failedAt: optionalDate(cycle.failedAt),
      failureCode: cycle.failureCode,
      verificationSource: source,
      lastVerifiedAt: now,
      updatedAt: now,
    },
  })
}

export async function reconcileSubscriptionPayment(input: {
  paymentId: number
  source: VerificationSource
  eventType?: string
  gatewayEventId?: string | null
  providerTimestamp?: string | null
  payload?: unknown
  expectedProfileId?: number
}) {
  const context = await subscriptionContext(input.paymentId, input.expectedProfileId)
  const { payment, gateway, credentials, environment } = context
  const gatewayPaymentId = payment.gatewayPaymentId
  if (!gatewayPaymentId) throw new Error('Subscription payment has no gateway reference')
  const session = await gateway.getSubscriptionSession(gatewayPaymentId, credentials)
  const planId = session.subscriptionPlanId ?? payment.subscriptionPlanId ?? undefined
  const plan = planId ? await gateway.getSubscriptionPlan(planId, credentials) : null
  const subscriptionStatus = nextSubscriptionPlanStatus(
    payment.subscriptionStatus,
    plan?.status ?? (session.status === 'active' ? 'active' : payment.subscriptionStatus ?? 'pending'),
  )
  const active = session.status === 'active' && subscriptionStatus === 'active'
  const activated = active && payment.subscriptionStatus !== 'active'
  const failed = ['failed', 'expired', 'cancelled'].includes(session.status)
  const normalized = nextPaymentStatus(payment.status, active ? 'completed' : failed ? 'failed' : 'pending')
  const providerStatus = plan?.providerStatus ?? session.providerStatus
  const sanitizedPayload = sanitizePaymentPayload(input.payload ?? plan?.raw ?? session.raw)
  const key = eventKey({
    gatewayEventId: input.gatewayEventId,
    gatewayPaymentId,
    eventType: input.eventType ?? 'subscription.verification',
    providerStatus,
    providerTimestamp: input.providerTimestamp,
  })
  const claimedEvent = await claimPaymentEvent({
    paymentId: payment.id,
    eventKey: key,
    gatewayEventId: input.gatewayEventId,
    eventType: input.eventType ?? 'subscription.verification',
    providerStatus,
    normalizedStatus: normalized,
    source: input.source,
    payload: sanitizedPayload,
  })
  if (!claimedEvent) {
    return { status: payment.status, duplicate: true, paymentId: payment.id, subscriptionActivated: false }
  }

  try {
    const now = new Date()
    await db.update(payments).set({
      status: normalized,
      subscriptionPlanId: planId ?? null,
      subscriptionStatus,
      subscriptionCheckoutStatus: session.providerStatus,
      subscriptionNextChargeAt: optionalDate(plan?.nextChargeAt),
      subscriptionEndedAt: optionalDate(plan?.endedAt),
      subscriptionLastSyncedAt: now,
      verificationSource: input.source,
      lastVerifiedAt: now,
      failureReason: failed ? `Subscription enrollment ${session.status}` : payment.failureReason,
      failedAt: normalized === 'failed' && !payment.failedAt ? now : payment.failedAt,
      gatewayResponse: {
        ...((payment.gatewayResponse as Record<string, unknown> | null) ?? {}),
        ...sanitizedPayload,
        environment,
      },
      updatedAt: now,
    }).where(eq(payments.id, payment.id))

    if (planId) {
      const cycles = await gateway.listSubscriptionCycles(planId, credentials)
      for (const cycle of cycles) {
        await upsertSubscriptionCycle(payment, cycle, input.source === 'webhook' ? 'webhook' : input.source === 'manual' ? 'manual' : 'reconciliation')
      }
      const nextCycle = cycles
        .filter((cycle) => ['scheduled', 'pending', 'retrying'].includes(cycle.status) && cycle.scheduledAt)
        .sort((left, right) =>
          new Date(left.scheduledAt ?? 0).getTime() - new Date(right.scheduledAt ?? 0).getTime(),
        )[0]
      if (nextCycle?.scheduledAt) {
        await db.update(payments).set({ subscriptionNextChargeAt: new Date(nextCycle.scheduledAt) })
          .where(eq(payments.id, payment.id))
      }
    }
    await markRecoverableResponse(payment, normalized)
    await syncPaymentOwnerStatus(payment, normalized)
    await completePaymentEvent(
      claimedEvent,
      normalized === payment.status && subscriptionStatus === payment.subscriptionStatus
        ? 'ignored'
        : 'processed',
    )
    return { status: normalized, duplicate: false, paymentId: payment.id, subscriptionActivated: activated }
  } catch (error) {
    await failPaymentEvent(claimedEvent, error)
    throw error
  }
}

export async function reconcileSubscriptionWebhook(input: {
  paymentId: number
  eventType: string
  gatewayEventId?: string | null
  providerTimestamp?: string | null
  payload: unknown
  expectedProfileId: number
  kind: 'session' | 'plan' | 'cycle'
}) {
  if (input.kind === 'session') {
    return reconcileSubscriptionPayment({ ...input, source: 'webhook' })
  }
  const context = await subscriptionContext(input.paymentId, input.expectedProfileId)
  const { payment } = context
  const data = webhookRecord(input.payload)
  const providerStatus = String(data.status ?? 'UNKNOWN').toUpperCase()
  const subscriptionReference = payment.subscriptionPlanId ?? payment.gatewayPaymentId
  if (!subscriptionReference) {
    throw new Error('Subscription payment has no gateway reference')
  }
  const key = eventKey({
    gatewayEventId: input.gatewayEventId,
    gatewayPaymentId: input.kind === 'cycle'
      ? String(data.id ?? data.cycle_id ?? payment.subscriptionPlanId)
      : subscriptionReference,
    eventType: input.eventType,
    providerStatus,
    providerTimestamp: input.providerTimestamp,
  })
  const normalizedPaymentStatus = input.kind === 'plan' && normalizedPlanStatus(providerStatus) === 'active'
    ? 'completed' as const
    : payment.status
  const claimedEvent = await claimPaymentEvent({
    paymentId: payment.id,
    eventKey: key,
    gatewayEventId: input.gatewayEventId,
    eventType: input.eventType,
    providerStatus,
    normalizedStatus: normalizedPaymentStatus,
    source: 'webhook',
    payload: sanitizePaymentPayload(input.payload),
  })
  if (!claimedEvent) {
    return { status: payment.status, duplicate: true, paymentId: payment.id, subscriptionActivated: false }
  }

  try {
    const now = new Date()
    if (input.kind === 'cycle') {
      const cycleId = typeof data.id === 'string' && data.id.trim()
        ? data.id.trim()
        : typeof data.cycle_id === 'string' && data.cycle_id.trim() ? data.cycle_id.trim() : null
      if (!cycleId) throw new Error('Subscription cycle reference is unavailable')
      const status = normalizedCycleStatus(providerStatus)
      const attempts = Array.isArray(data.attempt_details)
        ? data.attempt_details.filter((attempt): attempt is Record<string, unknown> =>
            Boolean(attempt && typeof attempt === 'object' && !Array.isArray(attempt)))
        : []
      const lastAttempt = attempts[attempts.length - 1]
      const amount = typeof data.amount === 'number' && Number.isFinite(data.amount)
        ? Math.round(data.amount * 100)
        : payment.amount
      await upsertSubscriptionCycle(payment, {
        gatewayCycleId: cycleId,
        cycleNumber: typeof data.cycle_number === 'number' ? data.cycle_number : undefined,
        status,
        providerStatus,
        amount,
        currency: typeof data.currency === 'string' ? data.currency : payment.currency,
        scheduledAt: typeof data.scheduled_timestamp === 'string'
          ? data.scheduled_timestamp
          : typeof data.scheduled_at === 'string' ? data.scheduled_at : undefined,
        paidAt: status === 'paid' ? String(data.succeeded_at ?? data.paid_at ?? data.updated ?? '') || undefined : undefined,
        failedAt: status === 'failed' ? String(data.failed_at ?? data.updated ?? '') || undefined : undefined,
        failureCode: typeof lastAttempt?.failure_code === 'string'
          ? lastAttempt.failure_code
          : typeof data.failure_code === 'string' ? data.failure_code : undefined,
      }, 'webhook')
      const cycleSubscriptionStatus = status === 'paid'
        ? nextSubscriptionPlanStatus(payment.subscriptionStatus, 'active')
        : status === 'failed' || status === 'retrying'
          ? nextSubscriptionPlanStatus(payment.subscriptionStatus, 'past_due')
          : payment.subscriptionStatus
      await db.update(payments).set({
        subscriptionStatus: cycleSubscriptionStatus,
        subscriptionNextChargeAt: optionalDate(data.next_scheduled_at) ?? payment.subscriptionNextChargeAt,
        subscriptionLastSyncedAt: now,
        updatedAt: now,
      }).where(eq(payments.id, payment.id))
      await completePaymentEvent(claimedEvent, 'processed')
      return { status: payment.status, duplicate: false, paymentId: payment.id, subscriptionActivated: false }
    }

    const incomingStatus = normalizedPlanStatus(providerStatus)
    const status = nextSubscriptionPlanStatus(payment.subscriptionStatus, incomingStatus)
    const activated = status === 'active' && payment.subscriptionStatus !== 'active'
    await db.update(payments).set({
      status: activated ? 'completed' : payment.status,
      subscriptionStatus: status,
      subscriptionNextChargeAt: optionalDate(data.next_scheduled_at) ?? payment.subscriptionNextChargeAt,
      subscriptionEndedAt: ['cancelled', 'deactivated', 'completed'].includes(status)
        ? optionalDate(data.ended_at) ?? optionalDate(data.deactivated_at) ?? now
        : payment.subscriptionEndedAt,
      subscriptionLastSyncedAt: now,
      lastVerifiedAt: now,
      verificationSource: 'webhook',
      updatedAt: now,
    }).where(eq(payments.id, payment.id))
    if (activated) {
      await markRecoverableResponse(payment, 'completed')
      await syncPaymentOwnerStatus(payment, 'completed')
    }
    await completePaymentEvent(
      claimedEvent,
      activated || status !== payment.subscriptionStatus ? 'processed' : 'ignored',
    )
    return { status: activated ? 'completed' as const : payment.status, duplicate: false, paymentId: payment.id, subscriptionActivated: activated }
  } catch (error) {
    await failPaymentEvent(claimedEvent, error)
    throw error
  }
}

export async function paymentByGatewayReference(reference: string) {
  const [payment] = await db.select().from(payments)
    .where(or(
      eq(payments.gatewayPaymentId, reference),
      eq(payments.externalId, reference),
      eq(payments.subscriptionPlanId, reference),
    ))
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
  const activeCutoff = new Date(Date.now() - 6 * 60 * 60_000)
  const activeSubscriptions = await db.select({ id: payments.id }).from(payments)
    .where(and(
      eq(payments.paymentKind, 'subscription'),
      eq(payments.subscriptionStatus, 'active'),
      or(isNull(payments.subscriptionLastSyncedAt), lt(payments.subscriptionLastSyncedAt, activeCutoff)),
    ))
    .orderBy(payments.subscriptionLastSyncedAt)
    .limit(Math.min(Math.max(limit, 1), 100))
  for (const payment of activeSubscriptions) {
    try {
      results.push(await reconcileSubscriptionPayment({ paymentId: payment.id, source: 'reconciliation' }))
    } catch (error) {
      console.error('[subscription-reconciliation-failed]', {
        paymentId: payment.id,
        category: error instanceof Error ? error.name : 'UnknownError',
      })
    }
  }
  return {
    checked: stale.length + activeSubscriptions.length,
    updated: results.filter((result) => !result.duplicate).length,
  }
}
