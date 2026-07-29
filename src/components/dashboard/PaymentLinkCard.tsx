import { useEffect, useState } from 'react'
import {
  CalendarDays,
  Check,
  Copy,
  ExternalLink,
  MoreHorizontal,
  Power,
  PowerOff,
  ReceiptText,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'

export interface PaymentLinkCardData {
  id: number
  publicId: string
  title: string
  description: string | null
  amount: number
  currency: string
  isActive: boolean
  totalPayments: number
  totalRevenue: number
  createdAt: string
}

interface PaymentLinkCardProps {
  link: PaymentLinkCardData
  onToggle: (id: number, active: boolean) => void
  onDelete: (id: number) => void
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

export function PaymentLinkCard({ link, onToggle, onDelete }: PaymentLinkCardProps) {
  const [copied, setCopied] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const relativeUrl = `/pay/${link.publicId}`
  const [publicUrl, setPublicUrl] = useState(relativeUrl)

  useEffect(() => {
    setPublicUrl(`${window.location.origin}${relativeUrl}`)
  }, [relativeUrl])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <article className="group relative overflow-visible rounded-xl border border-[#dfd8ce] bg-white shadow-[0_1px_2px_rgba(36,35,32,0.03)] transition-[border-color,box-shadow] hover:border-[#cfc4b7] hover:shadow-[0_10px_30px_rgba(36,35,32,0.07)]">
      <div className="flex items-start gap-4 p-5 sm:p-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f5eee8] text-[#a9583e]">
          <ReceiptText size={19} aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-base font-semibold text-[#242320]">{link.title}</h3>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                  link.isActive
                    ? 'bg-[#eaf2ea] text-[#4f6e54]'
                    : 'bg-[#f1eee8] text-[#796f63]'
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${link.isActive ? 'bg-[#5d8a66]' : 'bg-[#9b9388]'}`} />
                  {link.isActive ? 'Live' : 'Paused'}
                </span>
              </div>
              {link.description ? (
                <p className="mt-1 line-clamp-2 text-sm leading-5 text-[#77736c]">{link.description}</p>
              ) : (
                <p className="mt-1 text-sm text-[#aaa59d]">One-time checkout</p>
              )}
            </div>

            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setMenuOpen((value) => !value)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#858078] transition-colors hover:bg-[#f5f1eb] hover:text-[#242320] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]"
                aria-label={`Actions for ${link.title}`}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                <MoreHorizontal size={17} aria-hidden="true" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div role="menu" className="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-lg border border-[#ded8cf] bg-white p-1.5 shadow-[0_14px_38px_rgba(20,20,19,0.14)]">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { onToggle(link.id, !link.isActive); setMenuOpen(false) }}
                      className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-[#35332f] hover:bg-[#f7f3ed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]"
                    >
                      {link.isActive ? <PowerOff size={15} /> : <Power size={15} />}
                      {link.isActive ? 'Pause link' : 'Make link live'}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { onDelete(link.id); setMenuOpen(false) }}
                      className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-[#b33d3d] hover:bg-[#fff3f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c64545]"
                    >
                      <Trash2 size={15} />
                      Delete link
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-[#eee9e2] pt-4 sm:grid-cols-[1.1fr_0.8fr_1fr]">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9a958d]">Pay once</p>
              <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums text-[#242320]">
                {formatMoney(link.amount / 100, link.currency)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9a958d]">Payments</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-[#242320]">{link.totalPayments}</p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#9a958d]">Collected</p>
              <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums text-[#242320]">
                {formatMoney(link.totalRevenue / 100, link.currency)}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-1.5 text-xs text-[#8a857d]">
            <CalendarDays size={13} aria-hidden="true" />
            Created {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(link.createdAt))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-dashed border-[#dfd8ce] bg-[#faf8f4] px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1 truncate font-mono text-[11px] text-[#77736c]">
          {publicUrl}
        </div>
        <Button
          type="button"
          variant="navigation"
          size="sm"
          onClick={handleCopy}
          className="shrink-0 gap-1.5 rounded-md bg-white"
        >
          {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy link'}
        </Button>
        <a
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#ded8cf] bg-white text-[#77736c] transition-colors hover:border-[#c9b4a8] hover:text-[#242320] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]"
          aria-label={`Open ${link.title} payment page`}
        >
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>
    </article>
  )
}
