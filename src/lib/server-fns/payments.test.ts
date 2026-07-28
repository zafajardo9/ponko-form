import { describe, expect, it } from 'vitest'
import { paymentAmountMinor } from './validation'

describe('payment initiation amount validation', () => {
  it('converts a positive major-unit amount to integer minor units', () => {
    expect(paymentAmountMinor('1250.55')).toBe(125055)
    expect(paymentAmountMinor(0.1 + 0.2)).toBe(30)
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 'not-a-number'])(
    'rejects an invalid amount: %s',
    (amount) => {
      expect(() => paymentAmountMinor(amount)).toThrow(
        'Nothing to pay — the amount is zero or invalid',
      )
    },
  )
})
