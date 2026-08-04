import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../../db/index'
import {
  collaborationLogs,
  formCollaborators,
  profiles,
} from '../../db/schema'
import { requireProfile } from '../profile.server'
import { sendTransactionalEmail } from '../email/transactional'
import { publicRequestOrigin } from './request-origin'
import { assertFormOwner } from './flow-helpers'

type CollaboratorRole = 'editor' | 'viewer'

function formIdInput(data: { formId: number }) {
  if (!Number.isInteger(data.formId) || data.formId <= 0) {
    throw new Error('Invalid form identifier')
  }
  return data
}

function collaboratorInput(data: { collaboratorId: number; role?: CollaboratorRole }) {
  if (!Number.isInteger(data.collaboratorId) || data.collaboratorId <= 0) {
    throw new Error('Invalid collaborator identifier')
  }
  if (data.role && data.role !== 'editor' && data.role !== 'viewer') {
    throw new Error('Invalid collaborator role')
  }
  return data
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!)
}

export const getCollaborators = createServerFn({ method: 'GET' })
  .validator(formIdInput)
  .handler(async ({ data }) => {
    const profile = await requireProfile()
    await assertFormOwner(data.formId, profile.authId)
    return db
      .select({
        id: formCollaborators.id,
        profileId: profiles.id,
        role: formCollaborators.role,
        name: profiles.name,
        email: profiles.email,
        avatarUrl: profiles.avatarUrl,
        createdAt: formCollaborators.createdAt,
      })
      .from(formCollaborators)
      .innerJoin(profiles, eq(formCollaborators.profileId, profiles.id))
      .where(eq(formCollaborators.formId, data.formId))
      .orderBy(desc(formCollaborators.createdAt))
  })

export const inviteCollaborator = createServerFn({ method: 'POST' })
  .validator((data: { formId: number; email: string; role: CollaboratorRole }) => {
    formIdInput(data)
    const email = data.email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address')
    if (data.role !== 'editor' && data.role !== 'viewer') {
      throw new Error('Invalid collaborator role')
    }
    return { ...data, email }
  })
  .handler(async ({ data }) => {
    const profile = await requireProfile()
    const form = await assertFormOwner(data.formId, profile.authId)

    const [target] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.email, data.email))
      .limit(1)
    if (!target) {
      throw new Error(`No PonkoForm user found for ${data.email}. They need to sign in once before you can add them.`)
    }
    if (target.id === profile.id) throw new Error('You already own this form')

    const [existing] = await db
      .select()
      .from(formCollaborators)
      .where(and(
        eq(formCollaborators.formId, data.formId),
        eq(formCollaborators.profileId, target.id),
      ))
      .limit(1)

    const [collaborator] = existing
      ? await db
          .update(formCollaborators)
          .set({ role: data.role, updatedAt: new Date() })
          .where(eq(formCollaborators.id, existing.id))
          .returning()
      : await db
          .insert(formCollaborators)
          .values({
            formId: data.formId,
            profileId: target.id,
            role: data.role,
            invitedBy: profile.id,
          })
          .returning()

    await db.insert(collaborationLogs).values({
      formId: data.formId,
      actorId: profile.id,
      targetId: target.id,
      action: existing ? 'role_changed' : 'invited',
      oldRole: existing?.role,
      newRole: data.role,
      details: existing
        ? `${profile.email || 'Owner'} changed ${target.email || 'collaborator'} from ${existing.role} to ${data.role}`
        : `${profile.email || 'Owner'} invited ${target.email || 'collaborator'} as ${data.role}`,
    })
    let notificationSent = false
    if (!existing && target.email) {
      const formTitle = form.title
      const actor = profile.name || profile.email || 'A PonkoForm user'
      const formsUrl = `${publicRequestOrigin()}/forms`
      try {
        await sendTransactionalEmail(profile.id, {
          recipient: target.email,
          subject: `You can now ${data.role === 'editor' ? 'edit' : 'view'} “${formTitle}” in PonkoForm`,
          text: `${actor} shared “${formTitle}” with you as ${data.role}. Open ${formsUrl} to access it.`,
          html: `<p>${escapeHtml(actor)} shared <strong>${escapeHtml(formTitle)}</strong> with you as ${data.role}.</p><p><a href="${escapeHtml(formsUrl)}">Open PonkoForm</a></p>`,
          idempotencyKey: `collaboration-invite-${collaborator.id}`,
        })
        notificationSent = true
      } catch {
        // Access is granted even when the owner has no email provider configured.
      }
    }
    return { ...collaborator, notificationSent }
  })

export const changeCollaboratorRole = createServerFn({ method: 'POST' })
  .validator((data: { collaboratorId: number; role: CollaboratorRole }) => {
    collaboratorInput(data)
    if (data.role !== 'editor' && data.role !== 'viewer') {
      throw new Error('Invalid collaborator role')
    }
    return data
  })
  .handler(async ({ data }) => {
    const profile = await requireProfile()
    const [collaborator] = await db
      .select()
      .from(formCollaborators)
      .where(eq(formCollaborators.id, data.collaboratorId))
      .limit(1)
    if (!collaborator) throw new Error('Collaborator not found')
    await assertFormOwner(collaborator.formId, profile.authId)
    if (collaborator.role === data.role) return collaborator

    const [updated] = await db
      .update(formCollaborators)
      .set({ role: data.role, updatedAt: new Date() })
      .where(eq(formCollaborators.id, collaborator.id))
      .returning()
    await db.insert(collaborationLogs).values({
      formId: collaborator.formId,
      actorId: profile.id,
      targetId: collaborator.profileId,
      action: 'role_changed',
      oldRole: collaborator.role,
      newRole: data.role,
      details: `${profile.email || 'Owner'} changed a collaborator from ${collaborator.role} to ${data.role}`,
    })
    return updated
  })

export const removeCollaborator = createServerFn({ method: 'POST' })
  .validator((data: { collaboratorId: number }) => collaboratorInput(data))
  .handler(async ({ data }) => {
    const profile = await requireProfile()
    const [collaborator] = await db
      .select()
      .from(formCollaborators)
      .where(eq(formCollaborators.id, data.collaboratorId))
      .limit(1)
    if (!collaborator) throw new Error('Collaborator not found')
    await assertFormOwner(collaborator.formId, profile.authId)

    await db.delete(formCollaborators).where(eq(formCollaborators.id, collaborator.id))
    await db.insert(collaborationLogs).values({
      formId: collaborator.formId,
      actorId: profile.id,
      targetId: collaborator.profileId,
      action: 'removed',
      oldRole: collaborator.role,
      details: `${profile.email || 'Owner'} removed a collaborator`,
    })
    return { success: true as const }
  })

export const getCollaborationLogs = createServerFn({ method: 'GET' })
  .validator(formIdInput)
  .handler(async ({ data }) => {
    const profile = await requireProfile()
    await assertFormOwner(data.formId, profile.authId)
    return db
      .select({
        id: collaborationLogs.id,
        action: collaborationLogs.action,
        oldRole: collaborationLogs.oldRole,
        newRole: collaborationLogs.newRole,
        details: collaborationLogs.details,
        createdAt: collaborationLogs.createdAt,
        actorName: profiles.name,
        actorEmail: profiles.email,
      })
      .from(collaborationLogs)
      .innerJoin(profiles, eq(collaborationLogs.actorId, profiles.id))
      .where(eq(collaborationLogs.formId, data.formId))
      .orderBy(desc(collaborationLogs.createdAt))
      .limit(50)
  })
