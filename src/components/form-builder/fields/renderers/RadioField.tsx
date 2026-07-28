import type { FieldConfig, FieldValue } from '../../../../lib/form-field-types'
import { getStrValue, getOptions } from './utils'

interface Props {
  field: FieldConfig
  value: FieldValue
  onChange: (value: FieldValue) => void
  error?: string
  readOnly?: boolean
}

export function RadioField({ field, value, onChange, error, readOnly }: Props) {
  const strValue = getStrValue(value)
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
        <legend id={labelId} className="text-sm font-medium text-[#141413]">
          {field.label || 'Untitled field'}
          {field.required && <span aria-hidden="true" className="ml-1 text-[#c64545]">*</span>}
        </legend>
        <div
          className="flex min-w-0 flex-col gap-3"
          role="radiogroup"
          aria-labelledby={labelId}
        >
          {options.map((opt) => {
            const selected = strValue === opt.value
            return (
              <label
                key={opt.value}
                className={`group flex min-h-12 cursor-pointer items-center gap-3 rounded-[var(--ponko-radius,8px)] border px-3.5 py-3 transition-all focus-within:ring-2 focus-within:ring-[var(--ponko-primary-soft,#cc785c29)] ${
                  selected
                    ? 'border-[var(--ponko-primary,#cc785c)] bg-[var(--ponko-primary-soft,#cc785c29)] shadow-sm'
                    : 'border-[#e6dfd8] bg-[#faf9f5] hover:border-[#cfc4b8] hover:bg-white'
                } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <input
                  type="radio"
                  name={`field-${field.id}`}
                  value={opt.value}
                  checked={selected}
                  disabled={readOnly}
                  onChange={() => onChange(opt.value)}
                  className="peer sr-only"
                  {...inputAccessibility}
                />
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors peer-checked:border-[var(--ponko-primary,#cc785c)] peer-checked:bg-[var(--ponko-primary,#cc785c)] group-hover:border-[var(--ponko-primary,#cc785c)]">
                  <span className={`h-2 w-2 rounded-full bg-white transition-transform ${selected ? 'scale-100' : 'scale-0'}`} />
                </span>
                <span className={`text-sm ${selected ? 'font-medium text-[#3d3d3a]' : 'text-[#141413]'}`}>{opt.label}</span>
              </label>
            )
          })}
        </div>
      </fieldset>
    </div>
  )
}
