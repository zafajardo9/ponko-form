import { describe, expect, it } from 'vitest'
import { validXenditWebhookToken, xenditWebhookIdentity } from './xendit-webhook'

describe('Xendit webhook validation', () => {
  it('accepts only the configured callback token', () => {
    expect(validXenditWebhookToken('expected-token', 'expected-token')).toBe(true)
    expect(validXenditWebhookToken('expected-token', 'wrong-token')).toBe(false)
    expect(validXenditWebhookToken('expected-token', null)).toBe(false)
    expect(validXenditWebhookToken(undefined, 'expected-token')).toBe(false)
  })

  it('extracts invoice and refund references', () => {
    expect(xenditWebhookIdentity({ id: 'inv-1', status: 'PAID' }).reference).toBe('inv-1')
    expect(xenditWebhookIdentity({ event: 'refund.succeeded', data: { invoice_id: 'inv-2' } })).toMatchObject({
      eventType: 'refund.succeeded', isRefund: true, reference: 'inv-2',
    })
  })
})
