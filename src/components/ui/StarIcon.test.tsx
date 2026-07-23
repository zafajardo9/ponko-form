// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { StarIcon } from './StarIcon'

afterEach(cleanup)

describe('StarIcon', () => {
  it('renders inline so currentColor works in builder and public themes', () => {
    const { container, rerender } = render(
      <StarIcon size={30} filled className="text-[#cc785c]" />,
    )

    const filled = container.querySelector('svg[data-star-icon]')
    expect(filled?.getAttribute('fill')).toBe('currentColor')
    expect(filled?.getAttribute('width')).toBe('30')
    expect(container.querySelector('img')).toBeNull()

    rerender(<StarIcon filled={false} />)
    expect(container.querySelector('svg[data-star-icon]')?.getAttribute('fill')).toBe('none')
  })
})
