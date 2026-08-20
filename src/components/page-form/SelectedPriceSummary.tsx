import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, ReceiptText } from 'lucide-react'
import { optionPrice } from '@/lib/page-builder/references'
import type { PageField, ReferenceMap } from '@/lib/page-builder/types'
import { formatMoney } from './PagePaymentStep'

export interface SelectedPriceItem {
  key: string
  label: string
  amount: number
}

function selectedValues(value: unknown) {
  if (Array.isArray(value)) return new Set(value.map(String))
  if (value == null || value === '') return new Set<string>()
  return new Set([String(value)])
}

export function selectedPriceItems(
  fields: PageField[],
  values: Record<string, unknown>,
  references: ReferenceMap,
): SelectedPriceItem[] {
  return fields.flatMap((field) => {
    if (
      !['select', 'checkbox', 'radio'].includes(field.fieldType) ||
      !field.validationRules?.optionPricesEnabled
    ) return []

    const selected = selectedValues(values[field.bindVariable])
    return (field.options ?? []).flatMap((option, optionIndex) => {
      if (!selected.has(option.value)) return []
      const price = optionPrice(option, references)
      if (price.missing) return []
      return [{
        key: `${field.id}-${option.value}-${optionIndex}`,
        label: option.label || field.label || 'Selected option',
        amount: price.value,
      }]
    })
  })
}

export function SelectedPriceSummary({
  items,
  currency,
}: {
  items: SelectedPriceItem[]
  currency: string
}) {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<number | null>(null)
  const pointerTypeRef = useRef<string | null>(null)
  const popoverId = useId()

  useEffect(() => () => {
    if (closeTimerRef.current != null) window.clearTimeout(closeTimerRef.current)
  }, [])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closePopover()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePopover()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (items.length === 0) return null

  const total = items.reduce((sum, item) => sum + item.amount, 0)
  const formattedTotal = formatMoney(total, currency)

  function openPopover() {
    if (closeTimerRef.current != null) window.clearTimeout(closeTimerRef.current)
    setClosing(false)
    setOpen(true)
  }

  function closePopover() {
    if (!open) return
    setOpen(false)
    setClosing(true)
    if (closeTimerRef.current != null) window.clearTimeout(closeTimerRef.current)
    const closeValue = getComputedStyle(document.documentElement)
      .getPropertyValue('--dropdown-close-dur')
    const closeMs = Number.parseFloat(closeValue) || 150
    closeTimerRef.current = window.setTimeout(() => setClosing(false), closeMs)
  }

  return (
    <div
      ref={rootRef}
      className="relative z-10 mb-6 flex justify-end"
      onMouseEnter={openPopover}
      onMouseLeave={closePopover}
      onFocus={() => {
        if (pointerTypeRef.current !== 'touch') openPopover()
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) closePopover()
      }}
    >
      <button
        type="button"
        aria-controls={popoverId}
        aria-expanded={open}
        aria-label={`View ${items.length} selected option${items.length === 1 ? '' : 's'}, total ${formattedTotal}`}
        className="group flex min-h-10 items-center gap-2 rounded-[var(--ponko-radius,6px)] border border-[#e6dfd8] bg-[var(--ponko-bg,#faf9f5)] px-3 py-2 text-sm shadow-sm outline-none transition-[border-color,background-color] duration-[var(--duration-quick)] hover:border-[var(--ponko-primary,#cc785c)] focus-visible:border-[var(--ponko-primary,#cc785c)] focus-visible:ring-2 focus-visible:ring-[var(--ponko-primary-soft,#cc785c29)] motion-reduce:transition-none"
        onPointerDown={(event) => {
          pointerTypeRef.current = event.pointerType
        }}
        onClick={() => {
          if (pointerTypeRef.current === 'touch' && open) closePopover()
          else openPopover()
          pointerTypeRef.current = null
        }}
      >
        <ReceiptText className="size-3.5 text-[var(--ponko-primary,#cc785c)]" aria-hidden="true" />
        <span className="text-[var(--ponko-foreground-muted,#6c6a64)]">Total</span>
        <span className="font-semibold tabular-nums text-[var(--ponko-foreground,#141413)]" aria-live="polite">
          {formattedTotal}
        </span>
        <ChevronDown
          className={`size-3.5 text-[var(--ponko-foreground-faint,#8e8b82)] transition-transform duration-[var(--duration-quick)] motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      <aside
        id={popoverId}
        aria-label="Selected options and prices"
        aria-hidden={!open}
        data-origin="top-right"
        className={`t-dropdown absolute right-0 top-[calc(100%+0.5rem)] z-20 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[var(--ponko-radius,6px)] border border-[#e6dfd8] bg-[var(--ponko-bg,#faf9f5)] shadow-[0_16px_40px_rgba(20,20,19,0.14)] ${open ? 'is-open' : closing ? 'is-closing' : ''}`}
      >
        <div className="flex items-center justify-between gap-4 border-b border-[#e6dfd8] px-3.5 py-2.5 text-xs font-medium text-[var(--ponko-foreground-muted,#6c6a64)]">
          <span>Your selection{items.length === 1 ? '' : 's'}</span>
          <span>{items.length} item{items.length === 1 ? '' : 's'}</span>
        </div>
        <ul className="divide-y divide-[#e6dfd8] px-3.5">
          {items.map((item) => (
            <li key={item.key} className="flex items-start justify-between gap-4 py-2.5 text-sm">
              <span className="min-w-0 break-words text-[var(--ponko-foreground,#141413)]">{item.label}</span>
              <span className="shrink-0 font-medium tabular-nums text-[var(--ponko-foreground,#141413)]">
                {formatMoney(item.amount, currency)}
              </span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
