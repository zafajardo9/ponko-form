import type { FieldConfig } from '../components/form-builder/fields/FieldRenderer'

export function validateField(field: FieldConfig, value: string | string[]): string | null {
  const strVal = Array.isArray(value) ? value.join('') : value
  const arrVal = Array.isArray(value) ? value : []

  if (field.required) {
    if (Array.isArray(value) && arrVal.length === 0) return 'This field is required'
    if (!Array.isArray(value) && !strVal.trim()) return 'This field is required'
  }

  if (strVal && field.type === 'email') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strVal)) return 'Please enter a valid email address'
  }

  if (strVal && field.type === 'number') {
    if (isNaN(Number(strVal))) return 'Please enter a valid number'
  }

  return null
}

export function validateForm(
  fields: FieldConfig[],
  values: Record<number, string | string[]>,
): Record<number, string> {
  const errors: Record<number, string> = {}
  for (const field of fields) {
    const error = validateField(field, values[field.id] ?? '')
    if (error) errors[field.id] = error
  }
  return errors
}
