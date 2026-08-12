// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PageField } from '../../lib/page-builder/types'
import { RulesDialog } from './RulesDialog'
import { VALIDATION_PATTERN_PRESETS } from '../../lib/page-builder/validation-patterns'

const emailField = {
  id: 1,
  fieldType: 'email',
  label: 'Email address',
  bindVariable: 'email_address',
} as PageField

const confirmationField = {
  id: 2,
  fieldType: 'email',
  label: 'Confirm email',
  bindVariable: 'confirm_email',
  conditions: [],
} as PageField & { conditions: [] }

describe('RulesDialog', () => {
  afterEach(cleanup)

  it('lets a creator select an earlier field for confirmation matching', () => {
    const onUpdate = vi.fn()
    render(
      <RulesDialog
        field={confirmationField}
        rules={{}}
        matchableFields={[emailField]}
        onClose={vi.fn()}
        onClear={vi.fn()}
        onUpdate={onUpdate}
        numberRule={(value) => Number(value)}
      />,
    )

    fireEvent.change(screen.getByRole('combobox', { name: 'Must match' }), {
      target: { value: 'email_address' },
    })

    expect(onUpdate).toHaveBeenCalledWith({ matchesFieldBinding: 'email_address' })
  })

  it('applies a Philippine mobile regex preset', () => {
    const onUpdate = vi.fn()
    render(
      <RulesDialog
        field={confirmationField}
        rules={{}}
        matchableFields={[emailField]}
        onClose={vi.fn()}
        onClear={vi.fn()}
        onUpdate={onUpdate}
        numberRule={(value) => Number(value)}
      />,
    )

    fireEvent.change(screen.getByRole('combobox', { name: 'Format preset' }), {
      target: { value: 'ph_mobile' },
    })

    expect(onUpdate).toHaveBeenCalledWith({
      customPattern: VALIDATION_PATTERN_PRESETS[0].pattern,
    })
  })
})
