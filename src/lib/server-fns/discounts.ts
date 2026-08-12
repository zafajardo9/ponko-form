import { createServerFn } from '@tanstack/react-start'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db/index'
import { discountCodeForms, discountCodes, formCollaborators, formPages, forms, paymentGateways } from '@/db/schema'
import { applyDiscount, discountEligibility, normalizeDiscountCode, validateDiscountDefinition } from '../discounts'
import { currentAuth as auth } from '../auth.server'
import { ensureProfile } from '../profile.server'
import { assertFormAccess } from './flow-helpers'

type DiscountInput = {
  code: string
  description?: string | null
  type: 'percentage' | 'fixed'
  value: number
  maxDiscount?: number | null
  minAmount?: number | null
  maxUses?: number | null
  isActive?: boolean
  startsAt?: string | null
  expiresAt?: string | null
  formIds: number[]
}

function parseDate(value: string | null | undefined, label: string): Date | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error(`${label} is not a valid date`)
  return date
}

type DiscountFormAssignment = { id: number; title: string }

function publicCode(code: typeof discountCodes.$inferSelect, assignedForms: DiscountFormAssignment[] = []) {
  return {
    id: code.id, code: code.code, description: code.description, type: code.type, value: code.value,
    maxDiscount: code.maxDiscount, minAmount: code.minAmount, maxUses: code.maxUses,
    currentUses: code.currentUses, isActive: code.isActive, startsAt: code.startsAt,
    expiresAt: code.expiresAt,
    formIds: assignedForms.map((form) => form.id),
    formNames: assignedForms.map((form) => form.title),
    createdAt: code.createdAt, updatedAt: code.updatedAt,
  }
}

async function currentUser() {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  return ensureProfile(userId)
}

async function accessibleForms(profileId: number) {
  const owned = await db.select({ id: forms.id, title: forms.title, description: forms.description, status: forms.status })
    .from(forms).where(eq(forms.profileId, profileId)).orderBy(asc(forms.title))
  const shared = await db.select({ id: forms.id, title: forms.title, description: forms.description, status: forms.status, role: formCollaborators.role })
    .from(formCollaborators).innerJoin(forms, eq(formCollaborators.formId, forms.id))
    .where(eq(formCollaborators.profileId, profileId)).orderBy(asc(forms.title))
  const seen = new Set<number>()
  const accessible = [
    ...owned.map((form) => ({ ...form, canEdit: true, accessRole: 'owner' as const })),
    ...shared.map((form) => ({ ...form, canEdit: form.role === 'editor', accessRole: form.role })),
  ].filter((form) => !seen.has(form.id) && seen.add(form.id))
  if (!accessible.length) return []

  const paymentRows = await db.select({
    formId: formPages.formId,
    gatewayName: paymentGateways.name,
    gatewaySlug: paymentGateways.slug,
    currency: formPages.paymentCurrency,
    computation: formPages.paymentComputation,
    amountVariable: formPages.paymentAmountVariable,
    subscription: formPages.subscriptionConfig,
  }).from(formPages)
    .leftJoin(paymentGateways, eq(formPages.paymentGatewayId, paymentGateways.id))
    .where(and(inArray(formPages.formId, accessible.map((form) => form.id)), eq(formPages.hasPayment, true)))
    .orderBy(asc(formPages.position))

  const paymentsByForm = new Map<number, typeof paymentRows[number]>()
  for (const payment of paymentRows) {
    if (!paymentsByForm.has(payment.formId)) paymentsByForm.set(payment.formId, payment)
  }

  return accessible.map((form) => {
    const payment = paymentsByForm.get(form.id)
    return {
      ...form,
      payment: payment ? {
        mode: payment.subscription?.enabled ? 'subscription' as const : 'one_time' as const,
        gatewayName: payment.gatewayName,
        gatewaySlug: payment.gatewaySlug,
        currency: payment.currency,
        pricingMode: payment.computation?.mode ?? (payment.amountVariable ? 'field' : 'configured'),
      } : null,
    }
  })
}

async function codeForms(codeIds: number[]) {
  if (!codeIds.length) return new Map<number, DiscountFormAssignment[]>()
  const rows = await db.select({ discountCodeId: discountCodeForms.discountCodeId, id: forms.id, title: forms.title })
    .from(discountCodeForms).innerJoin(forms, eq(discountCodeForms.formId, forms.id))
    .where(inArray(discountCodeForms.discountCodeId, codeIds))
  const result = new Map<number, DiscountFormAssignment[]>()
  for (const row of rows) {
    result.set(row.discountCodeId, [...(result.get(row.discountCodeId) ?? []), { id: row.id, title: row.title }])
  }
  return result
}

async function validateAssignments(formIds: number[], profileId: number) {
  const uniqueIds = [...new Set(formIds.filter((id) => Number.isInteger(id) && id > 0))]
  if (!uniqueIds.length) throw new Error('Select at least one form')
  for (const formId of uniqueIds) {
    const form = await db.select({ id: forms.id, profileId: forms.profileId }).from(forms).where(eq(forms.id, formId)).limit(1)
    if (!form[0]) throw new Error('One of the selected forms was not found')
    if (form[0].profileId !== profileId) {
      const access = await db.select({ role: formCollaborators.role }).from(formCollaborators)
        .where(and(eq(formCollaborators.formId, formId), eq(formCollaborators.profileId, profileId))).limit(1)
      if (access[0]?.role !== 'editor') throw new Error('You can only assign discounts to forms you can edit')
    }
  }
  return uniqueIds
}

export const getDiscountWorkspace = createServerFn({ method: 'GET' }).handler(async () => {
  const profile = await currentUser()
  const [codes, formsForUser] = await Promise.all([
    db.select().from(discountCodes).where(eq(discountCodes.profileId, profile.id)).orderBy(desc(discountCodes.createdAt)),
    accessibleForms(profile.id),
  ])
  const names = await codeForms(codes.map((code) => code.id))
  return { codes: codes.map((code) => publicCode(code, names.get(code.id) ?? [])), forms: formsForUser }
})

export const getDiscountCodes = createServerFn({ method: 'GET' }).validator((data: { formId: number }) => data).handler(async ({ data }) => {
  const profile = await currentUser()
  await assertFormAccess(data.formId, profile.authId)
  const rows = await db.select({ code: discountCodes }).from(discountCodes)
    .innerJoin(discountCodeForms, eq(discountCodeForms.discountCodeId, discountCodes.id))
    .where(and(eq(discountCodes.profileId, profile.id), eq(discountCodeForms.formId, data.formId)))
  return rows.map(({ code }) => publicCode(code, []))
})

export const createDiscountCode = createServerFn({ method: 'POST' }).validator((data: DiscountInput) => data).handler(async ({ data }) => {
  const profile = await currentUser()
  const formIds = await validateAssignments(data.formIds, profile.id)
  const startsAt = parseDate(data.startsAt, 'Start date')
  const expiresAt = parseDate(data.expiresAt, 'Expiry date')
  const code = validateDiscountDefinition({ ...data, startsAt, expiresAt })
  if (!data.description?.trim()) throw new Error('Description is required')
  const [existing] = await db.select({ id: discountCodes.id }).from(discountCodes).where(and(eq(discountCodes.profileId, profile.id), eq(discountCodes.code, code))).limit(1)
  if (existing) throw new Error('That discount code already exists')
  const [created] = await db.insert(discountCodes).values({ profileId: profile.id, code, description: data.description.trim(), type: data.type, value: data.value, maxDiscount: data.maxDiscount ?? null, minAmount: data.minAmount ?? null, maxUses: data.maxUses ?? null, isActive: data.isActive ?? true, startsAt, expiresAt }).returning()
  await db.insert(discountCodeForms).values(formIds.map((formId) => ({ discountCodeId: created.id, formId })))
  return publicCode(created)
})

export const updateDiscountCode = createServerFn({ method: 'POST' }).validator((data: DiscountInput & { id: number }) => data).handler(async ({ data }) => {
  const profile = await currentUser()
  const formIds = await validateAssignments(data.formIds, profile.id)
  const startsAt = parseDate(data.startsAt, 'Start date')
  const expiresAt = parseDate(data.expiresAt, 'Expiry date')
  const code = validateDiscountDefinition({ ...data, startsAt, expiresAt })
  if (!data.description?.trim()) throw new Error('Description is required')
  const [updated] = await db.update(discountCodes).set({ code, description: data.description.trim(), type: data.type, value: data.value, maxDiscount: data.maxDiscount ?? null, minAmount: data.minAmount ?? null, maxUses: data.maxUses ?? null, isActive: data.isActive ?? true, startsAt, expiresAt, updatedAt: new Date() }).where(and(eq(discountCodes.id, data.id), eq(discountCodes.profileId, profile.id))).returning()
  if (!updated) throw new Error('Discount code not found')
  await db.delete(discountCodeForms).where(eq(discountCodeForms.discountCodeId, data.id))
  await db.insert(discountCodeForms).values(formIds.map((formId) => ({ discountCodeId: data.id, formId })))
  return publicCode(updated)
})

export const toggleDiscountCode = createServerFn({ method: 'POST' }).validator((data: { id: number; isActive: boolean }) => data).handler(async ({ data }) => {
  const profile = await currentUser()
  const [updated] = await db.update(discountCodes).set({ isActive: data.isActive, updatedAt: new Date() }).where(and(eq(discountCodes.id, data.id), eq(discountCodes.profileId, profile.id))).returning()
  if (!updated) throw new Error('Discount code not found')
  return publicCode(updated)
})

export const deleteDiscountCode = createServerFn({ method: 'POST' }).validator((data: { id: number }) => data).handler(async ({ data }) => {
  const profile = await currentUser()
  const [deleted] = await db.delete(discountCodes).where(and(eq(discountCodes.id, data.id), eq(discountCodes.profileId, profile.id))).returning({ id: discountCodes.id })
  if (!deleted) throw new Error('Discount code not found')
  return { success: true }
})

export const validateDiscountCode = createServerFn({ method: 'POST', strict: false }).validator((data: { formId: number; code: string; amountMinor: number }) => data).handler(async ({ data }) => {
  const code = normalizeDiscountCode(data.code)
  const [discount] = await db.select({ discount: discountCodes }).from(discountCodes).innerJoin(discountCodeForms, eq(discountCodeForms.discountCodeId, discountCodes.id)).where(and(eq(discountCodeForms.formId, data.formId), eq(discountCodes.code, code))).limit(1)
  if (!discount) return { valid: false, reason: 'Invalid discount code' }
  const reason = discountEligibility(discount.discount, data.amountMinor)
  if (reason) return { valid: false, reason }
  const application = applyDiscount(discount.discount, data.amountMinor)
  return { valid: true, ...application }
})
