import { useEffect, type ReactNode } from 'react'
import { Button } from '../ui/Button'
import { ChevronRight, X } from 'lucide-react'

export const inputClass =
  'h-10 w-full rounded-md border border-[#e6dfd8] bg-[#faf9f5] px-3 py-2 text-sm text-[#141413] outline-none focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/20'

export function FieldGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-[#141413]">{label}</span>
      {children}
    </div>
  )
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-[#141413]">{label}</span>
      {children}
      {hint && <span className="text-xs leading-5 text-[#8e8b82]">{hint}</span>}
    </label>
  )
}

export function FieldDialog({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string
  subtitle: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-0 backdrop-blur-[2px] sm:p-4"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="field-dialog-title"
        className={`flex h-full max-h-none w-full flex-col bg-[#f5f0e8] shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-2xl ${
          wide ? 'sm:max-w-6xl' : 'sm:max-w-3xl'
        }`}
      >
        <div className="flex items-center justify-between border-b border-[#e6dfd8] bg-[#faf9f5] px-4 py-3 sm:rounded-t-2xl sm:px-5">
          <div>
            <p className="text-xs font-medium uppercase text-[#8e8b82]">{subtitle}</p>
            <h2 id="field-dialog-title" className="mt-1 text-lg font-medium text-[#141413]">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#8e8b82] hover:bg-[#e8e0d2] hover:text-[#141413]"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className={`flex-1 overflow-y-auto ${wide ? 'p-0' : 'p-4 sm:p-5'}`}>{children}</div>
        <div className="flex justify-end border-t border-[#e6dfd8] bg-[#faf9f5] px-4 py-3 sm:rounded-b-2xl sm:px-5">
          <Button type="button" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}

export function SettingsSection({
  title,
  description,
  icon,
  children,
}: {
  title: string
  description: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#e6dfd8] bg-white">
      <div className="flex items-start gap-3 border-b border-[#ebe6df] bg-[#f5f0e8] px-4 py-3">
        <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-md bg-white text-[#cc785c]">
          {icon}
        </span>
        <div>
          <h4 className="text-sm font-medium text-[#141413]">{title}</h4>
          <p className="mt-0.5 text-xs leading-5 text-[#8e8b82]">{description}</p>
        </div>
      </div>
      <div className="flex flex-col gap-4 p-4">{children}</div>
    </section>
  )
}

export function SettingsAction({
  title,
  description,
  status,
  onClick,
}: {
  title: string
  description: string
  status: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-3 text-left transition-colors hover:border-[#cc785c]/70 hover:bg-[#f5f0e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]/30"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-[#141413]">{title}</span>
          <span className="rounded bg-white px-2 py-0.5 text-xs text-[#6c6a64]">{status}</span>
        </div>
        <p className="mt-1 text-xs leading-5 text-[#8e8b82]">{description}</p>
      </div>
      <ChevronRight size={16} className="flex-none text-[#8e8b82] transition-transform group-hover:translate-x-0.5 group-hover:text-[#cc785c]" />
    </button>
  )
}

export function SettingsToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-3 transition-colors hover:border-[#cc785c]/60">
      <span>
        <span className="block text-sm font-medium text-[#141413]">{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-[#8e8b82]">{description}</span>
      </span>
      <span className="relative mt-0.5 inline-flex flex-none">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span className="h-6 w-11 rounded-full bg-[#d8cec3] transition-colors peer-checked:bg-[#cc785c] peer-focus-visible:ring-2 peer-focus-visible:ring-[#cc785c]/30 peer-focus-visible:ring-offset-2" />
        <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  )
}
