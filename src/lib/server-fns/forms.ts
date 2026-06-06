import { createServerFn } from '@tanstack/react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import { db } from '../../db/index'
import { forms, profiles } from '../../db/schema'
import { eq, desc } from 'drizzle-orm'
import type { FormTheme } from '../theme'

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
 * getPublicForm({ formId })
 * PUBLIC (no auth) — fetches a single form by id for the shareable/embeddable
 * pages. Only returns the form if it is PUBLISHED, so unpublished drafts are
 * never exposed. Returns null when not found or not published.
 *
 * The public form pages must NOT use `getForms` (auth-gated + owner-scoped):
 * anonymous visitors have no Clerk session, so it would throw "Unauthorized".
 */
export const getPublicForm = createServerFn({ method: 'GET' })
  .inputValidator((data: { formId: number }) => data)
  .handler(async ({ data }) => {
    const [form] = await db
      .select({
        id: forms.id,
        title: forms.title,
        description: forms.description,
        status: forms.status,
      })
      .from(forms)
      .where(eq(forms.id, data.formId))
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
    const [form] = await db
      .insert(forms)
      .values({ profileId: profile.id, title: data.title, description: data.description })
      .returning()
    return form
  })

export const updateForm = createServerFn({ method: 'POST', strict: false })
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
      .where(eq(forms.id, id))
      .returning()

    if (!form || form.profileId !== profile.id) throw new Error('Not found')
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
