import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Check, Code2, Copy, ExternalLink, X } from 'lucide-react'

/**
 * SharePopupDialog — the copy-paste embed snippet modal for a popup
 * (mirrors ShareDialog's role for forms). The snippet is only useful once
 * the popup is published, so the copy action is gated on status.
 */
export function SharePopupDialog({
  publicId,
  title,
  published,
  onClose,
}: {
  publicId: string
  title: string
  published: boolean
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ponkoform.com'
  const snippet = `<script async src="${origin}/embed/popup-loader.js" data-popup="${publicId}" data-popup-wordpress-admin-test="true"></script>`

  function copySnippet() {
    navigator.clipboard?.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleBackdrop(event: React.MouseEvent) {
    if (event.target === event.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={handleBackdrop}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Embed popup ${title}`}
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-white/70 bg-[#f5f0e8] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#e6dfd8] bg-[#faf9f5] px-5 py-3.5 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#8e8b82]">
              Embed popup
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-[#141413]">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close embed dialog"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#8e8b82] transition-colors hover:bg-[#e8e0d2] hover:text-[#141413] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 sm:p-6">
          {!published ? (
            <div className="rounded-lg border border-[#d7a84c] bg-[#fff8e7] p-4 text-sm text-[#6b4f16]">
              Publish this popup first — the snippet only shows the popup on
              your site once it&apos;s live.
            </div>
          ) : null}

          <p className="text-sm text-[#6c6a64]">
            Paste this snippet anywhere on your site — WordPress (Appearance →
            Custom HTML, or an Elementor HTML widget), Wix, Webflow, or plain
            HTML. The popup appears on the trigger you configured.
          </p>

          <p className="mt-3 rounded-lg border border-[#d7a84c] bg-[#fff8e7] px-3 py-2 text-xs leading-5 text-[#6b4f16]">
            WordPress safeguard is on: while you are logged in, popup views,
            clicks, form responses, payments, and notifications are test-only.
          </p>

          <div className="relative mt-3">
            <textarea
              readOnly
              value={snippet}
              onFocus={(event) => event.currentTarget.select()}
              rows={3}
              className="w-full resize-none rounded-md border border-[#e6dfd8] bg-white px-3 py-2 pr-24 font-mono text-xs leading-relaxed text-[#141413]"
            />
            <button
              type="button"
              onClick={copySnippet}
              disabled={!published}
              className="absolute right-2 top-2 inline-flex h-7 items-center gap-1.5 rounded-md border border-[#e6dfd8] bg-white/95 px-2.5 text-xs font-medium text-[#5f5b55] shadow-sm transition-colors hover:border-[#cc785c]/50 hover:text-[#a9583e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-2 text-sm">
            <Link
              to="/popups/$publicId/preview"
              params={{ publicId }}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#cc785c] hover:text-[#a9583e]"
            >
              <ExternalLink size={12} aria-hidden="true" />
              Open live preview (tests the real loader)
            </Link>
            <p className="flex items-start gap-1.5 text-xs leading-5 text-[#8e8b82]">
              <Code2 size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
              One snippet per popup. If your site uses a strict CSP, allow this
              origin in <code>script-src</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
