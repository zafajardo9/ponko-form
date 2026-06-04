import { useState } from 'react'

interface ShareDialogProps {
  formId: number
  title: string
  onClose: () => void
}

type Tab = 'link' | 'embed'

/**
 * ShareDialog
 *
 * Surfaces the two ways a creator can make a published form accessible:
 *   1. Link  — a clean, navigation-free shareable page (/forms/submit/:id)
 *   2. Embed — a responsive <iframe> snippet that fills its host container and
 *              auto-resizes to fit the form's content (/forms/embed/:id)
 */
export function ShareDialog({ formId, title, onClose }: ShareDialogProps) {
  const [tab, setTab] = useState<Tab>('link')
  const [copied, setCopied] = useState<string | null>(null)

  const origin =
    typeof window !== 'undefined' ? window.location.origin : ''
  const shareUrl = `${origin}/forms/submit/${formId}`
  const embedUrl = `${origin}/forms/embed/${formId}`

  // Responsive iframe + a tiny listener that resizes it to the form's content
  // height (the embed page posts its height via postMessage).
  const embedCode = `<iframe
  src="${embedUrl}"
  title="${title.replace(/"/g, '&quot;')}"
  style="width:100%;border:none;overflow:hidden;"
  width="100%"
  height="600"
  loading="lazy"
></iframe>
<script>
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "ponkoform:resize" && e.data.formId === ${formId}) {
      var f = document.querySelector('iframe[src="${embedUrl}"]');
      if (f) f.style.height = e.data.height + "px";
    }
  });
</script>`

  function copy(value: string, key: string) {
    navigator.clipboard?.writeText(value)
    setCopied(key)
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000)
  }

  function handleBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={handleBackdrop}
    >
      <div className="flex w-full max-w-lg flex-col rounded-xl bg-[#f5f0e8] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between rounded-t-xl bg-[#faf9f5] border-b border-[#e6dfd8] px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-[#8e8b82]">
              Share —
            </span>
            <span className="text-sm font-medium text-[#141413]">{title}</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#8e8b82] hover:bg-[#e8e0d2] hover:text-[#141413] transition-colors"
            aria-label="Close share dialog"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[#e6dfd8] px-6 pt-4">
          <TabButton active={tab === 'link'} onClick={() => setTab('link')}>
            Share link
          </TabButton>
          <TabButton active={tab === 'embed'} onClick={() => setTab('embed')}>
            Embed
          </TabButton>
        </div>

        {/* Body */}
        <div className="p-6">
          {tab === 'link' ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-[#6c6a64]">
                A clean, full-page form with no app navigation. Anyone with the
                link can view and submit it.
              </p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 rounded-md border border-[#e6dfd8] bg-white px-3 py-2 text-sm text-[#141413]"
                />
                <button
                  onClick={() => copy(shareUrl, 'link')}
                  className="inline-flex h-9 items-center rounded-md bg-[#cc785c] px-4 text-sm font-medium text-white transition-colors hover:bg-[#a9583e]"
                >
                  {copied === 'link' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#cc785c] hover:text-[#a9583e] underline"
              >
                Open in new tab ↗
              </a>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-[#6c6a64]">
                Paste this snippet into any site. The form is responsive — it
                fills the container it's placed in and auto-resizes to fit its
                content.
              </p>
              <textarea
                readOnly
                value={embedCode}
                onFocus={(e) => e.currentTarget.select()}
                rows={10}
                className="w-full resize-none rounded-md border border-[#e6dfd8] bg-white px-3 py-2 font-mono text-xs leading-relaxed text-[#141413]"
              />
              <button
                onClick={() => copy(embedCode, 'embed')}
                className="inline-flex h-9 w-fit items-center rounded-md bg-[#cc785c] px-4 text-sm font-medium text-white transition-colors hover:bg-[#a9583e]"
              >
                {copied === 'embed' ? 'Copied!' : 'Copy embed code'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
        active
          ? 'border-[#cc785c] font-medium text-[#141413]'
          : 'border-transparent text-[#6c6a64] hover:text-[#141413]'
      }`}
    >
      {children}
    </button>
  )
}
