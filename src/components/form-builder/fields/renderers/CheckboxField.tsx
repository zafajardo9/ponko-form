import type { FieldConfig, FieldValue } from '../../../../lib/form-field-types'
import { getArrValue, getOptions } from './utils'

interface Props {
  field: FieldConfig
  value: FieldValue
  onChange: (value: FieldValue) => void
  error?: string
  readOnly?: boolean
  hideLabel?: boolean
}

export function CheckboxField({ field, value, onChange, error, readOnly, hideLabel }: Props) {
  const arrValue = getArrValue(value)
  const options = getOptions(field)
  const labelId = `field-label-${field.id}`
  const inputId = `field-input-${field.id}`
  const errorId = `field-error-${field.id}`
  const inputAccessibility = {
    id: inputId,
    required: field.required,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? errorId : undefined as string | undefined,
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <fieldset className="flex min-w-0 flex-col gap-1.5">
        {!hideLabel && (
          <legend id={labelId} className="text-sm font-medium text-[var(--ponko-foreground,#141413)]">
            {field.label || 'Untitled field'}
            {field.required && <span aria-hidden="true" className="ml-1 text-[#c64545]">*</span>}
          </legend>
        )}
        <div
          className="flex min-w-0 flex-col gap-3"
          role="group"
          aria-labelledby={hideLabel ? undefined : labelId}
          aria-label={hideLabel ? field.label : undefined}
        >
          {options.map((opt) => {
            const selected = arrValue.includes(opt.value)
            return (
              <label
                key={opt.value}
                className={`group flex min-h-12 cursor-pointer items-center gap-3 px-3.5 py-3 transition-all focus-within:ring-2 focus-within:ring-[var(--ponko-primary-soft,#cc785c29)] ${
                  readOnly ? 'cursor-not-allowed opacity-60' : ''
                }`}
              >
                <input
                  type="checkbox"
                  value={opt.value}
                  checked={selected}
                  disabled={readOnly}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onChange([...arrValue, opt.value])
                    } else {
                      onChange(arrValue.filter((v) => v !== opt.value))
                    }
                  }}
                  className="peer sr-only"
                  {...inputAccessibility}
                />
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-150 ${
                    selected
                      ? 'border-[var(--ponko-primary,#cc785c)] bg-[var(--ponko-primary,#cc785c)]'
                      : 'border-[#cfc4b8] bg-white group-hover:border-[var(--ponko-primary,#cc785c)]'
                  }`}
                >
                  <svg
                    viewBox="0 0 12 12"
                    fill="none"
                    className={`h-3 w-3 text-white transition-transform duration-150 ${selected ? 'scale-100' : 'scale-0'}`}
                  >
                    <path
                      d="M2.5 6.5L4.5 8.5L9.5 3.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className={`text-sm ${selected ? 'font-medium text-[var(--ponko-foreground,#141413)]' : 'text-[var(--ponko-foreground-muted,#6c6a64)]'}`}>{opt.label}</span>
              </label>
            )
          })}
        </div>
      </fieldset>
    </div>
  )
}
