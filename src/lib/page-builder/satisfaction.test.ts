import { describe, expect, it } from 'vitest'
import { inferSatisfactionPreset, satisfactionOptions } from './satisfaction'

describe('satisfaction presets', () => {
  it('provides independent five-point and NPS scales', () => {
    const first = satisfactionOptions('five-point')
    const second = satisfactionOptions('five-point')
    first[0].label = 'Changed'

    expect(second).toHaveLength(5)
    expect(second[0].value).toBe('1')
    expect(second[4].value).toBe('5')
    expect(satisfactionOptions('nps')).toHaveLength(11)
  })

  it('recognizes presets and custom scales', () => {
    expect(inferSatisfactionPreset(satisfactionOptions('stars'))).toBe('stars')
    expect(inferSatisfactionPreset([
      { label: 'Poor', value: '1' },
      { label: 'Excellent', value: '10' },
    ])).toBe('custom')
  })
})
