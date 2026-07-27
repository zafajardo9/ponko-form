import { describe, expect, it } from 'vitest'
import {
  normalizedSubscriptionConfig,
  subscriptionAnchorDate,
  subscriptionCustomer,
  validateSubscriptionBindings,
} from './subscriptions'

describe('subscription configuration', () => {
  it('normalizes quarterly billing to three-month Xendit intervals', () => {
    expect(normalizedSubscriptionConfig({
      enabled: true,
      interval: 'quarterly',
      intervalUnit: 'WEEK',
      intervalCount: 99,
      trialPeriodDays: 0,
      maxCycles: 8,
      customerNameField: 'full_name',
      customerEmailField: 'email',
    })).toMatchObject({ intervalUnit: 'MONTH', intervalCount: 3, maxCycles: 8 })
  })

  it('anchors zero-trial enrollment on the next cycle and preserves trial delays', () => {
    expect(subscriptionAnchorDate({
      trialPeriodDays: 0,
      intervalUnit: 'MONTH',
      intervalCount: 1,
    }, new Date('2026-07-15T10:00:00Z')).toISOString())
      .toBe('2026-08-15T10:00:00.000Z')
    expect(subscriptionAnchorDate({
      trialPeriodDays: 0,
      intervalUnit: 'WEEK',
      intervalCount: 1,
    }, new Date('2026-07-15T10:00:00Z')).toISOString())
      .toBe('2026-07-22T10:00:00.000Z')
    expect(subscriptionAnchorDate({
      trialPeriodDays: 14,
      intervalUnit: 'MONTH',
      intervalCount: 1,
    }, new Date('2026-07-15T10:00:00Z')).toISOString())
      .toBe('2026-08-01T10:00:00.000Z')
  })

  it('extracts and validates explicitly bound customer data', () => {
    expect(subscriptionCustomer({
      enabled: true,
      interval: 'monthly',
      intervalUnit: 'MONTH',
      intervalCount: 1,
      trialPeriodDays: 0,
      maxCycles: null,
      customerNameField: 'member_name',
      customerEmailField: 'member_email',
    }, { member_name: 'Ada Reyes', member_email: 'ADA@EXAMPLE.COM' }))
      .toEqual({ name: 'Ada Reyes', email: 'ada@example.com' })
  })

  it('requires bound name and email fields on an earlier page', () => {
    const config = normalizedSubscriptionConfig({
      enabled: true,
      interval: 'monthly',
      intervalUnit: 'MONTH',
      intervalCount: 1,
      trialPeriodDays: 0,
      maxCycles: null,
      customerNameField: 'member_name',
      customerEmailField: 'member_email',
    })!
    expect(() => validateSubscriptionBindings(config, { position: 1 }, [
      { position: 0, fields: [
        { bindVariable: 'member_name', fieldType: 'text' },
        { bindVariable: 'member_email', fieldType: 'email' },
      ] },
    ])).not.toThrow()
    expect(() => validateSubscriptionBindings(config, { position: 0 }, [
      { position: 0, fields: [
        { bindVariable: 'member_name', fieldType: 'text' },
        { bindVariable: 'member_email', fieldType: 'email' },
      ] },
    ])).toThrow(/earlier page/i)
  })
})
