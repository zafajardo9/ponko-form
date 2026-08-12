import { useCallback, useEffect, useRef, useState } from 'react'

export type TransitionPhase = 'entering' | 'open' | 'closing'

function readDuration(variable: string, fallbackMs: number) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0

  const raw = getComputedStyle(document.documentElement).getPropertyValue(variable).trim()
  if (!raw) return fallbackMs

  const value = Number.parseFloat(raw)
  if (!Number.isFinite(value)) return fallbackMs
  return raw.endsWith('s') && !raw.endsWith('ms') ? value * 1000 : value
}

/**
 * Keeps exit transitions mounted for the duration declared in CSS.
 * The opening frame is intentionally deferred so transition-based surfaces
 * paint their resting state before receiving `.is-open`.
 */
export function useTransitionClose(
  onClose: () => void,
  durationVariable = '--modal-close-dur',
  fallbackMs = 150,
) {
  const [phase, setPhase] = useState<TransitionPhase>('entering')
  const phaseRef = useRef<TransitionPhase>('entering')
  const onCloseRef = useRef(onClose)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      phaseRef.current = 'open'
      setPhase('open')
    })

    return () => {
      cancelAnimationFrame(frame)
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    }
  }, [])

  const requestClose = useCallback(() => {
    if (phaseRef.current === 'closing') return

    phaseRef.current = 'closing'
    setPhase('closing')
    const duration = readDuration(durationVariable, fallbackMs)
    closeTimerRef.current = setTimeout(() => onCloseRef.current(), duration)
  }, [durationVariable, fallbackMs])

  return {
    phase,
    requestClose,
    transitionClass: phase === 'open' ? 'is-open' : phase === 'closing' ? 'is-closing' : '',
  }
}
