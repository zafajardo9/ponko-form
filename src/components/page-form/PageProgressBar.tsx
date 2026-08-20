interface PageProgressBarProps {
  current: number
  total: number
}

export function PageProgressBar({ current, total }: PageProgressBarProps) {
  // Single-page forms have nothing to progress through — hide the bar entirely.
  if (total < 2) return null
  const pct = Math.min(100, Math.round((current / total) * 100))
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between text-xs text-[var(--ponko-foreground-faint,#8e8b82)]">
        {/* Re-keyed per page so the labels do a small rise-in on navigation. */}
        <span
          key={`label-${current}`}
          className="ponko-progress-label font-medium text-[var(--ponko-foreground-muted,#6c6a64)] tabular-nums"
        >
          Page {current} of {total}
        </span>
        <span key={`pct-${current}`} className="ponko-progress-label tabular-nums">
          {pct}%
        </span>
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-[#e6dfd8]">
        <div
          className="relative h-full overflow-hidden rounded-full bg-[var(--ponko-primary,#cc785c)] transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ width: `${pct}%` }}
        >
          {/* One shine sweep per page change (re-keyed by `current`). */}
          <span
            key={`shine-${current}`}
            aria-hidden="true"
            className="ponko-progress-shine absolute inset-y-0 left-0 w-1/3 rounded-full bg-white/40 blur-[2px]"
          />
        </div>
      </div>
    </div>
  )
}
