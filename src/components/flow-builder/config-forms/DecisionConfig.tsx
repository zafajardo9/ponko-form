import { Field, VariableSelect, TextField, type ConfigFormProps } from './Controls'
import { Button } from '../../ui/Button'

/**
 * Config form for a Decision node.
 *
 * Defines the source variable and the branch values. Each branch's `value`
 * is what an outgoing edge's `matchValue` must equal to be taken at runtime —
 * connect each branch to a target node on the canvas and the edge label shows
 * the matching value.
 */
export function DecisionConfig({ nodeId, config, variables, onChange }: ConfigFormProps) {
  const branches = (config.branches as { value: string; label: string }[] | undefined) ?? []

  function setBranches(next: { value: string; label: string }[]) {
    onChange({ branches: next })
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Source variable" hint="The flow branches based on this variable's value.">
        <VariableSelect
          value={config.sourceVariable as string | undefined}
          variables={variables}
          onChange={(name) => onChange({ sourceVariable: name })}
        />
      </Field>

      <Field label="Branches" hint="Connect each branch value to a node on the canvas.">
        <div className="flex flex-col gap-2">
          {branches.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <TextField
                resetKey={`${nodeId}-label-${i}`}
                value={b.label}
                onCommit={(label) =>
                  setBranches(branches.map((x, idx) => (idx === i ? { ...x, label } : x)))
                }
                placeholder="Branch label"
              />
              <TextField
                resetKey={`${nodeId}-value-${i}`}
                value={b.value}
                onCommit={(value) =>
                  setBranches(branches.map((x, idx) => (idx === i ? { ...x, value } : x)))
                }
                placeholder="match value"
              />
              <button
                onClick={() => setBranches(branches.filter((_, idx) => idx !== i))}
                className="text-sm text-[#8e8b82] hover:text-[#c64545]"
              >
                ✕
              </button>
            </div>
          ))}
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setBranches([...branches, { label: `Branch ${branches.length + 1}`, value: `value_${branches.length + 1}` }])
            }
          >
            + Add branch
          </Button>
        </div>
      </Field>
    </div>
  )
}
