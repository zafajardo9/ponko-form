import { describe, expect, it } from 'vitest'
import { jsonObject } from './validation'

describe('form runtime JSON serialization', () => {
  it('keeps valid nested configuration and removes non-JSON values', () => {
    expect(jsonObject({
      label: 'Contact',
      enabled: true,
      count: Number.POSITIVE_INFINITY,
      nested: { values: [1, undefined, 'ok'] },
      callback: () => undefined,
    })).toEqual({
      label: 'Contact',
      enabled: true,
      count: null,
      nested: { values: [1, null, 'ok'] },
    })
  })

  it('returns an empty object for non-object form configuration', () => {
    expect(jsonObject(null)).toEqual({})
    expect(jsonObject('invalid')).toEqual({})
  })
})
