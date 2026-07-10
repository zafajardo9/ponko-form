import type { FieldCondition, FieldValidationRules, PageField } from './types'
import type { ReferenceMap } from './types'
import { resolveConditionExpected } from './references'

const DEFAULT_ADDRESS_REQUIRED = {
  currentAddress: true,
  apartment: false,
  city: true,
  stateProvince: true,
  zipPostalCode: true,
  country: true,
}

const ADDRESS_LABELS = {
  currentAddress: 'Current Address',
  apartment: 'Apartment',
  city: 'City',
  stateProvince: 'State/Province',
  zipPostalCode: 'ZIP/Postal Code',
  country: 'Country',
}

type AddressPart = keyof typeof DEFAULT_ADDRESS_REQUIRED

export function addressRequiredParts(field: Pick<PageField, 'validationRules'>): Record<AddressPart, boolean> {
  return {
    ...DEFAULT_ADDRESS_REQUIRED,
    ...(field.validationRules?.addressRequired ?? {}),
  }
}

export function missingAddressParts(field: Pick<PageField, 'validationRules'>, value: unknown): string[] {
  const address = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const required = addressRequiredParts(field)
  return (Object.keys(required) as AddressPart[])
    .filter((part) => required[part] && !String(address[part] ?? '').trim())
    .map((part) => ADDRESS_LABELS[part])
}

function isEmpty(value: unknown): boolean {
  if (value == null) return true
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).every((item) => String(item ?? '').trim() === '')
  }
  return String(value).trim() === ''
}

function comparable(value: unknown): number {
  if (value instanceof Date) return value.getTime()
  const asNumber = Number(value)
  if (Number.isFinite(asNumber)) return asNumber
  const asDate = Date.parse(String(value))
  return Number.isFinite(asDate) ? asDate : Number.NaN
}

export function evaluateCondition(
  condition: Pick<FieldCondition, 'sourceFieldBinding' | 'operator' | 'value'>,
  data: Record<string, unknown>,
  references: ReferenceMap = {},
): boolean {
  const source = data[condition.sourceFieldBinding]
  const expected = resolveConditionExpected(condition.value, references)

  switch (condition.operator) {
    case 'is_empty':
      return isEmpty(source)
    case 'is_not_empty':
      return !isEmpty(source)
    case 'equals':
      return Array.isArray(source)
        ? source.map(String).includes(expected)
        : String(source ?? '') === expected
    case 'not_equals':
      return Array.isArray(source)
        ? !source.map(String).includes(expected)
        : String(source ?? '') !== expected
    case 'contains':
      return Array.isArray(source)
        ? source.map(String).some((item) => item.includes(expected))
        : String(source ?? '').includes(expected)
    case 'greater_than':
      return comparable(source) > comparable(expected)
    case 'less_than':
      return comparable(source) < comparable(expected)
    default:
      return false
  }
}

export function isFieldVisible(
  field: Pick<PageField, 'conditions'>,
  data: Record<string, unknown>,
  references: ReferenceMap = {},
): boolean {
  if (field.conditions.length === 0) return true
  const action = field.conditions[0]?.action ?? 'show'
  const passes = field.conditions.every((condition) => evaluateCondition(condition, data, references))
  return action === 'show' ? passes : !passes
}

export function visibleFields(
  fields: PageField[],
  data: Record<string, unknown>,
  references: ReferenceMap = {},
): PageField[] {
  return fields.filter((field) => isFieldVisible(field, data, references))
}

export function pruneHiddenValues(
  fields: PageField[],
  data: Record<string, unknown>,
  references: ReferenceMap = {},
): Record<string, unknown> {
  const visible = new Set(visibleFields(fields, data, references).map((field) => field.bindVariable))
  return Object.fromEntries(Object.entries(data).filter(([key]) => visible.has(key)))
}

function defaultRuleMessage(field: Pick<PageField, 'label'>, detail: string) {
  const label = field.label || 'This field'
  return `${label} ${detail}`
}

function regexFromPattern(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern)
  } catch {
    return null
  }
}

function allowedRegex(rules: FieldValidationRules): RegExp | null {
  switch (rules.allowedCharacters ?? 'any') {
    case 'letters':
      return /^[A-Za-z\s]*$/
    case 'numbers':
      return /^[0-9]*$/
    case 'alphanumeric':
      return /^[A-Za-z0-9\s]*$/
    case 'custom':
      return rules.customPattern ? regexFromPattern(rules.customPattern) : null
    default:
      return null
  }
}

export function sanitizeFieldValue(field: PageField, value: unknown): unknown {
  if (field.fieldType === 'file_upload') {
    if (!Array.isArray(value)) return []
    return value
      .filter((item) => item && typeof item === 'object')
      .map((item) => {
        const file = item as Record<string, unknown>
        return {
          name: String(file.name ?? ''),
          size: Number(file.size ?? 0),
          type: String(file.type ?? ''),
          lastModified: Number(file.lastModified ?? 0),
          dataUrl: typeof file.dataUrl === 'string' ? file.dataUrl : undefined,
        }
      })
      .filter((file) => file.name)
  }
  if (field.fieldType === 'address' && value && typeof value === 'object' && !Array.isArray(value)) {
    const address = value as Record<string, unknown>
    return {
      currentAddress: String(address.currentAddress ?? ''),
      apartment: String(address.apartment ?? ''),
      country: String(address.country ?? ''),
      city: String(address.city ?? ''),
      stateProvince: String(address.stateProvince ?? address.state ?? ''),
      zipPostalCode: String(address.zipPostalCode ?? ''),
    }
  }
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return value
  const rules = field.validationRules
  if (!rules) return value
  switch (rules.allowedCharacters ?? 'any') {
    case 'letters':
      return value.replace(/[^A-Za-z\s]/g, '')
    case 'numbers':
      return value.replace(/[^0-9]/g, '')
    case 'alphanumeric':
      return value.replace(/[^A-Za-z0-9\s]/g, '')
    default:
      return value
  }
}

export function validateFieldRules(
  field: PageField,
  value: unknown,
): string | null {
  const rules = field.validationRules
  if (!rules) return null
  if (isEmpty(value)) {
    return null
  }

  const message = rules.message?.trim()
  const text = Array.isArray(value)
    ? value.join(',')
    : typeof value === 'object'
      ? Object.values(value as Record<string, unknown>).map((item) => String(item ?? '')).join(',')
      : String(value)
  const allowed = allowedRegex(rules)
  if (allowed && !allowed.test(text)) {
    return message || defaultRuleMessage(field, 'contains characters that are not allowed.')
  }

  if (rules.minLength != null && text.length < rules.minLength) {
    return message || defaultRuleMessage(field, `must be at least ${rules.minLength} characters.`)
  }
  if (rules.maxLength != null && text.length > rules.maxLength) {
    return message || defaultRuleMessage(field, `must be no more than ${rules.maxLength} characters.`)
  }

  const numeric = Number(text)
  if (rules.minValue != null && Number.isFinite(numeric) && numeric < rules.minValue) {
    return message || defaultRuleMessage(field, `must be at least ${rules.minValue}.`)
  }
  if (rules.maxValue != null && Number.isFinite(numeric) && numeric > rules.maxValue) {
    return message || defaultRuleMessage(field, `must be no more than ${rules.maxValue}.`)
  }

  return null
}
