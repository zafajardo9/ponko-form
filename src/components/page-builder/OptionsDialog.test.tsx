// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OptionsEditor } from './OptionsDialog'

afterEach(cleanup)

describe('OptionsEditor', () => {
  it('places the full-width add control after the option rows', () => {
    const onChange = vi.fn()
    const { container } = render(
      <OptionsEditor
        options={[
          { label: 'First option', value: 'first_option' },
          { label: 'Second option', value: 'second_option' },
        ]}
        showPrices={false}
        references={[]}
        onChange={onChange}
      />,
    )

    const addButton = screen.getByRole('button', { name: 'Add option' })
    const secondLabel = screen.getByDisplayValue('Second option')
    expect(
      secondLabel.compareDocumentPosition(addButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(addButton.className).toContain('w-full')
    expect(container.querySelectorAll('button[aria-label^="Remove"]')).toHaveLength(2)

    fireEvent.click(addButton)
    expect(onChange).toHaveBeenCalledWith([
      { label: 'First option', value: 'first_option' },
      { label: 'Second option', value: 'second_option' },
      expect.objectContaining({ label: 'Option 3', value: 'option_3' }),
    ])
  })

  it('preserves a selected price reference and shows its active numeric value', () => {
    const onChange = vi.fn()
    const references = [{
      id: 7,
      formId: 1,
      key: 'premium_price',
      type: 'number' as const,
      value: '1250',
      label: 'Premium price',
      description: null,
      position: 0,
    }]
    const { rerender } = render(
      <OptionsEditor
        options={[{ label: 'Premium', value: 'premium', price: 0 }]}
        showPrices
        references={references}
        onChange={onChange}
      />,
    )

    fireEvent.change(screen.getByLabelText('Base price mode for Premium'), {
      target: { value: 'reference' },
    })
    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ price: null, priceReference: 'premium_price' }),
    ])

    rerender(
      <OptionsEditor
        options={[{ label: 'Premium', value: 'premium', price: null, priceReference: 'premium_price' }]}
        showPrices
        references={references}
        onChange={onChange}
      />,
    )

    expect((screen.getByLabelText('Base price reference for Premium') as HTMLSelectElement).value).toBe('premium_price')
    expect(screen.getByRole('status').textContent).toContain('Active value: 1250 from {{premium_price}}')
  })

  it('allows a percentage reference and explains how to apply it', () => {
    const onChange = vi.fn()
    const percentageReference = [{
      id: 8,
      formId: 1,
      key: 'premium_rate',
      type: 'percentage' as const,
      value: '25%',
      label: 'Premium rate',
      description: null,
      position: 0,
    }]

    render(
      <OptionsEditor
        options={[{ label: 'Premium', value: 'premium', priceReference: 'premium_rate' }]}
        showPrices
        references={percentageReference}
        onChange={onChange}
      />,
    )

    expect((screen.getByLabelText('Base price reference for Premium') as HTMLSelectElement).value).toBe('premium_rate')
    expect(screen.getByRole('status').textContent).toContain('Active value: 25% from {{premium_rate}}')
    expect(screen.getByRole('status').textContent).toContain('use this option after +%')
  })
})
