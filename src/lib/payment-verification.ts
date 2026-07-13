export type PaymentVerificationPhase = 'pending' | 'verification_error' | 'done'

export function paymentVerificationPhase(
  result?: { status: 'pending' | 'completed' | 'failed' | 'refunded' },
  infrastructureError = false,
): PaymentVerificationPhase {
  if (infrastructureError || !result) return 'verification_error'
  if (result.status === 'pending') return 'pending'
  return 'done'
}
