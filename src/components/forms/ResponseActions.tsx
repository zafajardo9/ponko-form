import { useEffect } from 'react'
import { Archive, Eye, RotateCcw, Trash2, X } from 'lucide-react'

export function ResponseRowActions({
  archived,
  busy,
  onView,
  onArchive,
  onRestore,
  onDelete,
}: {
  archived: boolean
  busy: boolean
  onView: () => void
  onArchive: () => void
  onRestore: () => void
  onDelete: () => void
}) {
  const buttonClass =
    'inline-flex h-8 w-8 items-center justify-center rounded-md text-[#6c6a64] transition-colors hover:bg-[#efe9de] hover:text-[#141413] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div
      className="inline-flex items-center justify-end gap-1"
      onClick={(event) => event.stopPropagation()}
    >
      <button type="button" className={buttonClass} onClick={onView} aria-label="View response" title="View response">
        <Eye size={15} aria-hidden="true" />
      </button>
      {archived ? (
        <button type="button" className={buttonClass} onClick={onRestore} disabled={busy} aria-label="Restore response" title="Restore response">
          <RotateCcw size={15} aria-hidden="true" />
        </button>
      ) : (
        <button type="button" className={buttonClass} onClick={onArchive} disabled={busy} aria-label="Archive response" title="Archive response">
          <Archive size={15} aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        className={`${buttonClass} hover:bg-[#fbeaea] hover:text-[#a33f32]`}
        onClick={onDelete}
        disabled={busy}
        aria-label="Delete response"
        title="Delete response"
      >
        <Trash2 size={15} aria-hidden="true" />
      </button>
    </div>
  )
}

export function ResponseActionDialog({
  kind,
  number,
  busy,
  onCancel,
  onConfirm,
}: {
  kind: 'archive' | 'delete'
  number: number
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const deleting = kind === 'delete'

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [busy, onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[1px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel()
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="response-action-title"
        aria-describedby="response-action-description"
        className="w-full max-w-md rounded-xl border border-[#e6dfd8] bg-[#faf9f5] p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full ${deleting ? 'bg-[#fbeaea] text-[#a33f32]' : 'bg-[#efe9de] text-[#a9583e]'}`}>
              {deleting ? <Trash2 size={18} aria-hidden="true" /> : <Archive size={18} aria-hidden="true" />}
            </div>
            <h2 id="response-action-title" className="text-lg font-medium text-[#141413]">
              {deleting ? `Delete response #${number}?` : `Archive response #${number}?`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close confirmation"
            className="rounded-md p-1 text-[#8e8b82] hover:bg-[#efe9de] hover:text-[#141413] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] disabled:opacity-40"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <p id="response-action-description" className="mt-2 text-sm leading-6 text-[#6c6a64]">
          {deleting
            ? 'This permanently removes the response and cannot be undone. Payment transactions remain available in Payments for financial recordkeeping.'
            : 'This moves the response out of the active list. You can restore it later from Archived responses.'}
        </p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-[#e6dfd8] px-4 py-2 text-sm font-medium text-[#141413] hover:bg-[#f5f0e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] disabled:opacity-40"
          >
            Keep response
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              deleting
                ? 'bg-[#a33f32] hover:bg-[#843228] focus-visible:ring-[#a33f32]'
                : 'bg-[#141413] hover:bg-[#2b2b28] focus-visible:ring-[#cc785c]'
            }`}
          >
            {busy ? 'Working…' : deleting ? 'Delete permanently' : 'Archive response'}
          </button>
        </div>
      </div>
    </div>
  )
}
