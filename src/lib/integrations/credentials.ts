import { currentAuth as auth } from '../auth.server'
import { and, eq } from 'drizzle-orm'
import { db } from '../../db/index'
import { integrationSettings, integrations } from '../../db/schema'
import { decryptJson, encryptJson, maskSecret } from '../crypto'
import { ensureProfile } from '../profile.server'
import type {
  IntegrationConfig,
  IntegrationConfigs,
  IntegrationSettingsView,
  IntegrationStatus,
  MayaConfig,
  PayPalConfig,
  PayPalEnvironmentCredentials,
  ProviderSlug,
  ResendConfig,
  RecaptchaConfig,
  SmtpConfig,
  XenditConfig,
  XenditEnvironmentCredentials,
} from './types'

/**
 * SERVER-ONLY data access for integration credentials. This module imports the
 * database driver (and Node crypto), so it must NEVER be imported by a route or
 * any client-reachable module — only by server functions and other server-side
 * code (e.g. payment gateways). Routes talk to `server-fns/integrations.ts`,
 * whose `.handler()` bodies are stripped from the client bundle.
 */

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
 *
 * Checks the new integrations table first (FT-002), falls back to the legacy
 * integration_settings table for backward compatibility.
 */
export async function loadIntegrationConfigs(
  profileId: number,
): Promise<IntegrationConfigs> {
  // Try new integrations table first
  const newRows = await db
    .select()
    .from(integrations)
    .where(eq(integrations.profileId, profileId))

  const newConfig = (provider: string) => {
    const row = newRows.find((r) => r.provider === provider)
    return row?.config ?? null
  }

  const xenditRaw = decryptOrNull<XenditConfig>(newConfig('xendit'))
  const paypalRaw = decryptOrNull<PayPalConfig>(newConfig('paypal'))
  const xendit = xenditRaw ? normalizeXenditConfig(xenditRaw) : null
  const paypal = paypalRaw ? normalizePaypalConfig(paypalRaw) : null
  const smtp = decryptOrNull<SmtpConfig>(newConfig('smtp'))

  // If all found in new table, return
  if (xendit || paypal || smtp) {
    return { xendit, paypal, smtp }
  }

  // Fall back to legacy integration_settings table
  const row = await loadRow(profileId)
  const legacyXendit = decryptOrNull<XenditConfig>(row?.xenditConfig ?? null)
  const legacyPaypal = decryptOrNull<PayPalConfig>(row?.paypalConfig ?? null)
  return {
    xendit: legacyXendit
      ? normalizeXenditConfig(legacyXendit)
      : null,
    paypal: legacyPaypal
      ? normalizePaypalConfig(legacyPaypal)
      : null,
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
      mode: xendit?.mode ?? inferXenditEnvironment(xendit?.secretKey),
    },
    paypal: {
      configured: !!paypal,
      clientId: paypal?.clientId ?? null,
      clientSecretMask: paypal ? maskSecret(paypal.clientSecret) : null,
      mode: paypal?.mode === 'live' ? 'live' : 'sandbox',
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

// ── NEW integrations table (FT-002) ──

/**
 * Extract non-secret metadata from a decrypted config for the client view.
 */
function integrationMeta(provider: ProviderSlug, config: IntegrationConfig | null): Record<string, string> | undefined {
  if (!config) return undefined
  switch (provider) {
    case 'xendit':
      const normalizedXendit = normalizeXenditConfig(config as XenditConfig)
      return {
        mode: normalizedXendit.mode,
        sandboxConfigured: String(Boolean(normalizedXendit.sandbox)),
        liveConfigured: String(Boolean(normalizedXendit.live)),
      }
    case 'paypal':
      const normalizedPaypal = normalizePaypalConfig(config as PayPalConfig)
      return {
        mode: normalizedPaypal.mode,
        sandboxConfigured: String(Boolean(normalizedPaypal.sandbox)),
        liveConfigured: String(Boolean(normalizedPaypal.live)),
      }
    case 'maya':
      return { mode: (config as MayaConfig).mode === 'live' ? 'live' : 'sandbox' }
    case 'smtp':
      return {
        host: (config as SmtpConfig).host,
        fromEmail: (config as SmtpConfig).fromEmail,
      }
    case 'resend':
      return {
        fromEmail: (config as ResendConfig).fromEmail ?? '',
        fromName: (config as ResendConfig).fromName ?? '',
      }
    case 'recaptcha':
      return { siteKey: (config as RecaptchaConfig).siteKey }
    default:
      return undefined
  }
}

function inferXenditEnvironment(secretKey?: string): 'sandbox' | 'live' {
  return secretKey?.toLowerCase().includes('production') ? 'live' : 'sandbox'
}

export function normalizeXenditConfig(config: XenditConfig): XenditConfig {
  const mode = config.mode === 'live' ? 'live' : inferXenditEnvironment(config.secretKey)
  const legacyActive: XenditEnvironmentCredentials = {
    secretKey: config.secretKey,
    publicKey: config.publicKey,
    webhookToken: config.webhookToken,
  }
  const sandbox = config.sandbox ?? (mode === 'sandbox' ? legacyActive : undefined)
  const live = config.live ?? (mode === 'live' ? legacyActive : undefined)
  const active = (mode === 'live' ? live : sandbox) ?? legacyActive
  return { ...config, ...active, mode, sandbox, live }
}

export function normalizePaypalConfig(config: PayPalConfig): PayPalConfig {
  const mode = config.mode === 'live' ? 'live' : 'sandbox'
  const legacyActive: PayPalEnvironmentCredentials = {
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  }
  const sandbox = config.sandbox ?? (mode === 'sandbox' ? legacyActive : undefined)
  const live = config.live ?? (mode === 'live' ? legacyActive : undefined)
  const active = (mode === 'live' ? live : sandbox) ?? legacyActive
  return { ...config, ...active, mode, sandbox, live }
}

export function xenditCredentialsForEnvironment(
  config: XenditConfig,
  environment: 'sandbox' | 'live' = config.mode,
) {
  return normalizeXenditConfig(config)[environment] ?? null
}

export function paypalCredentialsForEnvironment(
  config: PayPalConfig,
  environment: 'sandbox' | 'live' = config.mode,
) {
  return normalizePaypalConfig(config)[environment] ?? null
}

/** Get the configuration status for all integrations for a profile. */
export async function getAllIntegrationStatuses(profileId: number): Promise<IntegrationStatus[]> {
  const rows = await db
    .select()
    .from(integrations)
    .where(eq(integrations.profileId, profileId))

  const allProviders: ProviderSlug[] = [
    'xendit', 'paypal', 'stripe', 'paymongo', 'maya',
    'smtp', 'resend',
    'google-sheets',
    'gemini',
    'google-calendar', 'calendly',
    'imagekit', 'cloudinary',
    'recaptcha',
  ]

  return allProviders.map((provider) => {
    const row = rows.find((r) => r.provider === provider)
    const config = row?.config ? decryptJson<IntegrationConfig>(row.config) : null
    return {
      provider,
      configured: !!row?.config,
      meta: {
        ...integrationMeta(provider, config),
        ...(provider === 'xendit' && row?.webhookEndpointKey
          ? { webhookPath: `/api/webhooks/xendit/${row.webhookEndpointKey}` }
          : {}),
      },
    }
  })
}

/** Get the decrypted config for a single integration. */
export async function getIntegrationConfig<T extends IntegrationConfig>(
  profileId: number,
  provider: ProviderSlug,
): Promise<T | null> {
  const [row] = await db
    .select()
    .from(integrations)
    .where(and(
      eq(integrations.profileId, profileId),
      eq(integrations.provider, provider),
    ))
    .limit(1)
  if (!row?.config) return null
  const config = decryptJson<T>(row.config)
  if (provider === 'xendit') return normalizeXenditConfig(config as XenditConfig) as T
  if (provider === 'paypal') return normalizePaypalConfig(config as PayPalConfig) as T
  return config
}

export async function getIntegrationByWebhookEndpoint<T extends IntegrationConfig>(
  endpointKey: string,
): Promise<{ profileId: number; config: T } | null> {
  const [row] = await db
    .select({ profileId: integrations.profileId, config: integrations.config })
    .from(integrations)
    .where(eq(integrations.webhookEndpointKey, endpointKey))
    .limit(1)
  if (!row?.config) return null
  return { profileId: row.profileId, config: decryptJson<T>(row.config) }
}

/** Save (upsert) an integration config. Encrypts before storing. */
export async function saveIntegrationConfig(
  profileId: number,
  provider: ProviderSlug,
  config: IntegrationConfig,
  webhookEndpointKey?: string,
): Promise<void> {
  const encrypted = encryptJson(config)
  await db
    .insert(integrations)
    .values({ profileId, provider, config: encrypted, webhookEndpointKey })
    .onConflictDoUpdate({
      target: [integrations.profileId, integrations.provider],
      set: {
        config: encrypted,
        ...(webhookEndpointKey ? { webhookEndpointKey } : {}),
        updatedAt: new Date(),
      },
    })
}

/** Remove an integration (delete its config row). */
export async function removeIntegrationConfig(
  profileId: number,
  provider: ProviderSlug,
): Promise<void> {
  await db
    .delete(integrations)
    .where(and(
      eq(integrations.profileId, profileId),
      eq(integrations.provider, provider),
    ))
}
