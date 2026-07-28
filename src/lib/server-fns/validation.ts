export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export function jsonObject(value: unknown): Record<string, JsonValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) => {
      if (item === undefined || typeof item === 'function' || typeof item === 'symbol') {
        return []
      }
      return [[key, jsonValue(item)]]
    }),
  )
}

function jsonValue(value: unknown): JsonValue {
  if (value === undefined) return null
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (Array.isArray(value)) return value.map(jsonValue)
  return jsonObject(value)
}

export function paymentAmountMinor(value: unknown) {
  const amountMajor = Number(value ?? 0)
  if (!Number.isFinite(amountMajor) || amountMajor <= 0) {
    throw new Error('Nothing to pay — the amount is zero or invalid')
  }
  return Math.round(amountMajor * 100)
}

const allowedSubmissionPageSizes = new Set([10, 25, 50, 100])

export function normalizeSubmissionPageSize(value?: number) {
  return value && allowedSubmissionPageSizes.has(value) ? value : 25
}
