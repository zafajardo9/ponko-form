import { describe, expect, it } from 'vitest'
import { checkFormulaExpression } from './ExpressionBuilder'
import type { PageField } from '../../lib/page-builder/types'

const calculationField = {
  id: 1,
  pageId: 1,
  fieldType: 'computation',
  label: 'Total',
  placeholder: null,
  required: false,
  bindVariable: 'total',
  position: 0,
  width: 'full',
  options: null,
  validationRules: null,
  conditions: [],
} satisfies PageField

describe('checkFormulaExpression', () => {
  it('accepts balanced nested parentheses', () => {
    expect(checkFormulaExpression('(100 + 20) * (3 + 2)', calculationField, [], []).errors).toEqual([])
  })

  it('reports malformed parentheses', () => {
    const result = checkFormulaExpression('(100 + 20', calculationField, [], [])
    expect(result.errors.some((error) => error.startsWith('Invalid formula:'))).toBe(true)
    expect(result.errors.join(' ')).not.toContain('Unsupported text in formula: "("')
  })
})
