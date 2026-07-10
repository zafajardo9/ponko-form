import { describe, expect, it } from 'vitest'
import {
  evaluateCondition,
  isFieldVisible,
  pruneHiddenValues,
  sanitizeFieldValue,
  validateFieldRules,
} from './conditions'
import type { PageField } from './types'

const base = {
  id: 1,
  fieldId: 1,
  sourceFieldBinding: 'meal',
  value: 'vegan',
  action: 'show' as const,
}

describe('page-builder conditions', () => {
  it('evaluates text, array, empty, numeric, and date operators', () => {
    expect(evaluateCondition({ ...base, operator: 'equals' }, { meal: 'vegan' })).toBe(true)
    expect(evaluateCondition({ ...base, operator: 'not_equals' }, { meal: 'meat' })).toBe(true)
    expect(evaluateCondition({ ...base, operator: 'contains', value: 'veg' }, { meal: 'vegan' })).toBe(true)
    expect(evaluateCondition({ ...base, operator: 'equals' }, { meal: ['meat', 'vegan'] })).toBe(true)
    expect(evaluateCondition({ ...base, operator: 'is_empty', value: null }, { meal: [] })).toBe(true)
    expect(evaluateCondition({ ...base, operator: 'is_not_empty', value: null }, { meal: 'x' })).toBe(true)
    expect(evaluateCondition({ ...base, operator: 'greater_than', value: '18' }, { meal: 21 })).toBe(true)
    expect(evaluateCondition({ ...base, operator: 'less_than', value: '2026-01-01' }, { meal: '2025-12-31' })).toBe(true)
  })

  it('resolves reference tokens in comparison values', () => {
    expect(
      evaluateCondition(
        { ...base, sourceFieldBinding: 'total', operator: 'greater_than', value: '{{free_shipping_threshold}}' },
        { total: 1500 },
        { free_shipping_threshold: 1000 },
      ),
    ).toBe(true)
  })

  it('uses show and hide actions with AND semantics', () => {
    expect(
      isFieldVisible(
        {
          conditions: [
            { ...base, id: 1, operator: 'equals' },
            { ...base, id: 2, sourceFieldBinding: 'age', operator: 'greater_than', value: '17' },
          ],
        },
        { meal: 'vegan', age: 18 },
      ),
    ).toBe(true)

    expect(
      isFieldVisible(
        { conditions: [{ ...base, action: 'hide', operator: 'equals' }] },
        { meal: 'vegan' },
      ),
    ).toBe(false)
  })

  it('prunes values for hidden fields', () => {
    const fields = [
      { bindVariable: 'name', conditions: [] },
      { bindVariable: 'notes', conditions: [{ ...base, operator: 'equals' }] },
    ] as PageField[]

    expect(pruneHiddenValues(fields, { name: 'Ava', notes: 'hidden', meal: 'meat' })).toEqual({
      name: 'Ava',
    })
  })

  it('sanitizes simple allowed-character rules while typing', () => {
    const field = {
      label: 'Code',
      validationRules: { allowedCharacters: 'alphanumeric' },
    } as PageField

    expect(sanitizeFieldValue(field, 'AB-12 !')).toBe('AB12 ')
    expect(sanitizeFieldValue(field, ['a', 'b'])).toEqual(['a', 'b'])
  })

  it('validates field rules for character modes, lengths, patterns, and numeric ranges', () => {
    const baseField = { label: 'Code', validationRules: null } as PageField

    expect(
      validateFieldRules(
        { ...baseField, validationRules: { allowedCharacters: 'letters' } },
        'ABC123',
      ),
    ).toContain('not allowed')
    expect(
      validateFieldRules({ ...baseField, validationRules: { minLength: 4 } }, 'ABC'),
    ).toContain('at least 4')
    expect(
      validateFieldRules({ ...baseField, validationRules: { maxLength: 3 } }, 'ABCD'),
    ).toContain('no more than 3')
    expect(
      validateFieldRules(
        { ...baseField, validationRules: { allowedCharacters: 'custom', customPattern: '^INV-[0-9]+$' } },
        'ABC-1',
      ),
    ).toContain('not allowed')
    expect(
      validateFieldRules({ ...baseField, validationRules: { minValue: 18 } }, '17'),
    ).toContain('at least 18')
    expect(
      validateFieldRules({ ...baseField, validationRules: { maxValue: 99 } }, '100'),
    ).toContain('no more than 99')
    expect(
      validateFieldRules(
        { ...baseField, validationRules: { minLength: 4, message: 'Use four or more.' } },
        'ABC',
      ),
    ).toBe('Use four or more.')
  })
})
