// @vitest-environment jsdom

import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FormWorkspaceLayout } from './FormWorkspaceLayout'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, params, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string
    params?: { formId: string }
    children: ReactNode
  }) => <a href={params ? to.replace('$formId', params.formId) : to} {...props}>{children}</a>,
}))

describe('FormWorkspaceLayout', () => {
  afterEach(cleanup)

  it('keeps section navigation, breadcrumbs, heading, actions, and content in one shell', () => {
    render(
      <FormWorkspaceLayout
        formId="11"
        formTitle="Service satisfaction"
        active="payments"
        title="Payments"
        count={8}
        description="Payment history"
        actions={<button type="button">Verify all</button>}
      >
        <div>Payment table</div>
      </FormWorkspaceLayout>,
    )

    expect(screen.getByRole('navigation', { name: 'Form sections' })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent).toBe('Forms/Service satisfaction/Payments')
    expect(screen.getByRole('heading', { name: /Payments.*8/ })).toBeTruthy()
    expect(screen.getByText('Payment history')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Verify all' })).toBeTruthy()
    expect(screen.getByText('Payment table')).toBeTruthy()
  })
})
