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
  const reference = isRefund
    ? value(nested.invoice_id) ?? value(payload.invoice_id) ?? value(nested.payment_id)
    : value(payload.id) ?? value(nested.id) ?? value(payload.external_id)
  return {
    eventType,
    isRefund,
    reference,
    providerTimestamp: value(payload.updated) ?? value(payload.created),
    eventId: value(payload.event_id),
  }
}
