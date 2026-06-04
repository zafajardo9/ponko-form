import { describe, it, expect } from 'vitest'
import { ExpressionEvaluator } from './ExpressionEvaluator'

describe('ExpressionEvaluator', () => {
  const evaluator = new ExpressionEvaluator()

  it('evaluates basic arithmetic', () => {
    const result = evaluator.evaluate('2 + 3 * 4', { variables: {} })
    expect(result).toEqual({ success: true, value: 14 })
  })

  it('resolves variable references', () => {
    const result = evaluator.evaluate('{{subtotal}} * 0.12', {
      variables: { subtotal: 1000 },
    })
    expect(result).toEqual({ success: true, value: 120 })
  })

  it('supports built-in round function', () => {
    const result = evaluator.evaluate('round({{value}}, 2)', {
      variables: { value: 10.5678 },
    })
    expect(result).toEqual({ success: true, value: 10.57 })
  })

  it('returns error for unknown variables', () => {
    const result = evaluator.evaluate('{{unknown_var}} + 1', { variables: {} })
    expect(result.success).toBe(false)
  })

  it('returns error for invalid syntax', () => {
    // Note: `2 ++ 3` is valid in math.js (unary plus). Use a genuine syntax error.
    const result = evaluator.evaluate('2 * * 3', { variables: {} })
    expect(result.success).toBe(false)
  })

  it('validates correct expressions', () => {
    expect(evaluator.validate('{{x}} * (1 + {{y}})')).toEqual({ valid: true })
  })

  it('validates incorrect expressions', () => {
    const result = evaluator.validate('2 +/ 3')
    expect(result.valid).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('handles numeric conditional (ternary) selection', () => {
    // Pick a price based on quantity. math.js supports the ?: operator on
    // numeric conditions natively.
    const result = evaluator.evaluate(
      '{{qty}} > 10 ? {{bulk_price}} : {{unit_price}}',
      { variables: { qty: 20, bulk_price: 50, unit_price: 100 } },
    )
    expect(result).toEqual({ success: true, value: 50 })
  })

  it('handles string conditionals via equalText()', () => {
    // math.js `==` does not compare strings — use equalText() for string
    // conditionals. (String-based routing is normally done with Decision nodes.)
    const result = evaluator.evaluate(
      'equalText({{plan}}, "full") ? {{full_amount}} : {{inst_amount}}',
      { variables: { plan: 'full', full_amount: 1000, inst_amount: 500 } },
    )
    expect(result).toEqual({ success: true, value: 1000 })
  })
})
