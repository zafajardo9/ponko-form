import { randomBytes } from 'node:crypto'
import { createServerFn } from '@tanstack/react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import { and, eq } from 'drizzle-orm'
import { db } from '../../db/index'
import {
  emailSurveyInvitations,
  formPageFields,
  formPages,
  forms,
} from '../../db/schema'
import type { PageFieldOption } from '../page-builder/types'
import { assertFormOwner } from './flow-helpers'
import { emailSurveyTokenHash, validEmailSurveyToken } from './email-survey-token'

export const getEmailSurveyFields = createServerFn({ method: 'GET', strict: false })
  .inputValidator((data: { publicId: string }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    const [form] = await db.select().from(forms).where(eq(forms.publicId, data.publicId)).limit(1)
    if (!form) throw new Error('Form not found')
    await assertFormOwner(form.id, userId)

    const fields = await db
      .select({
        id: formPageFields.id,
        label: formPageFields.label,
        bindVariable: formPageFields.bindVariable,
        options: formPageFields.options,
      })
      .from(formPageFields)
      .innerJoin(formPages, eq(formPageFields.pageId, formPages.id))
      .where(and(eq(formPages.formId, form.id), eq(formPageFields.fieldType, 'satisfaction')))
      .orderBy(formPages.position, formPageFields.position)

    return {
      published: form.status === 'published',
      fields: fields.map((field) => ({
        ...field,
        options: (field.options ?? []) as PageFieldOption[],
      })),
    }
  })

export const createEmailSurveyInvitation = createServerFn({ method: 'POST', strict: false })
  .inputValidator((data: {
    publicId: string
    fieldId: number
    recipientReference?: string | null
    expiresInDays?: number
  }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    const [form] = await db.select().from(forms).where(eq(forms.publicId, data.publicId)).limit(1)
    if (!form) throw new Error('Form not found')
    await assertFormOwner(form.id, userId)
    if (form.status !== 'published') throw new Error('Publish this form before creating email survey links')

    const [field] = await db
      .select({
        id: formPageFields.id,
        label: formPageFields.label,
        bindVariable: formPageFields.bindVariable,
        options: formPageFields.options,
      })
      .from(formPageFields)
      .innerJoin(formPages, eq(formPageFields.pageId, formPages.id))
      .where(and(
        eq(formPageFields.id, data.fieldId),
        eq(formPages.formId, form.id),
        eq(formPageFields.fieldType, 'satisfaction'),
      ))
      .limit(1)
    if (!field) throw new Error('Satisfaction field not found')

    const options = (field.options ?? []) as PageFieldOption[]
    if (options.length < 2 || options.some((option) => !Number.isFinite(Number(option.value)))) {
      throw new Error('The satisfaction field needs at least two numeric rating levels')
    }

    const expiresInDays = Math.min(90, Math.max(1, Math.floor(data.expiresInDays ?? 30)))
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    const recipientReference = data.recipientReference?.trim().slice(0, 255) || null
    const token = randomBytes(32).toString('base64url')

    await db.insert(emailSurveyInvitations).values({
      formId: form.id,
      fieldId: field.id,
      tokenHash: emailSurveyTokenHash(token),
      recipientReference,
      expiresAt,
    })

    return {
      token,
      publicId: form.publicId,
      field: { ...field, options },
      expiresAt,
    }
  })

export const getEmailSurveyPrefill = createServerFn({ method: 'GET', strict: false })
  .inputValidator((data: { publicId: string; token: string; rating: string }) => data)
  .handler(async ({ data }) => {
    if (!validEmailSurveyToken(data.token)) return { valid: false as const, reason: 'invalid' as const }

    const [invitation] = await db
      .select({
        id: emailSurveyInvitations.id,
        expiresAt: emailSurveyInvitations.expiresAt,
        usedAt: emailSurveyInvitations.usedAt,
        formSubmissionId: emailSurveyInvitations.formSubmissionId,
        fieldId: formPageFields.id,
        fieldLabel: formPageFields.label,
        bindVariable: formPageFields.bindVariable,
        options: formPageFields.options,
        formStatus: forms.status,
      })
      .from(emailSurveyInvitations)
      .innerJoin(forms, eq(emailSurveyInvitations.formId, forms.id))
      .innerJoin(formPageFields, eq(emailSurveyInvitations.fieldId, formPageFields.id))
      .where(and(
        eq(forms.publicId, data.publicId),
        eq(emailSurveyInvitations.tokenHash, emailSurveyTokenHash(data.token)),
        eq(formPageFields.fieldType, 'satisfaction'),
      ))
      .limit(1)

    if (!invitation || invitation.formStatus !== 'published') {
      return { valid: false as const, reason: 'invalid' as const }
    }
    const completed = Boolean(invitation.usedAt || invitation.formSubmissionId)
    if (!completed && invitation.expiresAt.getTime() <= Date.now()) {
      return { valid: false as const, reason: 'expired' as const }
    }
    const options = (invitation.options ?? []) as PageFieldOption[]
    if (!options.some((option) => option.value === data.rating)) {
      return { valid: false as const, reason: 'rating' as const }
    }

    return {
      valid: true as const,
      completed,
      fieldId: invitation.fieldId,
      fieldLabel: invitation.fieldLabel,
      bindVariable: invitation.bindVariable,
      rating: data.rating,
    }
  })
