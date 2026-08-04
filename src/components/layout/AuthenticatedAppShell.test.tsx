// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/auth-client', () => ({
  useSession: () => ({
    data: {
      session: { id: 'session-test' },
      user: { email: 'test@example.com', name: 'Test User', image: null },
    },
    isPending: false,
  }),
  authClient: { signOut: vi.fn() },
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string
    children: React.ReactNode
  }) => <a href={to} {...props}>{children}</a>,
}))

import { TopNav } from './AuthenticatedAppShell'

afterEach(cleanup)

describe('authenticated application navigation', () => {
  it('exposes every workspace destination from the mobile menu', () => {
    render(<TopNav />)

    const trigger = screen.getByRole('button', { name: 'Open navigation menu' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(trigger)

    const navigation = screen.getByRole('navigation', { name: 'Mobile navigation' })
    expect(within(navigation).getByRole('link', { name: 'Dashboard' }).getAttribute('href'))
      .toBe('/dashboard')
    expect(within(navigation).getByRole('link', { name: 'Forms' }).getAttribute('href'))
      .toBe('/forms')
    expect(within(navigation).getByRole('link', { name: 'Payment Links' }).getAttribute('href'))
      .toBe('/dashboard/payment-links')
    expect(within(navigation).getByRole('link', { name: 'Integrations' }).getAttribute('href'))
      .toBe('/settings/integrations')
    expect(within(navigation).getByRole('link', { name: 'Documentation' }).getAttribute('href'))
      .toBe('/docs')
  })

  it('closes on Escape and restores focus to the trigger', () => {
    render(<TopNav />)

    const trigger = screen.getByRole('button', { name: 'Open navigation menu' })
    fireEvent.click(trigger)
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('closes after choosing a mobile destination', () => {
    render(<TopNav />)

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }))
    const navigation = screen.getByRole('navigation', { name: 'Mobile navigation' })
    fireEvent.click(within(navigation).getByRole('link', { name: 'Forms' }))

    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).toBeNull()
  })
})
