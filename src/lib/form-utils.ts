import type { FieldConfig, FieldValue } from '../components/form-builder/fields/FieldRenderer'

function isAddressEmpty(field: FieldConfig, value: FieldValue) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return true
  const options = new Map((field.options ?? []).map((option) => [option.label, option.value]))
  const isRequired = (key: string, fallback: boolean) => options.get(`required:${key}`) === 'true' || (options.get(`required:${key}`) == null && fallback)
  return (isRequired('currentAddress', true) && !String(value.currentAddress ?? '').trim()) ||
    (isRequired('apartment', false) && !String(value.apartment ?? '').trim()) ||
    (isRequired('city', true) && !String(value.city ?? '').trim()) ||
    (isRequired('stateProvince', true) && !String(value.stateProvince ?? '').trim()) ||
    (isRequired('zipPostalCode', true) && !String(value.zipPostalCode ?? '').trim()) ||
    (isRequired('country', true) && !String(value.country ?? '').trim())
}

export function validateField(field: FieldConfig, value: FieldValue): string | null {
  const strVal = String(Array.isArray(value)
    ? value.join('')
    : value && typeof value === 'object'
      ? Object.values(value).join('')
      : value ?? '')
  const arrVal = Array.isArray(value) ? value : []

  if (field.required) {
    if (field.type === 'address' && isAddressEmpty(field, value)) return 'This field is required'
    if (Array.isArray(value) && arrVal.length === 0) return 'This field is required'
    if (!Array.isArray(value) && typeof value !== 'object' && !strVal.trim()) return 'This field is required'
  }

  if (strVal && field.type === 'email') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strVal)) return 'Please enter a valid email address'
  }

  if (strVal && field.type === 'number') {
    if (isNaN(Number(strVal))) return 'Please enter a valid number'
  }

  if (strVal && field.type === 'satisfaction' && !field.options?.some((option) => option.value === String(strVal))) {
    return 'Please select a valid rating'
  }

  return null
}

export function validateForm(
  fields: FieldConfig[],
  values: Record<number, FieldValue>,
): Record<number, string> {
  const errors: Record<number, string> = {}
  for (const field of fields) {
    const error = validateField(field, values[field.id] ?? '')
    if (error) errors[field.id] = error
  }
  return errors
}
