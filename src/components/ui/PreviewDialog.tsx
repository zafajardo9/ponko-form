import { useEffect, useId, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { useTransitionClose } from './useTransitionClose'

/**
 * PreviewDialog
 *
 * A full-screen modal overlay for previewing a form or flow.
 * Replaces the inline preview toggle in both the Form Builder and Flow Builder.
 * Renders a centered card on a darkened backdrop with a close button.
 */
interface PreviewDialogProps {
  title: string
  children: ReactNode
  onClose: () => void
}

export function PreviewDialog({ title, children, onClose }: PreviewDialogProps) {
  const titleId = useId()
  const { requestClose, transitionClass } = useTransitionClose(onClose)

  // Close on Escape.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') requestClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [requestClose])

  // Close on backdrop click.
  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) requestClose()
  }

  return (
    <div
      className={`t-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-2 backdrop-blur-[2px] sm:p-4 ${transitionClass}`}
      onClick={handleBackdrop}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`t-modal flex max-h-[calc(100dvh-1rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-white/60 bg-[#f5f0e8] shadow-[0_24px_80px_rgba(20,20,19,0.24)] sm:max-h-[90vh] ${transitionClass}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e6dfd8] bg-[#faf9f5] px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8e8b82]">
              Form preview
            </span>
            <span
              id={titleId}
              className="mt-0.5 block truncate text-sm font-semibold text-[#141413]"
            >
              {title}
            </span>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#8e8b82] transition-colors hover:bg-[#e8e0d2] hover:text-[#141413] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]"
            aria-label="Close preview"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  )
}
