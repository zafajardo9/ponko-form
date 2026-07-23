// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InvoiceDownloadButton } from './InvoiceDownloadButton'
import type { InvoiceModel } from './invoice'

const generateInvoicePdf = vi.hoisted(() => vi.fn())

vi.mock('./InvoicePDF', () => ({ generateInvoicePdf }))

const invoice: InvoiceModel = {
  issuer: 'PonkoForm',
  invoiceNo: 'INV-42',
  dateText: 'July 23, 2026',
  paid: true,
  lines: [],
  totalText: null,
}

describe('InvoiceDownloadButton', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:invoice'),
      revokeObjectURL: vi.fn(),
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('loads the PDF generator only after the download action and downloads the blob', async () => {
    generateInvoicePdf.mockResolvedValue(new Blob(['invoice']))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    render(<InvoiceDownloadButton invoice={invoice} fileName="INV-42.pdf" />)

    expect(generateInvoicePdf).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '↓ Download PDF' }))

    expect(
      (screen.getByRole('button', { name: 'Preparing PDF…' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    await waitFor(() => expect(generateInvoicePdf).toHaveBeenCalledWith(invoice))
    await waitFor(() => expect(click).toHaveBeenCalledOnce())
    expect(screen.getByRole('button', { name: '↓ Download PDF' })).toBeTruthy()

  })

  it('shows a retryable error when PDF generation fails', async () => {
    generateInvoicePdf.mockRejectedValueOnce(new Error('renderer unavailable'))
    generateInvoicePdf.mockResolvedValueOnce(new Blob(['invoice']))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    render(<InvoiceDownloadButton invoice={invoice} fileName="INV-42.pdf" />)
    fireEvent.click(screen.getByRole('button', { name: '↓ Download PDF' }))

    expect((await screen.findByRole('alert')).textContent).toBe(
      'The PDF could not be prepared. Please try again.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Try PDF download again' }))

    await waitFor(() => expect(generateInvoicePdf).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(click).toHaveBeenCalledOnce())

  })
})
