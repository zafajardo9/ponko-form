import { createServerFn } from '@tanstack/react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import { getRequestUrl } from '@tanstack/react-start/server'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../../db/index'
import {
  fieldConditions,
  formPageFields,
  formPages,
  formSubmissionSessions,
  formSubmissions,
  forms,
  paymentGateways,
  payments,
} from '../../db/schema'
import { paymentRegistry } from '../../integrations/payments/index'
import type { GatewayCredentials } from '../../integrations/payments/types'
import { loadIntegrationConfigs } from '../integrations/credentials'
import { missingAddressParts, pruneHiddenValues, validateFieldRules, visibleFields } from '../page-builder/conditions'
import type {
  ConditionAction,
  ConditionOperator,
  FieldCondition,
  PageFieldOption,
  FieldValidationRules,
  FormPage,
  PageField,
  PageFieldType,
  PageForm,
  PaymentComputation,
} from '../page-builder/types'
import { assertFormOwner, uniqueVarName } from './flow-helpers'

type GatewaySlug = 'paypal' | 'xendit'

function credentialsForSlug(
  slug: GatewaySlug,
  configs: Awaited<ReturnType<typeof loadIntegrationConfigs>>,
): GatewayCredentials | null {
  if (slug === 'xendit') {
    return configs.xendit
      ? { secretKey: configs.xendit.secretKey, publicKey: configs.xendit.publicKey }
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
  const [existing] = await db
    .select({ id: paymentGateways.id })
    .from(paymentGateways)
    .where(eq(paymentGateways.slug, slug))
    .limit(1)
  if (existing) return existing.id
  const [created] = await db
    .insert(paymentGateways)
    .values({ name, slug, isActive: true })
    .returning({ id: paymentGateways.id })
  return created.id
}

function originForReturnUrls(): string {
  try {
    return new URL(getRequestUrl()).origin
  } catch {
    return process.env.APP_URL ?? 'http://localhost:3000'
  }
}

async function hydratePages(formId: number): Promise<FormPage[]> {
  const pages = await db
    .select()
    .from(formPages)
    .where(eq(formPages.formId, formId))
    .orderBy(formPages.position, formPages.id)
  if (pages.length === 0) return []

  const pageIds = pages.map((page) => page.id)
  const fields = await db
    .select()
    .from(formPageFields)
    .where(inArray(formPageFields.pageId, pageIds))
    .orderBy(formPageFields.position, formPageFields.id)
  const fieldIds = fields.map((field) => field.id)
  const conditions =
    fieldIds.length > 0
      ? await db
          .select()
          .from(fieldConditions)
          .where(inArray(fieldConditions.fieldId, fieldIds))
          .orderBy(fieldConditions.id)
      : []

  const conditionsByField = new Map<number, FieldCondition[]>()
  for (const condition of conditions) {
    conditionsByField.set(condition.fieldId, [
      ...(conditionsByField.get(condition.fieldId) ?? []),
      condition as FieldCondition,
    ])
  }

  const fieldsByPage = new Map<number, PageField[]>()
  for (const field of fields) {
    fieldsByPage.set(field.pageId, [
      ...(fieldsByPage.get(field.pageId) ?? []),
      {
        id: field.id,
        pageId: field.pageId,
        fieldType: field.fieldType as PageFieldType,
        label: field.label,
        placeholder: field.placeholder,
        required: field.required,
        options: field.options ?? null,
        bindVariable: field.bindVariable,
        position: field.position,
        width: field.width,
        validationRules: (field.validationRules as FieldValidationRules | null) ?? null,
        conditions: conditionsByField.get(field.id) ?? [],
      },
    ])
  }

  return pages.map((page) => ({
    id: page.id,
    formId: page.formId,
    title: page.title,
    description: page.description,
    position: page.position,
    isFinal: page.isFinal,
    finalTemplate: page.finalTemplate,
    finalRedirectUrl: page.finalRedirectUrl,
    hasPayment: page.hasPayment,
    paymentGatewayId: page.paymentGatewayId,
    paymentAmountVariable: page.paymentAmountVariable,
    paymentCurrency: page.paymentCurrency,
    paymentComputation: (page.paymentComputation as PaymentComputation | null) ?? null,
    fields: fieldsByPage.get(page.id) ?? [],
  }))
}

async function normalizePagePositions(formId: number) {
  const pages = await db
    .select()
    .from(formPages)
    .where(eq(formPages.formId, formId))
    .orderBy(formPages.position, formPages.id)
  for (let i = 0; i < pages.length; i++) {
    await db
      .update(formPages)
      .set({ position: i, isFinal: i === pages.length - 1, updatedAt: new Date() })
      .where(eq(formPages.id, pages[i].id))
  }
}

async function ensurePageBuilderFieldTypes() {
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'field_type' AND e.enumlabel = 'content'
      ) THEN
        ALTER TYPE "public"."field_type" ADD VALUE 'content';
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'field_type' AND e.enumlabel = 'media'
      ) THEN
        ALTER TYPE "public"."field_type" ADD VALUE 'media';
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'field_type' AND e.enumlabel = 'address'
      ) THEN
        ALTER TYPE "public"."field_type" ADD VALUE 'address';
      END IF;
    END $$;
  `)
}

function pageFieldValueIsEmpty(field: PageField, value: unknown) {
  if (field.fieldType === 'address') {
    return missingAddressParts(field, value).length > 0
  }
  return value == null ||
    (Array.isArray(value) ? value.length === 0 : String(value).trim() === '')
}

function calculatePaymentAmount(
  page: Pick<FormPage, 'paymentAmountVariable' | 'paymentComputation'>,
  fields: PageField[],
  dataScope: Record<string, unknown>,
): number {
  const computation = page.paymentComputation
  if (!computation || computation.mode === 'field') {
    return page.paymentAmountVariable ? Number(dataScope[page.paymentAmountVariable] ?? 0) : 0
  }

  if (computation.mode === 'fixed') {
    return Number(computation.fixedAmount ?? 0)
  }

  const bindings = computation.fieldBindings ?? []
  if (computation.mode === 'sum_number_fields') {
    const numberBindings = bindings.length > 0
      ? bindings
      : fields.filter((field) => field.fieldType === 'number').map((field) => field.bindVariable)
    return numberBindings.reduce((total, binding) => total + Number(dataScope[binding] ?? 0), 0)
  }

  if (computation.mode === 'sum_priced_options') {
    const pricedBindings = bindings.length > 0
      ? bindings
      : fields
          .filter((field) =>
            ['select', 'checkbox', 'radio'].includes(field.fieldType) &&
            field.validationRules?.optionPricesEnabled &&
            field.options?.some((option) => Number(option.price ?? 0) > 0),
          )
          .map((field) => field.bindVariable)
    return pricedBindings.reduce((total, binding) => {
      const field = fields.find((item) => item.bindVariable === binding)
      if (!field?.options?.length) return total
      const selected = dataScope[binding]
      const selectedValues = new Set(Array.isArray(selected) ? selected.map(String) : [String(selected ?? '')])
      const fieldTotal = field.options.reduce((sum, option) => {
        return selectedValues.has(option.value) ? sum + Number(option.price ?? 0) : sum
      }, 0)
      return total + fieldTotal
    }, 0)
  }

  return 0
}

export const getPageForm = createServerFn({ method: 'GET', strict: false })
  .inputValidator((data: { formId: number }) => data)
  .handler(async ({ data }): Promise<PageForm | null> => {
    const [form] = await db.select().from(forms).where(eq(forms.id, data.formId)).limit(1)
    if (!form) return null
    const pages = await hydratePages(data.formId)
    if (pages.length === 0) return null
    return { form, pages }
  })

export const getPageSessionData = createServerFn({ method: 'GET', strict: false })
  .inputValidator((data: { sessionId: number }) => data)
  .handler(async ({ data }) => {
    const [session] = await db
      .select()
      .from(formSubmissionSessions)
      .where(eq(formSubmissionSessions.id, data.sessionId))
      .limit(1)
    if (!session) throw new Error('Session not found')
    const [form] = await db.select().from(forms).where(eq(forms.id, session.formId)).limit(1)
    if (!form) throw new Error('Form not found')
    return { session, form, pages: await hydratePages(session.formId) }
  })

export const ensurePageForm = createServerFn({ method: 'POST', strict: false })
  .inputValidator((data: { formId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)

    const existing = await hydratePages(data.formId)
    if (existing.length > 0) return { created: false, pages: existing }

    const [first] = await db
      .insert(formPages)
      .values({
        formId: data.formId,
        title: 'Page 1',
        description: null,
        position: 0,
        isFinal: false,
      })
      .returning()
    const [finalPage] = await db
      .insert(formPages)
      .values({
        formId: data.formId,
        title: 'Thank You',
        position: 1,
        isFinal: true,
        finalTemplate: 'Your response has been recorded.',
      })
      .returning()
    return { created: true, pages: [first, finalPage] }
  })

export const createPage = createServerFn({ method: 'POST', strict: false })
  .inputValidator((data: { formId: number; title?: string }) => data)
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
      .where(eq(formPages.id, finalPage.id))
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
  .inputValidator(
    (data: {
      formId: number
      pageId: number
      title?: string
      description?: string | null
      isFinal?: boolean
      finalTemplate?: string | null
      finalRedirectUrl?: string | null
      hasPayment?: boolean
      paymentGatewayId?: number | null
      paymentAmountVariable?: string | null
      paymentCurrency?: string
    }) => data,
  )
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)

    const { formId: _formId, pageId, ...patch } = data
    if (patch.hasPayment) {
      const pages = await hydratePages(data.formId)
      for (const page of pages) {
        if (page.id !== pageId && page.hasPayment) {
          await db.update(formPages).set({ hasPayment: false }).where(eq(formPages.id, page.id))
        }
      }
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
  .inputValidator((data: { formId: number; pageId: number }) => data)
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
    await db.delete(formPages).where(eq(formPages.id, data.pageId))
    await normalizePagePositions(data.formId)
    return { success: true }
  })

export const reorderPages = createServerFn({ method: 'POST', strict: false })
  .inputValidator((data: { formId: number; pageIds: number[] }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)
    const pages = await hydratePages(data.formId)
    const finalPage = pages.find((page) => page.isFinal)
    const ordered = data.pageIds.filter((id) => id !== finalPage?.id)
    if (finalPage) ordered.push(finalPage.id)
    for (let i = 0; i < ordered.length; i++) {
      await db.update(formPages).set({ position: i, isFinal: ordered[i] === finalPage?.id }).where(eq(formPages.id, ordered[i]))
    }
    return { success: true }
  })

export const createPageField = createServerFn({ method: 'POST', strict: false })
  .inputValidator(
    (data: { formId: number; pageId: number; fieldType: PageFieldType; label?: string }) => data,
  )
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)
    const pages = await hydratePages(data.formId)
    const page = pages.find((item) => item.id === data.pageId)
    if (!page || page.isFinal) throw new Error('Editable page not found')
    const used = new Set(pages.flatMap((p) => p.fields.map((field) => field.bindVariable)))
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
  .inputValidator(
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
    }) => data,
  )
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)
    const { formId: _formId, fieldId, ...patch } = data
    const [field] = await db
      .update(formPageFields)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(formPageFields.id, fieldId))
      .returning()
    if (!field) throw new Error('Field not found')
    return field
  })

export const deletePageField = createServerFn({ method: 'POST', strict: false })
  .inputValidator((data: { formId: number; fieldId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)
    await db.delete(formPageFields).where(eq(formPageFields.id, data.fieldId))
    return { success: true }
  })

export const movePageField = createServerFn({ method: 'POST', strict: false })
  .inputValidator((data: { formId: number; fieldId: number; pageId: number; position: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)
    await db
      .update(formPageFields)
      .set({ pageId: data.pageId, position: data.position, updatedAt: new Date() })
      .where(eq(formPageFields.id, data.fieldId))
    return { success: true }
  })

export const saveFieldConditions = createServerFn({ method: 'POST', strict: false })
  .inputValidator(
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
  .inputValidator(
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
        hasPayment?: boolean
        paymentGatewayId?: number | null
        paymentAmountVariable?: string | null
        paymentCurrency?: string
        paymentComputation?: PaymentComputation | null
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
    }) => data,
  )
  .handler(async ({ data }): Promise<PageForm> => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)
    await ensurePageBuilderFieldTypes()

    const [form] = await db.select().from(forms).where(eq(forms.id, data.formId)).limit(1)
    if (!form) throw new Error('Form not found')

    const orderedPages = [...data.pages].sort((a, b) => a.position - b.position)
    if (orderedPages.length < 2) throw new Error('A form needs at least one page and a final page')
    const editablePages = orderedPages.filter((page) => !page.isFinal)
    if (editablePages.length === 0) throw new Error('A form needs at least one editable page')

    const finalInput = orderedPages.find((page) => page.isFinal) ?? orderedPages[orderedPages.length - 1]
    const normalizedPages = [
      ...orderedPages.filter((page) => page.id !== finalInput.id && !page.isFinal),
      { ...finalInput, isFinal: true },
    ]
    const firstPaymentIndex = normalizedPages.findIndex((page) => !page.isFinal && page.hasPayment)

    await db.transaction(async (tx) => {
      await tx.delete(formPages).where(eq(formPages.formId, data.formId))

      for (let pageIndex = 0; pageIndex < normalizedPages.length; pageIndex++) {
        const page = normalizedPages[pageIndex]
        const isPaymentPage = firstPaymentIndex === pageIndex
        const [createdPage] = await tx
          .insert(formPages)
          .values({
            formId: data.formId,
            title: page.title.trim() || (page.isFinal ? 'Thank You' : `Page ${pageIndex + 1}`),
            description: page.isFinal ? null : page.description ?? null,
            position: pageIndex,
            isFinal: pageIndex === normalizedPages.length - 1,
            finalTemplate:
              pageIndex === normalizedPages.length - 1
                ? page.finalTemplate ?? 'Your response has been recorded.'
                : null,
            finalRedirectUrl: pageIndex === normalizedPages.length - 1 ? page.finalRedirectUrl ?? null : null,
            hasPayment: isPaymentPage,
            paymentGatewayId: isPaymentPage ? page.paymentGatewayId ?? null : null,
            paymentAmountVariable: isPaymentPage ? page.paymentAmountVariable ?? null : null,
            paymentCurrency: (page.paymentCurrency || 'USD').slice(0, 3).toUpperCase(),
            paymentComputation: isPaymentPage ? page.paymentComputation ?? null : null,
          })
          .returning()

        const fields = [...page.fields].sort((a, b) => a.position - b.position)
        for (let fieldIndex = 0; fieldIndex < fields.length; fieldIndex++) {
          const field = fields[fieldIndex]
          const [createdField] = await tx
            .insert(formPageFields)
            .values({
              pageId: createdPage.id,
              fieldType: field.fieldType,
              label: field.label,
              placeholder: field.placeholder ?? null,
              required: field.required,
              options: field.options ?? null,
              bindVariable: field.bindVariable,
              position: fieldIndex,
              width: field.width,
              validationRules: field.validationRules ?? null,
            })
            .returning()

          const conditions = field.conditions.filter((condition) => condition.sourceFieldBinding)
          if (conditions.length > 0) {
            await tx.insert(fieldConditions).values(
              conditions.map((condition) => ({
                fieldId: createdField.id,
                sourceFieldBinding: condition.sourceFieldBinding,
                operator: condition.operator,
                value: condition.value ?? null,
                action: condition.action,
              })),
            )
          }
        }
      }
    })

    return { form, pages: await hydratePages(data.formId) }
  })

export const startPageSession = createServerFn({ method: 'POST', strict: false })
  .inputValidator((data: { formId: number }) => data)
  .handler(async ({ data }) => {
    const [form] = await db.select().from(forms).where(eq(forms.id, data.formId)).limit(1)
    if (!form || form.status !== 'published') throw new Error('Form not found or not published')
    const [session] = await db
      .insert(formSubmissionSessions)
      .values({ formId: data.formId, currentPageIndex: 0, collectedData: {}, status: 'in_progress' })
      .returning()
    return session
  })

export const advancePageSession = createServerFn({ method: 'POST', strict: false })
  .inputValidator(
    (data: {
      sessionId: number
      currentPageIndex: number
      collectedData: Record<string, unknown>
      status?: 'in_progress' | 'payment_pending' | 'payment_failed'
    }) => data,
  )
  .handler(async ({ data }) => {
    const [session] = await db
      .update(formSubmissionSessions)
      .set({
        currentPageIndex: data.currentPageIndex,
        collectedData: data.collectedData,
        status: data.status ?? 'in_progress',
        updatedAt: new Date(),
      })
      .where(eq(formSubmissionSessions.id, data.sessionId))
      .returning()
    if (!session) throw new Error('Session not found')
    return session
  })

export const completePageSubmission = createServerFn({ method: 'POST', strict: false })
  .inputValidator((data: { sessionId: number; collectedData: Record<string, unknown> }) => data)
  .handler(async ({ data }) => {
    const [session] = await db
      .select()
      .from(formSubmissionSessions)
      .where(eq(formSubmissionSessions.id, data.sessionId))
      .limit(1)
    if (!session) throw new Error('Session not found')
    const pages = await hydratePages(session.formId)
    const allFields = pages.flatMap((page) => page.fields)
    const pruned = pruneHiddenValues(allFields, data.collectedData)

    for (const field of visibleFields(allFields, pruned)) {
      const value = pruned[field.bindVariable]
      const empty = pageFieldValueIsEmpty(field, value)
      if (field.required && empty) {
        const missing = field.fieldType === 'address' ? missingAddressParts(field, value) : []
        throw new Error(
          missing.length > 0
            ? `Field "${field.label}" is missing: ${missing.join(', ')}`
            : `Field "${field.label}" is required`,
        )
      }
      const ruleError = validateFieldRules(field, value)
      if (!empty && ruleError) throw new Error(ruleError)
    }

    const [submission] = await db
      .insert(formSubmissions)
      .values({ formId: session.formId, formData: pruned, status: 'completed' })
      .returning()

    const meta = (session.collectedData ?? {}) as Record<string, unknown>
    const paymentId = Number(meta.__paymentId)
    if (Number.isFinite(paymentId)) {
      await db.update(payments).set({ formSubmissionId: submission.id }).where(eq(payments.id, paymentId))
    }

    const [updated] = await db
      .update(formSubmissionSessions)
      .set({
        formSubmissionId: submission.id,
        collectedData: pruned,
        status: 'completed',
        currentPageIndex: pages.length - 1,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(formSubmissionSessions.id, session.id))
      .returning()
    return { session: updated, submission }
  })

export const getPagePaymentOptions = createServerFn({ method: 'GET', strict: false })
  .inputValidator((data: { sessionId: number; pageId: number }) => data)
  .handler(async ({ data }) => {
    const [session] = await db
      .select()
      .from(formSubmissionSessions)
      .where(eq(formSubmissionSessions.id, data.sessionId))
      .limit(1)
    if (!session) throw new Error('Session not found')
    const [page] = await db.select().from(formPages).where(eq(formPages.id, data.pageId)).limit(1)
    if (!page || !page.hasPayment) throw new Error('Payment page not found')
    const [form] = await db.select().from(forms).where(eq(forms.id, session.formId)).limit(1)
    if (!form) throw new Error('Form not found')
    const pages = await hydratePages(session.formId)
    const allFields = pages.flatMap((item) => item.fields)
    const dataScope = (session.collectedData ?? {}) as Record<string, unknown>
    const amount = calculatePaymentAmount(page as FormPage, allFields, dataScope)
    const currency = page.paymentCurrency ?? 'USD'
    const configs = await loadIntegrationConfigs(form.profileId)
    const connected: { slug: GatewaySlug; name: string }[] = []
    if (configs.paypal) connected.push({ slug: 'paypal', name: 'PayPal' })
    if (configs.xendit) connected.push({ slug: 'xendit', name: 'Xendit' })
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
    return { amount, currency, gateways }
  })

export const initiatePagePayment = createServerFn({ method: 'POST', strict: false })
  .inputValidator((data: { sessionId: number; pageId: number; gatewaySlug: GatewaySlug }) => data)
  .handler(async ({ data }) => {
    const [session] = await db
      .select()
      .from(formSubmissionSessions)
      .where(eq(formSubmissionSessions.id, data.sessionId))
      .limit(1)
    if (!session) throw new Error('Session not found')
    const [page] = await db.select().from(formPages).where(eq(formPages.id, data.pageId)).limit(1)
    if (!page || !page.hasPayment) throw new Error('Payment page not found')
    const [form] = await db.select().from(forms).where(eq(forms.id, session.formId)).limit(1)
    if (!form) throw new Error('Form not found')

    const pages = await hydratePages(session.formId)
    const allFields = pages.flatMap((item) => item.fields)
    const amountMajor = calculatePaymentAmount(
      page as FormPage,
      allFields,
      (session.collectedData ?? {}) as Record<string, unknown>,
    )
    if (!Number.isFinite(amountMajor) || amountMajor <= 0) {
      throw new Error('Nothing to pay - the amount is zero or invalid')
    }

    const gateway = paymentRegistry.get(data.gatewaySlug)
    if (!gateway) throw new Error(`Unknown gateway: ${data.gatewaySlug}`)
    const configs = await loadIntegrationConfigs(form.profileId)
    const credentials = credentialsForSlug(data.gatewaySlug, configs)
    if (!credentials) throw new Error(`The form owner has not connected ${gateway.getGatewayName()}`)

    const origin = originForReturnUrls()
    const base = `${origin}/forms/payment-return?pageSessionId=${session.id}&pageId=${page.id}`
    const result = await gateway.createPayment(
      {
        amount: Math.round(amountMajor * 100),
        currency: page.paymentCurrency,
        metadata: { pageSessionId: String(session.id), pageId: String(page.id) },
        returnUrl: base,
        cancelUrl: `${base}&cancelled=1`,
      },
      credentials,
    )
    if (!result.success || !result.paymentUrl) {
      throw new Error(result.error ?? 'Could not start the payment')
    }

    const gwId = await gatewayRowId(data.gatewaySlug, gateway.getGatewayName())
    const [payment] = await db
      .insert(payments)
      .values({
        paymentGatewayId: gwId,
        amount: Math.round(amountMajor * 100),
        currency: page.paymentCurrency,
        status: 'pending',
        gatewayPaymentId: result.gatewayPaymentId,
        gatewayResponse: { pageSessionId: session.id, pageId: page.id },
      })
      .returning()
    await db
      .update(formSubmissionSessions)
      .set({
        status: 'payment_pending',
        collectedData: { ...(session.collectedData as Record<string, unknown>), __paymentId: payment.id },
        updatedAt: new Date(),
      })
      .where(eq(formSubmissionSessions.id, session.id))
    return { paymentUrl: result.paymentUrl }
  })

export const finalizePagePayment = createServerFn({ method: 'POST', strict: false })
  .inputValidator((data: { sessionId: number }) => data)
  .handler(async ({ data }) => {
    const [session] = await db
      .select()
      .from(formSubmissionSessions)
      .where(eq(formSubmissionSessions.id, data.sessionId))
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
        slug: paymentGateways.slug,
      })
      .from(payments)
      .innerJoin(paymentGateways, eq(payments.paymentGatewayId, paymentGateways.id))
      .where(eq(payments.id, paymentId))
      .orderBy(desc(payments.id))
      .limit(1)
    if (!payment?.gatewayPaymentId) {
      return { status: 'failed' as const, success: false, gatewayPaymentId: null }
    }

    const [form] = await db.select().from(forms).where(eq(forms.id, session.formId)).limit(1)
    if (!form) throw new Error('Form not found')
    const slug = payment.slug as GatewaySlug
    const gateway = paymentRegistry.get(slug)
    if (!gateway) throw new Error(`Unknown gateway: ${slug}`)
    const credentials = credentialsForSlug(slug, await loadIntegrationConfigs(form.profileId))
    if (!credentials) throw new Error('Gateway credentials are no longer available')

    const status = await gateway.verifyPayment(payment.gatewayPaymentId, credentials)
    const paymentStatus = status === 'completed' ? 'completed' : status === 'pending' ? 'pending' : 'failed'
    await db.update(payments).set({ status: paymentStatus }).where(eq(payments.id, payment.id))
    await db
      .update(formSubmissionSessions)
      .set({
        status: paymentStatus === 'failed' ? 'payment_failed' : paymentStatus === 'pending' ? 'payment_pending' : 'in_progress',
        updatedAt: new Date(),
      })
      .where(eq(formSubmissionSessions.id, session.id))
    return {
      status: paymentStatus,
      success: paymentStatus === 'completed',
      gatewayPaymentId: payment.gatewayPaymentId,
    }
  })
