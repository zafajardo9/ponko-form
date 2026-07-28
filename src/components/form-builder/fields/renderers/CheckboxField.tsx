import type { FieldConfig, FieldValue } from '../../../../lib/form-field-types'
import { getArrValue, getOptions } from './utils'

interface Props {
  field: FieldConfig
  value: FieldValue
  onChange: (value: FieldValue) => void
  error?: string
  readOnly?: boolean
}

export function CheckboxField({ field, value, onChange, error, readOnly }: Props) {
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
        <legend id={labelId} className="text-sm font-medium text-[#141413]">
          {field.label || 'Untitled field'}
          {field.required && <span aria-hidden="true" className="ml-1 text-[#c64545]">*</span>}
        </legend>
        <div
          className="flex min-w-0 flex-col gap-3"
          role="group"
          aria-labelledby={labelId}
        >
          {options.map((opt) => {
            const selected = arrValue.includes(opt.value)
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
                  className="h-4 w-4 rounded border-[#cfc4b8] text-[var(--ponko-primary,#cc785c)] focus:ring-[var(--ponko-primary-soft,#cc785c29)]"
                  {...inputAccessibility}
                />
                <span className={`text-sm ${selected ? 'font-medium text-[#141413]' : 'text-[#6c6a64]'}`}>{opt.label}</span>
              </label>
            )
          })}
        </div>
      </fieldset>
    </div>
  )
}
