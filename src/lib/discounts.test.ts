import { describe, expect, it } from 'vitest'
import { applyDiscount, discountEligibility, normalizeDiscountCode, validateDiscountDefinition } from './discounts'

describe('discount domain rules', () => {
  it('normalizes codes and validates safe definitions', () => {
    expect(normalizeDiscountCode(' earlybird ')).toBe('EARLYBIRD')
    expect(validateDiscountDefinition({ code: 'staff2026', type: 'percentage', value: 20 })).toBe('STAFF2026')
    expect(() => validateDiscountDefinition({ code: 'no', type: 'percentage', value: 20 })).toThrow()
    expect(() => validateDiscountDefinition({ code: 'VALID', type: 'percentage', value: 101 })).toThrow()
  })

  it('applies percentage discounts with a cap', () => {
    const result = applyDiscount({ id: 1, code: 'EARLY', description: 'Early bird', type: 'percentage', value: 30, maxDiscount: 1000 }, 5000)
    expect(result.discountAmount).toBe(1000)
    expect(result.finalAmount).toBe(4000)
  })

  it('clamps fixed discounts to the order amount', () => {
    const result = applyDiscount({ id: 1, code: 'FREE', description: null, type: 'fixed', value: 2500, maxDiscount: null }, 1000)
    expect(result.discountAmount).toBe(1000)
    expect(result.finalAmount).toBe(0)
  })

  it('rejects inactive, not-started, expired, exhausted, and minimum-order codes', () => {
    const now = new Date('2026-08-11T00:00:00Z')
    expect(discountEligibility({ isActive: false, startsAt: null, expiresAt: null, maxUses: null, currentUses: 0, minAmount: null }, 100, now)).toContain('inactive')
    expect(discountEligibility({ isActive: true, startsAt: new Date('2026-08-12T00:00:00Z'), expiresAt: null, maxUses: null, currentUses: 0, minAmount: null }, 100, now)).toContain('not active')
    expect(discountEligibility({ isActive: true, startsAt: null, expiresAt: new Date('2026-08-10T00:00:00Z'), maxUses: null, currentUses: 0, minAmount: null }, 100, now)).toContain('expired')
    expect(discountEligibility({ isActive: true, startsAt: null, expiresAt: null, maxUses: 1, currentUses: 1, minAmount: null }, 100, now)).toContain('usage')
    expect(discountEligibility({ isActive: true, startsAt: null, expiresAt: null, maxUses: null, currentUses: 0, minAmount: 500 }, 100, now)).toContain('higher')
  })
})
