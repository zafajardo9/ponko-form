import { describe, expect, it } from 'vitest'
import { normalizeSubmissionPageSize } from './validation'

describe('submission query pagination', () => {
  it.each([10, 25, 50, 100])('accepts the supported page size %i', (pageSize) => {
    expect(normalizeSubmissionPageSize(pageSize)).toBe(pageSize)
  })

  it.each([undefined, 0, 1, 24, 101, -25])(
    'falls back to 25 for unsupported page size %s',
    (pageSize) => {
      expect(normalizeSubmissionPageSize(pageSize)).toBe(25)
    },
  )
})
