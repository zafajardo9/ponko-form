import { Field, Select, VariableSelect, Toggle, TextField, type ConfigFormProps } from './controls'
import { OptionsEditor } from './OptionsEditor'

const FIELD_TYPES = ['text', 'email', 'number', 'textarea', 'select', 'checkbox', 'radio', 'date', 'time', 'datetime'] as const
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

      {['text', 'email', 'number', 'textarea', 'date', 'time', 'datetime'].includes(fieldType) && (
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
          <OptionsEditor options={options} onChange={setOptions} resetKeyPrefix={nodeId} />
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
