// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EditablePageField } from './PageBuilderTypes'
import { SatisfactionSettings } from './FieldSettings'

const field: EditablePageField = {
  id: 629,
  pageId: 1,
  fieldType: 'satisfaction',
  label: 'How was your visit?',
  placeholder: null,
  required: false,
  options: null,
  bindVariable: 'visit_rating',
  position: 0,
  width: 'full',
  validationRules: null,
  conditions: [],
}

describe('SatisfactionSettings', () => {
  afterEach(cleanup)

  it('offers visual rating presets and applies the text-only scale', () => {
    const onUpdate = vi.fn()
    render(<SatisfactionSettings field={field} onUpdate={onUpdate} />)

    expect(screen.getByRole('radiogroup', { name: 'Rating appearance preset' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: /Review stars/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('radio', { name: /Text labels/i }))

    expect(onUpdate).toHaveBeenCalledWith({
      options: expect.arrayContaining([
        expect.objectContaining({ label: 'Very poor', value: '1', emoji: 'rating-text-only' }),
        expect.objectContaining({ label: 'Excellent', value: '5', emoji: 'rating-text-only' }),
      ]),
    })
  })
})
