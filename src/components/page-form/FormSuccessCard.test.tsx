// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { FormSuccessCard } from './FormSuccessCard'

afterEach(cleanup)

describe('FormSuccessCard', () => {
  it('renders safe block-editor confirmation content', () => {
    const { container } = render(
      <FormSuccessCard
        message={'<h2>All set</h2><p><strong>Your request</strong> is on its way.</p><script>alert(1)</script>'}
      />,
    )

    expect(screen.getByRole('heading', { name: 'All set' })).toBeTruthy()
    expect(screen.getByText('Your request')).toBeTruthy()
    expect(container.querySelector('script')).toBeNull()
  })

  it('keeps legacy plain confirmation copy readable', () => {
    render(<FormSuccessCard message="Your response has been recorded." />)
    expect(screen.getByText('Your response has been recorded.')).toBeTruthy()
  })
})
