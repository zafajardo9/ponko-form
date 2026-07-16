import type { EmailTemplateKind, EmailTemplateSnapshot } from '../../db/schema'
import type { TemplateVariable } from '../../lib/invoicing/types'

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] ?? character)
}

function previewMessage(
  kind: EmailTemplateKind,
  snapshot: EmailTemplateSnapshot,
  variables: TemplateVariable[],
) {
  const samples: Record<string, string> = {
    ...Object.fromEntries(variables.map((variable) => [variable.key, variable.sampleValue])),
    form_title: 'Event Registration', submission_id: '1042', submitted_at: 'July 16, 2026',
    payment_amount: '$49.00', payment_currency: 'USD', payment_date: 'July 16, 2026',
    payment_gateway: 'PayPal', payment_id: 'PAY-TEST-1042', invoice_number: 'INV-TEST',
  }
  const replace = (value: string) => value.replace(/\{\{([a-z0-9][a-z0-9_]*)\}\}/g, (_token, key: string) => escapeHtml(samples[key] ?? ''))
  const safeBody = replace(snapshot.bodyTemplate)
    .replace(/<(script|style|iframe|object|embed|form|svg|math)[\s\S]*?>[\s\S]*?<\/\1>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/\s(?:href|src)\s*=\s*("|')\s*(?:javascript|data):[^"']*\1/gi, '')
    .replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/gi, '')
  const accent = /^#[0-9a-f]{6}$/i.test(snapshot.accentColor ?? '') ? snapshot.accentColor : '#cc785c'
  const logo = snapshot.logoUrl && /^https:\/\//i.test(snapshot.logoUrl)
    ? `<img src="${escapeHtml(snapshot.logoUrl)}" alt="" style="display:block;max-height:56px;max-width:180px;margin-bottom:20px" />`
    : ''
  const lineItems = kind === 'invoice' && snapshot.includeLineItems && snapshot.lineItemFields?.length
    ? `<div style="margin-top:24px"><strong>Submission details</strong>${snapshot.lineItemFields.map((item) => `<p>${escapeHtml(item.label)}: ${escapeHtml(samples[item.variable] ?? '')}</p>`).join('')}</div>`
    : ''
  const payment = kind === 'invoice' && snapshot.includePaymentDetails
    ? '<div style="margin-top:24px;padding:16px;border:1px solid #e6dfd8;border-radius:10px"><strong>Payment details</strong><p>Amount: $49.00 USD</p><p>Method: PayPal</p></div>'
    : ''
  const html = `<div style="background:#f5f0e8;padding:28px 12px"><div style="max-width:640px;margin:0 auto;background:#fff;border-radius:14px;padding:32px;color:#141413;font-family:Arial,sans-serif;line-height:1.6;border-top:5px solid ${accent}">${logo}${safeBody}${lineItems}${payment}</div></div>`
  return { subject: replace(snapshot.subjectTemplate), html }
}

export function InvoicePreview({
  kind,
  snapshot,
  variables,
}: {
  kind: EmailTemplateKind
  snapshot: EmailTemplateSnapshot
  variables: TemplateVariable[]
}) {
  const message = previewMessage(kind, snapshot, variables)
  return (
    <section aria-label="Email preview" className="overflow-hidden rounded-xl border border-[#e6dfd8] bg-white">
      <div className="border-b border-[#e6dfd8] bg-[#faf9f5] px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-[#8e8b82]">Subject</p>
        <p className="mt-1 truncate text-sm font-medium text-[#141413]">{message.subject}</p>
      </div>
      <iframe
        title={`${kind} email preview`}
        sandbox=""
        srcDoc={message.html}
        className="h-[620px] w-full bg-white"
      />
    </section>
  )
}
