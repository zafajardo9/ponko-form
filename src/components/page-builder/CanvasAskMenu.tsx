import { Liquid } from 'liquid-gooey'
import { BookOpen, MessageCircleQuestion, Workflow, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

const actionClass =
  'group/ask-action pointer-events-auto relative grid h-11 w-11 place-items-center rounded-full bg-transparent text-white outline-none transition-[opacity,transform] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:scale-105 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#cc785c] active:scale-95 motion-reduce:transition-none'

export function CanvasAskMenu() {
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

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-30 h-36 w-40"
    >
      <Liquid
        id={menuId}
        blur={7}
        contrast={18}
        fill="#cc785c"
        shadow="0 12px 30px rgba(78, 42, 30, 0.24), inset 0 1px 0 rgba(255,255,255,0.22)"
        filterPadding={30}
        className="h-full w-full"
      >
        <Liquid.Item
          x={open ? -70 : 0}
          y={open ? -10 : 0}
          transition="bouncy"
          className="absolute bottom-0 right-0"
        >
          <AskLink href="/docs" label="Documentation" open={open} onSelect={() => setOpen(false)}>
            <BookOpen size={18} aria-hidden="true" />
          </AskLink>
        </Liquid.Item>

        <Liquid.Item
          x={open ? -48 : 0}
          y={open ? -64 : 0}
          transition="bouncy"
          delay={40}
          className="absolute bottom-0 right-0"
        >
          <AskLink
            href="/docs/flow-builder-guide"
            label="Form builder guide"
            open={open}
            onSelect={() => setOpen(false)}
          >
            <Workflow size={18} aria-hidden="true" />
          </AskLink>
        </Liquid.Item>

        <Liquid.Item className="absolute bottom-0 right-0">
          <button
            ref={triggerRef}
            type="button"
            aria-label={open ? 'Close Ask menu' : 'Ask Ponko'}
            title={open ? 'Close Ask menu' : 'Ask Ponko'}
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((current) => !current)}
            className="pointer-events-auto group/ask grid h-14 w-14 place-items-center rounded-full bg-transparent text-white outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#cc785c]"
          >
            {open ? (
              <X
                size={21}
                strokeWidth={2.25}
                className="transition-transform duration-[var(--duration-medium)] ease-[var(--ease-smooth-out)] group-hover/ask:rotate-6 motion-reduce:transition-none"
                aria-hidden="true"
              />
            ) : (
              <MessageCircleQuestion
                size={23}
                strokeWidth={2.15}
                className="transition-transform duration-[var(--duration-medium)] ease-[var(--ease-smooth-out)] group-hover/ask:-translate-y-0.5 motion-reduce:transition-none"
                aria-hidden="true"
              />
            )}
          </button>
        </Liquid.Item>
      </Liquid>
    </div>
  )
}

function AskLink({
  href,
  label,
  open,
  onSelect,
  children,
}: {
  href: '/docs' | '/docs/flow-builder-guide'
  label: string
  open: boolean
  onSelect: () => void
  children: ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      aria-hidden={!open}
      tabIndex={open ? 0 : -1}
      onClick={onSelect}
      className={`${actionClass} ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
    >
      {children}
      <span className="pointer-events-none absolute right-[calc(100%+0.625rem)] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-[#242320] px-2.5 py-1.5 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-[var(--duration-quick)] group-hover/ask-action:opacity-100 group-focus-visible/ask-action:opacity-100 motion-reduce:transition-none">
        {label}
      </span>
    </a>
  )
}
