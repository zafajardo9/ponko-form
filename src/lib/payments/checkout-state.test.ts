import { describe, expect, it } from 'vitest'
import { checkoutDisposition } from './checkout-state'

const now = new Date('2026-07-23T12:00:00.000Z')

describe('checkoutDisposition', () => {
  it('reuses a live pending checkout URL', () => {
    expect(
      checkoutDisposition({
        status: 'pending',
        paymentUrl: 'https://checkout.test/1',
        expiresAt: new Date('2026-07-23T12:05:00.000Z'),
        updatedAt: now,
      }, now),
    ).toBe('reuse')
  })

  it('waits for a recent in-progress provider request', () => {
    expect(
      checkoutDisposition({
        status: 'pending',
        paymentUrl: null,
        expiresAt: null,
        updatedAt: new Date('2026-07-23T11:59:45.000Z'),
      }, now),
    ).toBe('wait')
  })

  it('reclaims failed, expired, and stale attempts', () => {
    for (const payment of [
      {
        status: 'failed' as const,
        paymentUrl: null,
        expiresAt: null,
        updatedAt: now,
      },
      {
        status: 'pending' as const,
        paymentUrl: 'https://checkout.test/expired',
        expiresAt: new Date('2026-07-23T11:59:00.000Z'),
        updatedAt: now,
      },
      {
        status: 'pending' as const,
        paymentUrl: null,
        expiresAt: null,
        updatedAt: new Date('2026-07-23T11:58:00.000Z'),
      },
    ]) {
      expect(checkoutDisposition(payment, now)).toBe('claim')
    }
  })

  it('does not reopen a completed payment', () => {
    expect(
      checkoutDisposition({
        status: 'completed',
        paymentUrl: 'https://checkout.test/paid',
        expiresAt: null,
        updatedAt: now,
      }, now),
    ).toBe('completed')
  })
})
