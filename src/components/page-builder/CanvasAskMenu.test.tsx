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
  it('reveals builder help actions and returns focus when closed with Escape', () => {
    render(<CanvasAskMenu />)

    const trigger = screen.getByRole('button', { name: 'Ask Ponko' })
    const docs = screen.getByLabelText('Documentation', { selector: 'a' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(docs.getAttribute('tabindex')).toBe('-1')

    fireEvent.click(trigger)
    expect(screen.getByRole('button', { name: 'Close Ask menu' }).getAttribute('aria-expanded')).toBe('true')
    expect(docs.getAttribute('tabindex')).toBe('0')
    expect(docs.getAttribute('target')).toBe('_blank')
    expect(screen.getByLabelText('Form builder guide', { selector: 'a' }).getAttribute('href')).toBe('/docs/flow-builder-guide')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'Ask Ponko' })).toBe(document.activeElement)
  })
})
