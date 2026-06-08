/**
 * Decrypted shapes of the per-user integration credentials stored (encrypted)
 * in the `integration_settings` table. These are the FULL secret-bearing
 * shapes — they only ever exist server-side after decryption. The client
 * receives the masked/summary views below instead.
 */

export interface XenditConfig {
  secretKey: string
  publicKey?: string
  webhookToken?: string
}

export interface PayPalConfig {
  clientId: string
  clientSecret: string
  mode: 'sandbox' | 'live'
}

export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  fromEmail: string
  fromName?: string
}

/** Everything a user can configure. */
export interface IntegrationConfigs {
  xendit: XenditConfig | null
  paypal: PayPalConfig | null
  smtp: SmtpConfig | null
}

/**
 * Safe-to-expose summaries returned to the client. Secrets are replaced with a
 * boolean "configured" flag and/or a mask; non-secret metadata (mode, host,
 * from address…) is shown so the user can recognise their settings.
 */
export interface IntegrationSettingsView {
  xendit: {
    configured: boolean
    secretKeyMask: string | null
    publicKey: string | null
    hasWebhookToken: boolean
  }
  paypal: {
    configured: boolean
    clientId: string | null
    clientSecretMask: string | null
    mode: 'sandbox' | 'live'
  }
  smtp: {
    configured: boolean
    host: string | null
    port: number | null
    secure: boolean
    user: string | null
    passwordSet: boolean
    fromEmail: string | null
    fromName: string | null
  }
}
