import { getIntegrationConfig, loadIntegrationConfigs } from '../integrations/credentials'
import type { ResendConfig, SmtpConfig } from '../integrations/types'
import { sendResendEmail } from './resend'
import { sendSmtpEmail } from './smtp'

export interface TransactionalEmailMessage {
  recipient: string
  subject: string
  html: string
  text: string
  fromName?: string | null
  cc?: string[]
  idempotencyKey?: string
}

export async function getTransactionalEmailAvailability(profileId: number) {
  const [resend, smtp, legacy] = await Promise.all([
    getIntegrationConfig<ResendConfig>(profileId, 'resend'),
    getIntegrationConfig<SmtpConfig>(profileId, 'smtp'),
    loadIntegrationConfigs(profileId),
  ])
  return { resend: Boolean(resend?.fromEmail), smtp: Boolean(smtp ?? legacy.smtp) }
}

export async function sendTransactionalEmail(profileId: number, message: TransactionalEmailMessage) {
  const resend = await getIntegrationConfig<ResendConfig>(profileId, 'resend')
  if (resend?.fromEmail) {
    const result = await sendResendEmail({ config: resend, ...message })
    return { ...result, provider: 'resend' as const }
  }
  const smtp = await getIntegrationConfig<SmtpConfig>(profileId, 'smtp')
    ?? (await loadIntegrationConfigs(profileId)).smtp
  if (smtp) {
    const result = await sendSmtpEmail({ config: smtp, ...message })
    return { ...result, provider: 'smtp' as const }
  }
  throw new Error('Configure Resend or SMTP before sending email')
}
