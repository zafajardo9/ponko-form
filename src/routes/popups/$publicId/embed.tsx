import { createFileRoute, notFound } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { getPopupEmbed, getPopupPreview } from '../../../lib/server-fns/popups'
import { PopupRuntime } from '../../../components/popup-runtime/PopupRuntime'

export const Route = createFileRoute('/popups/$publicId/embed')({
  validateSearch: (search: Record<string, unknown>) => ({
    preview: search.preview === 'owner' ? 'owner' as const : undefined,
  }),
  loaderDeps: ({ search }) => ({ preview: search.preview }),
  loader: async ({ params, deps }) => {
    const popup = deps.preview === 'owner'
      ? await getPopupPreview({ data: { publicId: params.publicId } })
        .catch(() => getPopupEmbed({ data: { publicId: params.publicId } }))
      : await getPopupEmbed({ data: { publicId: params.publicId } })
    if (!popup) throw notFound()
    return popup
  },
  component: PopupEmbedPage,
})

/**
 * Popup embed content — the iframe body served to host sites.
 *
 * Rendered bare on a transparent canvas so the host page shows through
 * around the popup card. The host-side loader (public/embed/popup-loader.js)
 * owns overlay/positioning/triggers and talks to this page through the
 * postMessage protocol (`ready` / `show` / `click` / `close` / `resize`).
 */
function PopupEmbedPage() {
  const { publicId } = Route.useParams()
  const containerRef = useRef<HTMLDivElement>(null)
  const popup = Route.useLoaderData()

  // Content height may change (e.g. an html element growing) — keep the
  // host iframe sized to the content.
  useEffect(() => {
    if (!popup || typeof window === 'undefined' || window.parent === window) return

    function postHeight() {
      const height = containerRef.current?.scrollHeight ?? document.body.scrollHeight
      window.parent.postMessage({ type: 'ponkoform:resize', popupId: publicId, height }, '*')
    }

    postHeight()
    const observer = new ResizeObserver(postHeight)
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [publicId, popup])

  return (
    <div ref={containerRef} className="w-full bg-transparent">
      <PopupRuntime
        publicId={popup.publicId}
        width={popup.width}
        height={popup.height}
        style={popup.style ?? {}}
        elements={popup.elements ?? []}
        mode="embed"
      />
    </div>
  )
}
