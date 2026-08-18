import { Link } from '@tanstack/react-router'
import { Code2, Eye, MessageSquareDot, MousePointerClick, Pencil, Trash2 } from 'lucide-react'

/** Dashboard list card for a popup — stats, status, and row actions. */
export function PopupCard({
  popup,
  onEmbed,
  onTogglePublish,
  onDelete,
}: {
  popup: {
    id: number
    publicId: string
    title: string
    status: 'draft' | 'published'
    placement: string
    triggerType: string
    viewCount: number
    clickCount: number
  }
  onEmbed: () => void
  onTogglePublish: (published: boolean) => void
  onDelete: () => void
}) {
  const published = popup.status === 'published'
  const ctr = popup.viewCount > 0 ? Math.round((popup.clickCount / popup.viewCount) * 1000) / 10 : 0

  return (
    <article className="flex flex-col rounded-xl border border-[#e4ddd3] bg-white p-5 shadow-[0_2px_10px_rgba(36,35,32,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f5ece4] text-[#cc785c]">
            <MessageSquareDot size={19} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-[#141413]">{popup.title}</h3>
            <p className="mt-0.5 text-xs capitalize text-[#8e8b82]">
              {popup.triggerType} · {popup.placement.replace('-', ' ')}
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            published ? 'bg-[#eaf4ec] text-[#3f7048]' : 'bg-[#f1ecfd] text-[#6d4fc9]'
          }`}
        >
          {published ? 'Published' : 'Draft'}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 rounded-lg border border-[#efe9de] bg-[#faf9f5] px-3 py-2.5 text-center">
        <div>
          <dt className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8e8b82]">
            <Eye size={11} aria-hidden="true" /> Views
          </dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-[#141413]">{popup.viewCount}</dd>
        </div>
        <div>
          <dt className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8e8b82]">
            <MousePointerClick size={11} aria-hidden="true" /> Clicks
          </dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-[#141413]">{popup.clickCount}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8e8b82]">CTR</dt>
          <dd className="mt-0.5 text-sm font-semibold tabular-nums text-[#141413]">{ctr}%</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link
          to="/popups/$popupId/edit"
          params={{ popupId: String(popup.id) }}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#e6dfd8] bg-[#faf9f5] px-3 text-xs font-medium text-[#3d3d3a] transition-colors hover:border-[#cc785c]/50 hover:text-[#a9583e]"
        >
          <Pencil size={13} aria-hidden="true" /> Edit
        </Link>
        <button
          type="button"
          onClick={onEmbed}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#e6dfd8] bg-[#faf9f5] px-3 text-xs font-medium text-[#3d3d3a] transition-colors hover:border-[#cc785c]/50 hover:text-[#a9583e]"
        >
          <Code2 size={13} aria-hidden="true" /> Embed
        </button>
        <button
          type="button"
          onClick={() => onTogglePublish(!published)}
          className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] ${
            published
              ? 'border border-[#e6dfd8] bg-[#faf9f5] text-[#3d3d3a] hover:border-[#cc785c]/50 hover:text-[#a9583e]'
              : 'bg-[#cc785c] text-white hover:bg-[#a9583e]'
          }`}
        >
          {published ? 'Unpublish' : 'Publish'}
        </button>
        <span className="grow" />
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${popup.title}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#b33e35] transition-colors hover:bg-[#fdf0f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c64545]"
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>
    </article>
  )
}
