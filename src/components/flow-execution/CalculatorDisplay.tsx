import { useEffect, useState } from 'react'

/**
 * CalculatorDisplay
 *
 * Shows a brief "Calculating…" animation, then reveals the computed value.
 * Used for Calculator steps in flow execution. The engine auto-advances past
 * calculators, so this is mostly a visual flourish when a calculator is shown
 * explicitly; `onDone` fires after the reveal so the container can continue.
 */
interface CalculatorDisplayProps {
  label: string
  value: number | string
  onDone?: () => void
}

export function CalculatorDisplay({ label, value, onDone }: CalculatorDisplayProps) {
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 700)
    const d = onDone ? setTimeout(onDone, 1400) : undefined
    return () => {
      clearTimeout(t)
      if (d) clearTimeout(d)
    }
  }, [onDone])

  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <p className="text-sm text-[#6c6a64]">{label}</p>
      {revealed ? (
        <p className="text-3xl font-semibold text-[#141413] transition-opacity duration-300">{value}</p>
      ) : (
        <div className="flex items-center gap-1.5 text-[#8e8b82]">
          <span className="h-2 w-2 animate-bounce rounded-full bg-[#cc785c] [animation-delay:-0.3s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-[#cc785c] [animation-delay:-0.15s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-[#cc785c]" />
          <span className="ml-2 text-sm">Calculating…</span>
        </div>
      )}
    </div>
  )
}
