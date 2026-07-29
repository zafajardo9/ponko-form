import { describe, expect, it } from 'vitest'
import {
  createPaymentLinkInputSchema,
  paymentLinkCheckoutKey,
  paymentLinkReturnUrl,
} from '../payment-links/model'

describe('payment link input validation', () => {
  const validInput = {
    title: 'Workshop ticket',
    amount: 500,
    currency: 'PHP',
    paymentGatewaySlug: 'xendit' as const,
  }

  it('normalizes a valid payment link input', () => {
    expect(createPaymentLinkInputSchema.parse({
      ...validInput,
      title: '  Workshop ticket  ',
      currency: 'php',
      redirectUrl: 'https://example.com/thanks',
    })).toMatchObject({
      title: 'Workshop ticket',
      currency: 'PHP',
      redirectUrl: 'https://example.com/thanks',
    })
  })

  it('rejects invalid amounts, redirect protocols, and custom ranges', () => {
    expect(createPaymentLinkInputSchema.safeParse({ ...validInput, amount: Number.NaN }).success).toBe(false)
    expect(createPaymentLinkInputSchema.safeParse({
      ...validInput,
      redirectUrl: 'javascript:alert(1)',
    }).success).toBe(false)
    expect(createPaymentLinkInputSchema.safeParse({
      ...validInput,
      allowCustomAmount: true,
      minAmount: 1_000,
      maxAmount: 500,
    }).success).toBe(false)
  })
})

describe('payment link checkout isolation', () => {
  it('uses a different database key for each buyer attempt', () => {
    const first = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const second = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

    expect(paymentLinkCheckoutKey(42, first)).not.toBe(paymentLinkCheckoutKey(42, second))
    expect(paymentLinkCheckoutKey(42, first)).toBe(`paylink:42:${first}`)
  })

  it('puts only the opaque attempt token in the gateway return URL', () => {
    const token = 'abcdefghijklmnopqrstuvwxABCDEFGH'
    expect(paymentLinkReturnUrl('https://ponkoform.test', 'public_123', token)).toBe(
      `https://ponkoform.test/pay/public_123/success?attempt=${token}`,
    )
  })
})
