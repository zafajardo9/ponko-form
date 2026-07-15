import type { PageFieldOption } from './types'

export type SatisfactionPreset = 'five-point' | 'stars' | 'nps' | 'custom'

export const SATISFACTION_PRESETS: Record<Exclude<SatisfactionPreset, 'custom'>, PageFieldOption[]> = {
  'five-point': [
    { label: 'Very dissatisfied', value: '1', emoji: '😡' },
    { label: 'Dissatisfied', value: '2', emoji: '😕' },
    { label: 'Neutral', value: '3', emoji: '😐' },
    { label: 'Satisfied', value: '4', emoji: '😊' },
    { label: 'Very satisfied', value: '5', emoji: '😍' },
  ],
  stars: [
    { label: '1 star', value: '1', emoji: '★' },
    { label: '2 stars', value: '2', emoji: '★★' },
    { label: '3 stars', value: '3', emoji: '★★★' },
    { label: '4 stars', value: '4', emoji: '★★★★' },
    { label: '5 stars', value: '5', emoji: '★★★★★' },
  ],
  nps: Array.from({ length: 11 }, (_, score) => ({
    label: score <= 6 ? `${score} · Not likely` : score <= 8 ? `${score} · Neutral` : `${score} · Very likely`,
    value: String(score),
    emoji: String(score),
  })),
}

export function satisfactionOptions(preset: Exclude<SatisfactionPreset, 'custom'>): PageFieldOption[] {
  return SATISFACTION_PRESETS[preset].map((option) => ({ ...option }))
}

export function inferSatisfactionPreset(options: PageFieldOption[] | null | undefined): SatisfactionPreset {
  if (!options?.length) return 'five-point'
  for (const preset of ['five-point', 'stars', 'nps'] as const) {
    const candidate = SATISFACTION_PRESETS[preset]
    if (
      options.length === candidate.length &&
      options.every((option, index) =>
        option.label === candidate[index].label &&
        option.value === candidate[index].value &&
        (option.emoji ?? '') === (candidate[index].emoji ?? ''),
      )
    ) return preset
  }
  return 'custom'
}
