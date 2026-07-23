// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: {
    to: string
    children: React.ReactNode
  }) => <a href={to} {...props}>{children}</a>,
}))

import {
  RootErrorPage,
  RootNotFoundPage,
} from './RouteFailurePage'

afterEach(cleanup)

describe('root route failure pages', () => {
  it('gives an unknown route clear recovery destinations', () => {
    render(<RootNotFoundPage />)

    expect(screen.getByRole('heading', {
      name: 'This page is no longer on the form.',
    })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Go to homepage/ }).getAttribute('href'))
      .toBe('/')
    expect(screen.getByRole('link', { name: 'Browse documentation' }).getAttribute('href'))
      .toBe('/docs')
  })

  it('retries a failed route through the router boundary reset', () => {
    const reset = vi.fn()
    render(<RootErrorPage error={new Error('private failure')} reset={reset} />)

    expect(screen.queryByText('private failure')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Try this page again' }))
    expect(reset).toHaveBeenCalledOnce()
  })
})
