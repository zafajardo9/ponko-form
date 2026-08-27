import { useEffect, useState } from 'react'

/**
 * Lets creators finish typing a number before it mutates the canvas.
 * Controlled number inputs that clamp on every keypress turn an intermediate
 * value such as `1` into the minimum before the user can finish `1200`.
 */
export function CommittedNumberInput({
  value,
  onCommit,
  min,
  max,
  step = 1,
  disabled,
  className,
}: {
  value: number
  onCommit: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  className?: string
}) {
  const normalizedValue = Number.isFinite(value) ? value : 0
  const [draft, setDraft] = useState(String(normalizedValue))

  useEffect(() => {
    setDraft(String(normalizedValue))
  }, [normalizedValue])

  function commit() {
    if (!draft.trim()) {
      setDraft(String(normalizedValue))
      return
    }
    const parsed = Number(draft)
    if (!Number.isFinite(parsed)) {
      setDraft(String(normalizedValue))
      return
    }
    const bounded = Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, parsed))
    setDraft(String(bounded))
    if (bounded !== normalizedValue) onCommit(bounded)
  }

  return (
    <input
      type="number"
      value={draft}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          event.currentTarget.blur()
        } else if (event.key === 'Escape') {
          event.preventDefault()
          setDraft(String(normalizedValue))
          event.currentTarget.blur()
        }
      }}
      className={className}
    />
  )
}
