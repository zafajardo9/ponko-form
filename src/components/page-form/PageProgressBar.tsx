interface PageProgressBarProps {
  current: number
  total: number
}

export function PageProgressBar({ current, total }: PageProgressBarProps) {
  const pct = total <= 1 ? 100 : Math.round((current / total) * 100)
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between text-xs text-[#8e8b82]">
        <span>
          Page {current} of {total}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#e6dfd8]">
        <div
          className="h-full rounded-full bg-[var(--ponko-primary,#cc785c)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
