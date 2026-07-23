export interface LegacySubmissionField {
  id: number
  type: string
  label: string
  required: boolean
  options?: { value: string }[] | null
}

function isEmpty(value: unknown): boolean {
  return value == null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
}

function boundedString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string') throw new Error(`Field "${label}" needs text`)
  if (value.length > maxLength) {
    throw new Error(`Field "${label}" is too long`)
  }
  return value
}

export function sanitizeLegacySubmission(
  fields: LegacySubmissionField[],
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  if (fields.length > 200) throw new Error('This form has too many fields')
  const result: Record<string, unknown> = {}

  for (const field of fields) {
    const key = String(field.id)
    const value = incoming[key]
    if (field.required && isEmpty(value)) {
      throw new Error(`Field "${field.label}" is required`)
    }
    if (isEmpty(value)) continue

    const allowedOptions = new Set(
      (field.options ?? []).map((option) => option.value),
    )
    if (field.type === 'number') {
      const number = typeof value === 'number' ? value : Number(value)
      if (!Number.isFinite(number)) {
        throw new Error(`Field "${field.label}" needs a valid number`)
      }
      result[key] = number
      continue
    }
    if (field.type === 'email') {
      const email = boundedString(value, field.label, 320).trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error(`Field "${field.label}" needs a valid email address`)
      }
      result[key] = email
      continue
    }
    if (field.type === 'select' || field.type === 'radio') {
      const selected = boundedString(value, field.label, 1000)
      if (!allowedOptions.has(selected)) {
        throw new Error(`Field "${field.label}" has an invalid option`)
      }
      result[key] = selected
      continue
    }
    if (field.type === 'checkbox') {
      if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
        throw new Error(`Field "${field.label}" has invalid selections`)
      }
      const selected = [...new Set(value)]
      if (
        selected.length > allowedOptions.size ||
        selected.some((item) => !allowedOptions.has(item))
      ) {
        throw new Error(`Field "${field.label}" has invalid selections`)
      }
      result[key] = selected
      continue
    }

    result[key] = boundedString(
      value,
      field.label,
      field.type === 'textarea' ? 20_000 : 2_000,
    )
  }

  if (JSON.stringify(result).length > 1_000_000) {
    throw new Error('Form response is too large')
  }
  return result
}
