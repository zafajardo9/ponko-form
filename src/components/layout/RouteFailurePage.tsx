import { Link } from '@tanstack/react-router'
import { ArrowRight, RefreshCw } from 'lucide-react'
import { appConfig } from '../../utils/app-config'

import type { ErrorComponentProps } from '@tanstack/react-router'

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas'

type FailurePageProps =
  | { kind: 'not-found' }
  | { kind: 'error'; onRetry: () => void }

export function RouteFailurePage(props: FailurePageProps) {
  const isNotFound = props.kind === 'not-found'

  return (
    <main className="min-h-[calc(100vh-4rem)] overflow-hidden bg-canvas">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-12 px-6 py-14 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.78fr)] lg:py-20">
        <section aria-labelledby="route-failure-title" className="max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
            {isNotFound ? 'Page not found' : 'Something interrupted the page'}
          </p>
          <h1
            id="route-failure-title"
            className="mt-5 font-[var(--font-display)] text-5xl font-normal leading-[1.04] tracking-[-0.025em] text-ink sm:text-6xl"
          >
            {isNotFound
              ? 'This page is no longer on the form.'
              : 'Your work is still here. The page just needs another try.'}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
            {isNotFound
              ? `The address may be outdated or incomplete. Return to ${appConfig.name}, or use the documentation to find the workflow you need.`
              : 'A temporary application error stopped this view from loading. Try the page again; if it keeps happening, return home and reopen your workspace.'}
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            {!isNotFound && (
              <button
                type="button"
                onClick={props.onRetry}
                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-active ${focusRing}`}
              >
                <RefreshCw size={16} aria-hidden="true" />
                Try this page again
              </button>
            )}
            <Link
              to="/"
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-hairline bg-canvas px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-surface-soft ${focusRing}`}
            >
              Go to homepage
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            {isNotFound && (
              <Link
                to="/docs"
                className={`inline-flex min-h-11 items-center justify-center rounded-md border border-hairline bg-surface-soft px-5 py-3 text-sm font-medium text-ink transition-colors hover:bg-surface-cream-strong ${focusRing}`}
              >
                Browse documentation
              </Link>
            )}
          </div>
        </section>

        <FailureIllustration kind={props.kind} />
      </div>
    </main>
  )
}

function FailureIllustration({ kind }: { kind: FailurePageProps['kind'] }) {
  const isNotFound = kind === 'not-found'

  return (
    <div className="relative mx-auto w-full max-w-md py-8" aria-hidden="true">
      <div className="absolute inset-x-10 bottom-1 h-16 rounded-[50%] bg-surface-cream-strong/65 blur-2xl" />
      <div className="-rotate-3 rounded-xl border border-hairline bg-surface-card p-4 shadow-[0_24px_60px_rgba(37,35,32,0.08)]">
        <div className="rounded-lg border border-hairline bg-canvas p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-white">
                P
              </span>
              <span className="text-sm font-medium text-ink">Untitled form</span>
            </div>
            <span className="rounded-full bg-surface-soft px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-soft">
              Draft
            </span>
          </div>

          <div className="mt-9 h-3 w-2/3 rounded-full bg-ink/10" />
          <div className="mt-3 h-2 w-5/6 rounded-full bg-ink/[0.06]" />
          <div className="mt-2 h-2 w-1/2 rounded-full bg-ink/[0.06]" />

          <div className="mt-8 rounded-lg border border-dashed border-primary/50 bg-primary/[0.04] px-5 py-7 text-center">
            <span className="font-[var(--font-display)] text-6xl font-normal leading-none text-primary sm:text-7xl">
              {isNotFound ? '404' : '!'}
            </span>
            <div className="mx-auto mt-4 h-2 w-24 rounded-full bg-primary/15" />
          </div>

          <div className="mt-7 flex items-center justify-between border-t border-hairline pt-5">
            <div className="h-2 w-20 rounded-full bg-ink/[0.06]" />
            <div className="h-8 w-24 rounded-md bg-primary/20" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function RootNotFoundPage() {
  return <RouteFailurePage kind="not-found" />
}

export function RootErrorPage({ reset }: ErrorComponentProps) {
  return <RouteFailurePage kind="error" onRetry={reset} />
}
