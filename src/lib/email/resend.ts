import type { ResendConfig } from '../integrations/types'

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
  if (!input.config.fromEmail) throw new Error('Resend verified sender email is not configured')
  const senderName = input.config.fromName?.trim() || 'Payments'
  const expiration = input.expiresAt
    ? `<p>This payment link expires on ${escapeHtml(input.expiresAt.toLocaleString())}.</p>`
    : ''
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${senderName} <${input.config.fromEmail}>`,
      to: [input.recipient],
      subject: `Payment requested for ${input.formTitle}`,
      html: `<p>Hello,</p><p>Your response for <strong>${escapeHtml(input.formTitle)}</strong> is awaiting payment of <strong>${escapeHtml(input.amount)}</strong>.</p><p><a href="${escapeHtml(input.paymentUrl)}">Complete your payment securely</a></p>${expiration}<p>If you already paid, you may ignore this message.</p>`,
      text: `Your response for ${input.formTitle} is awaiting payment of ${input.amount}. Complete payment: ${input.paymentUrl}`,
    }),
  })
  const result = await response.json().catch(() => ({})) as { id?: string; message?: string }
  if (!response.ok || !result.id) throw new Error(result.message ?? `Resend delivery failed (${response.status})`)
  return { messageId: result.id }
}
