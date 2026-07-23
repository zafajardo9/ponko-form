import type {
  PageField,
  SubscriptionConfig,
  SubscriptionIntervalPreset,
} from '../page-builder/types'

export const SUBSCRIPTION_PRESETS: Record<
  SubscriptionIntervalPreset,
  { unit: 'WEEK' | 'MONTH'; count: number; label: string; shortLabel: string }
> = {
  weekly: { unit: 'WEEK', count: 1, label: 'Weekly', shortLabel: 'week' },
  monthly: { unit: 'MONTH', count: 1, label: 'Monthly', shortLabel: 'month' },
  quarterly: { unit: 'MONTH', count: 3, label: 'Quarterly', shortLabel: '3 months' },
  semiannual: { unit: 'MONTH', count: 6, label: 'Semiannual', shortLabel: '6 months' },
  annual: { unit: 'MONTH', count: 12, label: 'Annual', shortLabel: 'year' },
}

export function subscriptionPaymentsEnabled() {
  return process.env.SUBSCRIPTION_PAYMENTS_ENABLED !== 'false'
}

export function normalizedSubscriptionConfig(input: SubscriptionConfig | null | undefined): SubscriptionConfig | null {
  if (!input?.enabled) return null
  const preset = SUBSCRIPTION_PRESETS[input.interval]
  if (!preset) throw new Error('Select a valid subscription interval')
  const trialPeriodDays = Number(input.trialPeriodDays ?? 0)
  const maxCycles = input.maxCycles == null ? null : Number(input.maxCycles)
  if (!Number.isSafeInteger(trialPeriodDays) || trialPeriodDays < 0 || trialPeriodDays > 365) {
    throw new Error('Trial period must be between 0 and 365 days')
  }
  if (maxCycles != null && (!Number.isSafeInteger(maxCycles) || maxCycles < 1 || maxCycles > 32_000)) {
    throw new Error('Maximum billing cycles must be between 1 and 32,000')
  }
  if (!input.customerNameField?.trim()) throw new Error('Select a customer name field')
  if (!input.customerEmailField?.trim()) throw new Error('Select a customer email field')
  return {
    enabled: true,
    interval: input.interval,
    intervalUnit: preset.unit,
    intervalCount: preset.count,
    trialPeriodDays,
    maxCycles,
    customerNameField: input.customerNameField.trim(),
    customerEmailField: input.customerEmailField.trim(),
  }
}

export function validateSubscriptionBindings(
  config: SubscriptionConfig,
  paymentPage: { position: number },
  pages: Array<{
    position: number
    fields: Array<Pick<PageField, 'bindVariable' | 'fieldType'>>
  }>,
) {
  const earlierFields = pages
    .filter((page) => page.position < paymentPage.position)
    .flatMap((page) => page.fields)
  const nameField = earlierFields.find((field) => field.bindVariable === config.customerNameField)
  const emailField = earlierFields.find((field) => field.bindVariable === config.customerEmailField)
  if (!nameField || !['text', 'textarea'].includes(nameField.fieldType)) {
    throw new Error('Customer name must use a text field from an earlier page')
  }
  if (!emailField || emailField.fieldType !== 'email') {
    throw new Error('Customer email must use an email field from an earlier page')
  }
}

export function subscriptionAnchorDate(trialPeriodDays: number, now = new Date()) {
  const anchor = new Date(now)
  anchor.setUTCDate(anchor.getUTCDate() + Math.max(0, trialPeriodDays))
  // Xendit's recurring anchor supports month dates through day 28. Move a
  // 29th–31st target to the next month's first day, keeping the adjustment to
  // at most three days and never producing a past anchor.
  if (anchor.getUTCDate() > 28) {
    anchor.setUTCDate(1)
    anchor.setUTCMonth(anchor.getUTCMonth() + 1)
  }
  return anchor
}

export function subscriptionIntervalLabel(config: Pick<SubscriptionConfig, 'interval'>) {
  return SUBSCRIPTION_PRESETS[config.interval].shortLabel
}

export function subscriptionCustomer(
  config: SubscriptionConfig,
  data: Record<string, unknown>,
) {
  const name = String(data[config.customerNameField] ?? '').trim()
  const email = String(data[config.customerEmailField] ?? '').trim().toLowerCase()
  if (!name || name.length > 50 || !/^[\p{L}\p{N} .'-]+$/u.test(name)) {
    throw new Error('Enter a valid customer name (50 characters maximum)')
  }
  if (email.length > 50 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid customer email address (50 characters maximum)')
  }
  return { name, email }
}

export function subscriptionIdentityFields(fields: PageField[]) {
  return {
    names: fields.filter((field) => ['text', 'textarea'].includes(field.fieldType)),
    emails: fields.filter((field) => field.fieldType === 'email'),
  }
}
