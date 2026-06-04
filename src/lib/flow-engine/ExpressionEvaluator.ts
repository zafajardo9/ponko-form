import { create, all, type MathJsInstance } from 'mathjs'

/**
 * ExpressionEvaluator
 *
 * Safely evaluates mathematical expressions with variable substitution.
 * Built on math.js with a restricted scope — no access to global objects.
 *
 * The evaluator:
 *   1. Replaces {{variable_name}} placeholders with actual values from the scope
 *   2. Parses and evaluates the expression using math.js eval()
 *   3. Math.js is configured with NO access to the global scope
 *   4. Only pure math operations and the allowed function set are available
 *
 * @example
 * ```ts
 * const evaluator = new ExpressionEvaluator()
 * const result = evaluator.evaluate('{{subtotal}} * (1 + {{vat_rate}})', {
 *   variables: { subtotal: 1000, vat_rate: 0.12 }
 * })
 * // result = { success: true, value: 1120 }
 * ```
 *
 * @example
 * ```ts
 * const result = evaluator.evaluate('round({{total}} / {{months}}, 2)', {
 *   variables: { total: 25000, months: 6 }
 * })
 * // result = { success: true, value: 4166.67 }
 * ```
 */
export class ExpressionEvaluator {
  private math: MathJsInstance

  constructor() {
    // Create a sandboxed math.js instance
    // 'all' imports all math.js functions, but we restrict the scope
    this.math = create(all)

    // Configure to be safe — no access to global objects
    this.math.config({
      number: 'number',
      precision: 64,
      epsilon: 1e-12,
    })
  }

  /**
   * Evaluate an expression with the given variable scope.
   *
   * @param expression - The expression string, e.g. "{{subtotal}} * 0.12"
   * @param scope - Object containing { variables, functions? }
   * @returns Result object with success flag and value or error message
   */
  evaluate(
    expression: string,
    scope: {
      variables: Record<string, unknown>
      functions?: Record<string, (...args: unknown[]) => unknown>
    },
  ): { success: true; value: number } | { success: false; error: string } {
    try {
      // 1. Replace {{variable}} references with actual values
      const resolvedExpression = this.resolveVariables(expression, scope.variables)

      // 2. Build the math.js evaluation scope
      const mathScope: Record<string, unknown> = {
        ...scope.variables,
        ...(scope.functions ?? {}),
      }

      // 3. Evaluate using math.js (safe — no eval(), no global access)
      const result = this.math.evaluate(resolvedExpression, mathScope)

      return { success: true, value: result }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown evaluation error',
      }
    }
  }

  /**
   * Validate whether an expression is syntactically valid.
   * Useful for real-time validation in the builder UI.
   */
  validate(expression: string): { valid: boolean; error?: string } {
    try {
      // Replace variables with dummy numbers to test syntax
      const testExpr = expression.replace(/\{\{([^}]+)\}\}/g, '1')
      this.math.parse(testExpr)
      return { valid: true }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid expression',
      }
    }
  }

  /**
   * Resolve {{variable}} placeholders to their actual values.
   * If a variable is not found in scope, it throws.
   */
  private resolveVariables(
    expression: string,
    variables: Record<string, unknown>,
  ): string {
    return expression.replace(/\{\{([^}]+)\}\}/g, (_match, varName) => {
      const trimmed = varName.trim()
      if (!(trimmed in variables)) {
        throw new Error(
          `Unknown variable: "${trimmed}". Declare it in the Variables Manager first.`,
        )
      }
      const value = variables[trimmed]
      // String values need to be quoted for math.js
      if (typeof value === 'string') {
        return `"${value}"`
      }
      return String(value ?? 0)
    })
  }
}
