import { useState } from 'react'
import type { InvoiceModel } from './invoice'

interface InvoiceDownloadButtonProps {
  invoice: InvoiceModel
  fileName: string
}

export function InvoiceDownloadButton({
  invoice,
  fileName,
}: InvoiceDownloadButtonProps) {
  const [state, setState] = useState<'idle' | 'preparing' | 'error'>('idle')

  async function download() {
    if (state === 'preparing') return
    setState('preparing')

    try {
      const { generateInvoicePdf } = await import('./InvoicePDF')
      const blob = await generateInvoicePdf(invoice)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileName
      anchor.style.display = 'none'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      setState('idle')
    } catch {
      setState('error')
    }
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={download}
        disabled={state === 'preparing'}
        className="inline-flex h-10 items-center justify-center rounded-[var(--ponko-radius,8px)] bg-[var(--ponko-primary,#cc785c)] px-5 text-sm font-medium text-white transition-colors hover:brightness-90 disabled:cursor-wait disabled:opacity-70"
      >
        {state === 'preparing'
          ? 'Preparing PDF…'
          : state === 'error'
            ? 'Try PDF download again'
            : '↓ Download PDF'}
      </button>
      {state === 'error' ? (
        <p role="alert" className="text-xs text-[#c64545]">
          The PDF could not be prepared. Please try again.
        </p>
      ) : null}
    </div>
  )
}
