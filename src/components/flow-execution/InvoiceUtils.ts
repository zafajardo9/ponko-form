import type { FlowVariable } from '../../lib/flow-engine/types'

/**
 * Pure invoice model shared by the on-page receipt and the PDF document. Kept
 * free of any PDF rendering import so it is safe to use during SSR.
 */
export interface InvoiceLine {
  label: string
  value: string
}

export interface InvoiceModel {
  issuer: string
  invoiceNo: string
  dateText: string
  lines: InvoiceLine[]
  totalText: string | null
  paid: boolean
  gatewayName?: string | null
  reference?: string | null
}

export function formatMoney(major: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(major)
  } catch {
    return `${currency} ${major.toFixed(2)}`
  }
}

function prettyName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function buildInvoice(opts: {
  formTitle: string
  executionId: number
  createdAt?: string | Date | null
  variables: FlowVariable[]
  values: Record<string, unknown>
  payment: {
    status: string
    amount: number // minor units (cents)
    currency: string
    gatewayPaymentId: string | null
    gatewayName: string
  } | null
}): InvoiceModel {
  const { formTitle, executionId, variables, values, payment } = opts
  const currency = payment?.currency ?? 'USD'

  const types: Record<string, string> = {}
  for (const v of variables) types[v.name] = v.type

  const lines: InvoiceLine[] = []
  for (const v of variables) {
    const raw = values[v.name]
    if (raw === undefined || raw === null || raw === '') continue
    let value: string
    if (types[v.name] === 'money') {
      const num = Number(raw)
      value = isNaN(num) ? String(raw) : formatMoney(num, currency)
    } else {
      value = Array.isArray(raw) ? raw.join(', ') : String(raw)
    }
    lines.push({ label: v.description || prettyName(v.name), value })
  }

  const date = opts.createdAt ? new Date(opts.createdAt) : new Date()

  return {
    issuer: formTitle,
    invoiceNo: `INV-${String(executionId).padStart(6, '0')}`,
    dateText: date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
    lines,
    totalText: payment ? formatMoney(payment.amount / 100, currency) : null,
    paid: payment?.status === 'completed',
    gatewayName: payment?.gatewayName ?? null,
    reference: payment?.gatewayPaymentId ?? null,
  }
}
