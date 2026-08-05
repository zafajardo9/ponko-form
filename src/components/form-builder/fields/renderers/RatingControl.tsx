import { useState } from 'react'
import type { FieldOption } from '../../../../lib/form-field-types'
import { StarIcon } from '../../../ui/StarIcon'
import { SVG_STAR_MARKER } from '../../../../lib/page-builder/satisfaction'
import { isImageUrl } from './utils'

interface RatingControlProps {
  options: FieldOption[]
  /** Currently selected option value ('' when nothing is selected). */
  value: string
  /** Called when the respondent picks an option. */
  onChange: (value: string) => void
  /** Namespaces the radio inputs so multiple fields never collide. */
  name: string
  /** Accessible name for the radiogroup (usually the field label). */
  label: string
  /** Disables interaction (e.g. submission review). */
  readOnly?: boolean
}

/**
 * The single source of truth for PonkoForm's rating UI (stars, emoji, and NPS
 * scales). Both the live form (`SatisfactionField`) and the form-builder card
 * preview render through this component, so creators always see exactly what
 * respondents will see.
 */
export function RatingControl({ options, value, onChange, name, label, readOnly }: RatingControlProps) {
  const [hoveredRating, setHoveredRating] = useState<number | null>(null)
  const interactive = !readOnly
  const usesSvgStars = options.length > 0 && options.every((opt) => (opt.emoji?.trim() ?? '') === SVG_STAR_MARKER)

  const numericValue = value === '' ? Number.NaN : Number(value)
  const activeRating = hoveredRating ?? numericValue
  const hasActiveRating = !Number.isNaN(activeRating)
  const feedbackOption = options.find((opt) => Number(opt.value) === activeRating)

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div
        className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(2.5rem,1fr))] gap-1 sm:gap-2"
        role="radiogroup"
        aria-label={label}
      >
        {options.map((opt) => {
          const ratingValue = Number(opt.value)
          const isCurrent = value === opt.value
          const isActive = hasActiveRating && ratingValue <= activeRating
          const visual = opt.emoji?.trim() || opt.value
          return (
            <label
              key={opt.value}
              title={opt.label}
              onMouseEnter={interactive ? () => setHoveredRating(ratingValue) : undefined}
              onMouseLeave={interactive ? () => setHoveredRating(null) : undefined}
              className={`group flex min-h-11 min-w-0 items-center justify-center rounded-full p-1 text-center transition-all duration-200 focus-within:ring-2 focus-within:ring-[var(--ponko-primary-soft,#cc785c29)] sm:min-h-14 sm:p-2 ${
                interactive ? 'cursor-pointer' : 'cursor-default'
              } ${
                usesSvgStars
                  ? ''
                  : isCurrent || (interactive && hoveredRating === ratingValue)
                    ? 'border border-[var(--ponko-primary,#cc785c)] bg-[var(--ponko-primary-soft,#cc785c29)] shadow-sm'
                    : 'border border-[#e6dfd8] bg-white hover:border-[#cfc4b8] hover:bg-[#faf9f5]'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={isCurrent}
                disabled={!interactive}
                onChange={() => onChange(opt.value)}
                className="peer sr-only"
              />
              {usesSvgStars ? (
                <StarIcon
                  size={28}
                  filled={isActive}
                  className={`h-7 w-7 transition-all duration-200 sm:h-8 sm:w-8 ${
                    isActive
                      ? 'scale-100 text-[var(--ponko-primary,#cc785c)] drop-shadow-[0_1px_2px_rgba(204,120,92,0.35)]'
                      : 'scale-95 text-[#d9cfc2]'
                  } ${interactive ? 'group-hover:scale-110' : ''}`}
                />
              ) : isImageUrl(visual) ? (
                <img
                  src={visual}
                  alt=""
                  className="h-7 w-7 object-contain transition-transform duration-200 group-hover:scale-110 sm:h-9 sm:w-9"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className={`whitespace-nowrap text-xl leading-none transition-transform duration-200 sm:text-2xl ${
                    isActive ? 'text-[#d59b25]' : 'text-[#8e8b82]'
                  } ${interactive ? 'group-hover:scale-110' : ''}`}
                >
                  {visual}
                </span>
              )}
              <span className="sr-only">{opt.label}</span>
            </label>
          )
        })}
      </div>
      {interactive && (
        <p
          role="status"
          aria-atomic="true"
          className={`h-4 truncate text-xs font-medium text-[#a9583e] transition-opacity duration-150 motion-reduce:transition-none ${
            feedbackOption ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {feedbackOption?.label ?? ''}
        </p>
      )}
    </div>
  )
}
