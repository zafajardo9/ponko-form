import { describe, expect, it } from 'vitest'
import { generateInvoicePdf } from './InvoicePDF'
import type { InvoiceModel } from './InvoiceUtils'

const invoice: InvoiceModel = {
  issuer: 'PonkoForm',
  invoiceNo: 'INV-000042',
  dateText: 'Jul 23, 2026',
  lines: [
    { label: 'Customer name', value: 'Alex Example' },
    { label: 'Service', value: 'Application review' },
  ],
  totalText: 'PHP 1,250.00',
  paid: true,
  gatewayName: 'Xendit',
  reference: 'invoice-42',
}

async function blobText(blob: Blob) {
  return new TextDecoder().decode(await blob.arrayBuffer())
}

describe('generateInvoicePdf', () => {
  it('creates a compact, valid PDF with selectable invoice text', async () => {
    const blob = await generateInvoicePdf(invoice)
    const text = await blobText(blob)

    expect(blob.type).toBe('application/pdf')
    expect(blob.size).toBeLessThan(25_000)
    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text).toContain('(INV-000042)')
    expect(text).toContain('(PHP 1,250.00)')
    expect(text.endsWith('%%EOF\n')).toBe(true)
  })

  it('paginates long invoices and escapes PDF control characters', async () => {
    const blob = await generateInvoicePdf({
      ...invoice,
      issuer: 'Acme (North) \\ Services',
      lines: Array.from({ length: 70 }, (_, index) => ({
        label: `Line item ${index + 1}`,
        value: `Detailed value ${index + 1}`,
      })),
    })
    const text = await blobText(blob)

    expect(text).toMatch(/\/Type \/Pages \/Count [2-9]/)
    expect(text).toContain('(Acme \\(North\\) \\\\ Services)')
    expect(text).toContain('(Page 2 of ')
  })
})
