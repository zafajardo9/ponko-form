// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('liquid-gooey', () => {
  const Liquid = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>
  Liquid.Item = ({ children, x, y, transition, delay, ...props }: React.HTMLAttributes<HTMLDivElement> & { x?: number; y?: number; transition?: string; delay?: number }) => (
    <div data-x={x} data-y={y} data-transition={transition} data-delay={delay} {...props}>{children}</div>
  )
  return { Liquid }
})

import { CanvasAskMenu } from './CanvasAskMenu'

afterEach(cleanup)

describe('CanvasAskMenu', () => {
  it('reveals AI actions, selects a mode, and returns focus when closed with Escape', () => {
    const onSelect = vi.fn()
    render(<CanvasAskMenu onSelect={onSelect} />)

    const trigger = screen.getByRole('button', { name: 'Ask Ponko' })
    const guide = screen.getByLabelText('AI Guide')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(guide.getAttribute('tabindex')).toBe('-1')

    fireEvent.click(trigger)
    expect(screen.getByRole('button', { name: 'Close Ask menu' }).getAttribute('aria-expanded')).toBe('true')
    expect(guide.getAttribute('tabindex')).toBe('0')
    expect(screen.getByRole('button', { name: 'Generate Form' }).getAttribute('tabindex')).toBe('0')

    fireEvent.click(guide)
    expect(onSelect).toHaveBeenCalledWith('guide')
    expect(screen.getByRole('button', { name: 'Ask Ponko' }).getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(screen.getByRole('button', { name: 'Ask Ponko' }))

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'Ask Ponko' })).toBe(document.activeElement)
  })
})
