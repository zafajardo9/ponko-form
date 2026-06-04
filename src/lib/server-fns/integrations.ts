import { createServerFn } from '@tanstack/react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index'
import { integrationSettings, profiles } from '../../db/schema'
import { decryptJson, encryptJson, maskSecret } from '../crypto'
import type {
  IntegrationConfigs,
  IntegrationSettingsView,
  PayPalConfig,
  SmtpConfig,
  XenditConfig,
} from '../integrations/types'

// ── Internal helpers (server-only, not exposed as server fns) ──

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

async function requireProfile() {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  return ensureProfile(userId)
}

async function loadRow(profileId: number) {
  const [row] = await db
    .select()
    .from(integrationSettings)
    .where(eq(integrationSettings.profileId, profileId))
    .limit(1)
  return row ?? null
}

function decryptOrNull<T>(token: string | null): T | null {
  if (!token) return null
  try {
    return decryptJson<T>(token)
  } catch {
    // Wrong/rotated key or corrupted data — treat as not configured rather than
    // crashing the whole settings page.
    return null
  }
}

/**
 * Loads and decrypts every integration config for a profile. SERVER-ONLY —
 * returns raw secrets, so never call this from a path that serializes to the
 * client. Used by payment gateways / the email sender to pick up the form
 * owner's own credentials.
 */
export async function loadIntegrationConfigs(
  profileId: number,
): Promise<IntegrationConfigs> {
  const row = await loadRow(profileId)
  return {
    xendit: decryptOrNull<XenditConfig>(row?.xenditConfig ?? null),
    paypal: decryptOrNull<PayPalConfig>(row?.paypalConfig ?? null),
    smtp: decryptOrNull<SmtpConfig>(row?.smtpConfig ?? null),
  }
}

function toView(configs: IntegrationConfigs): IntegrationSettingsView {
  const { xendit, paypal, smtp } = configs
  return {
    xendit: {
      configured: !!xendit,
      secretKeyMask: xendit ? maskSecret(xendit.secretKey) : null,
      hasWebhookToken: !!xendit?.webhookToken,
    },
    paypal: {
      configured: !!paypal,
      clientId: paypal?.clientId ?? null,
      clientSecretMask: paypal ? maskSecret(paypal.clientSecret) : null,
      mode: paypal?.mode ?? 'sandbox',
    },
    smtp: {
      configured: !!smtp,
      host: smtp?.host ?? null,
      port: smtp?.port ?? null,
      secure: smtp?.secure ?? true,
      user: smtp?.user ?? null,
      passwordSet: !!smtp?.password,
      fromEmail: smtp?.fromEmail ?? null,
      fromName: smtp?.fromName ?? null,
    },
  }
}

async function upsert(
  profileId: number,
  patch: Partial<
    Pick<
      typeof integrationSettings.$inferInsert,
      'xenditConfig' | 'paypalConfig' | 'smtpConfig'
    >
  >,
) {
  await db
    .insert(integrationSettings)
    .values({ profileId, ...patch })
    .onConflictDoUpdate({
      target: integrationSettings.profileId,
      set: { ...patch, updatedAt: new Date() },
    })
}

// ── Server functions (client-callable) ──

/**
 * Returns the masked/summary view of the current user's integration settings.
 * Never returns raw secrets.
 */
export const getIntegrationSettings = createServerFn({ method: 'GET' }).handler(
  async (): Promise<IntegrationSettingsView> => {
    const profile = await requireProfile()
    const configs = await loadIntegrationConfigs(profile.id)
    return toView(configs)
  },
)

/**
 * Saves Xendit credentials. Leave `secretKey` blank to keep the existing one
 * (lets the user update only the webhook token without re-entering the key).
 */
export const saveXenditSettings = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: { secretKey?: string; webhookToken?: string }) => data,
  )
  .handler(async ({ data }) => {
    const profile = await requireProfile()
    const existing = (await loadIntegrationConfigs(profile.id)).xendit

    const secretKey = data.secretKey?.trim() || existing?.secretKey
    if (!secretKey) throw new Error('Xendit secret key is required')

    const config: XenditConfig = {
      secretKey,
      webhookToken: data.webhookToken?.trim() || undefined,
    }
    await upsert(profile.id, { xenditConfig: encryptJson(config) })
    return { success: true }
  })

/**
 * Saves PayPal credentials. Leave `clientSecret` blank to keep the existing one.
 */
export const savePaypalSettings = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: {
      clientId: string
      clientSecret?: string
      mode: 'sandbox' | 'live'
    }) => data,
  )
  .handler(async ({ data }) => {
    const profile = await requireProfile()
    const existing = (await loadIntegrationConfigs(profile.id)).paypal

    const clientId = data.clientId.trim()
    const clientSecret = data.clientSecret?.trim() || existing?.clientSecret
    if (!clientId) throw new Error('PayPal client ID is required')
    if (!clientSecret) throw new Error('PayPal client secret is required')

    const config: PayPalConfig = {
      clientId,
      clientSecret,
      mode: data.mode === 'live' ? 'live' : 'sandbox',
    }
    await upsert(profile.id, { paypalConfig: encryptJson(config) })
    return { success: true }
  })

/**
 * Saves SMTP credentials. Leave `password` blank to keep the existing one.
 */
export const saveSmtpSettings = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: {
      host: string
      port: number
      secure: boolean
      user: string
      password?: string
      fromEmail: string
      fromName?: string
    }) => data,
  )
  .handler(async ({ data }) => {
    const profile = await requireProfile()
    const existing = (await loadIntegrationConfigs(profile.id)).smtp

    const password = data.password?.trim() || existing?.password
    if (!data.host?.trim()) throw new Error('SMTP host is required')
    if (!data.fromEmail?.trim()) throw new Error('From email is required')
    if (!password) throw new Error('SMTP password is required')

    const config: SmtpConfig = {
      host: data.host.trim(),
      port: Number(data.port) || 587,
      secure: !!data.secure,
      user: data.user?.trim() ?? '',
      password,
      fromEmail: data.fromEmail.trim(),
      fromName: data.fromName?.trim() || undefined,
    }
    await upsert(profile.id, { smtpConfig: encryptJson(config) })
    return { success: true }
  })

/** Clears a single integration's credentials. */
export const deleteIntegration = createServerFn({ method: 'POST' })
  .inputValidator((data: { provider: 'xendit' | 'paypal' | 'smtp' }) => data)
  .handler(async ({ data }) => {
    const profile = await requireProfile()
    const column =
      data.provider === 'xendit'
        ? { xenditConfig: null }
        : data.provider === 'paypal'
          ? { paypalConfig: null }
          : { smtpConfig: null }
    await upsert(profile.id, column)
    return { success: true }
  })
