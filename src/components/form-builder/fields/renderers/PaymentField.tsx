import type { FieldConfig, FieldValue } from '../../../../lib/form-field-types'

interface Props {
  field: FieldConfig
  value: FieldValue
  onChange: (value: FieldValue) => void
  error?: string
  readOnly?: boolean
}

export function PaymentField({ field }: Props) {
  const labelId = `field-label-${field.id}`

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <fieldset className="flex min-w-0 flex-col gap-1.5">
        <legend id={labelId} className="text-sm font-medium text-[#141413]">
          {field.label || 'Untitled field'}
          {field.required && <span aria-hidden="true" className="ml-1 text-[#c64545]">*</span>}
        </legend>
      </fieldset>
    </div>
  )
}
