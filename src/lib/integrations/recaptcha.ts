import { eq } from 'drizzle-orm'
import { db } from '../../db/index'
import { forms } from '../../db/schema'
import type { FormPage, PageField } from '../page-builder/types'
import { getIntegrationConfig } from './credentials'
import type { RecaptchaConfig } from './types'

const VERIFIED_FIELD_IDS_KEY = '__recaptchaVerifiedFieldIds'

interface SiteVerifyResponse {
  success?: boolean
  hostname?: string
  'error-codes'?: string[]
}

export function verifiedRecaptchaFieldIds(data: Record<string, unknown>): number[] {
  const value = data[VERIFIED_FIELD_IDS_KEY]
  if (!Array.isArray(value)) return []
  return value.map(Number).filter(Number.isFinite)
}

export function withVerifiedRecaptchaFieldIds(
  data: Record<string, unknown>,
  fieldIds: number[],
): Record<string, unknown> {
  return { ...data, [VERIFIED_FIELD_IDS_KEY]: [...new Set(fieldIds)] }
}

/** Preserve server-owned metadata while preventing the browser from forging it. */
export function mergeSubmissionSessionData(
  stored: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const userData = Object.fromEntries(Object.entries(incoming).filter(([key]) => !key.startsWith('__')))
  const serverData = Object.fromEntries(Object.entries(stored).filter(([key]) => key.startsWith('__')))
  return { ...userData, ...serverData }
}

export function publicSubmissionData(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).filter(([key]) => !key.startsWith('__')))
}

export async function getRecaptchaConfigForForm(formId: number): Promise<RecaptchaConfig | null> {
  const [form] = await db
    .select({ profileId: forms.profileId })
    .from(forms)
    .where(eq(forms.id, formId))
    .limit(1)
  if (!form) return null
  return getIntegrationConfig<RecaptchaConfig>(form.profileId, 'recaptcha')
}

export async function verifyResponseToken(secretKey: string, token: string): Promise<void> {
  if (!token.trim()) throw new Error('Please complete the reCAPTCHA challenge.')
  const body = new URLSearchParams({ secret: secretKey, response: token })
  let response: Response
  try {
    response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(8_000),
    })
  } catch {
    throw new Error('Google reCAPTCHA could not be reached. Please try again.')
  }
  if (!response.ok) throw new Error('Google reCAPTCHA could not verify this response. Please try again.')
  const result = await response.json() as SiteVerifyResponse
  if (!result.success) {
    const expired = result['error-codes']?.includes('timeout-or-duplicate')
    throw new Error(expired
      ? 'The reCAPTCHA challenge expired. Please complete it again.'
      : 'Google reCAPTCHA verification failed. Please try again.')
  }
}

export async function verifyRecaptchaFields(
  formId: number,
  fields: PageField[],
  data: Record<string, unknown>,
  alreadyVerified: number[] = [],
): Promise<number[]> {
  const captchaFields = fields.filter((field) => field.fieldType === 'recaptcha')
  if (captchaFields.length === 0) return alreadyVerified
  const config = await getRecaptchaConfigForForm(formId)
  if (!config) throw new Error('This form’s reCAPTCHA protection is not configured. Please contact the form owner.')

  const verified = new Set(alreadyVerified)
  for (const field of captchaFields) {
    if (verified.has(field.id)) continue
    await verifyResponseToken(config.secretKey, String(data[field.bindVariable] ?? ''))
    verified.add(field.id)
  }
  return [...verified]
}

export function replaceRecaptchaTokensWithResult(
  pages: FormPage[],
  data: Record<string, unknown>,
  verifiedFieldIds: number[],
): Record<string, unknown> {
  const result = publicSubmissionData(data)
  const verified = new Set(verifiedFieldIds)
  for (const field of pages.flatMap((page) => page.fields)) {
    if (field.fieldType === 'recaptcha') result[field.bindVariable] = verified.has(field.id)
  }
  return result
}
