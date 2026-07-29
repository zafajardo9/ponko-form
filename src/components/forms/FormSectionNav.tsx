import { useEffect, useId, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { BarChart3, ChevronDown, CreditCard, FileEdit, MailCheck, ReceiptText } from 'lucide-react'

export type FormSection = 'build' | 'responses' | 'emails' | 'payments' | 'invoicing'

const sections = [
  { id: 'build', label: 'Build', to: '/forms/$formId/edit', icon: FileEdit },
  { id: 'responses', label: 'Responses', to: '/forms/$formId/submissions', icon: BarChart3 },
  { id: 'emails', label: 'Emails', to: '/forms/$formId/emails', icon: MailCheck },
  { id: 'payments', label: 'Payments', to: '/forms/$formId/payments', icon: CreditCard },
  { id: 'invoicing', label: 'Invoicing', to: '/forms/$formId/invoicing', icon: ReceiptText },
] as const

export function FormSectionNav({ formId, active }: { formId: string; active: FormSection }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()
  const navRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const activeSection = sections.find((section) => section.id === active) ?? sections[0]
  const ActiveIcon = activeSection.icon

  useEffect(() => {
    if (!menuOpen) return

    function handlePointerDown(event: MouseEvent) {
      if (!navRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  return (
    <nav aria-label="Form sections" className="max-w-full">
      <div ref={navRef} className="relative lg:hidden">
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen((open) => !open)}
          className="inline-flex min-w-40 items-center gap-2 rounded-lg border border-[#e6dfd8] bg-[#f5f0e8] px-3 py-2 text-sm font-medium text-[#141413] shadow-sm transition-colors hover:bg-[#eee7dc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2"
        >
          <ActiveIcon size={15} aria-hidden="true" className="text-[#cc785c]" />
          <span className="flex-1 text-left">{activeSection.label}</span>
          <ChevronDown
            size={15}
            aria-hidden="true"
            className={`text-[#8e8b82] transition-transform motion-reduce:transition-none ${
              menuOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {menuOpen ? (
          <div
            id={menuId}
            className="absolute left-0 top-[calc(100%+0.375rem)] z-50 w-56 overflow-hidden rounded-xl border border-[#e6dfd8] bg-white p-1.5 shadow-[0_12px_32px_rgba(20,20,19,0.14)]"
          >
            {sections.map((section) => {
              const Icon = section.icon
              const selected = active === section.id
              return (
                <Link
                  key={section.id}
                  to={section.to}
                  params={{ formId }}
                  aria-current={selected ? 'page' : undefined}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] ${
                    selected
                      ? 'bg-[#f5f0e8] font-medium text-[#141413]'
                      : 'text-[#6c6a64] hover:bg-[#faf9f5] hover:text-[#141413]'
                  }`}
                >
                  <Icon
                    size={15}
                    aria-hidden="true"
                    className={selected ? 'text-[#cc785c]' : 'text-[#8e8b82]'}
                  />
                  <span className="flex-1">{section.label}</span>
                  {selected ? (
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#cc785c]" />
                  ) : null}
                </Link>
              )
            })}
          </div>
        ) : null}
      </div>

      <div className="hidden w-max rounded-lg border border-[#e6dfd8] bg-[#f5f0e8] p-0.5 text-sm lg:flex">
        {sections.map((section) => {
          const Icon = section.icon
          const selected = active === section.id
          return (
            <Link
              key={section.id}
              to={section.to}
              params={{ formId }}
              aria-current={selected ? 'page' : undefined}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] ${
                selected
                  ? 'bg-white font-medium text-[#141413] shadow-sm'
                  : 'text-[#6c6a64] hover:text-[#141413]'
              }`}
            >
              <Icon size={14} aria-hidden="true" className={selected ? 'text-[#cc785c]' : ''} />
              {section.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
