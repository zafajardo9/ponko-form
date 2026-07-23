import { describe, expect, it } from 'vitest'
import {
  EMAIL_DELIVERY_LEASE_MS,
  EMAIL_DELIVERY_RETRY_COOLDOWN_MS,
  MAX_EMAIL_DELIVERY_ATTEMPTS,
  emailDeliveryClaimDisposition,
} from './delivery-state'

const now = new Date('2026-07-23T00:00:00.000Z')

describe('emailDeliveryClaimDisposition', () => {
  it('claims a newly queued delivery', () => {
    expect(emailDeliveryClaimDisposition({
      status: 'queued',
      attemptCount: 0,
      lastAttemptAt: null,
    }, now)).toBe('claimable')
  })

  it('enforces the failed-delivery retry cooldown', () => {
    expect(emailDeliveryClaimDisposition({
      status: 'failed',
      attemptCount: 1,
      lastAttemptAt: new Date(now.getTime() - EMAIL_DELIVERY_RETRY_COOLDOWN_MS + 1),
    }, now)).toBe('retry-cooldown')
  })

  it('recovers an abandoned sending lease', () => {
    expect(emailDeliveryClaimDisposition({
      status: 'sending',
      attemptCount: 1,
      lastAttemptAt: new Date(now.getTime() - EMAIL_DELIVERY_LEASE_MS),
    }, now)).toBe('claimable')
  })

  it('does not claim an active sending lease', () => {
    expect(emailDeliveryClaimDisposition({
      status: 'sending',
      attemptCount: 1,
      lastAttemptAt: new Date(now.getTime() - EMAIL_DELIVERY_LEASE_MS + 1),
    }, now)).toBe('active-lease')
  })

  it('never reopens sent or exhausted deliveries', () => {
    expect(emailDeliveryClaimDisposition({
      status: 'sent',
      attemptCount: 1,
      lastAttemptAt: now,
    }, now)).toBe('already-sent')
    expect(emailDeliveryClaimDisposition({
      status: 'failed',
      attemptCount: MAX_EMAIL_DELIVERY_ATTEMPTS,
      lastAttemptAt: null,
    }, now)).toBe('attempt-limit')
  })
})
