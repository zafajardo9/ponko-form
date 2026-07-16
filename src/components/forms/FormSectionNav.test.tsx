// @vitest-environment jsdom

import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
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
    render(<FormSectionNav formId="17" active="invoicing" />)
    expect(screen.getByRole('navigation', { name: 'Form sections' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Build' }).getAttribute('href')).toBe('/forms/17/edit')
    expect(screen.getByRole('link', { name: 'Responses' }).getAttribute('href')).toBe('/forms/17/submissions')
    expect(screen.getByRole('link', { name: 'Payments' }).getAttribute('href')).toBe('/forms/17/payments')
    expect(screen.getByRole('link', { name: 'Invoicing' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page')).toHaveLength(1)
  })
})
