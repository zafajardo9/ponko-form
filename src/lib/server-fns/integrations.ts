import { createServerFn } from '@tanstack/react-start'
import { encryptJson } from '../crypto'
import type {
  IntegrationSettingsView,
  PayPalConfig,
  SmtpConfig,
  XenditConfig,
} from '../integrations/types'
import {
  loadIntegrationConfigs,
  requireProfile,
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
  .inputValidator(
    (data: { secretKey?: string; publicKey?: string; webhookToken?: string }) =>
      data,
  )
  .handler(async ({ data }) => {
    const profile = await requireProfile()
    const existing = (await loadIntegrationConfigs(profile.id)).xendit

    const secretKey = data.secretKey?.trim() || existing?.secretKey
    if (!secretKey) throw new Error('Xendit secret key is required')

    const config: XenditConfig = {
      secretKey,
      publicKey: data.publicKey?.trim() || existing?.publicKey || undefined,
      webhookToken: data.webhookToken?.trim() || existing?.webhookToken || undefined,
    }
    await upsertIntegrationConfig(profile.id, { xenditConfig: encryptJson(config) })
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
    await upsertIntegrationConfig(profile.id, { paypalConfig: encryptJson(config) })
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
    await upsertIntegrationConfig(profile.id, { smtpConfig: encryptJson(config) })
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
    await upsertIntegrationConfig(profile.id, column)
    return { success: true }
  })
