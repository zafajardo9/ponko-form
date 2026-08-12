export type DiscountKind = 'percentage' | 'fixed'

export interface DiscountRecord {
  id: number
  formId: number
  code: string
  description: string | null
  type: DiscountKind
  value: number
  maxDiscount: number | null
  minAmount: number | null
  maxUses: number | null
  currentUses: number
  isActive: boolean
  startsAt: Date | null
  expiresAt: Date | null
}

export interface DiscountApplication {
  discountId: number
  code: string
  description: string | null
  type: DiscountKind
  value: number
  discountAmount: number
  originalAmount: number
  finalAmount: number
}

export function normalizeDiscountCode(value: string): string {
  return value.trim().toUpperCase()
}

export function validateDiscountDefinition(input: {
  code: string
  type: DiscountKind
  value: number
  maxDiscount?: number | null
  minAmount?: number | null
  maxUses?: number | null
  startsAt?: Date | null
  expiresAt?: Date | null
}) {
  const code = normalizeDiscountCode(input.code)
  if (!/^[A-Z0-9][A-Z0-9_-]{2,49}$/.test(code)) {
    throw new Error('Code must be 3-50 characters using letters, numbers, underscores, or hyphens')
  }
  if (input.type === 'percentage' && (!Number.isInteger(input.value) || input.value <= 0 || input.value > 100)) {
    throw new Error('Percentage discount must be a whole number from 1 to 100')
  }
  if (input.type === 'fixed' && (!Number.isInteger(input.value) || input.value <= 0)) {
    throw new Error('Fixed discount must be a positive amount in minor units')
  }
  for (const [label, value] of [['Maximum discount', input.maxDiscount], ['Minimum order', input.minAmount]] as const) {
    if (value != null && (!Number.isInteger(value) || value < 0)) throw new Error(`${label} must be a non-negative amount`)
  }
  if (input.maxUses != null && (!Number.isInteger(input.maxUses) || input.maxUses <= 0)) {
    throw new Error('Maximum uses must be a positive whole number')
  }
  if (input.startsAt && input.expiresAt && input.startsAt >= input.expiresAt) {
    throw new Error('Start date must be before the expiry date')
  }
  return code
}

export function discountEligibility(discount: Pick<DiscountRecord, 'isActive' | 'startsAt' | 'expiresAt' | 'maxUses' | 'currentUses' | 'minAmount'>, amountMinor: number, now = new Date()): string | null {
  if (!discount.isActive) return 'This discount code is inactive'
  if (discount.startsAt && discount.startsAt > now) return 'This discount code is not active yet'
  if (discount.expiresAt && discount.expiresAt <= now) return 'This discount code has expired'
  if (discount.maxUses != null && discount.currentUses >= discount.maxUses) return 'This discount code has reached its usage limit'
  if (discount.minAmount != null && amountMinor < discount.minAmount) return 'This discount requires a higher order amount'
  return null
}

export function applyDiscount(discount: Pick<DiscountRecord, 'id' | 'code' | 'description' | 'type' | 'value' | 'maxDiscount'>, originalAmount: number): DiscountApplication {
  const safeOriginal = Math.max(0, Math.round(originalAmount))
  let discountAmount = discount.type === 'percentage'
    ? Math.round(safeOriginal * discount.value / 100)
    : discount.value
  if (discount.maxDiscount != null) discountAmount = Math.min(discountAmount, discount.maxDiscount)
  discountAmount = Math.max(0, Math.min(discountAmount, safeOriginal))
  return {
    discountId: discount.id,
    code: discount.code,
    description: discount.description,
    type: discount.type,
    value: discount.value,
    discountAmount,
    originalAmount: safeOriginal,
    finalAmount: safeOriginal - discountAmount,
  }
}
