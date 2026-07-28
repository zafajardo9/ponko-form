import { useState } from 'react'
import type { FieldConfig, FieldValue } from '../../../../lib/form-field-types'
import { StarIcon } from '../../../ui/StarIcon'
import { SVG_STAR_MARKER } from '../../../../lib/page-builder/satisfaction'
import { getStrValue, getOptions, isImageUrl } from './utils'

interface Props {
  field: FieldConfig
  value: FieldValue
  onChange: (value: FieldValue) => void
  error?: string
  readOnly?: boolean
}

export function SatisfactionField({ field, value, onChange, error: _error, readOnly }: Props) {
  const [hoveredRating, setHoveredRating] = useState<number | null>(null)
  const strValue = getStrValue(value)
  const options = getOptions(field)
  const usesSvgStars = options.length > 0 && options.every((opt) => (opt.emoji?.trim() ?? '') === SVG_STAR_MARKER)
  const labelId = `field-label-${field.id}`

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <fieldset className="flex min-w-0 flex-col gap-1.5">
        <legend id={labelId} className="text-sm font-medium text-[#141413]">
          {field.label || 'Untitled field'}
          {field.required && <span aria-hidden="true" className="ml-1 text-[#c64545]">*</span>}
        </legend>
        <div
          className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(2.5rem,1fr))] gap-1 sm:gap-2"
          role="radiogroup"
          aria-label={field.label}
        >
          {options.map((opt) => {
            const actualRating = hoveredRating ?? Number(strValue)
            const isCurrent = strValue === opt.value
            const isHovering = hoveredRating !== null
            const visual = opt.emoji?.trim() || opt.value
            const ratingValue = Number(opt.value)
            return (
              <label
                key={opt.value}
                title={opt.label}
                className={`group flex min-h-11 min-w-0 cursor-pointer items-center justify-center rounded-full p-1 text-center transition-all focus-within:ring-2 focus-within:ring-[var(--ponko-primary-soft,#cc785c29)] sm:min-h-14 sm:p-2 ${
                  isHovering
                    ? strValue === opt.value
                      ? 'scale-110 opacity-100 drop-shadow-sm'
                      : Number(opt.value) <= actualRating
                        ? 'scale-105 opacity-85'
                        : 'opacity-65'
                    : isCurrent
                      ? 'scale-110 opacity-100 drop-shadow-sm'
                      : 'opacity-65 hover:scale-105 hover:opacity-100'
                } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
                onMouseEnter={readOnly ? undefined : () => setHoveredRating(ratingValue)}
                onMouseLeave={readOnly ? undefined : () => setHoveredRating(null)}
              >
                <input
                  type="radio"
                  name={`field-${field.id}`}
                  value={opt.value}
                  checked={isCurrent}
                  disabled={readOnly}
                  onChange={() => onChange(opt.value)}
                  className="peer sr-only"
                />
                {usesSvgStars ? (
                  <StarIcon
                    size={28}
                    filled={ratingValue <= actualRating}
                    className={`h-7 w-7 sm:h-8 sm:w-8 ${
                      ratingValue <= actualRating
                        ? 'text-[var(--ponko-primary,#cc785c)]'
                        : 'text-[#c8beb3]'
                    }`}
                  />
                ) : isImageUrl(visual) ? (
                  <img src={visual} alt="" className="h-7 w-7 object-contain sm:h-9 sm:w-9" />
                ) : (
                  <span aria-hidden="true" className="whitespace-nowrap text-xl leading-none text-[#d59b25] sm:text-2xl">
                    {visual}
                  </span>
                )}
                <span className="sr-only">{opt.label}</span>
              </label>
            )
          })}
        </div>
      </fieldset>
    </div>
  )
}
