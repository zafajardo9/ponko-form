import { Link } from '@tanstack/react-router'
import { Liquid } from 'liquid-gooey'
import { BadgePercent, CreditCard, FilePlus2, Plus } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

const actionClass =
  'group/action relative grid h-12 w-12 place-items-center rounded-full bg-transparent text-white outline-none transition-[opacity,transform] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:scale-105 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary active:scale-95 motion-reduce:transition-none'

export function FloatingQuickActions() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const close = () => setOpen(false)

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))] z-40 h-44 w-44"
    >
      <Liquid
        id={menuId}
        blur={7}
        contrast={18}
        fill="#cc785c"
        shadow="0 12px 30px rgba(78, 42, 30, 0.24), inset 0 1px 0 rgba(255,255,255,0.22)"
        filterPadding={32}
        className="h-full w-full"
      >
        <Liquid.Item x={open ? -78 : 0} y={open ? -8 : 0} transition="bouncy" className="absolute bottom-0 right-0">
          <QuickActionLink to="/forms/new" label="New form" open={open} onSelect={close}>
            <FilePlus2 size={19} aria-hidden="true" />
          </QuickActionLink>
        </Liquid.Item>

        <Liquid.Item x={open ? -58 : 0} y={open ? -68 : 0} transition="bouncy" delay={40} className="absolute bottom-0 right-0">
          <QuickActionLink to="/dashboard/payment-links" label="Payment links" open={open} onSelect={close}>
            <CreditCard size={18} aria-hidden="true" />
          </QuickActionLink>
        </Liquid.Item>

        <Liquid.Item x={open ? 0 : 0} y={open ? -88 : 0} transition="bouncy" delay={80} className="absolute bottom-0 right-0">
          <QuickActionLink to="/discounts" label="Discounts" open={open} onSelect={close}>
            <BadgePercent size={19} aria-hidden="true" />
          </QuickActionLink>
        </Liquid.Item>

        <Liquid.Item className="absolute bottom-0 right-0">
          <button
            ref={triggerRef}
            type="button"
            aria-label={open ? 'Close quick actions' : 'Open quick actions'}
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((current) => !current)}
            className="pointer-events-auto grid h-14 w-14 place-items-center rounded-full bg-transparent text-white outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
          >
            <Plus size={23} strokeWidth={2.25} className={`transition-transform duration-[var(--duration-medium)] ease-[var(--ease-smooth-out)] motion-reduce:transition-none ${open ? 'rotate-45' : ''}`} aria-hidden="true" />
          </button>
        </Liquid.Item>
      </Liquid>

    </div>
  )
}

function QuickActionLink({
  to,
  label,
  open,
  onSelect,
  children,
}: {
  to: '/forms/new' | '/dashboard/payment-links' | '/discounts'
  label: string
  open: boolean
  onSelect: () => void
  children: ReactNode
}) {
  return (
    <Link
      to={to}
      aria-label={label}
      aria-hidden={!open}
      tabIndex={open ? 0 : -1}
      onClick={onSelect}
      className={`${actionClass} ${open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
    >
      {children}
      <span className="pointer-events-none absolute right-[calc(100%+0.625rem)] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-[#242320] px-2.5 py-1.5 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-[var(--duration-quick)] group-hover/action:opacity-100 group-focus-visible/action:opacity-100 motion-reduce:transition-none">
        {label}
      </span>
    </Link>
  )
}
