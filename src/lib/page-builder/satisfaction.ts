import type { PageFieldOption } from './types'

export type SatisfactionPreset =
  | 'five-point'
  | 'icon-faces'
  | 'svg-stars'
  | 'text-only'
  | 'numbers'
  | 'nps'
  | 'stars'
  | 'custom'

/** Special emoji marker used by the SVG stars preset. Renderers detect this
 *  string and render <StarIcon /> components instead of raw emoji text. */
export const SVG_STAR_MARKER = 'star-svg'
export const TEXT_ONLY_MARKER = 'rating-text-only'
export const ICON_FACE_MARKER_PREFIX = 'rating-icon:'

export type RatingFaceIcon = 'angry' | 'frown' | 'meh' | 'smile' | 'delighted'

export function ratingFaceIcon(value: string | null | undefined): RatingFaceIcon | null {
  const visual = value?.trim() ?? ''
  if (!visual.startsWith(ICON_FACE_MARKER_PREFIX)) return null
  const icon = visual.slice(ICON_FACE_MARKER_PREFIX.length)
  return ['angry', 'frown', 'meh', 'smile', 'delighted'].includes(icon)
    ? icon as RatingFaceIcon
    : null
}

export const SATISFACTION_PRESETS: Record<Exclude<SatisfactionPreset, 'custom'>, PageFieldOption[]> = {
  'five-point': [
    { label: 'Very dissatisfied', value: '1', emoji: '😡' },
    { label: 'Dissatisfied', value: '2', emoji: '😕' },
    { label: 'Neutral', value: '3', emoji: '😐' },
    { label: 'Satisfied', value: '4', emoji: '😊' },
    { label: 'Very satisfied', value: '5', emoji: '😍' },
  ],
  'icon-faces': [
    { label: 'Very dissatisfied', value: '1', emoji: `${ICON_FACE_MARKER_PREFIX}angry` },
    { label: 'Dissatisfied', value: '2', emoji: `${ICON_FACE_MARKER_PREFIX}frown` },
    { label: 'Neutral', value: '3', emoji: `${ICON_FACE_MARKER_PREFIX}meh` },
    { label: 'Satisfied', value: '4', emoji: `${ICON_FACE_MARKER_PREFIX}smile` },
    { label: 'Very satisfied', value: '5', emoji: `${ICON_FACE_MARKER_PREFIX}delighted` },
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
  'text-only': [
    { label: 'Very poor', value: '1', emoji: TEXT_ONLY_MARKER },
    { label: 'Poor', value: '2', emoji: TEXT_ONLY_MARKER },
    { label: 'Okay', value: '3', emoji: TEXT_ONLY_MARKER },
    { label: 'Good', value: '4', emoji: TEXT_ONLY_MARKER },
    { label: 'Excellent', value: '5', emoji: TEXT_ONLY_MARKER },
  ],
  numbers: Array.from({ length: 5 }, (_, index) => ({
    label: `${index + 1} out of 5`,
    value: String(index + 1),
    emoji: String(index + 1),
  })),
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
  for (const preset of ['five-point', 'icon-faces', 'svg-stars', 'text-only', 'numbers', 'nps', 'stars'] as const) {
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
