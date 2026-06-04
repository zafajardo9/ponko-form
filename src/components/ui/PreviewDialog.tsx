import { useEffect, type ReactNode } from 'react'

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
  // Close on Escape.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Close on backdrop click.
  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={handleBackdrop}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-[#f5f0e8] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between rounded-t-xl bg-[#faf9f5] border-b border-[#e6dfd8] px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-[#8e8b82]">Preview —</span>
            <span className="text-sm font-medium text-[#141413]">{title}</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#8e8b82] hover:bg-[#e8e0d2] hover:text-[#141413] transition-colors"
            aria-label="Close preview"
          >
            ✕
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>
  )
}
