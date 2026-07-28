import type { FieldConfig, FieldValue } from '../../../../lib/form-field-types'
import { getStrValue } from './utils'
import { formatDateValue } from '../FieldRendererUtils'

interface Props {
  field: FieldConfig
  value: FieldValue
  onChange: (value: FieldValue) => void
  error?: string
  readOnly?: boolean
}

export function DateField({ field, value, onChange, error, readOnly }: Props) {
  const strValue = getStrValue(value)
  const inputId = `field-input-${field.id}`
  const labelId = `field-label-${field.id}`
  const errorId = `field-error-${field.id}`

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={inputId} id={labelId} className="text-sm font-medium text-[#141413]">
        {field.label || 'Untitled field'}
        {field.required && <span aria-hidden="true" className="ml-1 text-[#c64545]">*</span>}
      </label>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-[#c64545]">
          {error}
        </p>
      )}
      <div className={readOnly ? 'opacity-60' : ''}>
        <div className="flex items-stretch gap-2">
          <label
            className={`flex min-h-12 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-[var(--ponko-radius,8px)] border bg-[#faf9f5] px-3 transition-all hover:border-[#cfc4b8] focus-within:border-[var(--ponko-primary,#cc785c)] focus-within:bg-white focus-within:ring-2 focus-within:ring-[var(--ponko-primary-soft,#cc785c29)] ${
              error ? 'border-[#c64545]' : 'border-[#e6dfd8]'
            } ${readOnly ? 'cursor-not-allowed' : ''}`}
          >
            <input
              id={inputId}
              type="date"
              value={strValue}
              aria-label={field.label}
              onChange={(e) => onChange(e.target.value)}
              disabled={readOnly}
              required={field.required}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className="min-w-0 flex-1 cursor-pointer bg-transparent py-3 text-sm font-medium text-[#141413] outline-none [color-scheme:light] disabled:cursor-not-allowed"
            />
          </label>
          {strValue && !readOnly && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="flex h-12 w-10 items-center justify-center rounded-[var(--ponko-radius,8px)] text-[#8e8b82] transition-colors hover:text-[#141413] focus:ring-2 focus:ring-[var(--ponko-primary-soft,#cc785c29)]"
              aria-label={`Clear ${field.label || 'date'}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
        {strValue && <p className="mt-1.5 text-xs text-[#6c6a64]">{formatDateValue(strValue)}</p>}
      </div>
    </div>
  )
}
