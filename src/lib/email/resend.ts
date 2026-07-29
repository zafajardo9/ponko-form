import type { ResendConfig } from '../integrations/types'

export async function sendResendEmail(input: {
  config: ResendConfig
  recipient: string
  subject: string
  html: string
  text: string
  fromName?: string | null
  cc?: string[]
  idempotencyKey?: string
}) {
  if (!input.config.fromEmail) throw new Error('Resend verified sender email is not configured')
  const senderName = input.fromName?.trim() || input.config.fromName?.trim() || 'PonkoForm'
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.config.apiKey}`,
      'Content-Type': 'application/json',
      ...(input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: `${senderName} <${input.config.fromEmail}>`,
      to: [input.recipient],
      ...(input.cc?.length ? { cc: input.cc } : {}),
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
    signal: AbortSignal.timeout(12_000),
  })
  const result = await response.json().catch(() => ({})) as { id?: string; message?: string }
  if (!response.ok || !result.id) throw new Error(result.message ?? `Resend delivery failed (${response.status})`)
  return { messageId: result.id }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] ?? character)
}

export async function sendPaymentReminderEmail(input: {
  config: ResendConfig
  recipient: string
  formTitle: string
  amount: string
  paymentUrl: string
  expiresAt?: Date | null
}) {
  const message = paymentReminderMessage(input)
  return sendResendEmail({
    config: input.config,
    ...message,
  })
}

export function paymentReminderMessage(input: {
  recipient: string
  formTitle: string
  amount: string
  paymentUrl: string
  expiresAt?: Date | null
}) {
  const expiration = input.expiresAt
    ? `<p>This payment link expires on ${escapeHtml(input.expiresAt.toLocaleString())}.</p>`
    : ''
  return {
    recipient: input.recipient,
    fromName: 'Payments',
    subject: `Payment requested for ${input.formTitle}`,
    html: `<p>Hello,</p><p>Your response for <strong>${escapeHtml(input.formTitle)}</strong> is awaiting payment of <strong>${escapeHtml(input.amount)}</strong>.</p><p><a href="${escapeHtml(input.paymentUrl)}">Complete your payment securely</a></p>${expiration}<p>If you already paid, you may ignore this message.</p>`,
    text: `Your response for ${input.formTitle} is awaiting payment of ${input.amount}. Complete payment: ${input.paymentUrl}`,
  }
}
