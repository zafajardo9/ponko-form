// @vitest-environment jsdom

import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FormSectionNav } from './FormSectionNav'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, params, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string
    params: { formId: string }
    children: ReactNode
  }) => <a href={to.replace('$formId', params.formId)} {...props}>{children}</a>,
}))

describe('FormSectionNav', () => {
  afterEach(cleanup)

  it('exposes every creator section with the selected section marked as current', () => {
    render(<FormSectionNav formId="17" active="invoicing" hasPayment />)
    expect(screen.getByRole('navigation', { name: 'Form sections' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Build' }).getAttribute('href')).toBe('/forms/17/edit')
    expect(screen.getByRole('link', { name: 'Responses' }).getAttribute('href')).toBe('/forms/17/submissions')
    expect(screen.getByRole('link', { name: 'Emails' }).getAttribute('href')).toBe('/forms/17/emails')
    expect(screen.getByRole('link', { name: 'Payments' }).getAttribute('href')).toBe('/forms/17/payments')
    expect(screen.getByRole('link', { name: 'Invoicing' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page')).toHaveLength(1)
  })

  it('opens a compact section menu and closes it after a selection', () => {
    render(<FormSectionNav formId="17" active="build" hasPayment />)

    const trigger = screen.getByRole('button', { name: 'Build' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getAllByRole('link', { name: 'Payments' })).toHaveLength(2)

    fireEvent.click(screen.getAllByRole('link', { name: 'Payments' })[0])
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getAllByRole('link', { name: 'Payments' })).toHaveLength(1)
  })

  it('closes the compact section menu with Escape', () => {
    render(<FormSectionNav formId="17" active="responses" />)

    const trigger = screen.getByRole('button', { name: 'Responses' })
    fireEvent.click(trigger)
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger)
  })

  it('hides payment-only sections when the form has no payment page', () => {
    render(<FormSectionNav formId="17" active="build" />)

    expect(screen.queryByRole('link', { name: 'Payments' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Invoicing' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Build' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Responses' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Emails' })).toBeTruthy()
  })
})
