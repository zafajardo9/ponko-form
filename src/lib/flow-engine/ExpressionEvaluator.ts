import {
  RESERVED_EXPRESSION_NAMES,
  evaluateSafeExpression,
  parseSafeExpression,
} from './safe-expression'

const PLACEHOLDER = /\{\{([^}]+)\}\}/g

/**
 * Evaluates the deliberately small expression language exposed by calculator
 * nodes. The parser never executes JavaScript and cannot access properties,
 * assignments, constructors, or global objects.
 */
export class ExpressionEvaluator {
  evaluate(
    expression: string,
    scope: {
      variables: Record<string, unknown>
      functions?: Record<string, (...args: unknown[]) => unknown>
    },
  ): { success: true; value: number } | { success: false; error: string } {
    try {
      const resolved = this.resolveVariables(expression, scope.variables)
      const directVariables = Object.fromEntries(
        Object.entries(scope.variables).filter(([name]) => !RESERVED_EXPRESSION_NAMES.has(name)),
      )
      const result = evaluateSafeExpression(
        parseSafeExpression(resolved.expression),
        { ...directVariables, ...resolved.bindings },
        scope.functions,
      )
      if (typeof result !== 'number' || !Number.isFinite(result)) {
        throw new Error('Expression must produce a finite number')
      }
      return { success: true, value: result }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown evaluation error',
      }
    }
  }

  validate(expression: string): { valid: boolean; error?: string } {
    try {
      parseSafeExpression(expression.replace(PLACEHOLDER, '1'))
      return { valid: true }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid expression',
      }
    }
  }

  private resolveVariables(
    expression: string,
    variables: Record<string, unknown>,
  ): { expression: string; bindings: Record<string, unknown> } {
    const bindings: Record<string, unknown> = {}
    let bindingIndex = 0
    const resolvedExpression = expression.replace(PLACEHOLDER, (_match, variableName) => {
      const trimmed = variableName.trim()
      if (!Object.hasOwn(variables, trimmed)) {
        throw new Error(
          `Unknown variable: "${trimmed}". Declare it in the Variables Manager first.`,
        )
      }
      const bindingName = `__ponko_var_${bindingIndex++}`
      bindings[bindingName] = variables[trimmed] ?? 0
      return bindingName
    })
    return { expression: resolvedExpression, bindings }
  }
}
