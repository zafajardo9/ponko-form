import { appConfig } from '../../utils/app-config'
import { getAuthBaseUrl } from '../auth-env'
import type { ResendConfig } from '../integrations/types'
import { sendResendEmail } from './resend'

/**
 * SYSTEM-LEVEL Resend client.
 *
 * The platform sends its own transactional email (password resets, account
 * notices) through Resend using credentials from env vars. This is deliberately
 * separate from the per-user `resend` integration, which is stored encrypted in
 * the DB and used only for a form owner's own respondent email. The system
 * client is never used as a fallback when a user has not configured email.
 */

export function getSystemEmailConfig(
  env: NodeJS.ProcessEnv = process.env,
): ResendConfig | null {
  const apiKey = env.RESEND_API_KEY
  const fromEmail = env.RESEND_FROM_EMAIL
  if (!apiKey || !fromEmail) return null
  return { apiKey, fromEmail, fromName: env.RESEND_FROM_NAME || undefined }
}

export function isSystemEmailConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return getSystemEmailConfig(env) !== null
}

export async function sendSystemEmail(input: {
  recipient: string
  subject: string
  html: string
  text: string
  fromName?: string | null
  cc?: string[]
  idempotencyKey?: string
}) {
  const config = getSystemEmailConfig()
  if (!config) {
    throw new Error(
      'System email is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL to enable platform emails.',
    )
  }
  return sendResendEmail({ config, ...input })
}

/**
 * Best-effort system email for auth/notification side effects. Auth flows must
 * never fail because a notification email could not be delivered, so errors are
 * logged and swallowed.
 */
export async function sendSystemEmailSafely(input: {
  recipient: string
  subject: string
  html: string
  text: string
  fromName?: string | null
  cc?: string[]
  idempotencyKey?: string
}) {
  try {
    await sendSystemEmail(input)
  } catch (error) {
    console.error('[system-email]', error instanceof Error ? error.message : String(error))
  }
}

export function systemWelcomeMessage(input: {
  user: { name?: string | null; email: string }
  workspaceUrl?: string
}) {
  const greeting = input.user.name?.trim()
    ? `Hello ${escapeHtml(input.user.name.trim())},`
    : 'Hello,'
  const workspaceUrl = (input.workspaceUrl ?? getAuthBaseUrl()).replace(/\/$/, '')
  return {
    recipient: input.user.email,
    subject: `Welcome to ${appConfig.name}!`,
    html: [
      `<p>${greeting}</p>`,
      `<p>Your <strong>${escapeHtml(appConfig.name)}</strong> account is ready to use. You can now create forms, build flows, and collect payments.</p>`,
      `<p><a href="${escapeHtml(workspaceUrl)}/forms">Open your workspace</a></p>`,
      `<p>If you have any questions, just reply to this email — we are happy to help.</p>`,
      `<p>— The ${escapeHtml(appConfig.name)} team</p>`,
    ].join(''),
    text: `Welcome to ${appConfig.name}! Your account is ready to use. Open your workspace: ${workspaceUrl}/forms`,
  }
}

export function systemSignInAlertMessage(input: {
  user: { name?: string | null; email: string }
  ip?: string | null
  userAgent?: string | null
  workspaceUrl?: string
}) {
  const greeting = input.user.name?.trim()
    ? `Hello ${escapeHtml(input.user.name.trim())},`
    : 'Hello,'
  const workspaceUrl = (input.workspaceUrl ?? getAuthBaseUrl()).replace(/\/$/, '')
  const detailLines = [
    input.ip ? `IP address: ${input.ip}` : null,
    input.userAgent ? `Browser: ${input.userAgent}` : null,
    `Time: ${new Date().toLocaleString()}`,
  ].filter((line): line is string => Boolean(line))
  return {
    recipient: input.user.email,
    subject: `New sign-in to your ${appConfig.name} account`,
    html: [
      `<p>${greeting}</p>`,
      `<p>We noticed a new sign-in to your <strong>${escapeHtml(appConfig.name)}</strong> account.</p>`,
      `<ul>${detailLines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`,
      `<p>If this was you, you can ignore this email. If you do not recognize this sign-in, <a href="${escapeHtml(workspaceUrl)}/sign-in">sign in and change your password</a> right away.</p>`,
    ].join(''),
    text: [
      `We noticed a new sign-in to your ${appConfig.name} account.`,
      ...detailLines.map((line) => `- ${line}`),
      `If this was not you, sign in and change your password immediately: ${workspaceUrl}/sign-in`,
    ].join('\n'),
  }
}

export function systemPasswordResetMessage(input: {
  user: { name?: string | null; email: string }
  url: string
}) {
  const greeting = input.user.name?.trim()
    ? `Hello ${escapeHtml(input.user.name.trim())},`
    : 'Hello,'
  return {
    recipient: input.user.email,
    subject: `Reset your ${appConfig.name} password`,
    html: `<p>${greeting}</p><p>We received a request to reset the password for your ${escapeHtml(appConfig.name)} account. Click the link below to choose a new password:</p><p><a href="${escapeHtml(input.url)}">Reset your password</a></p><p>If you did not request this, you can safely ignore this email. The link expires after 1 hour.</p>`,
    text: `Reset your ${appConfig.name} password: ${input.url}`,
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] ?? character)
}
