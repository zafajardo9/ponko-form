import type { FieldConfig, FieldValue } from '../../../../lib/form-field-types'

interface Props {
  field: FieldConfig
  value: FieldValue
  onChange: (value: FieldValue) => void
  error?: string
  readOnly?: boolean
}

export function RecaptchaField({ field }: Props) {
  const labelId = `field-label-${field.id}`

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <fieldset className="flex min-w-0 flex-col gap-1.5">
        <legend id={labelId} className="text-sm font-medium text-[#141413]">
          {field.label || 'Untitled field'}
          {field.required && <span aria-hidden="true" className="ml-1 text-[#c64545]">*</span>}
        </legend>
        <div className="rounded-[var(--ponko-radius,6px)] border border-[#e6dfd8] bg-[#faf9f5] px-3.5 py-2.5 text-sm text-[#6c6a64]">
          reCAPTCHA verification is required to continue.
        </div>
      </fieldset>
    </div>
  )
}
