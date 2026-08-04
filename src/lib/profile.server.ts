import { eq } from 'drizzle-orm'
import { db } from '../db/index'
import { user as authUsers } from '../db/auth-schema'
import { profiles } from '../db/schema'
import { requireAuthIdentity } from './auth.server'

export async function ensureProfile(authId: string) {
  const [existing] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.authId, authId))
    .limit(1)
  if (existing) return existing

  const [user] = await db
    .select()
    .from(authUsers)
    .where(eq(authUsers.id, authId))
    .limit(1)
  if (!user) throw new Error('Authenticated user record was not found')

  const email = user.email.trim().toLowerCase()
  const name = user.name?.trim() || null
  const avatarUrl = user.image || null

  const [linked] = await db
    .update(profiles)
    .set({
      authId,
      email,
      name,
      displayName: name,
      avatarUrl,
      authProvider: 'better-auth',
      updatedAt: new Date(),
    })
    .where(eq(profiles.email, email))
    .returning()
  if (linked) return linked

  const [created] = await db
    .insert(profiles)
    .values({
      authId,
      email,
      name,
      displayName: name,
      avatarUrl,
      authProvider: 'better-auth',
    })
    .onConflictDoUpdate({
      target: profiles.authId,
      set: {
        email,
        name,
        displayName: name,
        avatarUrl,
        authProvider: 'better-auth',
        updatedAt: new Date(),
      },
    })
    .returning()
  if (!created) throw new Error('Unable to initialize user profile')
  return created
}

export async function requireProfile() {
  const { userId } = await requireAuthIdentity()
  return ensureProfile(userId)
}
