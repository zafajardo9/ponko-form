import { createServerFn } from '@tanstack/react-start'
import { encryptJson } from '../crypto'
import type {
  IntegrationConfig,
  IntegrationSettingsView,
  IntegrationStatus,
  MayaConfig,
  PayPalConfig,
  ProviderSlug,
  ResendConfig,
  RecaptchaConfig,
  SmtpConfig,
  XenditConfig,
} from '../integrations/types'

function paymentMode(value: unknown): 'sandbox' | 'live' {
  return value === 'live' ? 'live' : 'sandbox'
}

function validateXenditKeyMode(secretKey: string, mode: 'sandbox' | 'live') {
  const normalized = secretKey.toLowerCase()
  const detected = normalized.includes('production')
    ? 'live'
    : normalized.includes('development') || normalized.includes('test')
      ? 'sandbox'
      : null
  if (detected && detected !== mode) {
    throw new Error(
      mode === 'live'
        ? 'The selected Live environment requires a Xendit production key'
        : 'The selected Test environment requires a Xendit development key',
    )
  }
}

async function verifyXenditCredentials(secretKey: string) {
  const response = await fetch('https://api.xendit.co/balance', {
    headers: { Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}` },
    signal: AbortSignal.timeout(8_000),
  })
  if (response.status === 401) throw new Error('Xendit rejected this API key. Check the selected environment and key.')
  if (!response.ok && response.status !== 403) throw new Error('Xendit could not verify these credentials. Please try again.')
}

async function verifyPaypalCredentials(clientId: string, clientSecret: string, mode: 'sandbox' | 'live') {
  const baseUrl = mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(8_000),
  })
  if (!response.ok) {
    throw new Error(`PayPal rejected these ${mode} credentials. Check the Client ID, secret, and environment.`)
  }
}
import {
  getAllIntegrationStatuses,
  getIntegrationConfig,
  loadIntegrationConfigs,
  removeIntegrationConfig,
  requireProfile,
  saveIntegrationConfig,
  toIntegrationView,
  upsertIntegrationConfig,
} from '../integrations/credentials'

// All DB/crypto access lives in `../integrations/credentials` (server-only).
// These functions only reference it inside `.handler()` bodies, which the
// TanStack Start compiler strips from the client bundle — keeping the Postgres
// driver (and `Buffer`) out of the browser.

// ── Server functions (client-callable) ──

/**
 * Returns the masked/summary view of the current user's integration settings.
 * Never returns raw secrets.
 */
export const getIntegrationSettings = createServerFn({ method: 'GET' }).handler(
  async (): Promise<IntegrationSettingsView> => {
    const profile = await requireProfile()
    const configs = await loadIntegrationConfigs(profile.id)
    return toIntegrationView(configs)
  },
)

/**
 * Saves Xendit credentials. Leave `secretKey` blank to keep the existing one
 * (lets the user update only the webhook token without re-entering the key).
 */
export const saveXenditSettings = createServerFn({ method: 'POST' })
  .validator(
    (data: { secretKey?: string; publicKey?: string; webhookToken?: string; mode?: 'sandbox' | 'live' }) =>
      data,
  )
  .handler(async ({ data }) => {
    const profile = await requireProfile()
    const existing = (await loadIntegrationConfigs(profile.id)).xendit
    const mode = paymentMode(data.mode ?? existing?.mode)
    const savedForMode = existing?.[mode]
    const secretKey = data.secretKey?.trim() || savedForMode?.secretKey
    if (!secretKey) throw new Error(`Xendit ${mode} secret key is required`)
    validateXenditKeyMode(secretKey, mode)
    await verifyXenditCredentials(secretKey)
    const active = {
      secretKey,
      publicKey: data.publicKey?.trim() || savedForMode?.publicKey || undefined,
      webhookToken: data.webhookToken?.trim() || savedForMode?.webhookToken || undefined,
    }
    const config: XenditConfig = {
      ...active,
      mode,
      sandbox: mode === 'sandbox' ? active : existing?.sandbox,
      live: mode === 'live' ? active : existing?.live,
    }
    await upsertIntegrationConfig(profile.id, { xenditConfig: encryptJson(config) })
    return { success: true }
  })

/**
 * Saves PayPal credentials. Leave `clientSecret` blank to keep the existing one.
 */
export const savePaypalSettings = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      clientId: string
      clientSecret?: string
      mode: 'sandbox' | 'live'
    }) => data,
  )
  .handler(async ({ data }) => {
    const profile = await requireProfile()
    const existing = (await loadIntegrationConfigs(profile.id)).paypal

    const mode = paymentMode(data.mode)
    const savedForMode = existing?.[mode]
    const clientId = data.clientId.trim() || savedForMode?.clientId
    const clientSecret = data.clientSecret?.trim() || savedForMode?.clientSecret
    if (!clientId) throw new Error(`PayPal ${mode} client ID is required`)
    if (!clientSecret) throw new Error(`PayPal ${mode} client secret is required`)
    await verifyPaypalCredentials(clientId, clientSecret, mode)
    const active = { clientId, clientSecret }
    const config: PayPalConfig = {
      ...active,
      mode,
      sandbox: mode === 'sandbox' ? active : existing?.sandbox,
      live: mode === 'live' ? active : existing?.live,
    }
    await upsertIntegrationConfig(profile.id, { paypalConfig: encryptJson(config) })
    return { success: true }
  })

/**
 * Saves SMTP credentials. Leave `password` blank to keep the existing one.
 */
export const saveSmtpSettings = createServerFn({ method: 'POST' })
  .validator(
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
    await upsertIntegrationConfig(profile.id, { smtpConfig: encryptJson(config) })
    return { success: true }
  })

/** Clears a single integration's credentials. */
export const deleteIntegration = createServerFn({ method: 'POST' })
  .validator((data: { provider: 'xendit' | 'paypal' | 'smtp' }) => data)
  .handler(async ({ data }) => {
    const profile = await requireProfile()
    const column =
      data.provider === 'xendit'
        ? { xenditConfig: null }
        : data.provider === 'paypal'
          ? { paypalConfig: null }
          : { smtpConfig: null }
    await upsertIntegrationConfig(profile.id, column)
    return { success: true }
  })

// ── Generic integration endpoints (new integrations table, FT-002) ──

/** Get the configuration status for all providers. */
export const getIntegrations = createServerFn({ method: 'GET' }).handler(
  async (): Promise<IntegrationStatus[]> => {
    const profile = await requireProfile()
    let statuses = await getAllIntegrationStatuses(profile.id)
    const xendit = statuses.find((item) => item.provider === 'xendit')
    if (xendit?.configured && !xendit.meta?.webhookPath) {
      const config = await getIntegrationConfig<XenditConfig>(profile.id, 'xendit')
      if (config) {
        await saveIntegrationConfig(profile.id, 'xendit', config, crypto.randomUUID().replaceAll('-', ''))
        statuses = await getAllIntegrationStatuses(profile.id)
      }
    }
    const maya = statuses.find((item) => item.provider === 'maya')
    if (maya?.configured && !maya.meta?.webhookPath) {
      const config = await getIntegrationConfig<MayaConfig>(profile.id, 'maya')
      if (config) {
        await saveIntegrationConfig(profile.id, 'maya', config, crypto.randomUUID().replaceAll('-', ''))
        statuses = await getAllIntegrationStatuses(profile.id)
      }
    }
    return statuses
  },
)

/** Save (upsert) a single integration's config. */
export const saveIntegration = createServerFn({ method: 'POST' })
  .validator(
    (data: { provider: ProviderSlug; config: Record<string, unknown> }) =>
      data,
  )
  .handler(async ({ data }) => {
    const profile = await requireProfile()
    if (data.provider === 'xendit') {
      const existing = await getIntegrationConfig<XenditConfig>(profile.id, 'xendit')
      const input = data.config as Partial<XenditConfig>
      const mode = paymentMode(input.mode ?? existing?.mode)
      const savedForMode = existing?.[mode]
      const secretKey = String(input.secretKey ?? '').trim() || savedForMode?.secretKey
      if (!secretKey) throw new Error(`Xendit ${mode} secret API key is required`)
      validateXenditKeyMode(secretKey, mode)
      await verifyXenditCredentials(secretKey)
      const webhookToken = String(input.webhookToken ?? '').trim() || savedForMode?.webhookToken
      if (!webhookToken) throw new Error(`Xendit ${mode} webhook verification token is required`)
      const active = {
        secretKey,
        publicKey: String(input.publicKey ?? '').trim() || savedForMode?.publicKey,
        webhookToken,
      }
      const config: XenditConfig = {
        ...active,
        mode,
        sandbox: mode === 'sandbox' ? active : existing?.sandbox,
        live: mode === 'live' ? active : existing?.live,
      }
      const statuses = await getAllIntegrationStatuses(profile.id)
      const existingPath = statuses.find((item) => item.provider === 'xendit')?.meta?.webhookPath
      const endpointKey = existingPath?.split('/').pop() ?? crypto.randomUUID().replaceAll('-', '')
      await saveIntegrationConfig(profile.id, 'xendit', config, endpointKey)
    } else if (data.provider === 'paypal') {
      const existing = await getIntegrationConfig<PayPalConfig>(profile.id, 'paypal')
      const input = data.config as Partial<PayPalConfig>
      const mode = paymentMode(input.mode ?? existing?.mode)
      const savedForMode = existing?.[mode]
      const clientId = String(input.clientId ?? '').trim() || savedForMode?.clientId
      const clientSecret = String(input.clientSecret ?? '').trim() || savedForMode?.clientSecret
      if (!clientId) throw new Error(`PayPal ${mode} client ID is required`)
      if (!clientSecret) throw new Error(`PayPal ${mode} client secret is required`)
      await verifyPaypalCredentials(clientId, clientSecret, mode)
      const active = { clientId, clientSecret }
      await saveIntegrationConfig(profile.id, 'paypal', {
        ...active,
        mode,
        sandbox: mode === 'sandbox' ? active : existing?.sandbox,
        live: mode === 'live' ? active : existing?.live,
      })
    } else if (data.provider === 'resend') {
      const existing = await getIntegrationConfig<ResendConfig>(profile.id, 'resend')
      const input = data.config as Partial<ResendConfig>
      const apiKey = String(input.apiKey ?? '').trim() || existing?.apiKey
      const fromEmail = String(input.fromEmail ?? '').trim() || existing?.fromEmail
      if (!apiKey) throw new Error('Resend API key is required')
      if (!fromEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
        throw new Error('A valid verified Resend sender email is required')
      }
      await saveIntegrationConfig(profile.id, 'resend', {
        apiKey,
        fromEmail,
        fromName: String(input.fromName ?? '').trim() || existing?.fromName,
      })
    } else if (data.provider === 'recaptcha') {
      const existing = await getIntegrationConfig<RecaptchaConfig>(profile.id, 'recaptcha')
      const input = data.config as Partial<RecaptchaConfig>
      const siteKey = String(input.siteKey ?? '').trim() || existing?.siteKey
      const secretKey = String(input.secretKey ?? '').trim() || existing?.secretKey
      if (!siteKey) throw new Error('Google reCAPTCHA site key is required')
      if (!secretKey) throw new Error('Google reCAPTCHA secret key is required')
      if (siteKey.length > 255 || secretKey.length > 255) {
        throw new Error('Google reCAPTCHA credentials are not valid')
      }
      await saveIntegrationConfig(profile.id, 'recaptcha', { siteKey, secretKey })
    } else if (data.provider === 'maya') {
      const existing = await getIntegrationConfig<MayaConfig>(profile.id, 'maya')
      const input = data.config as Partial<MayaConfig>
      const mode = paymentMode(input.mode ?? existing?.mode)
      const publicKey = String(input.publicKey ?? '').trim() || existing?.publicKey
      const secretKey = String(input.secretKey ?? '').trim() || existing?.secretKey
      if (!publicKey) throw new Error('Maya public API key is required')
      if (!publicKey.toLowerCase().startsWith('pk-')) {
        throw new Error('Maya public API key should start with “pk-”')
      }
      const statuses = await getAllIntegrationStatuses(profile.id)
      const existingPath = statuses.find((item) => item.provider === 'maya')?.meta?.webhookPath
      const endpointKey = existingPath?.split('/').pop() ?? crypto.randomUUID().replaceAll('-', '')
      await saveIntegrationConfig(profile.id, 'maya', { publicKey, secretKey, mode }, endpointKey)
    } else {
      await saveIntegrationConfig(profile.id, data.provider, data.config as unknown as IntegrationConfig)
    }
    return { success: true }
  })

/** Delete a single integration's config. */
export const deleteIntegrationByProvider = createServerFn({ method: 'POST' })
  .validator((data: { provider: ProviderSlug }) => data)
  .handler(async ({ data }) => {
    const profile = await requireProfile()
    await removeIntegrationConfig(profile.id, data.provider)
    return { success: true }
  })
