import sanitize from 'sanitize-html'
import type { EmailTemplateKind, EmailTemplateSnapshot } from '../../db/schema'
import type { InvoiceTemplateContext, TemplateVariable } from './types'

export const SYSTEM_VARIABLES: TemplateVariable[] = [
  { key: 'form_title', label: 'Form title', category: 'form', sampleValue: 'Event Registration' },
  { key: 'submission_id', label: 'Submission ID', category: 'system', sampleValue: '1042' },
  { key: 'submitted_at', label: 'Submitted date', category: 'system', sampleValue: 'July 16, 2026' },
  { key: 'payment_amount', label: 'Payment amount', category: 'payment', sampleValue: '$49.00' },
  { key: 'payment_currency', label: 'Payment currency', category: 'payment', sampleValue: 'USD' },
  { key: 'payment_date', label: 'Payment date', category: 'payment', sampleValue: 'July 16, 2026' },
  { key: 'payment_gateway', label: 'Payment gateway', category: 'payment', sampleValue: 'PayPal' },
  { key: 'payment_id', label: 'Payment ID', category: 'payment', sampleValue: 'PAY-TEST-1042' },
  { key: 'invoice_number', label: 'Invoice number', category: 'payment', sampleValue: 'INV-1000' },
]

const TOKEN = /\{\{([a-z0-9][a-z0-9_]*)\}\}/g

function stringifyValue(value: unknown): string {
  if (value == null) return ''
  if (Array.isArray(value)) return value.map(stringifyValue).filter(Boolean).join(', ')
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).map(stringifyValue).filter(Boolean).join(', ')
  }
  return String(value)
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] ?? character)
}

function contextValue(key: string, context: InvoiceTemplateContext): string {
  switch (key) {
    case 'form_title': return context.formTitle
    case 'submission_id': return String(context.submissionId)
    case 'submitted_at': return formatDate(context.submittedAt)
    case 'payment_amount': return context.paymentAmount ?? ''
    case 'payment_currency': return context.paymentCurrency ?? ''
    case 'payment_date': return context.paymentDate ?? ''
    case 'payment_gateway': return context.paymentGateway ?? ''
    case 'payment_id': return context.paymentId ?? ''
    case 'invoice_number': return context.invoiceNumber ?? ''
    default: return stringifyValue(context.values[key])
  }
}

export function extractTemplateTokens(template: string): string[] {
  return [...template.matchAll(TOKEN)].map((match) => match[1])
}

export function interpolateText(template: string, context: InvoiceTemplateContext): string {
  return template.replace(TOKEN, (_token, key: string) => contextValue(key, context))
    .replace(/[\r\n]+/g, ' ')
    .trim()
}

export function sanitizeTemplateHtml(template: string): string {
  return sanitize(template, {
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'a', 'hr'],
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['https', 'mailto'],
    allowProtocolRelative: false,
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: 'a',
        attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' },
      }),
    },
  })
}

export function interpolateHtml(template: string, context: InvoiceTemplateContext): string {
  return sanitizeTemplateHtml(template).replace(
    TOKEN,
    (_token, key: string) => escapeHtml(contextValue(key, context)),
  )
}

export function htmlToPlainText(html: string): string {
  return sanitize(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function formatMoney(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amountMinor / 100)
  } catch {
    return `${currency.toUpperCase()} ${(amountMinor / 100).toFixed(2)}`
  }
}

export function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  }).format(value)
}

function paymentDetails(context: InvoiceTemplateContext, accentColor: string) {
  if (!context.paymentAmount) return ''
  const rows = [
    ['Amount', context.paymentAmount],
    ['Currency', context.paymentCurrency],
    ['Payment date', context.paymentDate],
    ['Payment method', context.paymentGateway],
    ['Payment ID', context.paymentId],
  ].filter((row): row is [string, string] => Boolean(row[1]))
  return `<div style="margin:24px 0;border:1px solid #e6dfd8;border-radius:10px;overflow:hidden"><div style="padding:12px 16px;background:${accentColor};color:#fff;font-weight:600">Payment details</div>${rows.map(([label, value]) => `<div style="display:flex;justify-content:space-between;gap:24px;padding:10px 16px;border-top:1px solid #eee"><span style="color:#6c6a64">${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('')}</div>`
}

function lineItems(snapshot: EmailTemplateSnapshot, context: InvoiceTemplateContext) {
  if (!snapshot.includeLineItems || !snapshot.lineItemFields?.length) return ''
  return `<div style="margin:24px 0"><h2 style="font-size:16px">Submission details</h2>${snapshot.lineItemFields.map((item) => `<div style="display:flex;justify-content:space-between;gap:24px;padding:8px 0;border-bottom:1px solid #eee"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(stringifyValue(context.values[item.variable]))}</strong></div>`).join('')}</div>`
}

export function renderTemplateMessage(
  kind: EmailTemplateKind,
  snapshot: EmailTemplateSnapshot,
  context: InvoiceTemplateContext,
) {
  const accent = /^#[0-9a-f]{6}$/i.test(snapshot.accentColor ?? '') ? snapshot.accentColor! : '#cc785c'
  const body = interpolateHtml(snapshot.bodyTemplate, context)
  const logo = snapshot.logoUrl && /^https:\/\//i.test(snapshot.logoUrl)
    ? `<img src="${escapeHtml(snapshot.logoUrl)}" alt="" style="display:block;max-height:56px;max-width:180px;margin-bottom:20px" />`
    : ''
  const invoiceDetails = kind === 'invoice' && snapshot.includePaymentDetails
    ? paymentDetails(context, accent)
    : ''
  const items = kind === 'invoice' ? lineItems(snapshot, context) : ''
  const html = `<div style="background:#f5f0e8;padding:28px 12px"><div style="max-width:640px;margin:0 auto;background:#fff;border-radius:14px;padding:32px;color:#141413;font-family:Arial,sans-serif;line-height:1.6;border-top:5px solid ${accent}">${logo}${body}${items}${invoiceDetails}</div></div>`
  const subject = interpolateText(snapshot.subjectTemplate, context).slice(0, 255)
  const text = snapshot.bodyTemplatePlain
    ? interpolateText(snapshot.bodyTemplatePlain, context)
    : htmlToPlainText(`${body} ${items} ${invoiceDetails}`)
  return { subject, html, text }
}

export function validateTemplateTokens(templates: string[], variables: TemplateVariable[]): string[] {
  const allowed = new Set([...SYSTEM_VARIABLES, ...variables].map((variable) => variable.key))
  return [...new Set(templates.flatMap(extractTemplateTokens).filter((token) => !allowed.has(token)))]
}

export function sampleContext(variables: TemplateVariable[], invoiceNumber = 'INV-TEST'): InvoiceTemplateContext {
  return {
    values: Object.fromEntries(variables.map((variable) => [variable.key, variable.sampleValue])),
    formTitle: 'Event Registration',
    submissionId: 1042,
    submittedAt: new Date('2026-07-16T00:00:00.000Z'),
    paymentAmount: '$49.00',
    paymentCurrency: 'USD',
    paymentDate: 'July 16, 2026',
    paymentGateway: 'PayPal',
    paymentId: 'PAY-TEST-1042',
    invoiceNumber,
  }
}
