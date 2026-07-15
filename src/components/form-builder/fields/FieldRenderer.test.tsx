// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FieldRenderer, type FieldConfig } from './FieldRenderer'

afterEach(cleanup)

const choiceField: FieldConfig = {
  id: 7,
  type: 'checkbox',
  label: 'Services',
  required: false,
  options: [
    { label: 'Background check', value: 'background' },
    { label: 'Identity check', value: 'identity' },
  ],
}

describe('FieldRenderer choice and calendar controls', () => {
  it('adds and removes checkbox card values', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <FieldRenderer field={choiceField} value={[]} onChange={onChange} />,
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'Background check' }))
    expect(onChange).toHaveBeenLastCalledWith(['background'])

    rerender(
      <FieldRenderer field={choiceField} value={['background']} onChange={onChange} />,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'Background check' }))
    expect(onChange).toHaveBeenLastCalledWith([])
  })

  it('selects a radio card value', () => {
    const onChange = vi.fn()
    render(
      <FieldRenderer field={{ ...choiceField, type: 'radio' }} value="" onChange={onChange} />,
    )

    fireEvent.click(screen.getByRole('radio', { name: 'Identity check' }))
    expect(onChange).toHaveBeenCalledWith('identity')
  })

  it('selects a satisfaction rating', () => {
    const onChange = vi.fn()
    const field: FieldConfig = {
      id: 9,
      type: 'satisfaction',
      label: 'How satisfied are you?',
      required: true,
      options: [
        { label: 'Dissatisfied', value: '1', emoji: '😕' },
        { label: 'Satisfied', value: '5', emoji: '😍' },
      ],
    }

    render(<FieldRenderer field={field} value="" onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /^Satisfied$/i }))
    expect(onChange).toHaveBeenCalledWith('5')
  })

  it('changes and clears a calendar value', () => {
    const onChange = vi.fn()
    const dateField: FieldConfig = {
      id: 8,
      type: 'date',
      label: 'Appointment date',
      required: false,
    }
    const { rerender } = render(
      <FieldRenderer field={dateField} value="" onChange={onChange} />,
    )

    fireEvent.change(screen.getByLabelText('Appointment date'), {
      target: { value: '2026-07-10' },
    })
    expect(onChange).toHaveBeenCalledWith('2026-07-10')

    rerender(
      <FieldRenderer field={dateField} value="2026-07-10" onChange={onChange} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Clear Appointment date' }))
    expect(onChange).toHaveBeenLastCalledWith('')
  })
})
