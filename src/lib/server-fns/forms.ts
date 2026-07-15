import { createServerFn } from '@tanstack/react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import { randomBytes } from 'node:crypto'
import { db } from '../../db/index'
import { formPageFields, formPages, formTemplates, forms, profiles } from '../../db/schema'
import { and, asc, desc, eq, isNull, or, sql } from 'drizzle-orm'
import type { FormTheme } from '../theme'
import type { TemplatePageData } from '../form-templates/types'

async function ensureProfile(clerkId: string) {
  const existing = await db
    .select()
    .from(profiles)
    .where(eq(profiles.clerkId, clerkId))
    .limit(1)
  if (existing.length > 0) return existing[0]

  const [created] = await db.insert(profiles).values({ clerkId }).returning()
  return created
}

function createPublicId() {
  return randomBytes(16).toString('base64url').slice(0, 24)
}

async function createUniquePublicId() {
  for (let i = 0; i < 5; i += 1) {
    const publicId = createPublicId()
    const existing = await db
      .select({ id: forms.id })
      .from(forms)
      .where(eq(forms.publicId, publicId))
      .limit(1)
    if (existing.length === 0) return publicId
  }
  throw new Error('Unable to create form link. Please try again.')
}

export const getForms = createServerFn({ method: 'GET' }).handler(async () => {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const profile = await ensureProfile(userId)
  return db
    .select()
    .from(forms)
    .where(eq(forms.profileId, profile.id))
    .orderBy(desc(forms.updatedAt))
})

/**
 * getPublicForm({ publicId })
 * PUBLIC (no auth) — fetches a single form by opaque public id for the shareable/embeddable
 * pages. Only returns the form if it is PUBLISHED, so unpublished drafts are
 * never exposed. Returns null when not found or not published.
 *
 * The public form pages must NOT use `getForms` (auth-gated + owner-scoped):
 * anonymous visitors have no Clerk session, so it would throw "Unauthorized".
 */
export const getPublicForm = createServerFn({ method: 'GET' })
  .inputValidator((data: { publicId: string }) => data)
  .handler(async ({ data }) => {
    if (!data.publicId) {
      throw new Error('Missing form identifier')
    }

    const [form] = await db
      .select({
        id: forms.id,
        publicId: forms.publicId,
        title: forms.title,
        description: forms.description,
        status: forms.status,
        theme: forms.theme,
      })
      .from(forms)
      .where(eq(forms.publicId, data.publicId))
      .limit(1)

    if (!form || form.status !== 'published') return null
    return form
  })

export const createForm = createServerFn({ method: 'POST' })
  .inputValidator((data: { title: string; description?: string }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')

    const profile = await ensureProfile(userId)
    const publicId = await createUniquePublicId()
    const [form] = await db
      .insert(forms)
      .values({ profileId: profile.id, publicId, title: data.title, description: data.description })
      .returning()
    await db.insert(formPages).values([
      {
        formId: form.id,
        title: 'Page 1',
        position: 0,
        isFinal: false,
      },
      {
        formId: form.id,
        title: 'Thank You',
        position: 1,
        isFinal: true,
        finalTemplate: 'Your response has been recorded.',
      },
    ])
    return form
  })

export const getFormTemplates = createServerFn({ method: 'GET' }).handler(async () => {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  const profile = await ensureProfile(userId)
  return db.select().from(formTemplates)
    .where(or(isNull(formTemplates.profileId), eq(formTemplates.profileId, profile.id)))
    .orderBy(asc(formTemplates.category), desc(formTemplates.usageCount), asc(formTemplates.name))
})

function validTemplatePages(value: unknown): value is TemplatePageData[] {
  if (!Array.isArray(value) || value.length === 0) return false
  const finalPages = value.filter((page) => page && typeof page === 'object' && (page as TemplatePageData).isFinal)
  return finalPages.length === 1 && value.every((page) => {
    if (!page || typeof page !== 'object') return false
    const item = page as TemplatePageData
    return typeof item.title === 'string' && item.title.trim().length > 0 && Array.isArray(item.fields)
  })
}

export const createFormFromTemplate = createServerFn({ method: 'POST' })
  .inputValidator((data: { templateId: number; title?: string }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    const profile = await ensureProfile(userId)
    const [template] = await db.select().from(formTemplates)
      .where(eq(formTemplates.id, data.templateId)).limit(1)
    if (!template || (template.profileId !== null && template.profileId !== profile.id)) {
      throw new Error('Template not found')
    }
    if (!validTemplatePages(template.pagesData)) throw new Error('Template data is invalid')
    const title = data.title?.trim() || template.name
    if (!title) throw new Error('Form title is required')

    const [form] = await db.insert(forms).values({
      profileId: profile.id,
      publicId: await createUniquePublicId(),
      title: title.slice(0, 255),
      description: template.description,
    }).returning()

    try {
      for (const pageData of [...template.pagesData].sort((a, b) => a.position - b.position)) {
        const [page] = await db.insert(formPages).values({
          formId: form.id,
          title: pageData.title.slice(0, 255),
          description: pageData.description ?? null,
          position: pageData.position,
          isFinal: pageData.isFinal,
          finalTemplate: pageData.isFinal ? pageData.finalTemplate ?? 'Your response has been recorded.' : null,
        }).returning({ id: formPages.id })
        if (!pageData.isFinal && pageData.fields.length > 0) {
          await db.insert(formPageFields).values(pageData.fields.map((field, index) => ({
            pageId: page.id,
            fieldType: field.fieldType,
            label: field.label.slice(0, 255),
            placeholder: field.placeholder?.slice(0, 255) ?? null,
            required: Boolean(field.required),
            options: field.options ?? null,
            bindVariable: field.bindVariable,
            position: Number.isFinite(field.position) ? field.position : index,
            width: field.width ?? 'full',
            validationRules: null,
          })))
        }
      }
      await db.update(formTemplates).set({
        usageCount: sql`${formTemplates.usageCount} + 1`,
        updatedAt: new Date(),
      }).where(eq(formTemplates.id, template.id))
      return form
    } catch (error) {
      await db.delete(forms).where(eq(forms.id, form.id))
      throw error
    }
  })

export const updateForm = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: {
      id: number
      title?: string
      description?: string
      status?: 'draft' | 'published'
      theme?: FormTheme | null
    }) => data,
  )
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')

    const profile = await ensureProfile(userId)
    const { id, ...fields } = data
    const [form] = await db
      .update(forms)
      .set({ ...fields, updatedAt: new Date() })
      .where(and(eq(forms.id, id), eq(forms.profileId, profile.id)))
      .returning()

    if (!form) throw new Error('Not found')
    return form
  })

export const deleteForm = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')

    const profile = await ensureProfile(userId)
    const [form] = await db.select().from(forms).where(eq(forms.id, data.id)).limit(1)
    if (!form || form.profileId !== profile.id) throw new Error('Not found')

    await db.delete(forms).where(eq(forms.id, data.id))
    return { success: true }
  })
