import { describe, expect, it } from 'vitest'
import {
  flowPaymentReturnUrl,
  isValidPublicSessionToken,
  pagePaymentReturnUrl,
} from './public-session-access'

describe('page session access', () => {
  it('accepts only bounded URL-safe bearer tokens', () => {
    expect(isValidPublicSessionToken('session-client-token-1234')).toBe(true)
    expect(isValidPublicSessionToken('short')).toBe(false)
    expect(isValidPublicSessionToken('a'.repeat(65))).toBe(false)
    expect(isValidPublicSessionToken('token with spaces 1234')).toBe(false)
  })

  it('includes the session token in payment return URLs', () => {
    expect(
      pagePaymentReturnUrl(
        'https://ponko.test',
        12,
        34,
        'session-client-token-1234',
      ),
    ).toBe(
      'https://ponko.test/forms/payment-return?pageSessionId=12&pageId=34&pageClientToken=session-client-token-1234',
    )
  })

  it('refuses to construct a return URL with an invalid token', () => {
    expect(() =>
      pagePaymentReturnUrl('https://ponko.test', 12, 34, 'invalid'),
    ).toThrow('Invalid session token')
  })

  it('includes the execution token in flow payment return URLs', () => {
    expect(
      flowPaymentReturnUrl(
        'https://ponko.test',
        56,
        'execution-client-token-1234',
      ),
    ).toBe(
      'https://ponko.test/forms/payment-return?executionId=56&executionClientToken=execution-client-token-1234',
    )
  })
})
