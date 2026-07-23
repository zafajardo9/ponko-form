import { describe, expect, it } from 'vitest'
import { sanitizeLegacySubmission } from './legacy-submission'

const fields = [
  {
    id: 1,
    type: 'text',
    label: 'Name',
    required: true,
  },
  {
    id: 2,
    type: 'email',
    label: 'Email',
    required: false,
  },
  {
    id: 3,
    type: 'number',
    label: 'Guests',
    required: false,
  },
  {
    id: 4,
    type: 'select',
    label: 'Plan',
    required: false,
    options: [{ value: 'starter' }, { value: 'pro' }],
  },
  {
    id: 5,
    type: 'checkbox',
    label: 'Topics',
    required: false,
    options: [{ value: 'design' }, { value: 'engineering' }],
  },
]

describe('sanitizeLegacySubmission', () => {
  it('keeps declared fields, normalizes values, and removes unknown keys', () => {
    expect(
      sanitizeLegacySubmission(fields, {
        1: 'Ada',
        2: ' ada@example.com ',
        3: '2',
        4: 'pro',
        5: ['design', 'design'],
        forged: 'discard me',
      }),
    ).toEqual({
      1: 'Ada',
      2: 'ada@example.com',
      3: 2,
      4: 'pro',
      5: ['design'],
    })
  })

  it('treats zero as a valid required numeric value', () => {
    expect(
      sanitizeLegacySubmission(
        [{ id: 1, type: 'number', label: 'Count', required: true }],
        { 1: 0 },
      ),
    ).toEqual({ 1: 0 })
  })

  it('rejects forged options and invalid email addresses', () => {
    expect(() =>
      sanitizeLegacySubmission(fields, { 1: 'Ada', 4: 'enterprise' }),
    ).toThrow('invalid option')
    expect(() =>
      sanitizeLegacySubmission(fields, { 1: 'Ada', 2: 'not-an-email' }),
    ).toThrow('valid email address')
  })

  it('enforces required fields and response-size limits', () => {
    expect(() => sanitizeLegacySubmission(fields, {})).toThrow(
      'Field "Name" is required',
    )
    expect(() =>
      sanitizeLegacySubmission(
        [{ id: 1, type: 'textarea', label: 'Essay', required: false }],
        { 1: 'x'.repeat(20_001) },
      ),
    ).toThrow('too long')
  })
})
