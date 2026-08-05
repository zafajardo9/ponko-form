import nodemailer from 'nodemailer'
import type { SmtpConfig } from '../integrations/types'
import { appConfig } from '../../utils/app-config'

export function smtpTransportSecurity(config: Pick<SmtpConfig, 'port' | 'secure'>) {
  if (config.port === 465) {
    return { secure: true, requireTLS: false }
  }
  if (config.port === 587) {
    return { secure: false, requireTLS: true }
  }
  return { secure: config.secure, requireTLS: false }
}

export function smtpDeliveryError(error: unknown): Error {
  const original = error instanceof Error ? error : new Error(String(error))
  const detail = original.message.toLowerCase()

  if (detail.includes('unauthorized ip address')) {
    return new Error(
      'Brevo blocked this server IP. Allow it in Brevo SMTP & API authorized IPs, then try again.',
      { cause: original },
    )
  }
  if (
    detail.includes('wrong version number') ||
    detail.includes('tls_validate_record_header')
  ) {
    return new Error(
      'The SMTP port and TLS mode do not match. Use STARTTLS for port 587 or SSL for port 465.',
      { cause: original },
    )
  }

  return original
}

export async function sendSmtpEmail(input: {
  config: SmtpConfig
  recipient: string
  subject: string
  html: string
  text: string
  fromName?: string | null
  cc?: string[]
}) {
  const security = smtpTransportSecurity(input.config)
  const transport = nodemailer.createTransport({
    host: input.config.host,
    port: input.config.port,
    ...security,
    auth: { user: input.config.user, pass: input.config.password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 12_000,
  })
  const fromName = input.fromName?.trim() || input.config.fromName?.trim() || appConfig.name
  try {
    const result = await transport.sendMail({
      from: { name: fromName, address: input.config.fromEmail },
      to: input.recipient,
      ...(input.cc?.length ? { cc: input.cc } : {}),
      subject: input.subject,
      html: input.html,
      text: input.text,
    })
    return { messageId: result.messageId }
  } catch (error) {
    throw smtpDeliveryError(error)
  }
}
