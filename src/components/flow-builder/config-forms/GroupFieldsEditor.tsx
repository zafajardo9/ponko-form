import { useState } from 'react'
import {
  Type,
  Mail,
  Hash,
  AlignLeft,
  ChevronDownSquare,
  CheckSquare,
  CircleDot,
  ChevronRight,
  ChevronDown,
  Plus,
  X,
  Calendar,
  Clock,
} from 'lucide-react'
import { Field, Select, VariableSelect, Toggle, TextField } from './controls'
import { OptionsEditor } from './OptionsEditor'
import type { FlowVariable, GroupedField } from '../../../lib/flow-engine/types'

/**
 * GroupFieldsEditor
 *
 * The "container" body shared by the List and Canvas Field Group renderers.
 * Renders a Field Group's inline fields (`config.fields`) as a vertical list of
 * collapsible rows — a mini form-builder for the single step the group
 * represents. Each row collapses to a summary (icon · label · type) and expands
 * in place to edit the field's settings. Mirrors the top-level List logic so a
 * group reads as "a list of fields on one page."
 *
 * It is purely controlled: it never persists on its own, it just calls
 * `onChange` with the next `fields` array. The caller decides how to save.
 */

const FIELD_TYPES = ['text', 'email', 'number', 'textarea', 'select', 'checkbox', 'radio', 'date', 'time', 'datetime'] as const
const OPTION_TYPES = ['select', 'checkbox', 'radio']
const TEXT_TYPES = ['text', 'email', 'number', 'textarea', 'date', 'time', 'datetime']

const FIELD_ICON: Record<string, React.ReactNode> = {
  text: <Type size={13} />,
  email: <Mail size={13} />,
  number: <Hash size={13} />,
  textarea: <AlignLeft size={13} />,
  select: <ChevronDownSquare size={13} />,
  checkbox: <CheckSquare size={13} />,
  radio: <CircleDot size={13} />,
  date: <Calendar size={13} />,
  time: <Clock size={13} />,
  datetime: <Calendar size={13} />,
}

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

interface GroupFieldsEditorProps {
  fields: GroupedField[]
  variables: FlowVariable[]
  onChange: (fields: GroupedField[]) => void
  /**
   * When rendered inside a React Flow canvas node, adds the `nodrag`/`nopan`
   * guards so interacting with inputs doesn't drag or pan the canvas.
   */
  insideCanvas?: boolean
}

export function GroupFieldsEditor({
  fields,
  variables,
  onChange,
  insideCanvas = false,
}: GroupFieldsEditorProps) {
  // Which field row is expanded for editing (one at a time).
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function patchField(id: string, patch: Partial<GroupedField>) {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }

  function removeField(id: string) {
    onChange(fields.filter((f) => f.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  function addField() {
    const field: GroupedField = {
      id: newId(),
      fieldType: 'text',
      label: `Field ${fields.length + 1}`,
      required: false,
    }
    onChange([...fields, field])
    setExpandedId(field.id)
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= fields.length) return
    const next = [...fields]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  const guard = insideCanvas ? 'nodrag nopan' : ''

  return (
    <div className={`flex flex-col gap-2 ${guard}`}>
      {fields.length === 0 && (
        <p className="rounded-lg border border-dashed border-[#e6dfd8] px-3 py-4 text-center text-xs text-[#8e8b82]">
          No fields yet — add fields below. They'll all appear on one page.
        </p>
      )}

      {fields.map((field, i) => {
        const expanded = expandedId === field.id
        const hasOptions = OPTION_TYPES.includes(field.fieldType)
        const options = field.options ?? []
        return (
          <div
            key={field.id}
            className={`rounded-lg border bg-[#faf9f5] transition-colors ${
              expanded ? 'border-[#cc785c]' : 'border-[#e6dfd8] hover:border-[#cc785c]/50'
            }`}
          >
            {/* Collapsed summary row */}
            <div className="flex items-center gap-2 px-2.5 py-2">
              <span className="flex flex-col text-[#c3bfb6]">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="leading-none hover:text-[#141413] disabled:opacity-30"
                  aria-label="Move field up"
                >
                  ▴
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === fields.length - 1}
                  className="leading-none hover:text-[#141413] disabled:opacity-30"
                  aria-label="Move field down"
                >
                  ▾
                </button>
              </span>
              <button
                onClick={() => setExpandedId(expanded ? null : field.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded bg-[#f3e3da] text-[#a9583e]">
                  {FIELD_ICON[field.fieldType] ?? <Type size={13} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[#141413]">
                    {field.label || 'Untitled field'}
                  </span>
                </span>
                <span className="flex-none rounded bg-[#efe9de] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#8e8b82]">
                  {field.fieldType}
                </span>
                {field.required && (
                  <span className="flex-none text-[10px] font-medium text-[#cc785c]">required</span>
                )}
                <span className="flex-none text-[#8e8b82]">
                  {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </span>
              </button>
              <button
                onClick={() => removeField(field.id)}
                className="flex-none text-[#8e8b82] hover:text-[#c64545]"
                aria-label="Remove field"
              >
                <X size={14} />
              </button>
            </div>

            {/* Expanded inline editor */}
            {expanded && (
              <div className="flex flex-col gap-3 border-t border-[#e6dfd8] px-3 py-3">
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

                {TEXT_TYPES.includes(field.fieldType) && (
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
                    <OptionsEditor
                      options={options}
                      onChange={(next) => patchField(field.id, { options: next })}
                      resetKeyPrefix={field.id}
                    />
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
            )}
          </div>
        )
      })}

      <button
        onClick={addField}
        className={`flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#cc785c]/50 px-3 py-2 text-sm font-medium text-[#cc785c] hover:bg-[#f3e3da]/40 ${guard}`}
      >
        <Plus size={15} /> Add field
      </button>
    </div>
  )
}
