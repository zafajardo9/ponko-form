import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../db/index', () => ({ db: {} }))
vi.mock('./credentials', () => ({ getIntegrationConfig: vi.fn() }))

import {
  mergeSubmissionSessionData,
  publicSubmissionData,
  verifiedRecaptchaFieldIds,
  verifyResponseToken,
  withVerifiedRecaptchaFieldIds,
} from './recaptcha'

describe('reCAPTCHA submission security', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('keeps server-owned verification state instead of accepting client metadata', () => {
    const stored = withVerifiedRecaptchaFieldIds({ name: 'Old', __paymentId: 42 }, [7])
    const merged = mergeSubmissionSessionData(stored, {
      name: 'Ada',
      __paymentId: 999,
      __recaptchaVerifiedFieldIds: [999],
    })

    expect(merged.name).toBe('Ada')
    expect(merged.__paymentId).toBe(42)
    expect(verifiedRecaptchaFieldIds(merged)).toEqual([7])
    expect(publicSubmissionData(merged)).toEqual({ name: 'Ada' })
  })

  it('accepts a successful Google siteverify response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(verifyResponseToken('secret', 'response-token')).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.google.com/recaptcha/api/siteverify',
      expect.objectContaining({ method: 'POST' }),
    )
    const request = fetchMock.mock.calls[0][1]
    expect(String(request.body)).toContain('secret=secret')
    expect(String(request.body)).toContain('response=response-token')
  })

  it('returns an actionable error for expired or replayed tokens', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: false,
      'error-codes': ['timeout-or-duplicate'],
    }), { status: 200 })))

    await expect(verifyResponseToken('secret', 'expired-token')).rejects.toThrow(/expired/i)
  })
})
