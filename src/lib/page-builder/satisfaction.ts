import type { PageFieldOption } from './types'

export type SatisfactionPreset = 'five-point' | 'stars' | 'svg-stars' | 'nps' | 'custom'

/** Special emoji marker used by the SVG stars preset. Renderers detect this
 *  string and render <StarIcon /> components instead of raw emoji text. */
export const SVG_STAR_MARKER = 'star-svg'

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
  'svg-stars': [
    { label: '1 star', value: '1', emoji: SVG_STAR_MARKER },
    { label: '2 stars', value: '2', emoji: SVG_STAR_MARKER },
    { label: '3 stars', value: '3', emoji: SVG_STAR_MARKER },
    { label: '4 stars', value: '4', emoji: SVG_STAR_MARKER },
    { label: '5 stars', value: '5', emoji: SVG_STAR_MARKER },
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
  for (const preset of ['five-point', 'stars', 'svg-stars', 'nps'] as const) {
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
