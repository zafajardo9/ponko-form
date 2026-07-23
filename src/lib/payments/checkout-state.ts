const CLAIM_STALE_MS = 30_000

export type CheckoutDisposition =
  | 'claimed'
  | 'reuse'
  | 'wait'
  | 'completed'

export function checkoutDisposition(
  payment: {
    status: string
    paymentUrl: string | null
    expiresAt: Date | null
    updatedAt: Date
  },
  now = new Date(),
): Exclude<CheckoutDisposition, 'claimed'> | 'claim' {
  if (payment.status === 'completed') return 'completed'
  const expired = payment.expiresAt
    ? payment.expiresAt.getTime() <= now.getTime()
    : false
  if (payment.status === 'pending' && payment.paymentUrl && !expired) {
    return 'reuse'
  }
  const claimIsFresh =
    payment.status === 'pending' &&
    !payment.paymentUrl &&
    now.getTime() - payment.updatedAt.getTime() < CLAIM_STALE_MS
  return claimIsFresh ? 'wait' : 'claim'
}
