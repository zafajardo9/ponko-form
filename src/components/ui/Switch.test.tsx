// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Switch } from './Switch'

afterEach(cleanup)

describe('Switch', () => {
  it('exposes its state and requests the next state when clicked', () => {
    const onCheckedChange = vi.fn()
    render(<Switch checked onCheckedChange={onCheckedChange} checkedLabel="Active" uncheckedLabel="Inactive" />)

    const control = screen.getByRole('switch', { name: 'Active' })
    expect(control.getAttribute('aria-checked')).toBe('true')

    fireEvent.click(control)
    expect(onCheckedChange).toHaveBeenCalledWith(false)
    expect(control.querySelector('.t-toggle')?.classList.contains('is-init')).toBe(true)
    expect(control.querySelector('.t-toggle')?.getAttribute('data-on')).toBe('true')
  })

  it('supports a custom accessible label without requiring visible state text', () => {
    render(<Switch checked={false} onCheckedChange={vi.fn()} stateLabel="hidden" aria-label="Email notifications" />)

    const control = screen.getByRole('switch', { name: 'Email notifications' })
    expect(control.getAttribute('aria-checked')).toBe('false')
  })
})
