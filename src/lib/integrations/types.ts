/**
 * Decrypted shapes of the per-user integration credentials stored (encrypted)
 * in the `integrations` table. These are the FULL secret-bearing shapes — they
 * only ever exist server-side after decryption. The client receives the
 * masked/summary views below instead.
 */

export type ProviderSlug =
  | 'xendit' | 'paypal' | 'stripe' | 'paymongo' | 'maya'
  | 'smtp' | 'resend'
  | 'google-sheets'
  | 'gemini'
  | 'google-calendar' | 'calendly'
  | 'imagekit' | 'cloudinary'

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

export interface StripeConfig {
  secretKey: string
  publishableKey: string
  webhookSecret?: string
}

export interface PayMongoConfig {
  secretKey: string
  publicKey: string
}

export interface MayaConfig {
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

export interface ResendConfig {
  apiKey: string
  fromEmail?: string
  fromName?: string
}

export interface GoogleSheetsConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  spreadsheetId: string
  accessToken?: string
  refreshToken?: string
  expiryDate?: string
}

export interface GeminiConfig {
  apiKey: string
}

export interface GoogleCalendarConfig {
  accessToken: string
  refreshToken: string
  expiryDate: string
  calendarId?: string
}

export interface CalendlyConfig {
  apiToken: string
  organizationUrl: string
}

export interface ImageKitConfig {
  publicKey: string
  privateKey: string
  urlEndpoint: string
}

export interface CloudinaryConfig {
  cloudName: string
  apiKey: string
  apiSecret: string
}

/** Union of every possible integration config — helps typed destructuring. */
export type IntegrationConfig =
  | XenditConfig
  | PayPalConfig
  | StripeConfig
  | PayMongoConfig
  | MayaConfig
  | SmtpConfig
  | ResendConfig
  | GoogleSheetsConfig
  | GeminiConfig
  | GoogleCalendarConfig
  | CalendlyConfig
  | ImageKitConfig
  | CloudinaryConfig

/** Everything a user can configure (legacy — loaded from integration_settings). */
export interface IntegrationConfigs {
  xendit: XenditConfig | null
  paypal: PayPalConfig | null
  smtp: SmtpConfig | null
}

/** Non-secret metadata shown to the client for each integration. */
export interface IntegrationStatus {
  provider: ProviderSlug
  configured: boolean
  /** Non-secret metadata for display (e.g. mode, host, fromEmail). */
  meta?: Record<string, string>
}

/**
 * Safe-to-expose summaries returned to the client from the legacy
 * integration_settings table. Secrets are replaced with a boolean
 * "configured" flag and/or a mask.
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
