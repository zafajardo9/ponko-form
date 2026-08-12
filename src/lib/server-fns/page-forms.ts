import { createServerFn } from '@tanstack/react-start'
import { currentAuth as auth } from '../auth.server'
import { and, desc, eq, exists, inArray, ne, sql, lt, or } from 'drizzle-orm'
import { db } from '@/db/index'
import { withTimeout } from '@/db/with-timeout'
import {
  fieldConditions,
  emailSurveyInvitations,
  formPageFields,
  formPages,
  formSubmissionSessions,
  formSubmissions,
  forms,
  paymentGateways,
  payments,
  discountCodeForms,
  discountCodes,
  discountRedemptions,
} from '@/db/schema'
import { paymentRegistry } from '@/integrations/payments/index'
import { reconcilePayment } from '../payments/reconciliation'
import type {
  GatewayCredentials,
  PaymentResult,
  SubscriptionResult,
} from '@/integrations/payments/types'
import { loadIntegrationConfigs } from '../integrations/credentials'
import {
  getRecaptchaConfigForForm,
  mergeSubmissionSessionData,
  publicSubmissionData,
  verifiedRecaptchaFieldIds,
  verifyRecaptchaFields,
  withVerifiedRecaptchaFieldIds,
} from '../integrations/recaptcha'
import {
  applyComputedFieldValues,
  buildReferenceMap,
  calculatePagePayment,
} from '../page-builder/references'
import { completePageSubmissionRecord, completePaidPageSubmission } from '../page-builder/complete-submission'
import { isFieldVisible } from '../page-builder/conditions'
import {
  isValidPublicSessionToken,
  pagePaymentReturnUrl,
} from '../public-session-access'
import { hydratePages, loadFormReferences } from '../page-builder/server-data'
import type {
  ConditionAction,
  ConditionOperator,
  PageFieldOption,
  FieldValidationRules,
  FormReferenceType,
  FormPage,
  PageFieldType,
  PageForm,
  PaymentComputation,
  SubscriptionConfig,
} from '../page-builder/types'
import {
  normalizedSubscriptionConfig,
  subscriptionAnchorDate,
  subscriptionCustomer,
  subscriptionPaymentsEnabled,
  validateSubscriptionBindings,
} from '../payments/subscriptions'
import { assertFormEditor as assertFormOwner, uniqueVarName } from './flow-helpers'
import { emailSurveyTokenHash, validEmailSurveyToken } from './email-survey-token'
import { paymentReturnOrigin, publicRequestOrigin } from './request-origin'
import { ensurePageSubmissionDraft } from '../page-builder/submission-draft'
import { claimPaymentCheckout } from '../payments/checkout-claim'
import { applyDiscount, discountEligibility, normalizeDiscountCode } from '../discounts'
export { validateDiscountCode } from './discounts'

type GatewaySlug = 'paypal' | 'xendit'

function assertSessionClientToken(clientToken: string) {
  if (!isValidPublicSessionToken(clientToken)) {
    throw new Error('Invalid session token')
  }
}

function sessionAccessWhere(sessionId: number, clientToken: string) {
  assertSessionClientToken(clientToken)
  return and(
    eq(formSubmissionSessions.id, sessionId),
    eq(formSubmissionSessions.clientToken, clientToken),
  )
}

function paymentStartIssue(gatewaySlug: GatewaySlug, gatewayName: string, detail?: string | null) {
  const normalized = (detail ?? '').toLowerCase()
  const returnUrlProblem =
    normalized.includes('https return url') ||
    normalized.includes('invalid_url')
  const subscriptionCapabilityProblem =
    normalized.includes('invalid_payment_channel') ||
    normalized.includes('session_type_not_supported') ||
    normalized.includes('request_forbidden')
  const configurationProblem =
    returnUrlProblem ||
    subscriptionCapabilityProblem ||
    normalized.includes('access token') ||
    normalized.includes('credential') ||
    normalized.includes('api key') ||
    normalized.includes('unauthorized') ||
    normalized.includes('authentication')

  return {
    code: configurationProblem ? 'gateway_configuration' : 'gateway_unavailable',
    title: returnUrlProblem
      ? 'Subscription checkout needs an HTTPS form URL'
      : subscriptionCapabilityProblem
        ? `${gatewayName} subscriptions need account activation`
        : `${gatewayName} could not open checkout`,
    message: returnUrlProblem
      ? 'The form owner must configure a public HTTPS APP_URL before Xendit can open subscription checkout.'
      : subscriptionCapabilityProblem
        ? `The form owner's ${gatewayName} account needs an active payment channel that supports recurring merchant-initiated payments.`
        : configurationProblem
          ? `This payment method needs attention from the form owner. You can choose another payment method or try again later.`
          : `We could not connect to ${gatewayName}. Your answers are safe—try again or choose another payment method.`,
    gatewaySlug,
    retryable: true,
  }
}

async function resolveSessionDiscount(formId: number, pages: Awaited<ReturnType<typeof hydratePages>>, collectedData: Record<string, unknown>, amountMajor: number) {
  const discountField = pages.flatMap((page) => page.fields).find((field) => field.fieldType === 'discount')
  const rawCode = discountField ? collectedData[discountField.bindVariable] : undefined
  const code = typeof rawCode === 'string' ? normalizeDiscountCode(rawCode) : ''
  if (!code) return { application: null, reason: null as string | null }
  const [discount] = await db.select({ discount: discountCodes }).from(discountCodes)
    .innerJoin(discountCodeForms, eq(discountCodeForms.discountCodeId, discountCodes.id))
    .where(and(eq(discountCodeForms.formId, formId), eq(discountCodes.code, code))).limit(1)
  if (!discount) return { application: null, reason: 'Invalid discount code' }
  const amountMinor = Math.max(0, Math.round(amountMajor * 100))
  const reason = discountEligibility(discount.discount, amountMinor)
  if (reason) return { application: null, reason }
  return { application: applyDiscount(discount.discount, amountMinor), reason: null }
}

function sessionRespondentEmail(pages: Awaited<ReturnType<typeof hydratePages>>, collectedData: Record<string, unknown>) {
  const emailField = pages.flatMap((page) => page.fields).find((field) => field.fieldType === 'email')
  const email = emailField ? String(collectedData[emailField.bindVariable] ?? '').trim().toLowerCase() : ''
  return email || null
}

function paymentCalculationWithDiscount(calculation: ReturnType<typeof calculatePagePayment>, application: Awaited<ReturnType<typeof resolveSessionDiscount>>['application']) {
  if (!application) return calculation
  const originalMinor = Math.max(0, Math.round(calculation.amount * 100))
  const finalAmount = application.finalAmount / 100
  return {
    ...calculation,
    amount: finalAmount,
    breakdown: [
      ...calculation.breakdown.filter((line) => line.kind !== 'total'),
      { label: `Discount (${application.code})`, amount: -(application.discountAmount / 100), kind: 'adjustment' as const },
      { label: 'Total', amount: finalAmount, kind: 'total' as const },
    ],
    subtotal: calculation.subtotal || originalMinor / 100,
  }
}

function credentialsForSlug(
  slug: GatewaySlug,
  configs: Awaited<ReturnType<typeof loadIntegrationConfigs>>,
): GatewayCredentials | null {
  if (slug === 'xendit') {
    return configs.xendit
      ? { secretKey: configs.xendit.secretKey, publicKey: configs.xendit.publicKey, mode: configs.xendit.mode }
      : null
  }
  return configs.paypal
    ? {
        clientId: configs.paypal.clientId,
        clientSecret: configs.paypal.clientSecret,
        mode: configs.paypal.mode,
      }
    : null
}

async function gatewayRowId(slug: GatewaySlug, name: string): Promise<number> {
  const [created] = await db
    .insert(paymentGateways)
    .values({ name, slug, isActive: true })
    .onConflictDoUpdate({
      target: paymentGateways.slug,
      set: { name, isActive: true },
    })
    .returning({ id: paymentGateways.id })
  return created.id
}

async function freeGatewayRowId(): Promise<number> {
  const [created] = await db.insert(paymentGateways)
    .values({ name: 'Discounted checkout', slug: 'free', isActive: true })
    .onConflictDoUpdate({ target: paymentGateways.slug, set: { isActive: true } })
    .returning({ id: paymentGateways.id })
  return created.id
}

async function assertFieldBindingAvailable(formId: number, bindVariable: string, excludedFieldId?: number) {
  if (!/^[a-z][a-z0-9_]*$/.test(bindVariable)) {
    throw new Error('Field binding must use snake_case, for example customer_name')
  }
  const references = await loadFormReferences(formId)
  if (references.some((reference) => reference.key === bindVariable)) {
    throw new Error(`"${bindVariable}" is already used as a reference key`)
  }
  const pages = await hydratePages(formId)
  const duplicate = pages
    .flatMap((page) => page.fields)
    .find((field) => field.id !== excludedFieldId && field.bindVariable === bindVariable)
  if (duplicate) throw new Error(`"${bindVariable}" is already used as a field binding`)
}

function ownedPageFieldWhere(formId: number, fieldId: number) {
  return and(
    eq(formPageFields.id, fieldId),
    inArray(
      formPageFields.pageId,
      db
        .select({ id: formPages.id })
        .from(formPages)
        .where(eq(formPages.formId, formId)),
    ),
  )
}

async function normalizePagePositions(formId: number) {
  const pages = await db
    .select()
    .from(formPages)
    .where(eq(formPages.formId, formId))
    .orderBy(formPages.position, formPages.id)
  if (pages.length > 0) {
    const position = sql<number>`case ${sql.join(
      pages.map(
        (page, index) => sql`when ${formPages.id} = ${page.id} then ${index}`,
      ),
      sql.raw(' '),
    )} else ${formPages.position} end`
    const finalPageId = pages[pages.length - 1].id
    await db
      .update(formPages)
      .set({
        position,
        isFinal: sql<boolean>`${formPages.id} = ${finalPageId}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(formPages.formId, formId),
          inArray(formPages.id, pages.map((page) => page.id)),
        ),
      )
  }
}

export const getPageForm = createServerFn({ method: 'GET', strict: false })
  .validator((data: { formId: number }) => data)
  .handler(async ({ data }): Promise<PageForm | null> => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    const form = await assertFormOwner(data.formId, userId)
    const pages = await hydratePages(data.formId)
    if (pages.length === 0) return null
    const recaptcha = pages.some((page) => page.fields.some((field) => field.fieldType === 'recaptcha'))
      ? await getRecaptchaConfigForForm(data.formId)
      : null
    return {
      form,
      pages,
      references: await loadFormReferences(data.formId),
      recaptchaSiteKey: recaptcha?.siteKey ?? null,
    }
  })

export const getPageSessionData = createServerFn({ method: 'GET', strict: false })
  .validator((data: { sessionId: number; clientToken: string }) => data)
  .handler(async ({ data }) => {
    const [session] = await db
      .select()
      .from(formSubmissionSessions)
      .where(sessionAccessWhere(data.sessionId, data.clientToken))
      .limit(1)
    if (!session) throw new Error('Session not found')
    const [[form], pages, references] = await Promise.all([
      db.select().from(forms).where(eq(forms.id, session.formId)).limit(1),
      hydratePages(session.formId),
      loadFormReferences(session.formId),
    ])
    if (!form) throw new Error('Form not found')
    const recaptcha = pages.some((page) => page.fields.some((field) => field.fieldType === 'recaptcha'))
      ? await getRecaptchaConfigForForm(session.formId)
      : null
    return {
      session: {
        id: session.id,
        currentPageIndex: session.currentPageIndex,
        status: session.status,
        formSubmissionId: session.formSubmissionId,
        collectedData: publicSubmissionData((session.collectedData ?? {}) as Record<string, unknown>),
      },
      form,
      pages,
      references,
      recaptchaSiteKey: recaptcha?.siteKey ?? null,
    }
  })

export const ensurePageForm = createServerFn({ method: 'POST', strict: false })
  .validator((data: { formId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)

    const existing = await hydratePages(data.formId)
    if (existing.length > 0) return { created: false, pages: existing }

    const [first, finalPage] = await db
      .insert(formPages)
      .values([
        {
          formId: data.formId,
          title: 'Page 1',
          description: null,
          position: 0,
          isFinal: false,
        },
        {
          formId: data.formId,
          title: 'Thank You',
          position: 1,
          isFinal: true,
          finalTemplate: 'Your response has been recorded.',
        },
      ])
      .returning()
    return { created: true, pages: [first, finalPage] }
  })

export const createPage = createServerFn({ method: 'POST', strict: false })
  .validator((data: { formId: number; title?: string }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)
    const pages = await hydratePages(data.formId)
    const finalPage = pages.find((page) => page.isFinal) ?? pages[pages.length - 1]
    const insertAt = finalPage ? finalPage.position : pages.length

    await db
      .update(formPages)
      .set({ position: insertAt + 1, updatedAt: new Date() })
      .where(and(eq(formPages.id, finalPage.id), eq(formPages.formId, data.formId)))
    const [page] = await db
      .insert(formPages)
      .values({
        formId: data.formId,
        title: data.title ?? `Page ${insertAt + 1}`,
        position: insertAt,
        isFinal: false,
      })
      .returning()
    await normalizePagePositions(data.formId)
    return page
  })

export const updatePage = createServerFn({ method: 'POST', strict: false })
  .validator(
    (data: {
      formId: number
      pageId: number
      title?: string
      description?: string | null
      isFinal?: boolean
      finalTemplate?: string | null
      finalRedirectUrl?: string | null
      finalContactEmail?: string | null
      hasPayment?: boolean
      paymentGatewayId?: number | null
      paymentAmountVariable?: string | null
      paymentCurrency?: string
      paymentComputation?: PaymentComputation | null
      subscriptionConfig?: SubscriptionConfig | null
    }) => data,
  )
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)

    const { formId: _formId, pageId, ...patch } = data
    if (patch.hasPayment) {
      await db
        .update(formPages)
        .set({ hasPayment: false })
        .where(
          and(
            eq(formPages.formId, data.formId),
            ne(formPages.id, pageId),
            eq(formPages.hasPayment, true),
          ),
        )
    }
    const [page] = await db
      .update(formPages)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(formPages.id, pageId), eq(formPages.formId, data.formId)))
      .returning()
    if (!page) throw new Error('Page not found')
    return page
  })

export const deletePage = createServerFn({ method: 'POST', strict: false })
  .validator((data: { formId: number; pageId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)
    const pages = await hydratePages(data.formId)
    const page = pages.find((item) => item.id === data.pageId)
    if (!page) throw new Error('Page not found')
    if (page.isFinal) throw new Error('The final page cannot be deleted')
    if (pages.filter((item) => !item.isFinal).length <= 1) {
      throw new Error('A form needs at least one editable page')
    }
    await db
      .delete(formPages)
      .where(and(eq(formPages.id, data.pageId), eq(formPages.formId, data.formId)))
    await normalizePagePositions(data.formId)
    return { success: true }
  })

export const reorderPages = createServerFn({ method: 'POST', strict: false })
  .validator((data: { formId: number; pageIds: number[] }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)
    const pages = await hydratePages(data.formId)
    const finalPage = pages.find((page) => page.isFinal)
    const ordered = data.pageIds.filter((id) => id !== finalPage?.id)
    if (finalPage) ordered.push(finalPage.id)
    if (ordered.length > 0) {
      const position = sql<number>`case ${sql.join(
        ordered.map(
          (id, index) => sql`when ${formPages.id} = ${id} then ${index}`,
        ),
        sql.raw(' '),
      )} else ${formPages.position} end`
      await db
        .update(formPages)
        .set({
          position,
          isFinal: finalPage
            ? sql<boolean>`${formPages.id} = ${finalPage.id}`
            : false,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(formPages.formId, data.formId),
            inArray(formPages.id, ordered),
          ),
        )
    }
    return { success: true }
  })

export const createPageField = createServerFn({ method: 'POST', strict: false })
  .validator(
    (data: { formId: number; pageId: number; fieldType: PageFieldType; label?: string }) => data,
  )
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)
    const pages = await hydratePages(data.formId)
    const page = pages.find((item) => item.id === data.pageId)
    if (!page || page.isFinal) throw new Error('Editable page not found')
    const references = await loadFormReferences(data.formId)
    const used = new Set([
      ...pages.flatMap((p) => p.fields.map((field) => field.bindVariable)),
      ...references.map((reference) => reference.key),
    ])
    const label = data.label ?? ''
    const bindVariable = uniqueVarName(label || data.fieldType, used, `field_${Date.now()}`)
    const [field] = await db
      .insert(formPageFields)
      .values({
        pageId: data.pageId,
        fieldType: data.fieldType,
        label,
        bindVariable,
        position: page.fields.length,
      })
      .returning()
    return field
  })

export const updatePageField = createServerFn({ method: 'POST', strict: false })
  .validator(
    (data: {
      formId: number
      fieldId: number
      fieldType?: PageFieldType
      label?: string
      placeholder?: string | null
      required?: boolean
      options?: PageFieldOption[] | null
      bindVariable?: string
      width?: 'full' | 'half'
      validationRules?: FieldValidationRules | null
    }) => data,
  )
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)
    const { formId: _formId, fieldId, ...patch } = data
    if (patch.bindVariable !== undefined) {
      await assertFieldBindingAvailable(data.formId, patch.bindVariable, fieldId)
    }
    const [field] = await db
      .update(formPageFields)
      .set({ ...patch, updatedAt: new Date() })
      .where(ownedPageFieldWhere(data.formId, fieldId))
      .returning()
    if (!field) throw new Error('Field not found')
    return field
  })

export const deletePageField = createServerFn({ method: 'POST', strict: false })
  .validator((data: { formId: number; fieldId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)
    const [field] = await db
      .delete(formPageFields)
      .where(ownedPageFieldWhere(data.formId, data.fieldId))
      .returning({ id: formPageFields.id })
    if (!field) throw new Error('Field not found')
    return { success: true }
  })

export const movePageField = createServerFn({ method: 'POST', strict: false })
  .validator((data: { formId: number; fieldId: number; pageId: number; position: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)
    const [destinationPage] = await db
      .select({ id: formPages.id, isFinal: formPages.isFinal })
      .from(formPages)
      .where(and(eq(formPages.id, data.pageId), eq(formPages.formId, data.formId)))
      .limit(1)
    if (!destinationPage || destinationPage.isFinal) {
      throw new Error('Editable page not found')
    }
    const [field] = await db
      .update(formPageFields)
      .set({ pageId: data.pageId, position: data.position, updatedAt: new Date() })
      .where(ownedPageFieldWhere(data.formId, data.fieldId))
      .returning({ id: formPageFields.id })
    if (!field) throw new Error('Field not found')
    return { success: true }
  })

export const saveFieldConditions = createServerFn({ method: 'POST', strict: false })
  .validator(
    (data: {
      formId: number
      fieldId: number
      conditions: {
        sourceFieldBinding: string
        operator: ConditionOperator
        value?: string | null
        action: ConditionAction
      }[]
    }) => data,
  )
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)
    const [field] = await db
      .select({ id: formPageFields.id })
      .from(formPageFields)
      .where(ownedPageFieldWhere(data.formId, data.fieldId))
      .limit(1)
    if (!field) throw new Error('Field not found')
    await db.delete(fieldConditions).where(eq(fieldConditions.fieldId, data.fieldId))
    if (data.conditions.length > 0) {
      await db.insert(fieldConditions).values(
        data.conditions.map((condition) => ({
          fieldId: data.fieldId,
          sourceFieldBinding: condition.sourceFieldBinding,
          operator: condition.operator,
          value: condition.value ?? null,
          action: condition.action,
        })),
      )
    }
    return { success: true }
  })

export const savePageForm = createServerFn({ method: 'POST', strict: false })
  .validator(
    (data: {
      formId: number
      pages: {
        id: number
        title: string
        description?: string | null
        position: number
        isFinal: boolean
        finalTemplate?: string | null
        finalRedirectUrl?: string | null
        finalContactEmail?: string | null
        hasPayment?: boolean
        paymentGatewayId?: number | null
        paymentAmountVariable?: string | null
        paymentCurrency?: string
        paymentComputation?: PaymentComputation | null
        subscriptionConfig?: SubscriptionConfig | null
        fields: {
          id: number
          fieldType: PageFieldType
          label: string
          placeholder?: string | null
          required: boolean
          options?: PageFieldOption[] | null
          bindVariable: string
          position: number
          width: 'full' | 'half'
          validationRules?: FieldValidationRules | null
          conditions: {
            sourceFieldBinding: string
            operator: ConditionOperator
            value?: string | null
            action: ConditionAction
          }[]
        }[]
      }[]
      references?: {
        id: number
        key: string
        type: FormReferenceType
        value: string
        label?: string | null
        description?: string | null
        position: number
      }[]
    }) => data,
  )
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    const form = await assertFormOwner(data.formId, userId)

    const orderedPages = [...data.pages].sort((a, b) => a.position - b.position)
    if (orderedPages.length < 2) throw new Error('A form needs at least one page and a final page')
    const editablePages = orderedPages.filter((page) => !page.isFinal)
    if (editablePages.length === 0) throw new Error('A form needs at least one editable page')
    const inputReferences = [...(data.references ?? [])].sort((a, b) => a.position - b.position)
    const referenceKeys = new Set<string>()
    for (const reference of inputReferences) {
      if (!/^[a-z][a-z0-9_]*$/.test(reference.key)) {
        throw new Error(`Reference "${reference.key}" must use snake_case`)
      }
      if (referenceKeys.has(reference.key)) {
        throw new Error(`"${reference.key}" is used by more than one reference`)
      }
      if (reference.type === 'number' && !Number.isFinite(Number(reference.value))) {
        throw new Error(`Reference "${reference.key}" needs a valid number`)
      }
      if (reference.type === 'percentage' && !Number.isFinite(Number(reference.value.replace('%', '').trim()))) {
        throw new Error(`Reference "${reference.key}" needs a valid percentage`)
      }
      if (reference.type === 'boolean' && !['true', 'false'].includes(reference.value)) {
        throw new Error(`Reference "${reference.key}" needs true or false`)
      }
      referenceKeys.add(reference.key)
    }
    const seenBindings = new Set<string>()
    for (const page of orderedPages) {
      for (const field of page.fields) {
        if (field.fieldType === 'satisfaction') {
          const options = field.options ?? []
          const values = options.map((option) => option.value.trim())
          if (options.length < 2) throw new Error(`Satisfaction field "${field.label}" needs at least two rating levels`)
          if (values.some((value) => !value || !Number.isFinite(Number(value)))) {
            throw new Error(`Satisfaction field "${field.label}" needs numeric rating values`)
          }
          if (new Set(values).size !== values.length) {
            throw new Error(`Satisfaction field "${field.label}" has duplicate rating values`)
          }
        }
        if (referenceKeys.has(field.bindVariable)) {
          throw new Error(`"${field.bindVariable}" is already used as a reference key`)
        }
        if (seenBindings.has(field.bindVariable)) {
          throw new Error(`"${field.bindVariable}" is used by more than one field`)
        }
        seenBindings.add(field.bindVariable)
      }
    }

    const finalInput = orderedPages.find((page) => page.isFinal) ?? orderedPages[orderedPages.length - 1]
    const supportEmail = finalInput.finalContactEmail?.trim() ?? ''
    if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
      throw new Error('Support email needs a valid email address')
    }
    const normalizedPages = [
      ...orderedPages.filter((page) => page.id !== finalInput.id && !page.isFinal),
      { ...finalInput, isFinal: true },
    ]
    const firstPaymentIndex = normalizedPages.findIndex((page) => !page.isFinal && page.hasPayment)
    const paymentPage = firstPaymentIndex >= 0 ? normalizedPages[firstPaymentIndex] : null
    let savedSubscriptionConfig: SubscriptionConfig | null = null
    if (paymentPage?.subscriptionConfig?.enabled) {
      if (!subscriptionPaymentsEnabled()) throw new Error('Subscription payments are temporarily unavailable')
      savedSubscriptionConfig = normalizedSubscriptionConfig(paymentPage.subscriptionConfig)
      if (!savedSubscriptionConfig) throw new Error('Subscription configuration is required')
      if ((paymentPage.paymentCurrency || '').toUpperCase() !== 'PHP') {
        throw new Error('Xendit subscriptions require PHP currency')
      }
      if (!paymentPage.paymentGatewayId) throw new Error('Select Xendit for subscription payments')
      const [selectedGateway] = await db.select({ slug: paymentGateways.slug })
        .from(paymentGateways)
        .where(eq(paymentGateways.id, paymentPage.paymentGatewayId))
        .limit(1)
      if (selectedGateway?.slug !== 'xendit') throw new Error('Subscriptions currently require Xendit')
      validateSubscriptionBindings(savedSubscriptionConfig, paymentPage, normalizedPages)
    }

    const referencesPayload = inputReferences.map((reference, index) => ({
      key: reference.key,
      type: reference.type,
      value: reference.value,
      label: reference.label || null,
      description: reference.description || null,
      position: index,
    }))
    const pagesPayload = normalizedPages.map((page, pageIndex) => {
      const isPaymentPage = firstPaymentIndex === pageIndex
      return {
        title: page.title.trim() || (page.isFinal ? 'Thank You' : `Page ${pageIndex + 1}`),
        description: page.isFinal ? null : page.description ?? null,
        position: pageIndex,
        isFinal: pageIndex === normalizedPages.length - 1,
        finalTemplate:
          pageIndex === normalizedPages.length - 1
            ? page.finalTemplate ?? 'Your response has been recorded.'
            : null,
        finalRedirectUrl: pageIndex === normalizedPages.length - 1 ? page.finalRedirectUrl ?? null : null,
        finalContactEmail: pageIndex === normalizedPages.length - 1 ? page.finalContactEmail?.trim() || null : null,
        hasPayment: isPaymentPage,
        paymentGatewayId: isPaymentPage ? page.paymentGatewayId ?? null : null,
        paymentAmountVariable: isPaymentPage ? page.paymentAmountVariable ?? null : null,
        paymentCurrency: (page.paymentCurrency || 'USD').slice(0, 3).toUpperCase(),
        paymentComputation: isPaymentPage ? page.paymentComputation ?? null : null,
        subscriptionConfig: isPaymentPage ? savedSubscriptionConfig : null,
        fields: [...page.fields]
          .sort((a, b) => a.position - b.position)
          .map((field, fieldIndex) => ({
            fieldType: field.fieldType,
            label: field.label,
            placeholder: field.placeholder ?? null,
            required: field.fieldType === 'recaptcha' ? true : field.required,
            options: field.options ?? null,
            bindVariable: field.bindVariable,
            position: fieldIndex,
            width: field.width,
            validationRules: field.validationRules ?? null,
            conditions: field.conditions
              .filter((condition) => condition.sourceFieldBinding)
              .map((condition) => ({
                sourceFieldBinding: condition.sourceFieldBinding,
                operator: condition.operator,
                value: condition.value ?? null,
                action: condition.action,
              })),
          })),
      }
    })

    // Neon HTTP does not support interactive transaction callbacks. The
    // database function performs the complete replace in one atomic statement.
    await db.execute(sql`select public.replace_page_form(
      ${data.formId},
      ${JSON.stringify(referencesPayload)}::jsonb,
      ${JSON.stringify(pagesPayload)}::jsonb
    )`)

    const [pages, references] = await Promise.all([
      hydratePages(data.formId),
      loadFormReferences(data.formId),
    ])
    return { form, pages, references }
  })

export type SavedPageForm = Awaited<ReturnType<typeof savePageForm>>

export const startPageSession = createServerFn({ method: 'POST', strict: false })
  .validator((data: {
    formId: number
    clientToken: string
    emailSurveyToken?: string
    emailSurveyRating?: string
  }) => data)
  .handler(async ({ data }) => {
    if (!/^[a-zA-Z0-9_-]{16,64}$/.test(data.clientToken)) {
      throw new Error('Invalid session token')
    }

    const startedAt = Date.now()
    const correlationId = data.clientToken.slice(0, 12)

    if (data.emailSurveyToken || data.emailSurveyRating) {
      if (
        !data.emailSurveyToken ||
        !data.emailSurveyRating ||
        !validEmailSurveyToken(data.emailSurveyToken)
      ) {
        throw new Error('Invalid email survey link')
      }
      const [invitation] = await db
        .select({
          id: emailSurveyInvitations.id,
          expiresAt: emailSurveyInvitations.expiresAt,
          usedAt: emailSurveyInvitations.usedAt,
          formSubmissionId: emailSurveyInvitations.formSubmissionId,
          bindVariable: formPageFields.bindVariable,
          options: formPageFields.options,
        })
        .from(emailSurveyInvitations)
        .innerJoin(forms, eq(emailSurveyInvitations.formId, forms.id))
        .innerJoin(formPageFields, eq(emailSurveyInvitations.fieldId, formPageFields.id))
        .where(and(
          eq(emailSurveyInvitations.formId, data.formId),
          eq(emailSurveyInvitations.tokenHash, emailSurveyTokenHash(data.emailSurveyToken)),
          eq(forms.status, 'published'),
          eq(formPageFields.fieldType, 'satisfaction'),
        ))
        .limit(1)
      const completedInvitation = Boolean(invitation?.usedAt || invitation?.formSubmissionId)
      const options = (invitation?.options ?? []) as PageFieldOption[]
      if (
        !invitation ||
        (!completedInvitation && invitation.expiresAt.getTime() <= Date.now()) ||
        !options.some((option) => option.value === data.emailSurveyRating)
      ) {
        throw new Error('This email survey link is invalid or has expired')
      }

      const initialData = { [invitation.bindVariable]: data.emailSurveyRating }
      const [session] = await db
        .insert(formSubmissionSessions)
        .values({
          formId: data.formId,
          clientToken: data.clientToken,
          emailSurveyInvitationId: invitation.id,
          collectedData: initialData,
        })
        .onConflictDoUpdate({
          target: formSubmissionSessions.emailSurveyInvitationId,
          set: {
            clientToken: data.clientToken,
            collectedData: sql`CASE
              WHEN ${formSubmissionSessions.status} = 'completed' THEN ${formSubmissionSessions.collectedData}
              ELSE ${formSubmissionSessions.collectedData} || ${JSON.stringify(initialData)}::jsonb
            END`,
            updatedAt: new Date(),
          },
        })
        .returning()
      if (!session) throw new Error('Unable to start email survey response')
      return {
        id: session.id,
        currentPageIndex: session.currentPageIndex,
        collectedData: publicSubmissionData(
          (session.collectedData ?? {}) as Record<string, unknown>,
        ),
        status: session.status,
        formSubmissionId: session.formSubmissionId,
      }
    }

    const result = await withTimeout(
      db.execute(sql`
        INSERT INTO form_submission_sessions (
          form_id,
          client_token,
          current_page_index,
          collected_data,
          status
        )
        SELECT
          ${data.formId},
          ${data.clientToken},
          0,
          '{}'::jsonb,
          'in_progress'
        FROM forms
        WHERE id = ${data.formId}
          AND status = 'published'
        ON CONFLICT (form_id, client_token)
        DO UPDATE SET client_token = EXCLUDED.client_token
        RETURNING id, current_page_index, collected_data, status, form_submission_id
      `),
      8_000,
      'startPageSession.upsertSession',
      { formId: data.formId, correlationId, phase: 'session-upsert' },
    ) as unknown as { rows: {
      id: number
      current_page_index: number
      collected_data: Record<string, unknown>
      status: string
      form_submission_id: number | null
    }[] }
    const row = result.rows[0]
    if (!row) throw new Error('Form not found or not published')
    const session = {
      id: row.id,
      currentPageIndex: row.current_page_index,
      collectedData: row.collected_data ?? {},
      status: row.status,
      formSubmissionId: row.form_submission_id,
    }

    console.info('[database-operation-complete]', {
      operation: 'startPageSession.upsertSession',
      elapsedMs: Date.now() - startedAt,
      formId: data.formId,
      sessionId: session.id,
      correlationId,
      vercelRegion: process.env.VERCEL_REGION ?? process.env.VERCEL_REGION_ID ?? 'local',
    })
    return {
      id: session.id,
      currentPageIndex: session.currentPageIndex,
      collectedData: publicSubmissionData(session.collectedData),
      status: session.status,
      formSubmissionId: session.formSubmissionId,
    }
  })

export const advancePageSession = createServerFn({ method: 'POST', strict: false })
  .validator(
    (data: {
      sessionId: number
      clientToken: string
      currentPageIndex: number
      collectedData: Record<string, unknown>
      status?: 'in_progress' | 'payment_pending' | 'payment_failed'
    }) => data,
  )
  .handler(async ({ data }) => {
    const [existing] = await db
      .select()
      .from(formSubmissionSessions)
      .where(sessionAccessWhere(data.sessionId, data.clientToken))
      .limit(1)
    if (!existing) throw new Error('Session not found')

    const pages = await hydratePages(existing.formId)
    const previousPage = pages[data.currentPageIndex - 1]
    let collectedData = mergeSubmissionSessionData(
      (existing.collectedData ?? {}) as Record<string, unknown>,
      data.collectedData,
    )
    if (previousPage) {
      const references = await loadFormReferences(existing.formId)
      const referenceMap = buildReferenceMap(references)
      const captchaFields = previousPage.fields.filter((field) =>
        field.fieldType === 'recaptcha' && isFieldVisible(field, collectedData, referenceMap),
      )
      const verified = await verifyRecaptchaFields(
        existing.formId,
        captchaFields,
        collectedData,
        verifiedRecaptchaFieldIds(collectedData),
      )
      collectedData = withVerifiedRecaptchaFieldIds(collectedData, verified)
    }
    for (const field of pages.flatMap((page) => page.fields)) {
      if (field.fieldType === 'recaptcha') delete collectedData[field.bindVariable]
    }

    const [session] = await withTimeout(
      db
        .update(formSubmissionSessions)
        .set({
          currentPageIndex: data.currentPageIndex,
          collectedData,
          status: data.status ?? 'in_progress',
          updatedAt: new Date(),
        })
        .where(sessionAccessWhere(data.sessionId, data.clientToken))
        .returning(),
      10_000,
      'advancePageSession.updateSession',
      { sessionId: data.sessionId },
    )
    if (!session) throw new Error('Session not found')
    if (session.formSubmissionId) {
      await db.update(formSubmissions)
        .set({ formData: publicSubmissionData(collectedData) })
        .where(eq(formSubmissions.id, session.formSubmissionId))
    }
    return {
      id: session.id,
      currentPageIndex: session.currentPageIndex,
      collectedData: publicSubmissionData(collectedData),
      status: session.status,
    }
  })

export const completePageSubmission = createServerFn({ method: 'POST', strict: false })
  .validator(
    (data: {
      sessionId: number
      clientToken: string
      collectedData: Record<string, unknown>
    }) => data,
  )
  .handler(async ({ data }) => {
    const [session] = await db
      .select({ id: formSubmissionSessions.id })
      .from(formSubmissionSessions)
      .where(sessionAccessWhere(data.sessionId, data.clientToken))
      .limit(1)
    if (!session) throw new Error('Session not found')
    const result = await withTimeout(
      completePageSubmissionRecord(data.sessionId, data.collectedData),
      15_000,
      'completePageSubmission',
      { sessionId: data.sessionId },
    )
    return {
      success: true,
      submissionId: result.submission.id,
    }
  })

export const getPagePaymentOptions = createServerFn({ method: 'GET', strict: false })
  .validator((data: { sessionId: number; clientToken: string; pageId: number }) => data)
  .handler(async ({ data }) => {
    return withTimeout((async () => {
    const [session] = await db
      .select()
      .from(formSubmissionSessions)
      .where(sessionAccessWhere(data.sessionId, data.clientToken))
      .limit(1)
    if (!session) throw new Error('Session not found')
    const [[page], [form], pages, references] = await Promise.all([
      db
        .select()
        .from(formPages)
        .where(and(eq(formPages.id, data.pageId), eq(formPages.formId, session.formId)))
        .limit(1),
      db.select().from(forms).where(eq(forms.id, session.formId)).limit(1),
      hydratePages(session.formId),
      loadFormReferences(session.formId),
    ])
    if (!page || !page.hasPayment) throw new Error('Payment page not found')
    if (!form) throw new Error('Form not found')
    const allFields = pages.flatMap((item) => item.fields)
    const sessionData = applyComputedFieldValues(allFields, (session.collectedData ?? {}) as Record<string, unknown>, references)
    const dataScope = { ...buildReferenceMap(references), ...sessionData }
    const baseCalculation = calculatePagePayment(page as unknown as FormPage, allFields, dataScope, references)
    const resolvedDiscount = await resolveSessionDiscount(
      session.formId,
      pages,
      (session.collectedData ?? {}) as Record<string, unknown>,
      baseCalculation.amount,
    )
    const calculation = paymentCalculationWithDiscount(baseCalculation, resolvedDiscount.application)
    const amount = calculation.amount
    const paymentId = Number(((session.collectedData ?? {}) as Record<string, unknown>).__paymentId)
    const [existingPayment] = Number.isFinite(paymentId)
      ? await db
          .select({
            status: payments.status,
            paymentKind: payments.paymentKind,
            subscriptionStatus: payments.subscriptionStatus,
          })
          .from(payments)
          .where(
            and(
              eq(payments.id, paymentId),
              eq(payments.pageSessionId, session.id),
            ),
          )
          .limit(1)
      : []
    const currency = page.paymentCurrency ?? 'USD'
    const configs = await loadIntegrationConfigs(form.profileId)
    const connected: { slug: GatewaySlug; name: string }[] = []
    if (configs.paypal) connected.push({ slug: 'paypal', name: configs.paypal.mode === 'live' ? 'PayPal' : 'PayPal Test' })
    if (configs.xendit) connected.push({ slug: 'xendit', name: configs.xendit.mode === 'live' ? 'Xendit' : 'Xendit Test' })
    let gateways = connected.filter((gateway) =>
      paymentRegistry.get(gateway.slug)?.getSupportedCurrencies().includes(currency),
    )
    if (page.paymentGatewayId) {
      const [selectedGateway] = await db
        .select({ slug: paymentGateways.slug })
        .from(paymentGateways)
        .where(eq(paymentGateways.id, page.paymentGatewayId))
        .limit(1)
      gateways = gateways.filter((gateway) => gateway.slug === selectedGateway?.slug)
    }
    const computation = (page.paymentComputation as PaymentComputation | null) ?? null
    const subscriptionConfig = normalizedSubscriptionConfig(page.subscriptionConfig as SubscriptionConfig | null)
    if (subscriptionConfig) {
      gateways = subscriptionPaymentsEnabled()
        ? gateways.filter((gateway) => paymentRegistry.get(gateway.slug)?.supportsSubscriptions())
        : []
    }
      return {
      amount,
      currency,
      gateways,
      breakdown: calculation.breakdown,
      discount: resolvedDiscount.application ? {
        code: resolvedDiscount.application.code,
        description: resolvedDiscount.application.description,
        discountAmount: resolvedDiscount.application.discountAmount / 100,
        originalAmount: resolvedDiscount.application.originalAmount / 100,
        finalAmount: resolvedDiscount.application.finalAmount / 100,
      } : null,
      discountError: resolvedDiscount.reason,
      showBreakdown: Boolean(computation?.showBreakdown),
      missingReferences: calculation.missingReferences,
      paymentStatus: existingPayment?.paymentKind === 'subscription' && existingPayment.subscriptionStatus === 'active'
        ? 'completed'
        : existingPayment?.status ?? null,
      paymentMode: subscriptionConfig ? 'subscription' as const : 'one_time' as const,
      subscription: subscriptionConfig ? {
        interval: subscriptionConfig.interval,
        intervalUnit: subscriptionConfig.intervalUnit,
        intervalCount: subscriptionConfig.intervalCount,
        trialPeriodDays: subscriptionConfig.trialPeriodDays,
        maxCycles: subscriptionConfig.maxCycles,
      } : null,
      }
    })(), 8_000, 'getPagePaymentOptions', {
      sessionId: data.sessionId,
      pageId: data.pageId,
      correlationId: `page-${data.sessionId}`,
      phase: 'payment-options',
    })
  })

async function ensurePaymentDraft(session: typeof formSubmissionSessions.$inferSelect) {
  return ensurePageSubmissionDraft(session, 'pending_payment')
}

export const ensurePagePaymentDraft = createServerFn({ method: 'POST', strict: false })
  .validator((data: { sessionId: number; clientToken: string; pageId: number }) => data)
  .handler(async ({ data }) => {
    const [session] = await db.select().from(formSubmissionSessions)
      .where(sessionAccessWhere(data.sessionId, data.clientToken)).limit(1)
    if (!session) throw new Error('Session not found')
    const [page] = await db.select({ id: formPages.id, hasPayment: formPages.hasPayment })
      .from(formPages)
      .where(and(eq(formPages.id, data.pageId), eq(formPages.formId, session.formId)))
      .limit(1)
    if (!page?.hasPayment) throw new Error('Payment page not found')
    await ensurePaymentDraft(session)
    return { success: true }
  })

export const completeFreePagePayment = createServerFn({ method: 'POST', strict: false })
  .validator((data: { sessionId: number; clientToken: string; pageId: number }) => data)
  .handler(async ({ data }) => {
    const [session] = await db.select().from(formSubmissionSessions)
      .where(sessionAccessWhere(data.sessionId, data.clientToken)).limit(1)
    if (!session) throw new Error('Session not found')
    const [[page], pages, references] = await Promise.all([
      db.select().from(formPages).where(and(eq(formPages.id, data.pageId), eq(formPages.formId, session.formId))).limit(1),
      hydratePages(session.formId),
      loadFormReferences(session.formId),
    ])
    if (!page?.hasPayment) throw new Error('Payment page not found')
    const allFields = pages.flatMap((item) => item.fields)
    const computed = applyComputedFieldValues(allFields, (session.collectedData ?? {}) as Record<string, unknown>, references)
    const base = calculatePagePayment(page as unknown as FormPage, allFields, { ...buildReferenceMap(references), ...computed }, references)
    const resolved = await resolveSessionDiscount(session.formId, pages, (session.collectedData ?? {}) as Record<string, unknown>, base.amount)
    const calculation = paymentCalculationWithDiscount(base, resolved.application)
    if (calculation.amount !== 0 || !resolved.application) throw new Error('This payment is not eligible for free checkout')
    const submissionId = await ensurePaymentDraft(session)
    const existingId = Number(((session.collectedData ?? {}) as Record<string, unknown>).__paymentId)
    if (Number.isFinite(existingId)) {
      const [existing] = await db.select({ id: payments.id, status: payments.status }).from(payments)
        .where(and(eq(payments.id, existingId), eq(payments.pageSessionId, session.id))).limit(1)
      if (existing?.status === 'completed') return { success: true }
    }
    const application = resolved.application
    const respondentEmail = sessionRespondentEmail(pages, (session.collectedData ?? {}) as Record<string, unknown>)
    const [reserved] = await db.update(discountCodes)
      .set({ currentUses: sql`${discountCodes.currentUses} + 1`, updatedAt: new Date() })
      .where(and(
        eq(discountCodes.id, application.discountId),
        eq(discountCodes.code, application.code),
        exists(db.select({ id: discountCodeForms.discountCodeId }).from(discountCodeForms).where(and(eq(discountCodeForms.discountCodeId, discountCodes.id), eq(discountCodeForms.formId, session.formId)))),
        eq(discountCodes.isActive, true),
        or(sql`${discountCodes.maxUses} IS NULL`, lt(discountCodes.currentUses, discountCodes.maxUses)),
        or(sql`${discountCodes.startsAt} IS NULL`, sql`${discountCodes.startsAt} <= NOW()`),
        or(sql`${discountCodes.expiresAt} IS NULL`, sql`${discountCodes.expiresAt} > NOW()`),
      )).returning({ id: discountCodes.id })
    if (!reserved) throw new Error('This discount code is no longer available')
    const paymentGatewayId = await freeGatewayRowId()
    const [payment] = await db.insert(payments).values({
      paymentGatewayId,
      pageSessionId: session.id,
      formSubmissionId: submissionId,
      amount: 0,
      paidAmount: 0,
      currency: page.paymentCurrency,
      status: 'completed',
      paymentKind: 'one_time',
      paidAt: new Date(),
      verificationSource: 'manual',
    }).returning({ id: payments.id })
    await db.insert(discountRedemptions).values({
      discountCodeId: application.discountId,
      formId: session.formId,
      paymentId: payment.id,
      pageSessionId: session.id,
      formSubmissionId: submissionId,
      currency: page.paymentCurrency,
      respondentEmail,
      originalAmount: application.originalAmount,
      discountAmount: application.discountAmount,
      finalAmount: application.finalAmount,
    }).onConflictDoNothing({ target: discountRedemptions.paymentId })
    await db.update(formSubmissionSessions).set({
      status: 'payment_pending',
      formSubmissionId: submissionId,
      collectedData: { ...(session.collectedData as Record<string, unknown>), __paymentId: payment.id },
      updatedAt: new Date(),
    }).where(eq(formSubmissionSessions.id, session.id))
    return { success: true }
  })

export const initiatePagePayment = createServerFn({ method: 'POST', strict: false })
  .validator(
    (data: {
      sessionId: number
      clientToken: string
      pageId: number
      gatewaySlug: GatewaySlug
    }) => data,
  )
  .handler(async ({ data }) => {
    return withTimeout((async () => {
    const [session] = await db
      .select()
      .from(formSubmissionSessions)
      .where(sessionAccessWhere(data.sessionId, data.clientToken))
      .limit(1)
    if (!session) throw new Error('Session not found')
    const [[page], [form], pages, references] = await Promise.all([
      db
        .select()
        .from(formPages)
        .where(and(eq(formPages.id, data.pageId), eq(formPages.formId, session.formId)))
        .limit(1),
      db.select().from(forms).where(eq(forms.id, session.formId)).limit(1),
      hydratePages(session.formId),
      loadFormReferences(session.formId),
    ])
    if (!page || !page.hasPayment) throw new Error('Payment page not found')
    if (!form) throw new Error('Form not found')

    const allFields = pages.flatMap((item) => item.fields)
    const computedSessionData = applyComputedFieldValues(
      allFields,
      (session.collectedData ?? {}) as Record<string, unknown>,
      references,
    )
    const baseCalculation = calculatePagePayment(
      page as unknown as FormPage,
      allFields,
      {
        ...buildReferenceMap(references),
        ...computedSessionData,
      },
      references,
    )
    const resolvedDiscount = await resolveSessionDiscount(
      session.formId,
      pages,
      (session.collectedData ?? {}) as Record<string, unknown>,
      baseCalculation.amount,
    )
    if (resolvedDiscount.reason) throw new Error(resolvedDiscount.reason)
    const calculation = paymentCalculationWithDiscount(baseCalculation, resolvedDiscount.application)
    const amountMajor = calculation.amount
    if (!Number.isFinite(amountMajor) || amountMajor <= 0) {
      throw new Error('Nothing to pay - the amount is zero or invalid')
    }

    const gateway = paymentRegistry.get(data.gatewaySlug)
    if (!gateway) throw new Error(`Unknown gateway: ${data.gatewaySlug}`)
    const configs = await loadIntegrationConfigs(form.profileId)
    const credentials = credentialsForSlug(data.gatewaySlug, configs)
    if (!credentials) throw new Error(`The form owner has not connected ${gateway.getGatewayName()}`)
    const subscriptionConfig = normalizedSubscriptionConfig(page.subscriptionConfig as SubscriptionConfig | null)
    if (subscriptionConfig && !subscriptionPaymentsEnabled()) {
      throw new Error('Subscription payments are temporarily unavailable')
    }
    if (subscriptionConfig && (data.gatewaySlug !== 'xendit' || !gateway.supportsSubscriptions())) {
      throw new Error('Subscriptions currently require Xendit')
    }
    if (subscriptionConfig && page.paymentCurrency !== 'PHP') {
      throw new Error('Xendit subscriptions require PHP currency')
    }
    const customer = subscriptionConfig ? subscriptionCustomer(subscriptionConfig, computedSessionData) : null

    const requestOrigin = publicRequestOrigin()
    const origin = subscriptionConfig
      ? paymentReturnOrigin(requestOrigin)
      : requestOrigin
    const base = pagePaymentReturnUrl(
      origin,
      session.id,
      page.id,
      data.clientToken,
    )
    const gwId = await gatewayRowId(data.gatewaySlug, gateway.getGatewayName())
    const submissionId = await ensurePaymentDraft(session)
    await db.update(formSubmissions).set({
      formData: session.collectedData as Record<string, unknown>,
      status: 'pending_payment',
    })
      .where(eq(formSubmissions.id, submissionId))
    const sessionPaymentId = Number((session.collectedData as Record<string, unknown> | null)?.__paymentId)
    const [reusablePayment] = Number.isFinite(sessionPaymentId)
      ? await db.select().from(payments).where(and(
          eq(payments.id, sessionPaymentId),
          eq(payments.pageSessionId, session.id),
        )).limit(1)
      : []
    if (
      reusablePayment?.paymentUrl &&
      reusablePayment.status === 'pending' &&
      (!reusablePayment.expiresAt || reusablePayment.expiresAt.getTime() > Date.now())
    ) {
      return { paymentUrl: reusablePayment.paymentUrl, issue: null }
    }
    const amountMinor = Math.round(amountMajor * 100)
    const respondentEmail = sessionRespondentEmail(pages, (session.collectedData ?? {}) as Record<string, unknown>)
    const paymentKind = subscriptionConfig ? 'subscription' as const : 'one_time' as const
    const subscriptionExternalId = subscriptionConfig
      ? `ponkoform-subscription-session-${session.id}`
      : null
    const newPaymentValues: Omit<typeof payments.$inferInsert, 'checkoutKey'> = {
          paymentGatewayId: gwId,
          pageSessionId: session.id,
          formSubmissionId: submissionId,
          amount: amountMinor,
          currency: page.paymentCurrency,
          paymentKind,
          status: 'pending',
          externalId: subscriptionExternalId,
          respondentName: customer?.name,
          respondentEmail: customer?.email,
          subscriptionStatus: subscriptionConfig ? 'pending' : null,
          subscriptionCheckoutStatus: subscriptionConfig ? 'PENDING' : null,
          subscriptionInterval: subscriptionConfig?.intervalUnit,
          subscriptionIntervalCount: subscriptionConfig?.intervalCount,
          subscriptionMaxCycles: subscriptionConfig?.maxCycles,
          subscriptionTrialDays: subscriptionConfig?.trialPeriodDays,
          subscriptionAnchorDate: subscriptionConfig
            ? subscriptionAnchorDate(subscriptionConfig)
            : null,
          gatewayResponse: { environment: credentials.mode ?? 'sandbox' },
        }
    const checkoutKey = [
      'page',
      session.id,
      page.id,
      data.gatewaySlug,
      paymentKind,
      amountMinor,
      page.paymentCurrency.toUpperCase(),
    ].join(':')
    if (reusablePayment && !reusablePayment.checkoutKey) {
      await db
        .update(payments)
        .set({ checkoutKey, updatedAt: new Date() })
        .where(
          and(
            eq(payments.id, reusablePayment.id),
            sql`${payments.checkoutKey} IS NULL`,
          ),
        )
    }
    const checkout = await claimPaymentCheckout(checkoutKey, newPaymentValues)
    if (checkout.disposition === 'reuse' && checkout.payment.paymentUrl) {
      return { paymentUrl: checkout.payment.paymentUrl, issue: null }
    }
    if (checkout.disposition === 'wait') {
      return {
        paymentUrl: null,
        issue: {
          code: 'checkout_in_progress',
          title: 'Checkout is being prepared',
          message: 'Another checkout request is already in progress. Try again in a moment.',
          gatewaySlug: data.gatewaySlug,
          retryable: true,
          reference: `PAY-${String(checkout.payment.id).padStart(6, '0')}`,
          debugDetail: undefined,
        },
      }
    }
    if (checkout.disposition === 'completed') {
      return {
        paymentUrl: null,
        issue: {
          code: 'payment_completed',
          title: 'Payment already completed',
          message: 'This response has already been paid.',
          gatewaySlug: data.gatewaySlug,
          retryable: false,
          reference: `PAY-${String(checkout.payment.id).padStart(6, '0')}`,
          debugDetail: undefined,
        },
      }
    }
    const payment = checkout.payment
    let discountReserved = false
    if (resolvedDiscount.application) {
      const application = resolvedDiscount.application
      const [reserved] = await db.update(discountCodes)
        .set({ currentUses: sql`${discountCodes.currentUses} + 1`, updatedAt: new Date() })
        .where(and(
          eq(discountCodes.id, application.discountId),
          eq(discountCodes.code, application.code),
          exists(db.select({ id: discountCodeForms.discountCodeId }).from(discountCodeForms).where(and(eq(discountCodeForms.discountCodeId, discountCodes.id), eq(discountCodeForms.formId, session.formId)))),
          eq(discountCodes.isActive, true),
          or(sql`${discountCodes.maxUses} IS NULL`, lt(discountCodes.currentUses, discountCodes.maxUses)),
          or(sql`${discountCodes.startsAt} IS NULL`, sql`${discountCodes.startsAt} <= NOW()`),
          or(sql`${discountCodes.expiresAt} IS NULL`, sql`${discountCodes.expiresAt} > NOW()`),
        ))
        .returning({ id: discountCodes.id })
      if (!reserved) throw new Error('This discount code is no longer available')
      discountReserved = true
    }
    const externalId = subscriptionExternalId ?? `ponkoform-payment-${payment.id}`
    await db.update(payments).set({
      externalId,
      amount: Math.round(amountMajor * 100),
      respondentName: customer?.name ?? reusablePayment?.respondentName,
      respondentEmail: customer?.email ?? reusablePayment?.respondentEmail ?? respondentEmail,
      subscriptionAnchorDate: subscriptionConfig
        ? subscriptionAnchorDate(subscriptionConfig)
        : reusablePayment?.subscriptionAnchorDate,
    }).where(eq(payments.id, payment.id))
    await db.update(formSubmissionSessions).set({
      formSubmissionId: submissionId,
      collectedData: { ...(session.collectedData as Record<string, unknown>), __paymentId: payment.id },
      updatedAt: new Date(),
    }).where(eq(formSubmissionSessions.id, session.id))
    const metadata = { pageSessionId: String(session.id), pageId: String(page.id), paymentId: String(payment.id) }
    const anchorDate = subscriptionConfig ? subscriptionAnchorDate(subscriptionConfig) : null
    if (subscriptionConfig && (!customer || !anchorDate)) {
      throw new Error('Subscription customer details are unavailable')
    }
    const createOperation: Promise<PaymentResult | SubscriptionResult> =
      subscriptionConfig && customer && anchorDate
      ? gateway.createSubscription({
          amount: Math.round(amountMajor * 100),
          currency: page.paymentCurrency,
          referenceId: `${externalId}-${Date.now()}`.slice(0, 64),
          customerReferenceId: `pf${form.id}s${session.id}`,
          customerName: customer.name,
          customerEmail: customer.email,
          description: `${form.title} subscription`.slice(0, 1000),
          interval: subscriptionConfig.intervalUnit,
          intervalCount: subscriptionConfig.intervalCount,
          anchorDate: anchorDate.toISOString(),
          totalRecurrence: subscriptionConfig.maxCycles,
          immediatePayment: subscriptionConfig.trialPeriodDays === 0,
          metadata,
          returnUrl: base,
          cancelUrl: `${base}&cancelled=1`,
        }, credentials)
      : gateway.createPayment({
          amount: Math.round(amountMajor * 100),
          currency: page.paymentCurrency,
          externalId,
          metadata,
          returnUrl: base,
          cancelUrl: `${base}&cancelled=1`,
        }, credentials)
    const result = await withTimeout(createOperation, 15_000, 'initiatePagePayment.gatewayCreate', {
      sessionId: data.sessionId,
      pageId: data.pageId,
      correlationId: `page-${data.sessionId}`,
      phase: 'gateway-create',
    })
    if (!result.success || !result.paymentUrl) {
      if (discountReserved && resolvedDiscount.application) {
        await db.update(discountCodes)
          .set({ currentUses: sql`GREATEST(${discountCodes.currentUses} - 1, 0)`, updatedAt: new Date() })
          .where(eq(discountCodes.id, resolvedDiscount.application.discountId))
      }
      const issue = paymentStartIssue(data.gatewaySlug, gateway.getGatewayName(), result.error)
      await db.update(payments).set({
        status: 'failed',
        failureReason: result.error ?? 'Gateway creation failed',
        failedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(payments.id, payment.id))
      await db.update(formSubmissions)
        .set({ status: 'payment_failed' })
        .where(and(eq(formSubmissions.id, submissionId), eq(formSubmissions.status, 'pending_payment')))
      await db.update(formSubmissionSessions)
        .set({ status: 'payment_failed', updatedAt: new Date() })
        .where(eq(formSubmissionSessions.id, session.id))
      console.error('[payment] checkout creation failed', {
        paymentId: payment.id,
        gateway: data.gatewaySlug,
        category: issue.code,
        correlationId: `page-${session.id}`,
        detail: result.error ?? 'Gateway creation failed',
      })
      return {
        paymentUrl: null,
        issue: {
          ...issue,
          reference: `PAY-${String(payment.id).padStart(6, '0')}`,
          // Gateway adapters sanitize provider responses before they reach this
          // boundary. Keep the detail out of the respondent UI, but make it
          // available to developers inspecting the browser console.
          debugDetail: result.error ?? 'Gateway creation failed',
        },
      }
    }

    await db.update(payments).set({
      gatewayPaymentId: 'paymentSessionId' in result ? result.paymentSessionId : result.gatewayPaymentId,
      paymentUrl: result.paymentUrl,
      expiresAt: result.expiresAt ? new Date(result.expiresAt) : null,
      subscriptionPlanId: 'subscriptionPlanId' in result ? result.subscriptionPlanId : null,
      subscriptionCheckoutStatus: 'providerStatus' in result ? result.providerStatus : null,
      gatewayResponse: {
        pageSessionId: session.id,
        pageId: page.id,
        environment: credentials.mode ?? 'sandbox',
        ...(subscriptionConfig ? { subscriptionInterval: subscriptionConfig.interval } : {}),
      },
      updatedAt: new Date(),
    }).where(eq(payments.id, payment.id))
    if (discountReserved && resolvedDiscount.application) {
      const application = resolvedDiscount.application
      await db.insert(discountRedemptions).values({
        discountCodeId: application.discountId,
        formId: session.formId,
        paymentId: payment.id,
        pageSessionId: session.id,
        formSubmissionId: submissionId,
        respondentEmail: respondentEmail ?? customer?.email?.trim().toLowerCase() ?? null,
        currency: page.paymentCurrency,
        originalAmount: application.originalAmount,
        discountAmount: application.discountAmount,
        finalAmount: application.finalAmount,
      }).onConflictDoNothing({ target: discountRedemptions.paymentId })
    }
    await db
      .update(formSubmissionSessions)
      .set({
        status: 'payment_pending',
        formSubmissionId: submissionId,
        collectedData: { ...(session.collectedData as Record<string, unknown>), __paymentId: payment.id },
        updatedAt: new Date(),
      })
      .where(eq(formSubmissionSessions.id, session.id))
      return { paymentUrl: result.paymentUrl, issue: null }
    })(), 25_000, 'initiatePagePayment', {
      sessionId: data.sessionId,
      pageId: data.pageId,
      correlationId: `page-${data.sessionId}`,
      phase: 'payment-initiation-total',
    })
  })

export const finalizePagePayment = createServerFn({ method: 'POST', strict: false })
  .validator((data: { sessionId: number; clientToken: string }) => data)
  .handler(async ({ data }) => {
    return withTimeout((async () => {
    const [session] = await db
      .select()
      .from(formSubmissionSessions)
      .where(sessionAccessWhere(data.sessionId, data.clientToken))
      .limit(1)
    if (!session) throw new Error('Session not found')
    const paymentId = Number((session.collectedData as Record<string, unknown>).__paymentId)
    if (!Number.isFinite(paymentId)) {
      return { status: 'failed' as const, success: false, gatewayPaymentId: null }
    }
    const [payment] = await db
      .select({
        id: payments.id,
        gatewayPaymentId: payments.gatewayPaymentId,
      })
      .from(payments)
      .innerJoin(paymentGateways, eq(payments.paymentGatewayId, paymentGateways.id))
      .where(
        and(
          eq(payments.id, paymentId),
          eq(payments.pageSessionId, session.id),
        ),
      )
      .orderBy(desc(payments.id))
      .limit(1)
    if (!payment?.gatewayPaymentId) {
      return { status: 'failed' as const, success: false, gatewayPaymentId: null }
    }

    const reconciliation = await reconcilePayment({ paymentId: payment.id, source: 'return' })
    const paymentStatus = reconciliation.status
    if (paymentStatus === 'completed') {
      await completePaidPageSubmission(session.id)
      return {
        status: paymentStatus,
        success: true,
        gatewayPaymentId: payment.gatewayPaymentId,
      }
    }
    await db
      .update(formSubmissionSessions)
      .set({
        status: paymentStatus === 'failed' ? 'payment_failed' : paymentStatus === 'pending' ? 'payment_pending' : 'in_progress',
        updatedAt: new Date(),
      })
      .where(eq(formSubmissionSessions.id, session.id))
      return {
      status: paymentStatus,
      success: false,
      gatewayPaymentId: payment.gatewayPaymentId,
      }
    })(), 15_000, 'finalizePagePayment', {
      sessionId: data.sessionId,
      correlationId: `page-${data.sessionId}`,
      phase: 'payment-verification',
    })
  })
