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
 *
 * Layout: options sit centered with comfortable gaps. When they don't fit on
 * narrow screens (e.g. an 11-point NPS scale on mobile), the row wraps into
 * centered rows instead of scrolling horizontally.
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
        className="flex min-w-0 flex-wrap items-center justify-center gap-1.5 px-1 sm:gap-2"
        role="radiogroup"
        aria-label={label}
      >
        {options.map((opt) => {
          const ratingValue = Number(opt.value)
          const isCurrent = value === opt.value
          const isActive = hasActiveRating && ratingValue <= activeRating
          const optionVisual = opt.emoji?.trim() ?? ''
          const visual = optionVisual || opt.value
          const isNumericOption =
            !usesSvgStars && !isImageUrl(visual) && (!optionVisual || optionVisual === opt.value)
          const usesTextStars = !usesSvgStars && visual.includes('★')
          return (
            <label
              key={opt.value}
              title={opt.label}
              onMouseEnter={interactive ? () => setHoveredRating(ratingValue) : undefined}
              onMouseLeave={interactive ? () => setHoveredRating(null) : undefined}
              className={`group flex h-11 flex-none items-center justify-center text-center transition-all duration-200 focus-within:rounded-lg focus-within:ring-2 focus-within:ring-[var(--ponko-primary-soft,#cc785c29)] sm:h-14 ${
                interactive ? 'cursor-pointer' : 'cursor-default'
              } ${
                isNumericOption
                  ? `w-11 rounded-full p-1 sm:w-14 sm:p-2 ${
                      isCurrent || (interactive && hoveredRating === ratingValue)
                        ? 'border border-[var(--ponko-primary,#cc785c)] bg-[var(--ponko-primary-soft,#cc785c29)] shadow-sm'
                        : 'border border-[#e6dfd8] bg-white hover:border-[#cfc4b8] hover:bg-[#faf9f5]'
                    }`
                  : 'min-w-11 px-1 sm:min-w-14 sm:px-2'
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
                  className={`h-8 w-8 object-contain transition-transform duration-200 sm:h-10 sm:w-10 ${
                    isCurrent ? 'scale-110 drop-shadow-sm' : ''
                  } ${interactive ? 'group-hover:scale-110' : ''}`}
                />
              ) : (
                <span
                  aria-hidden="true"
                  className={`whitespace-nowrap leading-none transition-transform duration-200 ${
                    isNumericOption
                      ? 'max-w-full truncate text-lg sm:text-xl'
                      : usesTextStars
                        ? 'text-lg sm:text-xl'
                        : 'text-2xl sm:text-3xl'
                  } ${
                    isNumericOption && isActive
                      ? 'text-[#d59b25]'
                      : isNumericOption
                        ? 'text-[#8e8b82]'
                        : ''
                  } ${
                    !isNumericOption && isCurrent ? 'scale-110 drop-shadow-sm' : ''
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
