import type { FieldConfig, FieldValue } from '../../../../lib/form-field-types'
import { inputBase, getStrValue, getOptions, formatMoney } from './utils'

interface Props {
  field: FieldConfig
  value: FieldValue
  onChange: (value: FieldValue) => void
  error?: string
  readOnly?: boolean
}

export function SelectField({ field, value, onChange, error, readOnly }: Props) {
  const strValue = getStrValue(value)
  const options = getOptions(field)
  const inputId = `field-input-${field.id}`
  const labelId = `field-label-${field.id}`
  const errorId = `field-error-${field.id}`
  const errorClass = error ? 'border-[#c64545] focus:border-[#c64545] focus:ring-[#c64545]/20' : ''

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
      <select
        id={inputId}
        value={strValue}
        onChange={(e) => onChange(e.target.value)}
        disabled={readOnly}
        required={field.required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`${inputBase} ${errorClass} h-10`}
      >
        {!field.required && <option value="">{field.placeholder || 'Select…'}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label} {opt.price != null ? formatMoney(opt.price, 'PHP') : ''}
          </option>
        ))}
      </select>
    </div>
  )
}
