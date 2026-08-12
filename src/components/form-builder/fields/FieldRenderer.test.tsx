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
  it('preserves leading zeroes and country prefixes for regex-formatted number fields', () => {
    render(
      <FieldRenderer
        field={{
          id: 12,
          type: 'number',
          label: 'Mobile number',
          required: true,
          validationRules: { customPattern: '^(?:\\+63|0)9\\d{9}$' },
        }}
        value="09171234567"
        onChange={vi.fn()}
      />,
    )

    const input = screen.getByRole('textbox')
    expect(input.getAttribute('type')).toBe('text')
    expect(input.getAttribute('inputmode')).toBe('tel')
    expect(input.getAttribute('value')).toBe('09171234567')
  })

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

  it('keeps satisfaction choices circular and wraps them on narrow screens', () => {
    const field: FieldConfig = {
      id: 10,
      type: 'satisfaction',
      label: 'Satisfaction level',
      required: false,
      options: Array.from({ length: 11 }, (_, index) => ({
        label: index === 0 ? 'Not at all likely' : index === 10 ? 'Extremely likely' : String(index),
        value: String(index),
      })),
    }

    render(<FieldRenderer field={field} value="" onChange={vi.fn()} />)

    const group = screen.getByRole('radiogroup', { name: 'Satisfaction level' })
    expect(group.className).toContain('flex-wrap')
    expect(group.className).toContain('justify-center')
    expect(screen.getByTitle('Not at all likely').className).toContain('h-11 flex-none')
    expect(screen.getByTitle('Not at all likely').className).toContain('w-11 rounded-full')
    expect(screen.getByText('Not at all likely').className).toBe('sr-only')
    expect(screen.getAllByRole('radio')).toHaveLength(11)
  })

  it('renders the modern preset as one accessible five-star control', () => {
    const onChange = vi.fn()
    const field: FieldConfig = {
      id: 11,
      type: 'satisfaction',
      label: 'Service rating',
      required: false,
      options: Array.from({ length: 5 }, (_, index) => ({
        label: `${index + 1} star${index === 0 ? '' : 's'}`,
        value: String(index + 1),
        emoji: 'star-svg',
      })),
    }

    const { container, rerender } = render(
      <FieldRenderer field={field} value="" onChange={onChange} />,
    )

    expect(screen.getByRole('radiogroup', { name: 'Service rating' })).toBeTruthy()
    expect(screen.getAllByRole('radio')).toHaveLength(5)
    expect(screen.queryByText('star-svg')).toBeNull()
    expect(container.querySelectorAll('svg[data-star-icon]')).toHaveLength(5)
    expect(container.querySelectorAll('svg[data-filled="true"]')).toHaveLength(0)
    expect(screen.getByTitle('4 stars').className).not.toContain('rounded-full')
    expect(screen.getByTitle('4 stars').className).not.toContain('border-[#e6dfd8]')

    fireEvent.click(screen.getByRole('radio', { name: '4 stars' }))
    expect(onChange).toHaveBeenCalledWith('4')

    rerender(<FieldRenderer field={field} value="4" onChange={onChange} />)
    expect(container.querySelectorAll('svg[data-filled="true"]')).toHaveLength(4)
    expect(container.querySelectorAll('svg[data-filled="false"]')).toHaveLength(1)
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
