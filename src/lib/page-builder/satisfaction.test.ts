import { describe, expect, it } from 'vitest'
import {
  inferSatisfactionPreset,
  ratingFaceIcon,
  satisfactionOptions,
  TEXT_ONLY_MARKER,
} from './satisfaction'

describe('satisfaction presets', () => {
  it('creates independent preset option arrays and infers their appearance', () => {
    const first = satisfactionOptions('text-only')
    const second = satisfactionOptions('text-only')

    expect(first).not.toBe(second)
    expect(first.every((option) => option.emoji === TEXT_ONLY_MARKER)).toBe(true)
    expect(inferSatisfactionPreset(first)).toBe('text-only')
    expect(inferSatisfactionPreset(satisfactionOptions('icon-faces'))).toBe('icon-faces')
    expect(inferSatisfactionPreset(satisfactionOptions('numbers'))).toBe('numbers')
  })

  it('recognizes only supported icon markers', () => {
    expect(ratingFaceIcon('rating-icon:smile')).toBe('smile')
    expect(ratingFaceIcon('rating-icon:unknown')).toBeNull()
    expect(ratingFaceIcon('😊')).toBeNull()
  })
})
