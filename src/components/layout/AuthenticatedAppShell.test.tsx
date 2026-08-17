// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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

vi.mock('../auth/UserMenu', () => ({
  UserMenu: () => <button type="button" aria-label="Open account menu">T</button>,
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
  useRouterState: ({ select }: { select?: (state: unknown) => unknown } = {}) => {
    const state = { location: { pathname: '/' } }
    return select ? select(state) : state
  },
}))

import { TopNav } from './AuthenticatedAppShell'

afterEach(cleanup)

describe('authenticated application navigation', () => {
  it('exposes every workspace destination from the mobile menu', () => {
    render(<TopNav signedIn />)

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
    render(<TopNav signedIn />)

    const trigger = screen.getByRole('button', { name: 'Open navigation menu' })
    fireEvent.click(trigger)
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('closes after choosing a mobile destination', () => {
    render(<TopNav signedIn />)

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }))
    const navigation = screen.getByRole('navigation', { name: 'Mobile navigation' })
    fireEvent.click(within(navigation).getByRole('link', { name: 'Forms' }))

    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).toBeNull()
  })
})

describe('grouped desktop navigation', () => {
  it('groups workspace destinations behind the Workspace menu', () => {
    render(<TopNav signedIn />)

    const trigger = screen.getByRole('button', { name: 'Workspace' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    const menu = screen.getByRole('group', { name: 'Workspace menu' })
    expect(within(menu).getByRole('link', { name: /Forms/ }).getAttribute('href')).toBe('/forms')
    expect(within(menu).getByRole('link', { name: /New form/ }).getAttribute('href')).toBe('/forms/new')
    expect(within(menu).getByRole('link', { name: /Payment Links/ }).getAttribute('href'))
      .toBe('/dashboard/payment-links')
    expect(within(menu).getByRole('link', { name: /Discounts/ }).getAttribute('href')).toBe('/discounts')
  })

  it('keeps Dashboard and Integrations as direct links', () => {
    render(<TopNav signedIn />)

    expect(screen.getByRole('link', { name: 'Dashboard' }).getAttribute('href')).toBe('/dashboard')
    expect(screen.getByRole('link', { name: 'Integrations' }).getAttribute('href')).toBe('/settings/integrations')
  })

  it('groups documentation destinations behind the Resources menu', () => {
    render(<TopNav signedIn={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Resources' }))
    const menu = screen.getByRole('group', { name: 'Resources menu' })

    expect(within(menu).getByRole('link', { name: /Documentation/ }).getAttribute('href')).toBe('/docs')
    expect(within(menu).getByRole('link', { name: /Progress/ }).getAttribute('href')).toBe('/progress')
  })

  it('opens on hover after a short intent delay and closes after the pointer leaves', () => {
    vi.useFakeTimers()
    try {
      render(<TopNav signedIn />)

      const trigger = screen.getByRole('button', { name: 'Workspace' })
      fireEvent.pointerOver(trigger)
      act(() => { vi.advanceTimersByTime(120) })
      expect(trigger.getAttribute('aria-expanded')).toBe('true')

      // Moving the pointer off the group (pointerout with no related target —
      // the pointer left toward elsewhere) starts the close grace period;
      // once it elapses the menu closes.
      fireEvent.pointerOut(trigger)
      act(() => { vi.advanceTimersByTime(200) })
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
    } finally {
      vi.useRealTimers()
    }
  })

  it('closes the group menu on Escape and restores focus to the trigger', () => {
    render(<TopNav signedIn />)

    const trigger = screen.getByRole('button', { name: 'Workspace' })
    fireEvent.click(trigger)
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger)
  })

  it('closes the group menu after choosing a destination', () => {
    render(<TopNav signedIn />)

    fireEvent.click(screen.getByRole('button', { name: 'Workspace' }))
    const menu = screen.getByRole('group', { name: 'Workspace menu' })
    fireEvent.click(within(menu).getByRole('link', { name: /Discounts/ }))

    expect(screen.getByRole('button', { name: 'Workspace' }).getAttribute('aria-expanded')).toBe('false')
  })
})
