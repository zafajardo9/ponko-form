import type { FieldConfig, FieldValue } from '../../../../lib/form-field-types'
import { inputBase, getAddressValue } from './utils'

interface Props {
  field: FieldConfig
  value: FieldValue
  onChange: (value: FieldValue) => void
  error?: string
  readOnly?: boolean
  hideLabel?: boolean
}

export function AddressField({ field, value, onChange, error, readOnly, hideLabel }: Props) {
  const addressValue = getAddressValue(value)
  const labelId = `field-label-${field.id}`
  const errorClass = error ? 'border-[#c64545] focus:border-[#c64545] focus:ring-[#c64545]/20' : ''

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <fieldset className="flex min-w-0 flex-col gap-1.5">
        {!hideLabel && (
          <legend id={labelId} className="text-sm font-medium text-[var(--ponko-foreground,#141413)]">
            {field.label || 'Untitled field'}
            {field.required && <span aria-hidden="true" className="ml-1 text-[#c64545]">*</span>}
          </legend>
        )}
        <div className="flex flex-col gap-3" role="group" aria-labelledby={hideLabel ? undefined : labelId} aria-label={hideLabel ? field.label : undefined}>
          {(!readOnly || addressValue.currentAddress) && (
            <input
              type="text"
              value={addressValue.currentAddress ?? ''}
              onChange={(e) => onChange({ ...addressValue, currentAddress: e.target.value })}
              disabled={readOnly}
              className={`${inputBase} ${errorClass} h-10`}
              placeholder="Current Address"
              aria-label="Current Address"
            />
          )}
          {(!readOnly || addressValue.apartment) && (
            <input
              type="text"
              value={addressValue.apartment ?? ''}
              onChange={(e) => onChange({ ...addressValue, apartment: e.target.value })}
              disabled={readOnly}
              className={`${inputBase} ${errorClass} h-10`}
              placeholder="Apartment, suite, etc."
              aria-label="Apartment"
            />
          )}
          {(!readOnly || addressValue.country) && (
            <input
              type="text"
              value={addressValue.country ?? ''}
              onChange={(e) => onChange({ ...addressValue, country: e.target.value })}
              disabled={readOnly}
              className={`${inputBase} ${errorClass} h-10`}
              placeholder="Country"
              aria-label="Country"
            />
          )}
          {(!readOnly || addressValue.city) && (
            <input
              type="text"
              value={addressValue.city ?? ''}
              onChange={(e) => onChange({ ...addressValue, city: e.target.value })}
              disabled={readOnly}
              className={`${inputBase} ${errorClass} h-10`}
              placeholder="City"
              aria-label="City"
            />
          )}
          {(!readOnly || addressValue.stateProvince) && (
            <input
              type="text"
              value={addressValue.stateProvince ?? ''}
              onChange={(e) => onChange({ ...addressValue, stateProvince: e.target.value })}
              disabled={readOnly}
              className={`${inputBase} ${errorClass} h-10`}
              placeholder="State/Province"
              aria-label="State/Province"
            />
          )}
          {(!readOnly || addressValue.zipPostalCode) && (
            <input
              type="text"
              value={addressValue.zipPostalCode ?? ''}
              onChange={(e) => onChange({ ...addressValue, zipPostalCode: e.target.value })}
              disabled={readOnly}
              className={`${inputBase} ${errorClass} h-10`}
              placeholder="ZIP/Postal Code"
              aria-label="ZIP/Postal Code"
            />
          )}
        </div>
      </fieldset>
    </div>
  )
}
