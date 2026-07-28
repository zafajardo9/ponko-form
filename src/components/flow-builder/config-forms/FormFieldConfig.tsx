import { Field, Select, VariableSelect, Toggle, TextField, type ConfigFormProps } from './Controls'
import { OptionsEditor } from './OptionsEditor'

const FIELD_TYPES = [
  { value: 'text', label: 'Short text' },
  { value: 'email', label: 'Email' },
  { value: 'number', label: 'Number' },
  { value: 'textarea', label: 'Long text' },
  { value: 'select', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkboxes' },
  { value: 'radio', label: 'Single choice' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'datetime', label: 'Date and time' },
] as const
const OPTION_TYPES = ['select', 'checkbox', 'radio']
const FIELD_DESCRIPTIONS: Record<string, string> = {
  text: 'Collects a short, single-line answer.',
  email: 'Collects an email address with browser validation.',
  number: 'Collects a numeric answer for calculations and logic.',
  textarea: 'Collects a longer, multi-line answer.',
  select: 'Lets people choose one option from a compact menu.',
  checkbox: 'Lets people choose one or more visible options.',
  radio: 'Lets people choose exactly one visible option.',
  date: 'Collects a calendar date.',
  time: 'Collects a time of day.',
  datetime: 'Collects a calendar date and time.',
}

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
      {fieldType && (
        <p className="rounded-lg border border-[#e6dfd8] bg-[#f5f0e8] px-3 py-2.5 text-xs leading-5 text-[#6c6a64]">
          {FIELD_DESCRIPTIONS[fieldType]}
        </p>
      )}
      <Field label="Field type">
        <Select value={fieldType} onChange={(v) => onChange({ fieldType: v })}>
          <option value="">Select a type…</option>
          {FIELD_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
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
        label="Answer required"
        description="People must answer before they can continue."
        checked={Boolean(config.required)}
        onChange={(c) => onChange({ required: c })}
      />

      {hasOptions && (
        <Field label="Options">
          <OptionsEditor options={options} onChange={setOptions} resetKeyPrefix={nodeId} />
        </Field>
      )}

      <Field label="Answer variable" hint="Stores the answer so later logic, calculations, and payments can use it.">
        <VariableSelect
          value={config.bindToVariable as string | undefined}
          variables={variables}
          onChange={(name) => onChange({ bindToVariable: name })}
        />
      </Field>
    </div>
  )
}
