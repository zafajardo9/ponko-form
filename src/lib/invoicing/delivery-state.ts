import type { EmailDeliveryStatus } from '../../db/schema'

export const MAX_EMAIL_DELIVERY_ATTEMPTS = 5
export const EMAIL_DELIVERY_RETRY_COOLDOWN_MS = 10_000
export const EMAIL_DELIVERY_LEASE_MS = 5 * 60_000

type DeliveryClaimState = {
  status: EmailDeliveryStatus
  attemptCount: number
  lastAttemptAt: Date | null
}

export type DeliveryClaimDisposition =
  | 'claimable'
  | 'already-sent'
  | 'attempt-limit'
  | 'retry-cooldown'
  | 'active-lease'

export function emailDeliveryClaimDisposition(
  delivery: DeliveryClaimState,
  now = new Date(),
): DeliveryClaimDisposition {
  if (delivery.status === 'sent') return 'already-sent'
  if (delivery.attemptCount >= MAX_EMAIL_DELIVERY_ATTEMPTS) return 'attempt-limit'

  const lastAttemptAt = delivery.lastAttemptAt?.getTime()
  if (delivery.status === 'failed' && lastAttemptAt !== undefined) {
    return now.getTime() - lastAttemptAt < EMAIL_DELIVERY_RETRY_COOLDOWN_MS
      ? 'retry-cooldown'
      : 'claimable'
  }
  if (delivery.status === 'sending' && lastAttemptAt !== undefined) {
    return now.getTime() - lastAttemptAt < EMAIL_DELIVERY_LEASE_MS
      ? 'active-lease'
      : 'claimable'
  }

  return 'claimable'
}
