import { describe, expect, it } from 'vitest'
import { emailSurveyTokenHash, validEmailSurveyToken } from './email-survey-token'

describe('email survey tokens', () => {
  it('accepts high-entropy URL-safe tokens and hashes them deterministically', () => {
    const token = 'a'.repeat(43)
    expect(validEmailSurveyToken(token)).toBe(true)
    expect(validEmailSurveyToken('short')).toBe(false)
    expect(emailSurveyTokenHash(token)).toMatch(/^[a-f0-9]{64}$/)
    expect(emailSurveyTokenHash(token)).toBe(emailSurveyTokenHash(token))
    expect(emailSurveyTokenHash(token)).not.toContain(token)
  })
})
