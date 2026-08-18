import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ArrowLeft, MessageSquareDot, Plus } from 'lucide-react'
import { requireAuth } from '@/lib/server-fns/auth'
import {
  createPopup,
  deletePopup,
  getPopups,
  setPopupStatus,
} from '@/lib/server-fns/popups'
import { PopupCard } from '@/components/popup-builder/PopupCard'
import { SharePopupDialog } from '@/components/popup-builder/SharePopupDialog'
import { Button, navigationBackIconClass, navigationButtonClass } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'

export const Route = createFileRoute('/popups/')({
  beforeLoad: ({ location }) => requireAuth({ data: { returnTo: location.href } }),
  component: PopupsPage,
})

function PopupsPage() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [createOpen, setCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [embedTarget, setEmbedTarget] = useState<{ publicId: string; title: string; published: boolean } | null>(null)

  const { data: popups, isLoading, isError, refetch } = useQuery({
    queryKey: ['popups'],
    queryFn: () => getPopups(),
  })

  const createMutation = useMutation({
    mutationFn: createPopup,
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ['popups'] })
      setCreateOpen(false)
      setNewTitle('')
      // Jump straight into the builder with the seeded layout.
      window.location.assign(`/popups/${created.id}/edit`)
    },
  })

  const toggleMutation = useMutation({
    mutationFn: (data: { id: number; status: 'draft' | 'published' }) => setPopupStatus({ data }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['popups'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deletePopup({ data: { id } }),
    onSuccess: async () => {
      toast.success('Popup deleted')
      await queryClient.invalidateQueries({ queryKey: ['popups'] })
    },
  })

  const totalViews = popups?.reduce((total, popup) => total + popup.viewCount, 0) ?? 0
  const totalClicks = popups?.reduce((total, popup) => total + popup.clickCount, 0) ?? 0

  return (
    <main className="t-popup-page t-popup-page-list min-h-full bg-[#f7f4ef]">
      <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
        <Link to="/dashboard" className={navigationButtonClass}>
          <ArrowLeft size={15} className={navigationBackIconClass} aria-hidden="true" />
          Dashboard
        </Link>

        <header className="mt-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#a9583e]">
              <MessageSquareDot size={16} aria-hidden="true" />
              <p className="text-xs font-semibold uppercase tracking-[0.13em]">Capture more leads</p>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[#242320] sm:text-[2.6rem]">
              Popups
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6c6962] sm:text-base">
              Design a popup on a free canvas, choose when it appears, and embed
              it on any website with one snippet. Point its button at any form
              you already have.
            </p>
          </div>
          <Button type="button" onClick={() => setCreateOpen(true)} className="h-11 shrink-0 gap-2 self-start rounded-lg px-5 sm:self-auto">
            <Plus size={17} aria-hidden="true" />
            New popup
          </Button>
        </header>

        {popups && popups.length > 0 ? (
          <section className="mt-8 grid grid-cols-3 rounded-xl border border-[#e4ddd3] bg-white py-3 text-center">
            <HeaderStat value={popups.length} label="Popups" />
            <HeaderStat value={totalViews} label="Views" />
            <HeaderStat value={totalClicks} label="Clicks" />
          </section>
        ) : null}

        <div className="mb-4 mt-9 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[#242320]">Your popups</h2>
            <p className="mt-1 text-sm text-[#77736c]">Build, publish, and measure each popup.</p>
          </div>
          {popups && popups.length > 0 ? (
            <span className="rounded-full border border-[#ded8cf] bg-white px-3 py-1 text-xs font-medium text-[#77736c]">
              {popups.length} {popups.length === 1 ? 'popup' : 'popups'}
            </span>
          ) : null}
        </div>

        {isLoading ? (
          <div role="status" aria-label="Loading popups" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-56 animate-pulse rounded-xl border border-[#e4ddd3] bg-white motion-reduce:animate-none" />
            ))}
          </div>
        ) : isError ? (
          <div role="alert" className="rounded-xl border border-[#d7a84c] bg-[#fff8e7] p-6 text-[#6b4f16]">
            <h2 className="font-semibold text-[#242320]">Popups couldn&apos;t be loaded</h2>
            <p className="mt-1 text-sm">Check your connection and try loading this list again.</p>
            <Button type="button" variant="secondary" className="mt-4" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : !popups || popups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#cfc6ba] bg-white px-6 py-14 text-center sm:py-16">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#f5eee8] text-[#a9583e]">
              <MessageSquareDot size={22} aria-hidden="true" />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-[#242320]">Create your first popup</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6c6962]">
              Start from a starter layout — a headline, a supporting line, and a
              button you can point at any form link.
            </p>
            <Button type="button" className="mt-6 gap-2" onClick={() => setCreateOpen(true)}>
              <Plus size={16} aria-hidden="true" />
              New popup
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {popups.map((popup) => (
              <PopupCard
                key={popup.id}
                popup={{
                  id: popup.id,
                  publicId: popup.publicId,
                  title: popup.title,
                  status: popup.status,
                  placement: popup.placement,
                  triggerType: popup.trigger.type.replace('-', ' '),
                  viewCount: popup.viewCount,
                  clickCount: popup.clickCount,
                }}
                onEmbed={() => setEmbedTarget({
                  publicId: popup.publicId,
                  title: popup.title,
                  published: popup.status === 'published',
                })}
                onTogglePublish={(published) => toggleMutation.mutate({
                  id: popup.id,
                  status: published ? 'published' : 'draft',
                })}
                onDelete={() => {
                  if (confirm(`Delete "${popup.title}"? This cannot be undone.`)) {
                    deleteMutation.mutate(popup.id)
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      {createOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) setCreateOpen(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="New popup"
            className="w-full max-w-md rounded-xl border border-[#e6dfd8] bg-white p-6 shadow-2xl"
          >
            <h2 className="text-lg font-semibold text-[#141413]">New popup</h2>
            <p className="mt-1 text-sm text-[#6c6a64]">
              Give it a name — you can change everything else in the builder.
            </p>
            <form
              className="mt-4"
              onSubmit={(event) => {
                event.preventDefault()
                if (newTitle.trim()) createMutation.mutate({ data: { title: newTitle } })
              }}
            >
              <input
                autoFocus
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="e.g. Newsletter signup"
                maxLength={255}
                className="h-10 w-full rounded-md border border-[#dedbd5] bg-white px-3 text-sm outline-none focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/15"
              />
              {createMutation.isError ? (
                <p className="mt-2 text-sm text-[#c64545]">
                  {(createMutation.error as Error).message}
                </p>
              ) : null}
              <div className="mt-4 flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!newTitle.trim() || createMutation.isPending}>
                  {createMutation.isPending ? 'Creating…' : 'Create popup'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {embedTarget ? (
        <SharePopupDialog
          publicId={embedTarget.publicId}
          title={embedTarget.title}
          published={embedTarget.published}
          onClose={() => setEmbedTarget(null)}
        />
      ) : null}
    </main>
  )
}

function HeaderStat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-lg font-semibold tabular-nums text-[#242320]">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#77736c]">{label}</p>
    </div>
  )
}
