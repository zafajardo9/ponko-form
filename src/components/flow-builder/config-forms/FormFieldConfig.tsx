import { Field, Select, VariableSelect, Toggle, TextField, type ConfigFormProps } from './controls'
import { Button } from '../../ui/Button'

const FIELD_TYPES = ['text', 'email', 'number', 'textarea', 'select', 'checkbox', 'radio'] as const
const OPTION_TYPES = ['select', 'checkbox', 'radio']

/** Config form for a FormField node — mirrors the form builder's FieldEditor. */
export function FormFieldConfig({ nodeId, config, variables, onChange }: ConfigFormProps) {
  const fieldType = (config.fieldType as string) ?? ''
  const options = (config.options as { label: string; value: string }[] | undefined) ?? []
  const hasOptions = OPTION_TYPES.includes(fieldType)

  function setOptions(next: { label: string; value: string }[]) {
    onChange({ options: next })
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Field type">
        <Select value={fieldType} onChange={(v) => onChange({ fieldType: v })}>
          <option value="">Select a type…</option>
          {FIELD_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Label">
        <TextField
          resetKey={nodeId}
          value={(config.label as string) ?? ''}
          onCommit={(v) => onChange({ label: v })}
          placeholder="e.g. Your name"
        />
      </Field>

      {['text', 'email', 'number', 'textarea'].includes(fieldType) && (
        <Field label="Placeholder">
          <TextField
            resetKey={nodeId}
            value={(config.placeholder as string) ?? ''}
            onCommit={(v) => onChange({ placeholder: v })}
          />
        </Field>
      )}

      <Toggle
        label="Required"
        checked={Boolean(config.required)}
        onChange={(c) => onChange({ required: c })}
      />

      {hasOptions && (
        <Field label="Options">
          <div className="flex flex-col gap-2">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <TextField
                  resetKey={`${nodeId}-${i}`}
                  value={opt.label}
                  onCommit={(label) =>
                    setOptions(
                      options.map((o, idx) =>
                        idx === i ? { label, value: label.toLowerCase().replace(/\s+/g, '_') } : o,
                      ),
                    )
                  }
                  placeholder="Option label"
                />
                <button
                  onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
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
                setOptions([...options, { label: `Option ${options.length + 1}`, value: `option_${options.length + 1}` }])
              }
            >
              + Add option
            </Button>
          </div>
        </Field>
      )}

      <Field label="Bind to variable" hint="Stores the answer in this variable for later nodes.">
        <VariableSelect
          value={config.bindToVariable as string | undefined}
          variables={variables}
          onChange={(name) => onChange({ bindToVariable: name })}
        />
      </Field>
    </div>
  )
}
