import { useEffect, useState } from 'react'
import { Field, VariableSelect, textAreaClass, type ConfigFormProps } from './controls'
import { Button } from '../../ui/Button'
import { ExpressionEvaluator } from '../../../lib/flow-engine/ExpressionEvaluator'

const FUNCTIONS = ['round', 'sum', 'min', 'max', 'abs']
const evaluator = new ExpressionEvaluator()

/**
 * Config form for a Calculator node: target variable + an expression with a
 * variable/function picker and a "Test" button that evaluates against the
 * flow's current default values.
 */
export function CalculatorConfig({ nodeId, config, variables, onChange }: ConfigFormProps) {
  const [expr, setExpr] = useState((config.expression as string) ?? '')
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    setExpr((config.expression as string) ?? '')
    setTest(null)
  }, [nodeId])

  function commit(next: string) {
    setExpr(next)
    onChange({ expression: next })
  }

  function insert(token: string) {
    const next = expr ? `${expr} ${token}` : token
    commit(next)
  }

  function runTest() {
    const defaults: Record<string, unknown> = {}
    for (const v of variables) {
      if (v.defaultValue === null) continue
      defaults[v.name] = v.type === 'number' || v.type === 'money' ? Number(v.defaultValue) : v.defaultValue
    }
    const result = evaluator.evaluate(expr, { variables: defaults })
    setTest(
      result.success
        ? { ok: true, text: `= ${result.value}` }
        : { ok: false, text: result.error },
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Target variable" hint="The computed result is stored here.">
        <VariableSelect
          value={config.targetVariable as string | undefined}
          variables={variables}
          filterTypes={['number', 'money']}
          onChange={(name) => onChange({ targetVariable: name })}
        />
      </Field>

      <Field label="Expression" hint="Use {{variable}} placeholders, e.g. {{subtotal}} * 1.12">
        <textarea
          value={expr}
          rows={3}
          onChange={(e) => setExpr(e.target.value)}
          onBlur={() => commit(expr)}
          placeholder="{{subtotal}} * 1.12"
          className={textAreaClass}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-[#8e8b82]">Insert variable</p>
        <div className="flex flex-wrap gap-1.5">
          {variables.map((v) => (
            <button
              key={v.id}
              onClick={() => insert(`{{${v.name}}}`)}
              className="rounded-md border border-[#e6dfd8] bg-white px-2 py-1 text-xs text-[#57544d] hover:border-[#cc785c]"
            >
              {v.name}
            </button>
          ))}
          {variables.length === 0 && (
            <span className="text-xs text-[#8e8b82]">No variables declared yet.</span>
          )}
        </div>
        <p className="mt-1 text-xs font-medium text-[#8e8b82]">Functions</p>
        <div className="flex flex-wrap gap-1.5">
          {FUNCTIONS.map((fn) => (
            <button
              key={fn}
              onClick={() => insert(`${fn}()`)}
              className="rounded-md border border-[#e6dfd8] bg-white px-2 py-1 text-xs text-[#57544d] hover:border-[#cc785c]"
            >
              {fn}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={runTest}>
          Test expression
        </Button>
        {test && (
          <span className={`text-sm ${test.ok ? 'text-[#2f7d52]' : 'text-[#c64545]'}`}>{test.text}</span>
        )}
      </div>
    </div>
  )
}
