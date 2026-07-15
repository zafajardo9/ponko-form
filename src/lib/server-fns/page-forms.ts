import { createServerFn } from '@tanstack/react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '../../db/index'
import { withTimeout } from '../../db/with-timeout'
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
} from '../../db/schema'
import { paymentRegistry } from '../../integrations/payments/index'
import { reconcilePayment } from '../payments/reconciliation'
import type { GatewayCredentials } from '../../integrations/payments/types'
import { loadIntegrationConfigs } from '../integrations/credentials'
import {
  applyComputedFieldValues,
  buildReferenceMap,
  calculatePagePayment,
} from '../page-builder/references'
import { completePageSubmissionRecord, completePaidPageSubmission } from '../page-builder/complete-submission'
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
} from '../page-builder/types'
import { assertFormOwner, uniqueVarName } from './flow-helpers'
import { emailSurveyTokenHash, validEmailSurveyToken } from './email-survey-token'
import { publicRequestOrigin } from './request-origin'

type GatewaySlug = 'paypal' | 'xendit'

function paymentStartIssue(gatewaySlug: GatewaySlug, gatewayName: string, detail?: string | null) {
  const normalized = (detail ?? '').toLowerCase()
  const configurationProblem =
    normalized.includes('access token') ||
    normalized.includes('credential') ||
    normalized.includes('api key') ||
    normalized.includes('unauthorized') ||
    normalized.includes('authentication')

  return {
    code: configurationProblem ? 'gateway_configuration' : 'gateway_unavailable',
    title: `${gatewayName} could not open checkout`,
    message: configurationProblem
      ? `This payment method needs attention from the form owner. You can choose another payment method or try again later.`
      : `We could not connect to ${gatewayName}. Your answers are safe—try again or choose another payment method.`,
    gatewaySlug,
    retryable: true,
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

      IF NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'field_type' AND e.enumlabel = 'computation'
      ) THEN
        ALTER TYPE "public"."field_type" ADD VALUE 'computation';
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'field_type' AND e.enumlabel = 'file_upload'
      ) THEN
        ALTER TYPE "public"."field_type" ADD VALUE 'file_upload';
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'field_type' AND e.enumlabel = 'satisfaction'
      ) THEN
        ALTER TYPE "public"."field_type" ADD VALUE 'satisfaction';
      END IF;
    END $$;
  `)
}

export const getPageForm = createServerFn({ method: 'GET', strict: false })
  .inputValidator((data: { formId: number }) => data)
  .handler(async ({ data }): Promise<PageForm | null> => {
    const [form] = await db.select().from(forms).where(eq(forms.id, data.formId)).limit(1)
    if (!form) return null
    const pages = await hydratePages(data.formId)
    if (pages.length === 0) return null
    return { form, pages, references: await loadFormReferences(data.formId) }
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
    return { session, form, pages: await hydratePages(session.formId), references: await loadFormReferences(session.formId) }
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
      paymentComputation?: PaymentComputation | null
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
    const normalizedPages = [
      ...orderedPages.filter((page) => page.id !== finalInput.id && !page.isFinal),
      { ...finalInput, isFinal: true },
    ]
    const firstPaymentIndex = normalizedPages.findIndex((page) => !page.isFinal && page.hasPayment)

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
        hasPayment: isPaymentPage,
        paymentGatewayId: isPaymentPage ? page.paymentGatewayId ?? null : null,
        paymentAmountVariable: isPaymentPage ? page.paymentAmountVariable ?? null : null,
        paymentCurrency: (page.paymentCurrency || 'USD').slice(0, 3).toUpperCase(),
        paymentComputation: isPaymentPage ? page.paymentComputation ?? null : null,
        fields: [...page.fields]
          .sort((a, b) => a.position - b.position)
          .map((field, fieldIndex) => ({
            fieldType: field.fieldType,
            label: field.label,
            placeholder: field.placeholder ?? null,
            required: field.required,
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

    return { form, pages: await hydratePages(data.formId), references: await loadFormReferences(data.formId) }
  })

export const startPageSession = createServerFn({ method: 'POST', strict: false })
  .inputValidator((data: {
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
            collectedData: sql`CASE
              WHEN ${formSubmissionSessions.status} = 'completed' THEN ${formSubmissionSessions.collectedData}
              ELSE ${formSubmissionSessions.collectedData} || ${JSON.stringify(initialData)}::jsonb
            END`,
            updatedAt: new Date(),
          },
        })
        .returning()
      if (!session) throw new Error('Unable to start email survey response')
      return session
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
        RETURNING id, current_page_index, collected_data, status
      `),
      8_000,
      'startPageSession.upsertSession',
      { formId: data.formId, correlationId, phase: 'session-upsert' },
    ) as unknown as { rows: {
      id: number
      current_page_index: number
      collected_data: Record<string, unknown>
      status: string
    }[] }
    const row = result.rows[0]
    if (!row) throw new Error('Form not found or not published')
    const session = {
      id: row.id,
      currentPageIndex: row.current_page_index,
      collectedData: row.collected_data ?? {},
      status: row.status,
    }

    console.info('[database-operation-complete]', {
      operation: 'startPageSession.upsertSession',
      elapsedMs: Date.now() - startedAt,
      formId: data.formId,
      sessionId: session.id,
      correlationId,
      vercelRegion: process.env.VERCEL_REGION ?? process.env.VERCEL_REGION_ID ?? 'local',
    })
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
    const [session] = await withTimeout(
      db
        .update(formSubmissionSessions)
        .set({
          currentPageIndex: data.currentPageIndex,
          collectedData: data.collectedData,
          status: data.status ?? 'in_progress',
          updatedAt: new Date(),
        })
        .where(eq(formSubmissionSessions.id, data.sessionId))
        .returning(),
      10_000,
      'advancePageSession.updateSession',
      { sessionId: data.sessionId },
    )
    if (!session) throw new Error('Session not found')
    if (session.formSubmissionId) {
      await db.update(formSubmissions)
        .set({ formData: data.collectedData })
        .where(eq(formSubmissions.id, session.formSubmissionId))
    }
    return session
  })

export const completePageSubmission = createServerFn({ method: 'POST', strict: false })
  .inputValidator((data: { sessionId: number; collectedData: Record<string, unknown> }) => data)
  .handler(async ({ data }) => {
    return withTimeout(
      completePageSubmissionRecord(data.sessionId, data.collectedData),
      15_000,
      'completePageSubmission',
      { sessionId: data.sessionId },
    )
  })

export const getPagePaymentOptions = createServerFn({ method: 'GET', strict: false })
  .inputValidator((data: { sessionId: number; pageId: number }) => data)
  .handler(async ({ data }) => {
    return withTimeout((async () => {
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
    const references = await loadFormReferences(session.formId)
    const sessionData = applyComputedFieldValues(allFields, (session.collectedData ?? {}) as Record<string, unknown>, references)
    const dataScope = { ...buildReferenceMap(references), ...sessionData }
    const calculation = calculatePagePayment(page as unknown as FormPage, allFields, dataScope, references)
    const amount = calculation.amount
    const paymentId = Number(((session.collectedData ?? {}) as Record<string, unknown>).__paymentId)
    const [existingPayment] = Number.isFinite(paymentId)
      ? await db
          .select({ status: payments.status })
          .from(payments)
          .where(eq(payments.id, paymentId))
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
      return {
      amount,
      currency,
      gateways,
      breakdown: calculation.breakdown,
      showBreakdown: Boolean(computation?.showBreakdown),
      missingReferences: calculation.missingReferences,
      paymentStatus: existingPayment?.status ?? null,
      }
    })(), 8_000, 'getPagePaymentOptions', {
      sessionId: data.sessionId,
      pageId: data.pageId,
      correlationId: `page-${data.sessionId}`,
      phase: 'payment-options',
    })
  })

async function ensurePaymentDraft(session: typeof formSubmissionSessions.$inferSelect) {
  if (session.formSubmissionId) return session.formSubmissionId
  const [draft] = await db.insert(formSubmissions).values({
    formId: session.formId,
    formData: session.collectedData as Record<string, unknown>,
    status: 'pending_payment',
  }).returning({ id: formSubmissions.id })
  const [updated] = await db.update(formSubmissionSessions)
    .set({ formSubmissionId: draft.id, updatedAt: new Date() })
    .where(and(eq(formSubmissionSessions.id, session.id), sql`${formSubmissionSessions.formSubmissionId} IS NULL`))
    .returning({ id: formSubmissionSessions.id })
  if (updated) return draft.id
  await db.delete(formSubmissions).where(eq(formSubmissions.id, draft.id))
  const [current] = await db.select({ submissionId: formSubmissionSessions.formSubmissionId })
    .from(formSubmissionSessions).where(eq(formSubmissionSessions.id, session.id)).limit(1)
  if (!current?.submissionId) throw new Error('Could not initialize payment response')
  return current.submissionId
}

export const ensurePagePaymentDraft = createServerFn({ method: 'POST', strict: false })
  .inputValidator((data: { sessionId: number; pageId: number }) => data)
  .handler(async ({ data }) => {
    const [session] = await db.select().from(formSubmissionSessions)
      .where(eq(formSubmissionSessions.id, data.sessionId)).limit(1)
    if (!session) throw new Error('Session not found')
    const [page] = await db.select({ id: formPages.id, hasPayment: formPages.hasPayment })
      .from(formPages).where(eq(formPages.id, data.pageId)).limit(1)
    if (!page?.hasPayment) throw new Error('Payment page not found')
    return { submissionId: await ensurePaymentDraft(session) }
  })

export const initiatePagePayment = createServerFn({ method: 'POST', strict: false })
  .inputValidator((data: { sessionId: number; pageId: number; gatewaySlug: GatewaySlug }) => data)
  .handler(async ({ data }) => {
    return withTimeout((async () => {
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
    const references = await loadFormReferences(session.formId)
    const amountMajor = calculatePagePayment(
      page as unknown as FormPage,
      allFields,
      {
        ...buildReferenceMap(references),
        ...applyComputedFieldValues(allFields, (session.collectedData ?? {}) as Record<string, unknown>, references),
      },
      references,
    ).amount
    if (!Number.isFinite(amountMajor) || amountMajor <= 0) {
      throw new Error('Nothing to pay - the amount is zero or invalid')
    }

    const gateway = paymentRegistry.get(data.gatewaySlug)
    if (!gateway) throw new Error(`Unknown gateway: ${data.gatewaySlug}`)
    const configs = await loadIntegrationConfigs(form.profileId)
    const credentials = credentialsForSlug(data.gatewaySlug, configs)
    if (!credentials) throw new Error(`The form owner has not connected ${gateway.getGatewayName()}`)

    const origin = publicRequestOrigin()
    const base = `${origin}/forms/payment-return?pageSessionId=${session.id}&pageId=${page.id}`
    const gwId = await gatewayRowId(data.gatewaySlug, gateway.getGatewayName())
    const submissionId = await ensurePaymentDraft(session)
    await db.update(formSubmissions).set({
      formData: session.collectedData as Record<string, unknown>,
      status: 'pending_payment',
    })
      .where(eq(formSubmissions.id, submissionId))
    const [payment] = await db.insert(payments).values({
      paymentGatewayId: gwId,
      pageSessionId: session.id,
      formSubmissionId: submissionId,
      amount: Math.round(amountMajor * 100),
      currency: page.paymentCurrency,
      status: 'pending',
      gatewayResponse: { environment: credentials.mode ?? 'sandbox' },
    }).returning({ id: payments.id })
    const externalId = `ponkoform-payment-${payment.id}`
    await db.update(payments).set({ externalId }).where(eq(payments.id, payment.id))
    const result = await withTimeout(gateway.createPayment(
      {
        amount: Math.round(amountMajor * 100),
        currency: page.paymentCurrency,
        externalId,
        metadata: { pageSessionId: String(session.id), pageId: String(page.id), paymentId: String(payment.id) },
        returnUrl: base,
        cancelUrl: `${base}&cancelled=1`,
      },
      credentials,
    ), 15_000, 'initiatePagePayment.gatewayCreate', {
      sessionId: data.sessionId,
      pageId: data.pageId,
      correlationId: `page-${data.sessionId}`,
      phase: 'gateway-create',
    })
    if (!result.success || !result.paymentUrl) {
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
      })
      return {
        paymentUrl: null,
        issue: {
          ...issue,
          reference: `PAY-${String(payment.id).padStart(6, '0')}`,
        },
      }
    }

    await db.update(payments).set({
      gatewayPaymentId: result.gatewayPaymentId,
      paymentUrl: result.paymentUrl,
      expiresAt: result.expiresAt ? new Date(result.expiresAt) : null,
      gatewayResponse: {
        pageSessionId: session.id,
        pageId: page.id,
        environment: credentials.mode ?? 'sandbox',
      },
      updatedAt: new Date(),
    }).where(eq(payments.id, payment.id))
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
  .inputValidator((data: { sessionId: number }) => data)
  .handler(async ({ data }) => {
    return withTimeout((async () => {
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
      })
      .from(payments)
      .innerJoin(paymentGateways, eq(payments.paymentGatewayId, paymentGateways.id))
      .where(eq(payments.id, paymentId))
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
