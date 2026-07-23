import { describe, expect, it } from 'vitest'
import {
  nextPaymentStatus,
  nextSubscriptionPlanStatus,
  paymentOwnerStatus,
  sanitizePaymentPayload,
} from './reconciliation-utils'

describe('payment reconciliation security', () => {
  it('removes secrets and unrelated personal fields from audit payloads', () => {
    expect(sanitizePaymentPayload({
      id: 'inv-1',
      status: 'PAID',
      amount: 100,
      card_number: '4111111111111111',
      authorization: 'secret',
      metadata: { paymentId: '7', email: 'person@example.com' },
    })).toEqual({
      id: 'inv-1',
      status: 'PAID',
      amount: 100,
      metadata: { paymentId: '7' },
    })
  })

  it('prevents completed and refunded payments from regressing', () => {
    expect(nextPaymentStatus('completed', 'pending')).toBe('completed')
    expect(nextPaymentStatus('completed', 'failed')).toBe('completed')
    expect(nextPaymentStatus('completed', 'refunded')).toBe('refunded')
    expect(nextPaymentStatus('refunded', 'completed')).toBe('refunded')
  })

  it('allows a verified completion to repair pending or failed state', () => {
    expect(nextPaymentStatus('pending', 'completed')).toBe('completed')
    expect(nextPaymentStatus('failed', 'completed')).toBe('completed')
  })

  it('keeps the owning form process aligned with the verified payment state', () => {
    expect(paymentOwnerStatus('pending')).toBe('payment_pending')
    expect(paymentOwnerStatus('failed')).toBe('payment_failed')
    expect(paymentOwnerStatus('completed')).toBe('in_progress')
    expect(paymentOwnerStatus('refunded')).toBeNull()
  })

  it('does not reactivate a terminal subscription from a delayed webhook', () => {
    expect(nextSubscriptionPlanStatus('cancelled', 'active')).toBe('cancelled')
    expect(nextSubscriptionPlanStatus('cancelled', 'past_due')).toBe('cancelled')
    expect(nextSubscriptionPlanStatus('deactivated', 'active')).toBe('deactivated')
    expect(nextSubscriptionPlanStatus('past_due', 'active')).toBe('active')
  })
})
