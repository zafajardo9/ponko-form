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

  it('supports the calculator helpers exposed by the builder', () => {
    const result = evaluator.evaluate(
      'sum(1, 2, 3) + min(8, 4) + max(3, 9) + abs(-2)',
      { variables: {} },
    )
    expect(result).toEqual({ success: true, value: 21 })
  })

  it('supports documented if and contains helpers', () => {
    const result = evaluator.evaluate(
      'if(contains({{services}}, "premium"), 500, 100)',
      { variables: { services: ['standard', 'premium'] } },
    )
    expect(result).toEqual({ success: true, value: 500 })
  })

  it('keeps variable bindings separate from function names', () => {
    const result = evaluator.evaluate('{{round}} + round({{amount}}, 1)', {
      variables: { round: 5, amount: 1.26 },
    })
    expect(result).toEqual({ success: true, value: 6.3 })
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

  it('does not leak custom functions between evaluator instances', () => {
    const first = new ExpressionEvaluator()
    const second = new ExpressionEvaluator()

    expect(first.evaluate('bonus(2)', {
      variables: {},
      functions: { bonus: (value) => Number(value) * 3 },
    })).toEqual({ success: true, value: 6 })
    expect(second.evaluate('bonus(2)', { variables: {} }).success).toBe(false)
  })

  it('rejects non-numeric and non-finite results', () => {
    expect(evaluator.evaluate('"not a number"', { variables: {} }).success).toBe(false)
    expect(evaluator.evaluate('1 / 0', { variables: {} }).success).toBe(false)
  })

  it('preserves power, unary, and logical operator precedence', () => {
    expect(evaluator.evaluate('-2 ^ 2', { variables: {} }))
      .toEqual({ success: true, value: -4 })
    expect(evaluator.evaluate('2 ^ 3 ^ 2', { variables: {} }))
      .toEqual({ success: true, value: 512 })
    expect(evaluator.evaluate('not false and 2 < 3 ? 7 : 0', { variables: {} }))
      .toEqual({ success: true, value: 7 })
  })

  it('supports direct variables, array aggregates, and unicode placeholder names', () => {
    expect(evaluator.evaluate('subtotal + sum({{line_items}})', {
      variables: { subtotal: 5, line_items: [1, 2, 3] },
    })).toEqual({ success: true, value: 11 })
    expect(evaluator.evaluate('{{presyo_ñ}} * 2', {
      variables: { 'presyo_ñ': 25 },
    })).toEqual({ success: true, value: 50 })
  })

  it('short-circuits conditionals and boolean branches', () => {
    expect(evaluator.evaluate('true ? 10 : missing()', { variables: {} }))
      .toEqual({ success: true, value: 10 })
    expect(evaluator.evaluate('false and missing() ? 1 : 2', { variables: {} }))
      .toEqual({ success: true, value: 2 })
  })

  it.each([
    'globalThis.process',
    'constructor("return 1")',
    'value = 10',
    '({}).constructor',
    '1; 2',
  ])('rejects access outside the expression grammar: %s', (expression) => {
    expect(evaluator.evaluate(expression, { variables: { value: 1 } }).success).toBe(false)
    if (!expression.startsWith('constructor(')) {
      expect(evaluator.validate(expression).valid).toBe(false)
    }
  })

  it('rejects expressions with excessive nesting', () => {
    const expression = `${'('.repeat(110)}1${')'.repeat(110)}`
    expect(evaluator.validate(expression).valid).toBe(false)
  })
})
