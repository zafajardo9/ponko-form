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
    const group = screen.getByRole('radiogroup')
    expect(status.textContent).toBe('')
    expect(status.className).toContain('h-4')
    expect(group.parentElement?.className).toContain('overflow-x-auto')
    expect(screen.getByTitle('Satisfied').className).toContain('min-w-11')
    expect(screen.getByTitle('Satisfied').className).not.toContain('rounded-full')
    expect(screen.getByTitle('Satisfied').className).not.toContain('border-[#e6dfd8]')

    fireEvent.mouseEnter(screen.getByTitle('Satisfied'))
    expect(status.textContent).toBe('Satisfied')
    expect(status.className).toContain('h-4')

    fireEvent.mouseLeave(screen.getByTitle('Satisfied'))
    expect(status.textContent).toBe('')
    expect(status.className).toContain('h-4')
  })

  it('uses circular containers only for numeric options', () => {
    render(
      <RatingControl
        options={[
          { value: '0', label: 'Not likely', emoji: '0' },
          { value: '10', label: 'Very likely', emoji: '10' },
        ]}
        value=""
        onChange={vi.fn()}
        name="nps"
        label="Likelihood"
      />,
    )

    expect(screen.getByTitle('Not likely').className).toContain('w-11 rounded-full')
    expect(screen.getByTitle('Not likely').className).toContain('border-[#e6dfd8]')
  })
})
