// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RatingControl } from './RatingControl'

const options = [
  { value: '1', label: 'Not satisfied', emoji: '😞' },
  { value: '2', label: 'Satisfied', emoji: '😊' },
]

describe('RatingControl', () => {
  afterEach(cleanup)

  it('keeps a fixed feedback slot while hover text changes', () => {
    render(
      <RatingControl
        options={options}
        value=""
        onChange={vi.fn()}
        name="satisfaction"
        label="How satisfied are you?"
      />,
    )

    const status = screen.getByRole('status')
    expect(status.textContent).toBe('')
    expect(status.className).toContain('h-4')

    fireEvent.mouseEnter(screen.getByTitle('Satisfied'))
    expect(status.textContent).toBe('Satisfied')
    expect(status.className).toContain('h-4')

    fireEvent.mouseLeave(screen.getByTitle('Satisfied'))
    expect(status.textContent).toBe('')
    expect(status.className).toContain('h-4')
  })
})
