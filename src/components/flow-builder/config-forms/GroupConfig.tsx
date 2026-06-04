import { Field, Select, VariableSelect, Toggle, TextField, type ConfigFormProps } from './controls'
import { Button } from '../../ui/Button'
import type { GroupedField } from '../../../lib/flow-engine/types'

const FIELD_TYPES = ['text', 'email', 'number', 'textarea', 'select', 'checkbox', 'radio'] as const
const OPTION_TYPES = ['select', 'checkbox', 'radio']

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Config form for a Group node.
 *
 * A group bundles several fields onto a single step so the end user fills them
 * all out before continuing — instead of one field per "Next". Fields live
 * inline in the node's `config.fields` (they are not separate graph nodes).
 */
export function GroupConfig({ nodeId, config, variables, onChange }: ConfigFormProps) {
  const fields = (config.fields as GroupedField[] | undefined) ?? []

  function setFields(next: GroupedField[]) {
    onChange({ fields: next })
  }

  function patchField(id: string, patch: Partial<GroupedField>) {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }

  function addField() {
    setFields([
      ...fields,
      { id: newId(), fieldType: 'text', label: `Field ${fields.length + 1}`, required: false },
    ])
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= fields.length) return
    const next = [...fields]
    ;[next[index], next[target]] = [next[target], next[index]]
    setFields(next)
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Group title" hint="Shown as a heading above the fields (optional).">
        <TextField
          resetKey={nodeId}
          value={(config.title as string) ?? ''}
          onCommit={(v) => onChange({ title: v })}
          placeholder="e.g. Your details"
        />
      </Field>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-[#8e8b82]">
          Fields ({fields.length})
        </p>

        {fields.length === 0 && (
          <p className="text-sm text-[#8e8b82]">
            No fields yet. Add fields below — they'll all appear on one step.
          </p>
        )}

        {fields.map((field, i) => {
          const hasOptions = OPTION_TYPES.includes(field.fieldType)
          const options = field.options ?? []
          return (
            <div
              key={field.id}
              className="flex flex-col gap-3 rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#57544d]">Field {i + 1}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="px-1 text-[#8e8b82] hover:text-[#141413] disabled:opacity-30"
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === fields.length - 1}
                    className="px-1 text-[#8e8b82] hover:text-[#141413] disabled:opacity-30"
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => setFields(fields.filter((f) => f.id !== field.id))}
                    className="px-1 text-[#8e8b82] hover:text-[#c64545]"
                    aria-label="Remove field"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <Field label="Field type">
                <Select
                  value={field.fieldType}
                  onChange={(v) => patchField(field.id, { fieldType: v })}
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Label">
                <TextField
                  resetKey={field.id}
                  value={field.label}
                  onCommit={(v) => patchField(field.id, { label: v })}
                  placeholder="e.g. Your name"
                />
              </Field>

              {['text', 'email', 'number', 'textarea'].includes(field.fieldType) && (
                <Field label="Placeholder">
                  <TextField
                    resetKey={field.id}
                    value={field.placeholder ?? ''}
                    onCommit={(v) => patchField(field.id, { placeholder: v })}
                  />
                </Field>
              )}

              <Toggle
                label="Required"
                checked={Boolean(field.required)}
                onChange={(c) => patchField(field.id, { required: c })}
              />

              {hasOptions && (
                <Field label="Options">
                  <div className="flex flex-col gap-2">
                    {options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <TextField
                          resetKey={`${field.id}-${oi}`}
                          value={opt.label}
                          onCommit={(label) =>
                            patchField(field.id, {
                              options: options.map((o, idx) =>
                                idx === oi
                                  ? { label, value: label.toLowerCase().replace(/\s+/g, '_') }
                                  : o,
                              ),
                            })
                          }
                          placeholder="Option label"
                        />
                        <button
                          onClick={() =>
                            patchField(field.id, {
                              options: options.filter((_, idx) => idx !== oi),
                            })
                          }
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
                        patchField(field.id, {
                          options: [
                            ...options,
                            {
                              label: `Option ${options.length + 1}`,
                              value: `option_${options.length + 1}`,
                            },
                          ],
                        })
                      }
                    >
                      + Add option
                    </Button>
                  </div>
                </Field>
              )}

              <Field label="Bind to variable" hint="Stores this field's answer for later nodes.">
                <VariableSelect
                  value={field.bindToVariable}
                  variables={variables}
                  onChange={(name) => patchField(field.id, { bindToVariable: name })}
                />
              </Field>
            </div>
          )
        })}

        <Button variant="secondary" size="sm" onClick={addField}>
          + Add field
        </Button>
      </div>
    </div>
  )
}
