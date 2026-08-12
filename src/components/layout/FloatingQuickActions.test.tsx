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

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => <a href={to} {...props}>{children}</a>,
}))

import { FloatingQuickActions } from './FloatingQuickActions'

afterEach(cleanup)

describe('FloatingQuickActions', () => {
  it('reveals accessible workspace actions and closes on Escape', () => {
    render(<FloatingQuickActions />)

    const trigger = screen.getByRole('button', { name: 'Open quick actions' })
    const newForm = screen.getByLabelText('New form', { selector: 'a' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(newForm.getAttribute('tabindex')).toBe('-1')

    fireEvent.click(trigger)
    expect(screen.getByRole('button', { name: 'Close quick actions' }).getAttribute('aria-expanded')).toBe('true')
    expect(newForm.getAttribute('tabindex')).toBe('0')
    expect(screen.getByLabelText('Payment links', { selector: 'a' }).getAttribute('href')).toBe('/dashboard/payment-links')
    expect(screen.getByLabelText('Discounts', { selector: 'a' }).getAttribute('href')).toBe('/discounts')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'Open quick actions' })).toBe(document.activeElement)
    expect(newForm.getAttribute('tabindex')).toBe('-1')
  })

  it('closes when the user clicks outside the liquid menu', () => {
    render(<FloatingQuickActions />)
    fireEvent.click(screen.getByRole('button', { name: 'Open quick actions' }))
    fireEvent.pointerDown(document.body)
    expect(screen.getByRole('button', { name: 'Open quick actions' }).getAttribute('aria-expanded')).toBe('false')
  })
})
