import type { PaymentStatus } from '../../integrations/payments/types'
import type { SubscriptionPlanStatus } from '../../integrations/payments/types'

const SAFE_PAYLOAD_KEYS = new Set([
  'id', 'event', 'status', 'external_id', 'amount', 'paid_amount', 'currency',
  'paid_at', 'updated', 'created', 'payment_id', 'invoice_id', 'refund_id',
  'payment_method', 'payment_channel', 'failure_reason', 'metadata',
  'payment_session_id', 'recurring_plan_id', 'plan_id', 'cycle_id', 'cycle_number',
  'scheduled_at', 'scheduled_timestamp', 'next_scheduled_at', 'succeeded_at', 'failed_at', 'failure_code',
  'ended_at', 'deactivated_at',
])

export function sanitizePaymentPayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {}
  return Object.fromEntries(
    Object.entries(payload as Record<string, unknown>)
      .filter(([key]) => SAFE_PAYLOAD_KEYS.has(key))
      .map(([key, value]) => [key, key === 'metadata' && value && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([metaKey]) =>
            ['pageSessionId', 'pageId', 'executionId', 'paymentId'].includes(metaKey)))
        : value]),
  )
}

export function nextPaymentStatus(current: PaymentStatus, incoming: PaymentStatus): PaymentStatus {
  if (current === 'refunded') return 'refunded'
  if (incoming === 'refunded') return current === 'completed' ? 'refunded' : current
  if (current === 'completed') return 'completed'
  if (incoming === 'completed') return 'completed'
  if (current === 'failed' && incoming === 'pending') return 'failed'
  return incoming
}

export function paymentOwnerStatus(status: PaymentStatus) {
  if (status === 'pending') return 'payment_pending' as const
  if (status === 'failed') return 'payment_failed' as const
  if (status === 'completed') return 'in_progress' as const
  return null
}

export function nextSubscriptionPlanStatus(
  current: SubscriptionPlanStatus | null,
  incoming: SubscriptionPlanStatus,
) {
  if (current === 'cancelled' || current === 'deactivated' || current === 'completed') return current
  return incoming
}
