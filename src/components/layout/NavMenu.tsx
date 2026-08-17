import type { CSSProperties } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

/** A single destination inside a grouped navigation dropdown. */
export interface NavMenuItem {
  to: string
  label: string
  description: string
  icon: LucideIcon
  /** Tailwind classes for the icon tile (soft background + icon color). */
  tileClass: string
  /** Overrides the default active rule (`pathname === to` or `to` prefix). */
  activeWhen?: (pathname: string) => boolean
}

// Pointer intent: open after a short hover delay, and keep the menu alive for
// a grace period after the pointer leaves so a diagonal move from trigger to
// panel never closes it mid-flight.
const OPEN_DELAY_MS = 90
const CLOSE_GRACE_MS = 180
// Exits are shorter than the entrance (users care about what appears).
const EXIT_MS = 140

/**
 * NavMenu
 *
 * A grouped top-navigation destination. Hovering or focusing the trigger opens
 * a small mega-menu of sub-destinations, each with a tinted icon tile, label,
 * and one-line description. Motion follows the house corporate-premium scale:
 * the panel decelerates in from just above the trigger (position + fade +
 * slight scale, ~220ms) while the items cascade up behind it (~28ms stagger);
 * the chevron rotates with the trigger. Exits play the same properties in
 * reverse on an accelerated, shorter curve.
 */
export function NavMenu({ label, items }: { label: string; items: NavMenuItem[] }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname }) ?? ''
  const panelId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const timers = useRef<{ open?: number; close?: number; exit?: number }>({})
  // `open` is the logical state (aria); `rendered`/`closing` keep the panel in
  // the DOM long enough to play the exit animation before unmounting.
  const [open, setOpen] = useState(false)
  const [rendered, setRendered] = useState(false)
  const [closing, setClosing] = useState(false)

  function clearTimer(...keys: Array<'open' | 'close' | 'exit'>) {
    for (const key of keys) {
      window.clearTimeout(timers.current[key])
      delete timers.current[key]
    }
  }

  useEffect(() => () => {
    window.clearTimeout(timers.current.open)
    window.clearTimeout(timers.current.close)
    window.clearTimeout(timers.current.exit)
  }, [])

  function openNow() {
    clearTimer('open', 'close', 'exit')
    setClosing(false)
    setOpen(true)
    setRendered(true)
  }

  function beginClose() {
    clearTimer('open', 'close')
    if (!open && !rendered) return
    setOpen(false)
    setClosing(true)
    timers.current.exit = window.setTimeout(() => {
      setRendered(false)
      setClosing(false)
    }, EXIT_MS)
  }

  function scheduleOpen() {
    clearTimer('close')
    if (open || rendered) return
    timers.current.open = window.setTimeout(openNow, OPEN_DELAY_MS)
  }

  function scheduleClose() {
    clearTimer('open')
    if (!open) return
    timers.current.close = window.setTimeout(beginClose, CLOSE_GRACE_MS)
  }

  function focusFirstItem() {
    window.requestAnimationFrame(() => {
      triggerRef.current?.parentElement?.querySelector<HTMLAnchorElement>(`#${CSS.escape(panelId)} a`)?.focus()
    })
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      beginClose()
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!open) openNow()
      focusFirstItem()
    }
  }

  // Click-away and Escape close the menu even when the pointer never touched
  // it (keyboard users, touch taps on the trigger).
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!triggerRef.current?.parentElement?.contains(event.target as Node)) beginClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      beginClose()
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function itemActive(item: NavMenuItem) {
    if (item.activeWhen) return item.activeWhen(pathname)
    return pathname === item.to || pathname.startsWith(`${item.to}/`)
  }
  const groupActive = items.some(itemActive)

  const triggerStateClass = open || groupActive
    ? 'text-[#141413]'
    : 'text-[#6c6a64] hover:text-[#141413]'

  return (
    <div
      className="relative"
      onPointerEnter={scheduleOpen}
      onPointerLeave={scheduleClose}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) scheduleClose()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          beginClose()
          triggerRef.current?.focus()
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? beginClose() : openNow())}
        onKeyDown={handleTriggerKeyDown}
        className={`inline-flex items-center gap-1 rounded-md py-1 text-sm transition-colors duration-[var(--duration-quick)] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2 ${triggerStateClass} ${groupActive ? 'font-medium' : ''}`}
      >
        {label}
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`text-[#8e8b82] transition-transform duration-[var(--duration-medium)] ease-[var(--ease-smooth-out)] motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {rendered ? (
        <div
          className="absolute left-1/2 top-full mt-2 -translate-x-1/2"
          onPointerEnter={scheduleOpen}
        >
          <div
            id={panelId}
            role="group"
            aria-label={`${label} menu`}
            className={`w-[19.5rem] rounded-xl border border-[#e6dfd8] bg-white p-2 shadow-[0_2px_10px_rgba(37,35,32,0.06),0_20px_44px_rgba(37,35,32,0.14)] ${closing ? 'ponko-nav-panel-out pointer-events-none' : 'ponko-nav-panel-in'}`}
          >
            {items.map((item, index) => {
              const active = itemActive(item)
              const Icon = item.icon
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={beginClose}
                  style={{ '--nav-i': index } as CSSProperties}
                  className={`ponko-nav-item-in group flex items-center gap-3 rounded-lg p-2.5 pr-3 transition-colors duration-[var(--duration-quick)] motion-reduce:transition-none hover:bg-[#f5f0e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#cc785c] ${active ? 'bg-[#f5f0e8]' : ''}`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.tileClass} transition-transform duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] motion-reduce:transition-none group-hover:scale-105`}
                  >
                    <Icon size={17} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-[#141413]">{item.label}</span>
                    <span className="block text-xs leading-4 text-[#8e8b82]">{item.description}</span>
                  </span>
                  <ChevronRight
                    size={14}
                    aria-hidden="true"
                    className="shrink-0 -translate-x-1 text-[#cc785c] opacity-0 transition-[opacity,transform] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] motion-reduce:transition-none group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
                  />
                </Link>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
