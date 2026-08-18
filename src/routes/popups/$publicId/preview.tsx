import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { MonitorPlay, MousePointerClick, RotateCcw, Timer, ArrowUpFromLine } from 'lucide-react'

export const Route = createFileRoute('/popups/$publicId/preview')({
  component: PopupPreviewPage,
})

/**
 * Popup preview — a mock host site that loads the REAL loader script, so the
 * production path (config fetch → iframe → triggers → stats) is exercised
 * end-to-end. The floating simulator toolbar can fire each trigger type and
 * reset the loader's frequency storage without devtools.
 */
function PopupPreviewPage() {
  const { publicId } = Route.useParams()
  const [scriptReady, setScriptReady] = useState(false)
  const [resetCount, setResetCount] = useState(0)

  // Inject the same <script> tag a creator pastes on their site. Re-inject
  // when the simulator resets so frequency gates re-evaluate cleanly.
  useEffect(() => {
    setScriptReady(false)
    const onReady = (event: Event) => {
      if ((event as CustomEvent).detail?.popupId === publicId) setScriptReady(true)
    }
    const onError = (event: Event) => {
      if ((event as CustomEvent).detail?.popupId === publicId) setScriptReady(false)
    }
    document.addEventListener('ponkoform:popup:loader-ready', onReady)
    document.addEventListener('ponkoform:popup:loader-error', onError)
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-popup-preview="${publicId}"]`,
    )
    if (existing) existing.remove()

    const script = document.createElement('script')
    script.async = true
    script.src = `${window.location.origin}/embed/popup-loader.js`
    script.dataset.popup = publicId
    script.dataset.popupPreview = publicId
    script.dataset.popupOwnerPreview = 'true'
    script.dataset.nonce = String(resetCount)
    script.addEventListener('error', () => setScriptReady(false))
    document.body.appendChild(script)
    return () => {
      document.removeEventListener('ponkoform:popup:loader-ready', onReady)
      document.removeEventListener('ponkoform:popup:loader-error', onError)
      const instances = (window as Window & {
        __ponkoformPopupInstances?: Record<string, { destroy: () => void }>
      }).__ponkoformPopupInstances
      instances?.[publicId]?.destroy()
      script.remove()
    }
  }, [publicId, resetCount])

  function fireTrigger(kind: 'load' | 'exit' | 'scroll') {
    document.dispatchEvent(new CustomEvent('ponkoform:popup:trigger', {
      detail: { popupId: publicId, kind },
    }))
  }

  function resetFrequency() {
    try {
      sessionStorage.removeItem(`ponkoform:popup:${publicId}:session`)
      localStorage.removeItem(`ponkoform:popup:${publicId}:lastShown`)
    } catch { /* storage unavailable — nothing to reset */ }
    setResetCount((count) => count + 1)
  }

  return (
    <main className="min-h-screen bg-[#faf9f5]">
      {/* Trigger simulator */}
      <div className="fixed bottom-4 left-4 z-[100000] flex flex-wrap items-center gap-2 rounded-xl border border-[#e6dfd8] bg-white/95 p-2 shadow-[0_14px_36px_rgba(20,20,19,0.18)] backdrop-blur">
        <span className="flex items-center gap-1.5 pl-1 pr-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8e8b82]">
          <MonitorPlay size={13} aria-hidden="true" />
          Simulator
        </span>
        <SimButton icon={<Timer size={13} aria-hidden="true" />} label="On load" onClick={() => fireTrigger('load')} />
        <SimButton icon={<ArrowUpFromLine size={13} aria-hidden="true" />} label="Exit intent" onClick={() => fireTrigger('exit')} />
        <SimButton icon={<MousePointerClick size={13} aria-hidden="true" />} label="Scroll" onClick={() => fireTrigger('scroll')} />
        <SimButton icon={<RotateCcw size={13} aria-hidden="true" />} label="Reset" onClick={resetFrequency} />
        <span className="pr-1 text-[11px] text-[#8e8b82]" role="status">
          {scriptReady ? 'Loader active' : 'Loading…'}
        </span>
      </div>

      {/* Mock host site — enough height to make scroll triggers meaningful */}
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#a9583e]">Preview host page</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[#141413]">
          This is a stand-in for your website.
        </h1>
        <p className="mt-4 text-base leading-7 text-[#6c6a64]">
          The popup you are previewing loads here exactly the way it will on your own
          site — same loader script, same triggers, same stats. Scroll, leave toward
          the top of the tab, or use the simulator in the corner to fire a trigger.
        </p>
        <div className="mt-10 space-y-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="rounded-xl border border-[#e6dfd8] bg-white p-5">
              <h2 className="text-sm font-semibold text-[#141413]">Sample section {index + 1}</h2>
              <p className="mt-2 text-sm leading-6 text-[#6c6a64]">
                Placeholder content so the page is tall enough to test the
                scroll-depth trigger at any percentage.
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

function SimButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e6dfd8] bg-[#faf9f5] px-2.5 text-xs font-medium text-[#3d3d3a] transition-colors hover:border-[#cc785c]/50 hover:bg-[#fffaf7] hover:text-[#a9583e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]"
    >
      {icon}
      {label}
    </button>
  )
}
