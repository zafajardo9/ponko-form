import { safeEqual } from '../crypto'

export function validXenditWebhookToken(expected: string | undefined, supplied: string | null) {
  return Boolean(expected && supplied && safeEqual(expected, supplied))
}

export function xenditWebhookIdentity(payload: Record<string, unknown>) {
  const value = (candidate: unknown) => typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null
  const nested = payload.data && typeof payload.data === 'object'
    ? payload.data as Record<string, unknown>
    : payload
  const eventType = value(payload.event) ?? value(nested.event) ?? 'invoice.status'
  const isRefund = eventType.toLowerCase().includes('refund')
  const normalizedEvent = eventType.toLowerCase()
  const subscriptionKind = normalizedEvent.includes('recurring.cycle')
    || normalizedEvent.includes('recurring_cycle')
    || normalizedEvent.includes('subscription.cycle')
    ? 'cycle' as const
    : normalizedEvent.includes('recurring.plan')
      || normalizedEvent.includes('recurring_plan')
      || normalizedEvent.includes('subscription.plan')
      ? 'plan' as const
      : normalizedEvent.includes('payment_session') || normalizedEvent.includes('session.')
        ? 'session' as const
        : null
  const subscriptionPlanId = value(nested.recurring_plan_id)
    ?? value(nested.plan_id)
    ?? value(payload.recurring_plan_id)
    ?? (subscriptionKind === 'plan' ? value(nested.id) : null)
  const paymentSessionId = value(nested.payment_session_id)
    ?? value(payload.payment_session_id)
    ?? (subscriptionKind === 'session' ? value(nested.id) : null)
  const cycleId = subscriptionKind === 'cycle' ? value(nested.id) ?? value(nested.cycle_id) : null
  const reference = isRefund
    ? value(nested.invoice_id) ?? value(payload.invoice_id) ?? value(nested.payment_id)
    : subscriptionPlanId
      ?? paymentSessionId
      ?? value(payload.id)
      ?? value(nested.id)
      ?? value(payload.external_id)
  return {
    eventType,
    isRefund,
    reference,
    providerTimestamp: value(payload.updated) ?? value(payload.created),
    eventId: value(payload.event_id),
    subscriptionKind,
    subscriptionPlanId,
    paymentSessionId,
    cycleId,
  }
}
