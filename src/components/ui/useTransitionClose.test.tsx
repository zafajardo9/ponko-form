// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTransitionClose } from './useTransitionClose'

function Harness({ onClose }: { onClose: () => void }) {
  const { requestClose, transitionClass } = useTransitionClose(onClose)
  return <button type="button" className={transitionClass} onClick={requestClose}>Close</button>
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(callback, 0))
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
  document.documentElement.style.setProperty('--modal-close-dur', '150ms')
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.documentElement.style.removeProperty('--modal-close-dur')
})

describe('useTransitionClose', () => {
  it('keeps a surface mounted for the CSS close duration', () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    act(() => vi.runOnlyPendingTimers())

    expect(screen.getByRole('button').className).toBe('is-open')
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button').className).toBe('is-closing')

    act(() => vi.advanceTimersByTime(149))
    expect(onClose).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes immediately when reduced motion is requested', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    act(() => vi.runOnlyPendingTimers())

    fireEvent.click(screen.getByRole('button'))
    act(() => vi.runOnlyPendingTimers())
    expect(onClose).toHaveBeenCalledOnce()
  })
})
