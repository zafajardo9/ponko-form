import { useSyncExternalStore } from 'react'

/**
 * Dev-only "skip validation" flag for fast manual testing of published forms.
 *
 * Mirrors the `react-grab` pattern in `src/router.tsx`: everything here is
 * inert in production (`import.meta.env.DEV` is false), and the flag is
 * persisted in localStorage so it survives reloads while iterating on
 * localhost. Validation sites read it through `useSkipValidation()` so they
 * stay in sync with the floating toggle.
 */

const STORAGE_KEY = 'ponkoform:dev:skip-validation'

const listeners = new Set<() => void>()
let cached: boolean | null = null

function readStored(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function snapshot(): boolean {
  if (cached === null) cached = readStored()
  return cached
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** React hook — true when validation should be skipped (DEV only). */
export function useSkipValidation(): boolean {
  if (!import.meta.env.DEV) return false
  return useSyncExternalStore(subscribe, snapshot, () => false)
}

/** Imperative read for non-React callers. */
export function isSkipValidationEnabled(): boolean {
  return import.meta.env.DEV && snapshot()
}

/** Flips the flag and notifies every subscriber. */
export function setSkipValidation(enabled: boolean): void {
  cached = enabled
  try {
    if (typeof window !== 'undefined') {
      if (enabled) window.localStorage.setItem(STORAGE_KEY, '1')
      else window.localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // localStorage can throw in private mode — the in-memory flag still works.
  }
  for (const listener of listeners) listener()
}
