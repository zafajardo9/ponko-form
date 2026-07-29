import { ChevronDown, ReceiptText, Trash2 } from 'lucide-react'
import type { EmailTemplateSnapshot } from '../../db/schema'
import type { InvoiceConfigDraft, TemplateVariable } from '../../lib/invoicing/types'
import { InvoicePreview } from './InvoicePreview'
import { TemplateRichTextEditor } from './TemplateRichTextEditor'

const inputClass = 'h-10 w-full rounded-md border border-[#e6dfd8] bg-white px-3 text-sm text-[#141413] outline-none focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/20 disabled:bg-[#f5f0e8] disabled:text-[#8e8b82]'

export function InvoiceTemplateBuilder({
  invoice,
  variables,
  hasPaymentPath,
  hasEmailIntegration,
  numberingLocked,
  onInvoiceChange,
}: {
  invoice: InvoiceConfigDraft
  variables: TemplateVariable[]
  hasPaymentPath: boolean
  hasEmailIntegration: boolean
  numberingLocked: boolean
  onInvoiceChange: (next: InvoiceConfigDraft) => void
}) {
  const emailVariables = variables.filter((variable) => variable.emailCandidate)
  const respondentVariables = variables.filter((variable) => variable.category === 'respondent')
  const prerequisites = hasPaymentPath && hasEmailIntegration && emailVariables.length > 0
  const invoiceSnapshot: EmailTemplateSnapshot = {
    subjectTemplate: invoice.subjectTemplate,
    bodyTemplate: invoice.bodyTemplate,
    fromName: invoice.fromName,
    logoUrl: invoice.logoUrl,
    accentColor: invoice.accentColor,
    includePaymentDetails: invoice.includePaymentDetails,
    includeLineItems: invoice.includeLineItems,
    lineItemFields: invoice.lineItemFields,
  }
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.8fr)]">
      <div className="space-y-6">
        <section className="rounded-xl border border-[#e6dfd8] bg-white">
          <div className="flex items-start justify-between gap-4 border-b border-[#e6dfd8] px-5 py-4">
            <div className="flex gap-3">
              <span className="rounded-lg bg-[#cc785c]/10 p-2 text-[#cc785c]"><ReceiptText size={20} /></span>
              <div><h2 className="font-medium text-[#141413]">Invoice email</h2><p className="mt-1 text-xs text-[#8e8b82]">Sent after a verified payment completes.</p></div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={invoice.enabled} disabled={!prerequisites} onChange={(event) => onInvoiceChange({ ...invoice, enabled: event.target.checked })} /> Enabled
            </label>
          </div>
          {!prerequisites && (
            <div className="mx-5 mt-5 rounded-lg border border-[#e2c49f] bg-[#fff8eb] px-4 py-3 text-sm text-[#79572e]">
              {!hasPaymentPath ? 'Add a payment step to this form. ' : ''}
              {!hasEmailIntegration ? 'Connect Resend or SMTP in Integrations. ' : ''}
              {emailVariables.length === 0 ? 'Add an Email field for the respondent. ' : ''}
              You can still design and save the template now.
            </div>
          )}
          <div className="space-y-5 p-5">
            <Field label="Respondent email field">
              <select className={inputClass} value={invoice.respondentEmailField} onChange={(event) => onInvoiceChange({ ...invoice, respondentEmailField: event.target.value })}>
                <option value="">Choose an email field…</option>
                {emailVariables.map((variable) => <option key={variable.key} value={variable.key}>{variable.label}</option>)}
              </select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="From name"><input className={inputClass} value={invoice.fromName} maxLength={255} onChange={(event) => onInvoiceChange({ ...invoice, fromName: event.target.value })} placeholder="Acme Billing" /></Field>
              <Field label="Accent color"><div className="flex gap-2"><input type="color" aria-label="Accent color picker" className="h-10 w-12 rounded border border-[#e6dfd8]" value={invoice.accentColor} onChange={(event) => onInvoiceChange({ ...invoice, accentColor: event.target.value })} /><input className={inputClass} value={invoice.accentColor} onChange={(event) => onInvoiceChange({ ...invoice, accentColor: event.target.value })} /></div></Field>
            </div>
            <Field label="Logo URL (optional)"><input type="url" className={inputClass} value={invoice.logoUrl} onChange={(event) => onInvoiceChange({ ...invoice, logoUrl: event.target.value })} placeholder="https://example.com/logo.png" /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Invoice prefix"><input className={inputClass} value={invoice.invoicePrefix} maxLength={20} onChange={(event) => onInvoiceChange({ ...invoice, invoicePrefix: event.target.value })} /></Field>
              <Field label="Starting number"><input type="number" min={1} disabled={numberingLocked} className={inputClass} value={invoice.invoiceStartNumber} onChange={(event) => onInvoiceChange({ ...invoice, invoiceStartNumber: Number(event.target.value) })} /></Field>
            </div>
            {numberingLocked && <p className="-mt-3 text-xs text-[#8e8b82]">The starting number is locked because an invoice has already been reserved.</p>}
            <Field label="Subject"><input className={inputClass} value={invoice.subjectTemplate} maxLength={255} onChange={(event) => onInvoiceChange({ ...invoice, subjectTemplate: event.target.value })} /></Field>
            <Field label="Email body"><TemplateRichTextEditor value={invoice.bodyTemplate} variables={variables} onChange={(bodyTemplate) => onInvoiceChange({ ...invoice, bodyTemplate })} /></Field>
            <div className="space-y-3 rounded-lg bg-[#faf9f5] p-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={invoice.includePaymentDetails} onChange={(event) => onInvoiceChange({ ...invoice, includePaymentDetails: event.target.checked })} /> Include verified payment details</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={invoice.includeLineItems} onChange={(event) => onInvoiceChange({ ...invoice, includeLineItems: event.target.checked })} /> Include selected submission fields</label>
              {invoice.includeLineItems && (
                <div className="space-y-2 pt-2">
                  {invoice.lineItemFields.map((item, index) => (
                    <div key={`${item.variable}-${index}`} className="flex gap-2">
                      <input aria-label="Line item label" className={inputClass} value={item.label} onChange={(event) => onInvoiceChange({ ...invoice, lineItemFields: invoice.lineItemFields.map((row, rowIndex) => rowIndex === index ? { ...row, label: event.target.value } : row) })} />
                      <button type="button" aria-label="Remove line item" onClick={() => onInvoiceChange({ ...invoice, lineItemFields: invoice.lineItemFields.filter((_, rowIndex) => rowIndex !== index) })} className="rounded-md border border-[#e6dfd8] px-3 text-[#8e8b82] hover:text-[#a33f32]"><Trash2 size={15} /></button>
                    </div>
                  ))}
                  <div className="relative">
                    <select aria-label="Add submission field" defaultValue="" onChange={(event) => {
                      const variable = respondentVariables.find((item) => item.key === event.target.value)
                      if (variable && !invoice.lineItemFields.some((item) => item.variable === variable.key)) onInvoiceChange({ ...invoice, lineItemFields: [...invoice.lineItemFields, { label: variable.label, variable: variable.key }] })
                      event.target.value = ''
                    }} className={inputClass}>
                      <option value="">Add a submission field…</option>
                      {respondentVariables.map((variable) => <option key={variable.key} value={variable.key}>{variable.label}</option>)}
                    </select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-3 text-[#8e8b82]" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

      </div>
      <aside className="min-w-0 xl:sticky xl:top-6 xl:self-start">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-[#141413]">Invoice preview</h2>
          <p className="mt-0.5 text-xs text-[#8e8b82]">Sample values replace variables here.</p>
        </div>
        <InvoicePreview kind="invoice" snapshot={invoiceSnapshot} variables={variables} />
      </aside>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-medium text-[#141413]">{label}</span>{children}</label>
}
