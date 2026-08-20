/**
 * FlowProgressBar
 *
 * A segmented progress indicator for a flow run. Each segment represents a
 * step; the current step is highlighted, completed steps are filled, and
 * upcoming steps are outlined.
 */
interface FlowProgressBarProps {
  current: number
  total: number
}

export function FlowProgressBar({ current, total }: FlowProgressBarProps) {
  const count = Math.max(total, 1)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1.5">
        {Array.from({ length: count }).map((_, i) => {
          const stepNo = i + 1
          const state = stepNo < current ? 'done' : stepNo === current ? 'current' : 'future'
          return (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                state === 'done'
                  ? 'bg-[var(--ponko-primary,#cc785c)]'
                  : state === 'current'
                    ? 'bg-[var(--ponko-primary-soft,#cc785c99)]'
                    : 'bg-[#e6dfd8]'
              }`}
            />
          )
        })}
      </div>
      <p className="text-xs text-[var(--ponko-foreground-faint,#8e8b82)]">
        Step {Math.min(current, count)} of {count}
      </p>
    </div>
  )
}
