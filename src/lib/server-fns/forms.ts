import { createServerFn } from '@tanstack/react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import { randomBytes } from 'node:crypto'
import { db } from '../../db/index'
import { formFields, formPageFields, formPages, formTemplates, forms, profiles } from '../../db/schema'
import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import type { FormTheme } from '../theme'
import type { TemplatePageData } from '../form-templates/types'
import {
  templateFieldInsertValues,
  templatePageInsertValues,
} from '../form-templates/create-plan'
import { getRecaptchaConfigForForm } from '../integrations/recaptcha'
import { hydratePages, loadFormReferences } from '../page-builder/server-data'
import { loadFlow } from '../flow-engine/server-data'
import { assertFormOwner } from './flow-helpers'
import { jsonObject } from './validation'
export { jsonObject } from './validation'

async function ensureProfile(clerkId: string) {
  const [profile] = await db
    .insert(profiles)
    .values({ clerkId })
    .onConflictDoUpdate({
      target: profiles.clerkId,
      set: { clerkId },
    })
    .returning()
  if (!profile) throw new Error('Unable to initialize user profile')
  return profile
}

function ownedProfileIds(clerkId: string) {
  return db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.clerkId, clerkId))
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

  return db
    .select()
    .from(forms)
    .where(inArray(forms.profileId, ownedProfileIds(userId)))
    .orderBy(desc(forms.updatedAt))
})

/**
 * Load the authenticated editor's metadata and active builder definition in a
 * single request. Page forms take precedence, so their accounts avoid loading
 * an unused legacy flow; flow forms avoid the page-reference queries.
 */
export const getEditorForm = createServerFn({ method: 'GET', strict: false })
  .validator((data: { formId: number }) => {
    if (!Number.isInteger(data.formId) || data.formId <= 0) {
      throw new Error('Invalid form identifier')
    }
    return data
  })
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')

    const form = await assertFormOwner(data.formId, userId)
    const pages = await hydratePages(data.formId)
    if (pages.length > 0) {
      const needsRecaptcha = pages.some((page) =>
        page.fields.some((field) => field.fieldType === 'recaptcha'),
      )
      const [references, recaptcha] = await Promise.all([
        loadFormReferences(data.formId),
        needsRecaptcha
          ? getRecaptchaConfigForForm(data.formId)
          : Promise.resolve(null),
      ])
      return {
        form,
        pageForm: {
          form,
          pages,
          references,
          recaptchaSiteKey: recaptcha?.siteKey ?? null,
        },
        flow: null,
      }
    }

    return {
      form,
      pageForm: null,
      flow: await loadFlow(data.formId),
    }
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
  .validator((data: { publicId: string }) => data)
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

/**
 * Resolve exactly one published form runtime after metadata has loaded.
 * Page-builder forms take precedence, followed by flow forms and legacy fields.
 */
export const getPublicFormRuntime = createServerFn({ method: 'GET' })
  .validator((data: { formId: number }) => data)
  .handler(async ({ data }) => {
    const [publishedForm] = await db
      .select({ id: forms.id })
      .from(forms)
      .where(and(eq(forms.id, data.formId), eq(forms.status, 'published')))
      .limit(1)
    if (!publishedForm) return null

    const pages = await hydratePages(data.formId)
    if (pages.length > 0) {
      const needsRecaptcha = pages.some((page) =>
        page.fields.some((field) => field.fieldType === 'recaptcha'),
      )
      const [references, recaptcha] = await Promise.all([
        loadFormReferences(data.formId),
        needsRecaptcha ? getRecaptchaConfigForForm(data.formId) : Promise.resolve(null),
      ])
      return {
        kind: 'page' as const,
        pages,
        references,
        recaptchaSiteKey: recaptcha?.siteKey ?? null,
      }
    }

    const flow = await loadFlow(data.formId)
    if (flow) {
      return {
        kind: 'flow' as const,
        flow: {
          ...flow,
          // Database JSON is already serializable at runtime. Giving the
          // public boundary a concrete JSON type also lets TanStack verify the
          // server-function contract instead of widening config values to
          // `unknown`.
          nodes: flow.nodes.map((node) => ({
            ...node,
            config: jsonObject(node.config),
          })),
        },
      }
    }

    const fields = await db
      .select()
      .from(formFields)
      .where(eq(formFields.formId, data.formId))
      .orderBy(formFields.order)
    return { kind: 'legacy' as const, fields }
  })

export const createForm = createServerFn({ method: 'POST' })
  .validator((data: { title: string; description?: string }) => data)
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
  return db.select().from(formTemplates)
    .where(
      or(
        isNull(formTemplates.profileId),
        inArray(formTemplates.profileId, ownedProfileIds(userId)),
      ),
    )
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
  .validator((data: { templateId: number; title?: string }) => data)
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
      const createdPages = await db
        .insert(formPages)
        .values(templatePageInsertValues(form.id, template.pagesData))
        .returning({ id: formPages.id, position: formPages.position })
      const fieldValues = templateFieldInsertValues(
        createdPages,
        template.pagesData,
      )
      if (fieldValues.length > 0) {
        await db.insert(formPageFields).values(fieldValues)
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
  .validator(
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

    const { id, ...fields } = data
    const [form] = await db
      .update(forms)
      .set({ ...fields, updatedAt: new Date() })
      .where(
        and(
          eq(forms.id, id),
          inArray(forms.profileId, ownedProfileIds(userId)),
        ),
      )
      .returning()

    if (!form) throw new Error('Not found')
    return form
  })

function normalizedFormIds(ids: number[]) {
  const uniqueIds = [...new Set(ids)]
  if (
    uniqueIds.length === 0 ||
    uniqueIds.length > 100 ||
    uniqueIds.some((id) => !Number.isInteger(id) || id <= 0)
  ) {
    throw new Error('Select between 1 and 100 valid forms')
  }
  return uniqueIds
}

async function assertOwnedFormIds(ids: number[], userId: string) {
  const owned = await db
    .select({ id: forms.id })
    .from(forms)
    .where(
      and(
        inArray(forms.id, ids),
        inArray(forms.profileId, ownedProfileIds(userId)),
      ),
    )
  if (owned.length !== ids.length) {
    throw new Error('One or more selected forms are unavailable')
  }
}

export const bulkUpdateForms = createServerFn({ method: 'POST' })
  .validator((data: { ids: number[]; status: 'draft' | 'published' }) => {
    if (data.status !== 'draft' && data.status !== 'published') {
      throw new Error('Select a valid form status')
    }
    return {
      ids: normalizedFormIds(data.ids),
      status: data.status,
    }
  })
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertOwnedFormIds(data.ids, userId)

    const updated = await db
      .update(forms)
      .set({ status: data.status, updatedAt: new Date() })
      .where(
        and(
          inArray(forms.id, data.ids),
          inArray(forms.profileId, ownedProfileIds(userId)),
        ),
      )
      .returning({ id: forms.id })

    if (updated.length !== data.ids.length) {
      throw new Error('One or more selected forms could not be updated')
    }
    return { updated: updated.length, ids: updated.map((form) => form.id) }
  })

export const bulkDeleteForms = createServerFn({ method: 'POST' })
  .validator((data: { ids: number[] }) => ({ ids: normalizedFormIds(data.ids) }))
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertOwnedFormIds(data.ids, userId)

    const deleted = await db
      .delete(forms)
      .where(
        and(
          inArray(forms.id, data.ids),
          inArray(forms.profileId, ownedProfileIds(userId)),
        ),
      )
      .returning({ id: forms.id })

    if (deleted.length !== data.ids.length) {
      throw new Error('One or more selected forms could not be deleted')
    }
    return { deleted: deleted.length, ids: deleted.map((form) => form.id) }
  })

export const deleteForm = createServerFn({ method: 'POST' })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')

    const [form] = await db
      .delete(forms)
      .where(
        and(
          eq(forms.id, data.id),
          inArray(forms.profileId, ownedProfileIds(userId)),
        ),
      )
      .returning({ id: forms.id })
    if (!form) throw new Error('Not found')
    return { success: true }
  })
