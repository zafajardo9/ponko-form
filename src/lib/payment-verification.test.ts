import { describe, expect, it } from 'vitest'
import { paymentVerificationPhase } from './payment-verification'

describe('paymentVerificationPhase', () => {
  it('keeps provider-pending payments pending', () => {
    expect(paymentVerificationPhase({ status: 'pending' })).toBe('pending')
  })

  it('allows explicit success to complete', () => {
    expect(paymentVerificationPhase({ status: 'completed' })).toBe('done')
  })

  it('allows explicit provider failure to complete on the failure path', () => {
    expect(paymentVerificationPhase({ status: 'failed' })).toBe('done')
  })

  it('does not classify infrastructure errors as payment failures', () => {
    expect(paymentVerificationPhase(undefined, true)).toBe('verification_error')
  })
})
