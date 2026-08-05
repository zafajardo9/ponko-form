import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index'
import { user as authUsers } from '../../db/auth-schema'
import { profiles } from '../../db/schema'
import { requireProfile } from '../profile.server'

function profileInput(data: { name: string; avatarUrl?: string }) {
  const name = data.name.trim()
  const avatarUrl = data.avatarUrl?.trim() || ''

  if (name.length < 2 || name.length > 100) {
    throw new Error('Name must be between 2 and 100 characters.')
  }

  if (avatarUrl.length > 2048) {
    throw new Error('Profile image URL is too long.')
  }

  if (avatarUrl) {
    try {
      const url = new URL(avatarUrl)
      if (url.protocol !== 'https:') throw new Error()
    } catch {
      throw new Error('Profile image must use a valid HTTPS URL.')
    }
  }

  return { name, avatarUrl: avatarUrl || null }
}

export const getMyProfile = createServerFn({ method: 'GET' }).handler(async () => {
  const profile = await requireProfile()
  return {
    name: profile.displayName || profile.name || '',
    email: profile.email || '',
    avatarUrl: profile.avatarUrl || '',
  }
})

export const updateMyProfile = createServerFn({ method: 'POST' })
  .validator(profileInput)
  .handler(async ({ data }) => {
    const profile = await requireProfile()
    const updatedAt = new Date()

    const [updated] = await db
      .update(profiles)
      .set({
        name: data.name,
        displayName: data.name,
        avatarUrl: data.avatarUrl,
        updatedAt,
      })
      .where(eq(profiles.id, profile.id))
      .returning({
        name: profiles.displayName,
        email: profiles.email,
        avatarUrl: profiles.avatarUrl,
      })

    if (!updated) throw new Error('Profile could not be updated.')

    await db
      .update(authUsers)
      .set({
        name: data.name,
        image: data.avatarUrl,
        updatedAt,
      })
      .where(eq(authUsers.id, profile.authId))

    return {
      name: updated.name || data.name,
      email: updated.email || '',
      avatarUrl: updated.avatarUrl || '',
    }
  })
