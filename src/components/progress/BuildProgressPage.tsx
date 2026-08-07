import { Link } from '@tanstack/react-router'
import { Check, Circle, Clock3, Home, Sparkles, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { BUILD_MILESTONES, milestoneProgress } from '../../lib/build-progress'
import type { BuildMilestone } from '../../lib/build-progress'
import LiquidEther from '../LiquidEther'
import { ProgressScene } from './ProgressScene'

const LIQUID_PALETTE = ['#4b1f19', '#8f4435', '#cc785c', '#efc0ab']

export function BuildProgressPage() {
  const progress = milestoneProgress()
  const initialId = progress.nextUp?.id ?? BUILD_MILESTONES.at(-1)?.id ?? null
  const [selectedId, setSelectedId] = useState<string | null>(initialId)
  const [reducedMotion, setReducedMotion] = useState(false)
  const displayedId = selectedId ?? progress.nextUp?.id ?? BUILD_MILESTONES[0].id
  const selectedIndex = Math.max(
    0,
    BUILD_MILESTONES.findIndex((milestone) => milestone.id === displayedId),
  )
  const displayed = BUILD_MILESTONES[selectedIndex] ?? progress.nextUp ?? BUILD_MILESTONES[0]
  const percent = Math.round((progress.completed / progress.total) * 100)

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    setReducedMotion(Boolean(media?.matches))
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches)
    media?.addEventListener?.('change', onChange)
    return () => media?.removeEventListener?.('change', onChange)
  }, [])

  return (
    <section className="progress-page relative min-h-[100svh] overflow-hidden bg-surface-dark text-on-dark">
      {reducedMotion ? (
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(80%_65%_at_52%_38%,rgba(169,88,62,0.2),transparent_68%)]" />
      ) : (
        <div className="absolute inset-0 opacity-75" aria-hidden="true">
          <LiquidEther
            colors={LIQUID_PALETTE}
            resolution={0.34}
            mouseForce={12}
            cursorSize={120}
            autoSpeed={0.24}
            autoIntensity={1.15}
            autoResumeDelay={1800}
            autoRampDuration={1}
          />
        </div>
      )}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(100%_86%_at_42%_38%,rgba(24,23,21,0.08),rgba(24,23,21,0.48)_58%,rgba(24,23,21,0.86)_100%)]" />
      <div aria-hidden="true" className="progress-grid pointer-events-none absolute inset-0 opacity-40" />

      <Link
        to="/"
        aria-label="Go to home"
        className="absolute left-4 top-4 z-30 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/20 text-on-dark-soft backdrop-blur-md transition-[color,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:text-on-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:left-6 sm:top-6"
      >
        <Home size={18} aria-hidden="true" />
      </Link>

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-[1440px] flex-col px-4 pb-8 pt-16 sm:px-6 sm:pt-12 lg:px-8 lg:pb-10">
        <header className="mx-auto w-full max-w-3xl text-center">
          <p className="hero-enter hero-enter-one inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
            <Sparkles size={13} aria-hidden="true" />
            Build progress
          </p>
          <h1 className="hero-enter hero-enter-two mt-3 font-[var(--font-display)] text-4xl font-normal leading-[0.98] tracking-[-0.035em] text-on-dark sm:text-5xl lg:text-[3.65rem]">
            Where PonkoForm is right now
          </h1>
          <p className="hero-enter hero-enter-three mx-auto mt-3 max-w-2xl text-sm leading-6 text-on-dark-soft sm:text-base">
            Follow the product from its first foundation to what we are building next.
            Select any point to open that chapter.
          </p>
        </header>

        <div className="mt-7 grid flex-1 items-center gap-7 lg:grid-cols-[minmax(0,1fr)_390px] lg:gap-10">
          <div className="min-w-0">
            <div className="hero-enter hero-enter-four mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-3">
                <span className="font-[var(--font-display)] text-4xl leading-none text-primary">{progress.completed}</span>
                <span className="text-xs leading-4 text-on-dark-soft">
                  of {progress.total}<br />milestones shipped
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/15 px-3 py-2 text-xs text-on-dark-soft backdrop-blur-md">
                <span className="inline-flex h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                Next up: <strong className="font-medium text-on-dark">{progress.nextUp?.title}</strong>
              </div>
              <div className="min-w-[132px] text-right">
                <div className="mb-1.5 flex justify-between text-[10px] font-medium uppercase tracking-[0.12em] text-on-dark-soft">
                  <span>Journey</span><span>{percent}%</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                </div>
              </div>
            </div>

            <DnaTimeline selectedId={displayed.id} onSelect={setSelectedId} />
          </div>

          <aside className="hidden lg:block" aria-label="Selected milestone details">
            <MilestoneCardStack milestone={displayed} selectedIndex={selectedIndex} />
          </aside>
        </div>
      </div>

      {selectedId ? (
        <MobileDetails milestone={displayed} selectedIndex={selectedIndex} onClose={() => setSelectedId(null)} />
      ) : null}
    </section>
  )
}

function DnaTimeline({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  return (
    <div className="hero-enter hero-enter-five relative h-[320px] min-h-0 sm:h-[390px] lg:h-[430px]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-[12%] top-1/2 h-24 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
      <ProgressScene milestones={BUILD_MILESTONES} selectedId={selectedId} onSelect={onSelect} />
      <div className="pointer-events-none absolute inset-x-2 bottom-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.13em] text-on-dark-soft sm:bottom-3">
        <span>First build · May 2026</span>
        <span className="flex items-center gap-2 text-on-dark">
          <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_0_4px_rgba(204,120,92,.13)]" />
          Click a point to explore
        </span>
        <span>What comes next</span>
      </div>
      <ol className="sr-only">
        {BUILD_MILESTONES.map((milestone) => (
          <li key={milestone.id}>
            <button
              type="button"
              onClick={() => onSelect(milestone.id)}
              aria-pressed={milestone.id === selectedId}
              aria-label={`${milestone.title} — ${milestone.status ? 'completed' : 'upcoming'}`}
            >
              {milestone.title}
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

function MilestoneCardStack({ milestone, selectedIndex, onClose }: { milestone: BuildMilestone; selectedIndex: number; onClose?: () => void }) {
  const previousIndex = useRef(selectedIndex)
  const direction = selectedIndex >= previousIndex.current ? 'forward' : 'backward'
  useEffect(() => { previousIndex.current = selectedIndex }, [selectedIndex])

  return (
    <div className="milestone-card-stack" data-direction={direction}>
      <div className="milestone-card-back milestone-card-back-two" aria-hidden="true" />
      <div className="milestone-card-back milestone-card-back-one" aria-hidden="true" />
      <div key={milestone.id} className="milestone-card-top progress-card-enter">
        <MilestoneCard milestone={milestone} index={selectedIndex} onClose={onClose} />
      </div>
    </div>
  )
}

function MilestoneCard({ milestone, index, onClose }: { milestone: BuildMilestone; index: number; onClose?: () => void }) {
  return (
    <article className="relative w-full overflow-hidden rounded-[22px] border border-white/70 bg-[#fbfaf7] p-6 text-ink shadow-[0_28px_80px_rgba(0,0,0,0.38)] sm:p-7">
      <span aria-hidden="true" className="absolute -right-2 -top-7 font-[var(--font-display)] text-[8rem] leading-none text-primary/[0.07]">{String(index + 1).padStart(2, '0')}</span>
      <div className="relative flex items-start justify-between gap-3">
        <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-primary-active">{milestone.tag}</span>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${milestone.status ? 'bg-success/12 text-[#3d7a4a]' : 'bg-surface-soft text-muted'}`}>
            {milestone.status ? <Check size={11} strokeWidth={3} /> : <Clock3 size={11} />}
            {milestone.status ? 'Completed' : 'Upcoming'}
          </span>
          {onClose ? <button type="button" onClick={onClose} aria-label="Close details" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><X size={16} /></button> : null}
        </div>
      </div>
      <div className="relative mt-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-soft">{milestone.date} · Milestone {String(index + 1).padStart(2, '0')}</p>
        <h2 className="mt-2 font-[var(--font-display)] text-[2.35rem] font-normal leading-[0.98] tracking-[-0.025em]">{milestone.title}</h2>
        <p className="mt-3 text-sm leading-6 text-muted">{milestone.summary}</p>
      </div>
      <ul className="relative mt-6 space-y-3 border-t border-hairline pt-5">
        {milestone.details.map((detail) => (
          <li key={detail} className="flex gap-3 text-[13px] leading-5 text-body">
            <span className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full ${milestone.status ? 'bg-primary/12 text-primary' : 'bg-surface-soft text-muted-soft'}`}>
              {milestone.status ? <Check size={10} strokeWidth={3} /> : <Circle size={8} />}
            </span>
            {detail}
          </li>
        ))}
      </ul>
      <div className="relative mt-6 flex items-center justify-between border-t border-hairline pt-4 text-[10px] uppercase tracking-[0.12em] text-muted-soft">
        <span>PonkoForm build history</span><span>{index + 1} / {BUILD_MILESTONES.length}</span>
      </div>
    </article>
  )
}

function MobileDetails({ milestone, selectedIndex, onClose }: { milestone: BuildMilestone; selectedIndex: number; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div role="dialog" aria-label={`${milestone.title} details`} className="pointer-events-none fixed inset-x-3 bottom-3 z-40 max-h-[calc(100svh-5rem)] overflow-y-auto lg:hidden">
      <div className="pointer-events-auto">
        <MilestoneCardStack milestone={milestone} selectedIndex={selectedIndex} onClose={onClose} />
      </div>
      <button ref={closeRef} className="sr-only" aria-hidden="true" tabIndex={-1} />
    </div>
  )
}
