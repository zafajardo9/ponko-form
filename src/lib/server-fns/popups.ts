import { createServerFn } from '@tanstack/react-start'
import { randomBytes } from 'node:crypto'
import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '../../db/index'
import { popups } from '../../db/schema'
import { requireProfile } from '../integrations/credentials'
import {
  DEFAULT_POPUP_HEIGHT,
  DEFAULT_POPUP_WIDTH,
  defaultStyle,
  defaultTrigger,
  sampleElements,
} from '../popup-builder/defaults'
import {
  createPopupSchema,
  popupPublicIdSchema,
  savePopupSchema,
  setPopupStatusSchema,
} from '../popup-builder/model'
import { sanitizePopupElements, sanitizePopupStyle } from '../popup-builder/sanitize'

/**
 * Popup server functions (FT-026). Creator-facing functions follow the
 * payment-links conventions (requireProfile + ownership); public functions
 * are `strict: false` so the embed page and API routes can call them without
 * a session, and only ever expose `published` popups. Validation schemas live
 * in `popup-builder/model.ts` (pure, testable).
 */

export {
  createPopupSchema,
  elementSchema,
  frequencySchema,
  placementSchema,
  popupPublicIdSchema,
  popupStyleSchema,
  savePopupSchema,
  setPopupStatusSchema,
  triggerSchema,
} from '../popup-builder/model'

// ── Helpers ──

function generatePublicId(): string {
  return randomBytes(8).toString('base64url').slice(0, 16)
}

async function ownedPopup(id: number, profileId: number) {
  const [row] = await db
    .select()
    .from(popups)
    .where(and(eq(popups.id, id), eq(popups.profileId, profileId)))
    .limit(1)
  return row ?? null
}

function withSafeElements<T extends { elements: typeof popups.$inferSelect.elements }>(popup: T): T {
  return { ...popup, elements: sanitizePopupElements(popup.elements ?? []) }
}

// ── Creator-facing (authenticated) ──

export const createPopup = createServerFn({ method: 'POST' })
  .validator(createPopupSchema)
  .handler(async ({ data }) => {
    const profile = await requireProfile()
    const [popup] = await db
      .insert(popups)
      .values({
        profileId: profile.id,
        publicId: generatePublicId(),
        title: data.title.trim(),
        width: DEFAULT_POPUP_WIDTH,
        height: DEFAULT_POPUP_HEIGHT,
        placement: 'center',
        trigger: defaultTrigger(),
        frequency: 'once-per-session',
        schedule: {},
        style: defaultStyle(),
        elements: sampleElements(),
      })
      .returning()
    return withSafeElements(popup)
  })

export const getPopups = createServerFn({ method: 'GET' })
  .handler(async () => {
    const profile = await requireProfile()
    return db
      .select()
      .from(popups)
      .where(eq(popups.profileId, profile.id))
      .orderBy(desc(popups.updatedAt))
  })

export const getPopup = createServerFn({ method: 'GET' })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const profile = await requireProfile()
    const popup = await ownedPopup(data.id, profile.id)
    if (!popup) throw new Error('Popup not found')
    return withSafeElements(popup)
  })

export const savePopup = createServerFn({ method: 'POST' })
  .validator(savePopupSchema)
  .handler(async ({ data }) => {
    const profile = await requireProfile()
    const existing = await ownedPopup(data.id, profile.id)
    if (!existing) throw new Error('Popup not found')

    const [updated] = await db
      .update(popups)
      .set({
        title: data.title.trim(),
        width: data.width,
        height: data.height,
        placement: data.placement,
        trigger: data.trigger,
        frequency: data.frequency,
        schedule: data.schedule,
        style: sanitizePopupStyle(data.style),
        elements: sanitizePopupElements(data.elements),
        updatedAt: new Date(),
      })
      .where(and(eq(popups.id, data.id), eq(popups.profileId, profile.id)))
      .returning()
    return withSafeElements(updated)
  })

export const setPopupStatus = createServerFn({ method: 'POST' })
  .validator(setPopupStatusSchema)
  .handler(async ({ data }) => {
    const profile = await requireProfile()
    const result = await db
      .update(popups)
      .set({ status: data.status, updatedAt: new Date() })
      .where(and(eq(popups.id, data.id), eq(popups.profileId, profile.id)))
      .returning({ id: popups.id })
    if (result.length === 0) throw new Error('Popup not found')
    return { success: true }
  })

export const deletePopup = createServerFn({ method: 'POST' })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const profile = await requireProfile()
    const result = await db
      .delete(popups)
      .where(and(eq(popups.id, data.id), eq(popups.profileId, profile.id)))
      .returning({ id: popups.id })
    if (result.length === 0) throw new Error('Popup not found')
    return { success: true }
  })

// ── Public-facing (no auth, published only) ──

/** Small config for the host-side loader — never includes elements. */
export const getPopupPublicConfig = createServerFn({ method: 'GET', strict: false })
  .validator(popupPublicIdSchema)
  .handler(async ({ data }) => {
    const [popup] = await db
      .select({
        publicId: popups.publicId,
        title: popups.title,
        width: popups.width,
        height: popups.height,
        placement: popups.placement,
        trigger: popups.trigger,
        frequency: popups.frequency,
        schedule: popups.schedule,
        style: popups.style,
        status: popups.status,
      })
      .from(popups)
      .where(eq(popups.publicId, data.publicId))
      .limit(1)

    if (!popup || popup.status !== 'published') return null
    const { status: _status, ...config } = popup
    return config
  })

/** Full render config for the embed iframe page. */
export const getPopupEmbed = createServerFn({ method: 'GET', strict: false })
  .validator(popupPublicIdSchema)
  .handler(async ({ data }) => {
    const [popup] = await db
      .select({
        publicId: popups.publicId,
        title: popups.title,
        width: popups.width,
        height: popups.height,
        style: popups.style,
        elements: popups.elements,
        status: popups.status,
      })
      .from(popups)
      .where(eq(popups.publicId, data.publicId))
      .limit(1)

    if (!popup || popup.status !== 'published') return null
    return withSafeElements(popup)
  })

/** Owner-only render config used by the real loader while previewing drafts. */
export const getPopupPreview = createServerFn({ method: 'GET' })
  .validator(popupPublicIdSchema)
  .handler(async ({ data }) => {
    const profile = await requireProfile()
    const [popup] = await db
      .select()
      .from(popups)
      .where(and(eq(popups.publicId, data.publicId), eq(popups.profileId, profile.id)))
      .limit(1)
    return popup ? withSafeElements(popup) : null
  })

/** Beacon endpoints — increment counters only for published popups. */
export const recordPopupView = createServerFn({ method: 'POST', strict: false })
  .validator(popupPublicIdSchema)
  .handler(async ({ data }) => {
    await db
      .update(popups)
      .set({ viewCount: sql`${popups.viewCount} + 1` })
      .where(and(eq(popups.publicId, data.publicId), eq(popups.status, 'published')))
    return { success: true }
  })

export const recordPopupClick = createServerFn({ method: 'POST', strict: false })
  .validator(popupPublicIdSchema)
  .handler(async ({ data }) => {
    await db
      .update(popups)
      .set({ clickCount: sql`${popups.clickCount} + 1` })
      .where(and(eq(popups.publicId, data.publicId), eq(popups.status, 'published')))
    return { success: true }
  })
