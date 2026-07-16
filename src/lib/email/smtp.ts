import nodemailer from 'nodemailer'
import type { SmtpConfig } from '../integrations/types'

export async function sendSmtpEmail(input: {
  config: SmtpConfig
  recipient: string
  subject: string
  html: string
  text: string
  fromName?: string | null
}) {
  const transport = nodemailer.createTransport({
    host: input.config.host,
    port: input.config.port,
    secure: input.config.secure,
    auth: { user: input.config.user, pass: input.config.password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 12_000,
  })
  const fromName = input.fromName?.trim() || input.config.fromName?.trim() || 'PonkoForm'
  const result = await transport.sendMail({
    from: { name: fromName, address: input.config.fromEmail },
    to: input.recipient,
    subject: input.subject,
    html: input.html,
    text: input.text,
  })
  return { messageId: result.messageId }
}

