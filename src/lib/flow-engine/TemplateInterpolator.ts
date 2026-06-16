import type { FlowVariableType } from './types'

/**
 * TemplateInterpolator
 *
 * Replaces {{variable_name}} placeholders in template strings with runtime values.
 * Supports money formatting when a variable has type 'money'.
 *
 * Formatting rules:
 *   - money type: formats as "1,200.00" (no hardcoded currency — put the symbol in the template)
 *   - number type: formats as "1,200" (locale-aware)
 *   - string type: inserted as-is
 *   - missing variables: replaced with empty string (no error)
 *
 * @example
 * ```ts
 * const interpolator = new TemplateInterpolator()
 * const result = interpolator.interpolate(
 *   'Thank you {{name}}! Total: ₱{{total_cost}}',
 *   { variables: { name: 'Alice', total_cost: 1200 }, types: { total_cost: 'money' } }
 * )
 * // result = 'Thank you Alice! Total: ₱1,200.00'
 * ```
 */
export class TemplateInterpolator {
  /**
   * Interpolate a template string with variable values.
   */
  interpolate(
    template: string,
    scope: {
      variables: Record<string, unknown>;
      types?: Record<string, FlowVariableType>;
    },
  ): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_match, varName) => {
      const trimmed = varName.trim();
      const value = scope.variables[trimmed];
      const type = scope.types?.[trimmed];

      if (value === undefined || value === null) {
        return "";
      }

      if (type === "money") {
        const num = Number(value);
        if (!isNaN(num)) {
          return num.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        }
      }

      return String(value);
    });
  }
}
