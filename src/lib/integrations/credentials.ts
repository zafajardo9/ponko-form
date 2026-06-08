import { auth } from '@clerk/tanstack-react-start/server'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index'
import { integrationSettings, profiles } from '../../db/schema'
import { decryptJson, maskSecret } from '../crypto'
import type {
  IntegrationConfigs,
  IntegrationSettingsView,
  PayPalConfig,
  SmtpConfig,
  XenditConfig,
} from './types'

/**
 * SERVER-ONLY data access for integration credentials. This module imports the
 * database driver (and Node crypto), so it must NEVER be imported by a route or
 * any client-reachable module — only by server functions and other server-side
 * code (e.g. payment gateways). Routes talk to `server-fns/integrations.ts`,
 * whose `.handler()` bodies are stripped from the client bundle.
 */

export async function ensureProfile(clerkId: string) {
  const existing = await db
    .select()
    .from(profiles)
    .where(eq(profiles.clerkId, clerkId))
    .limit(1)
  if (existing.length > 0) return existing[0]
  const [created] = await db.insert(profiles).values({ clerkId }).returning()
  return created
}

export async function requireProfile() {
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
 * Loads and decrypts every integration config for a profile. Returns raw
 * secrets, so never serialize the result to the client. Used by payment
 * gateways / the email sender to pick up the form owner's own credentials.
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

/** Builds the masked, safe-to-serialize view from decrypted configs. */
export function toIntegrationView(
  configs: IntegrationConfigs,
): IntegrationSettingsView {
  const { xendit, paypal, smtp } = configs
  return {
    xendit: {
      configured: !!xendit,
      secretKeyMask: xendit ? maskSecret(xendit.secretKey) : null,
      publicKey: xendit?.publicKey ?? null,
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

/** Upserts the encrypted config columns for a profile. */
export async function upsertIntegrationConfig(
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
