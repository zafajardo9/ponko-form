import type { ProviderSlug } from '../../lib/integrations/types'

export type ProviderCategory = 'payments' | 'email' | 'data-export' | 'ai' | 'scheduling' | 'file-storage'

export interface ProviderFormField {
  name: string
  label: string
  type: 'password' | 'text' | 'select' | 'email' | 'url'
  placeholder?: string
  required?: boolean
  docLink?: string
}

export interface ProviderFormConfig {
  provider: ProviderSlug
  name: string
  icon: string
  description: string
  category: ProviderCategory
  fields: ProviderFormField[]
  docsUrl?: string
  planned?: boolean
}

export const PROVIDER_FORMS: Record<ProviderSlug, ProviderFormConfig> = {
  // ── Payments ──
  xendit: {
    provider: 'xendit',
    name: 'Xendit',
    icon: '💳',
    description: 'Accept payments through your own Xendit account (PH-focused).',
    category: 'payments',
    fields: [
      { name: 'secretKey', label: 'Secret API key', type: 'password', required: true, placeholder: 'xnd_production_...', docLink: 'https://dashboard.xendit.co/settings/api-keys' },
      { name: 'publicKey', label: 'Public API key', type: 'text', placeholder: 'xnd_public_production_...' },
      { name: 'webhookToken', label: 'Webhook verification token', type: 'password', placeholder: 'Optional' },
    ],
    docsUrl: 'https://docs.xendit.co/',
  },
  paypal: {
    provider: 'paypal',
    name: 'PayPal',
    icon: '💳',
    description: 'Accept payments through your own PayPal business account.',
    category: 'payments',
    fields: [
      { name: 'clientId', label: 'Client ID', type: 'text', required: true, placeholder: 'AYSq3RDGsmBLJE...', docLink: 'https://developer.paypal.com/dashboard/applications' },
      { name: 'clientSecret', label: 'Client secret', type: 'password', required: true, placeholder: 'EGnHDxD_qRPdaLd...' },
      { name: 'mode', label: 'Environment', type: 'select', required: true, placeholder: 'sandbox' },
    ],
    docsUrl: 'https://developer.paypal.com/docs/api/',
  },
  stripe: {
    provider: 'stripe',
    name: 'Stripe',
    icon: '💳',
    description: 'Accept payments from 135+ currencies worldwide.',
    category: 'payments',
    fields: [
      { name: 'secretKey', label: 'Secret key', type: 'password', required: true, placeholder: 'sk_live_...', docLink: 'https://dashboard.stripe.com/apikeys' },
      { name: 'publishableKey', label: 'Publishable key', type: 'text', required: true, placeholder: 'pk_live_...' },
      { name: 'webhookSecret', label: 'Webhook signing secret', type: 'password', placeholder: 'whsec_...' },
    ],
    docsUrl: 'https://stripe.com/docs/keys',
  },
  paymongo: {
    provider: 'paymongo',
    name: 'PayMongo',
    icon: '💳',
    description: 'PH all-in-one: card, GCash, GrabPay, Maya via single API.',
    category: 'payments',
    fields: [
      { name: 'secretKey', label: 'Secret key', type: 'password', required: true, placeholder: 'sk_test_... / sk_live_...', docLink: 'https://dashboard.paymongo.com/developers' },
      { name: 'publicKey', label: 'Public key', type: 'text', required: true, placeholder: 'pk_test_... / pk_live_...' },
    ],
    docsUrl: 'https://developers.paymongo.com/',
  },
  maya: {
    provider: 'maya',
    name: 'Maya',
    icon: '💳',
    description: 'Maya Checkout API — direct integration with Maya payments.',
    category: 'payments',
    fields: [
      { name: 'clientId', label: 'Client ID', type: 'text', required: true, placeholder: 'your-client-id', docLink: 'https://developers.maya.ph/' },
      { name: 'clientSecret', label: 'Client secret', type: 'password', required: true, placeholder: 'your-client-secret' },
    ],
    docsUrl: 'https://developers.maya.ph/',
  },

  // ── Email ──
  smtp: {
    provider: 'smtp',
    name: 'SMTP / Email',
    icon: '📬',
    description: 'Send form notifications and receipts from your own mail server.',
    category: 'email',
    fields: [
      { name: 'host', label: 'SMTP host', type: 'text', required: true, placeholder: 'smtp.gmail.com' },
      { name: 'port', label: 'Port', type: 'text', required: true, placeholder: '587' },
      { name: 'user', label: 'Username', type: 'text', required: true, placeholder: 'you@example.com' },
      { name: 'password', label: 'Password', type: 'password', required: true, placeholder: 'App password or SMTP password' },
      { name: 'fromEmail', label: 'From email', type: 'email', required: true, placeholder: 'noreply@example.com' },
      { name: 'fromName', label: 'From name', type: 'text', placeholder: 'Your Company' },
      { name: 'secure', label: 'Use TLS/SSL', type: 'select', placeholder: 'false' },
    ],
    docsUrl: 'https://www.google.com/search?q=smtp+settings',
  },
  resend: {
    provider: 'resend',
    name: 'Resend',
    icon: '📬',
    description: 'Modern email API. Free tier: 100 emails/day.',
    category: 'email',
    fields: [
      { name: 'apiKey', label: 'API key', type: 'password', required: true, placeholder: 're_...', docLink: 'https://resend.com/api-keys' },
    ],
    docsUrl: 'https://resend.com/docs',
  },

  // ── Data Export ──
  'google-sheets': {
    provider: 'google-sheets',
    name: 'Google Sheets',
    icon: '📊',
    description: 'Auto-sync every form submission as a new row in your sheet. Create your own Google Cloud project OAuth credentials, then connect below.',
    category: 'data-export',
    fields: [
      { name: 'clientId', label: 'Google Client ID', type: 'text', required: true, placeholder: '123456.apps.googleusercontent.com', docLink: 'https://console.cloud.google.com/apis/credentials' },
      { name: 'clientSecret', label: 'Client Secret', type: 'password', required: true, placeholder: 'GOCSPX-...' },
      { name: 'redirectUri', label: 'Redirect URI', type: 'text', required: true, placeholder: 'http://localhost:3000/integrations/google/callback' },
      { name: 'spreadsheetId', label: 'Spreadsheet ID', type: 'text', required: true, placeholder: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE', docLink: 'https://developers.google.com/sheets/api/guides/concepts#spreadsheet_id' },
    ],
    docsUrl: 'https://developers.google.com/sheets/api',
  },

  // ── AI ──
  gemini: {
    provider: 'gemini',
    name: 'Google Gemini',
    icon: '🧠',
    description: 'AI-powered auto-fill, smart suggestions, and field generation.',
    category: 'ai',
    fields: [
      { name: 'apiKey', label: 'Gemini API key', type: 'password', required: true, placeholder: 'AIzaSy...', docLink: 'https://aistudio.google.com/apikey' },
    ],
    docsUrl: 'https://ai.google.dev/',
  },

  // ── Scheduling ──
  'google-calendar': {
    provider: 'google-calendar',
    name: 'Google Calendar',
    icon: '📅',
    description: 'Create calendar events automatically on form submission.',
    category: 'scheduling',
    fields: [
      { name: 'calendarId', label: 'Calendar ID', type: 'text', required: true, placeholder: 'primary or your-calendar-id@group.calendar.google.com' },
    ],
    docsUrl: 'https://developers.google.com/calendar/api',
  },
  calendly: {
    provider: 'calendly',
    name: 'Calendly',
    icon: '📅',
    description: 'Embed booking links in your flow steps.',
    category: 'scheduling',
    fields: [
      { name: 'apiToken', label: 'Personal access token', type: 'password', required: true, placeholder: 'your-calendly-token', docLink: 'https://calendly.com/integrations/api' },
      { name: 'organizationUrl', label: 'Organization URL', type: 'url', required: true, placeholder: 'https://calendly.com/your-org' },
    ],
    docsUrl: 'https://developer.calendly.com/',
  },

  // ── File Storage ──
  imagekit: {
    provider: 'imagekit',
    name: 'ImageKit',
    icon: '☁️',
    description: 'Image upload with on-the-fly transforms and optimization.',
    category: 'file-storage',
    fields: [
      { name: 'publicKey', label: 'Public key', type: 'text', required: true, placeholder: 'public_...', docLink: 'https://imagekit.io/dashboard/developer/api-keys' },
      { name: 'privateKey', label: 'Private key', type: 'password', required: true, placeholder: 'private_...' },
      { name: 'urlEndpoint', label: 'URL endpoint', type: 'url', required: true, placeholder: 'https://ik.imagekit.io/your-id' },
    ],
    docsUrl: 'https://docs.imagekit.io/',
  },
  cloudinary: {
    provider: 'cloudinary',
    name: 'Cloudinary',
    icon: '☁️',
    description: 'Image and video upload with cloud transforms.',
    category: 'file-storage',
    fields: [
      { name: 'cloudName', label: 'Cloud name', type: 'text', required: true, placeholder: 'your-cloud-name', docLink: 'https://cloudinary.com/console' },
      { name: 'apiKey', label: 'API key', type: 'text', required: true, placeholder: '123456789012345' },
      { name: 'apiSecret', label: 'API secret', type: 'password', required: true, placeholder: 'abc123...' },
    ],
    docsUrl: 'https://cloudinary.com/documentation',
  },
}

export const CATEGORIES: { key: ProviderCategory; label: string; icon: string }[] = [
  { key: 'payments', label: 'Payments', icon: '💳' },
  { key: 'email', label: 'Email', icon: '📬' },
  { key: 'data-export', label: 'Data Export', icon: '📊' },
  { key: 'ai', label: 'AI', icon: '🧠' },
  { key: 'scheduling', label: 'Scheduling', icon: '📅' },
  { key: 'file-storage', label: 'File Storage', icon: '☁️' },
]
