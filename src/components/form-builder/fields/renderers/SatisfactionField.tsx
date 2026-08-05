import type { FieldConfig, FieldValue } from '../../../../lib/form-field-types'
import { getStrValue, getOptions } from './utils'
import { RatingControl } from './RatingControl'

interface Props {
  field: FieldConfig
  value: FieldValue
  onChange: (value: FieldValue) => void
  error?: string
  readOnly?: boolean
  /** Hides the label — used by read-only previews that render their own heading. */
  hideLabel?: boolean
}

export function SatisfactionField({ field, value, onChange, error: _error, readOnly, hideLabel }: Props) {
  const strValue = getStrValue(value)
  const options = getOptions(field)
  const labelId = `field-label-${field.id}`

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <fieldset className="flex min-w-0 flex-col gap-1.5">
        {!hideLabel && (
          <legend id={labelId} className="text-sm font-medium text-[#141413]">
            {field.label || 'Untitled field'}
            {field.required && <span aria-hidden="true" className="ml-1 text-[#c64545]">*</span>}
          </legend>
        )}
        <RatingControl
          options={options}
          value={strValue}
          onChange={onChange}
          name={`field-${field.id}`}
          label={field.label || 'Untitled field'}
          readOnly={readOnly}
        />
      </fieldset>
    </div>
  )
}
