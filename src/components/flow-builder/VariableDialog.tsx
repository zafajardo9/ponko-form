import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '../ui/Button'
import { Field, Select, textInputClass } from './config-forms/Controls'
import type { FlowVariable, FlowVariableType } from '../../lib/flow-engine/types'

const TYPES: FlowVariableType[] = ['string', 'number', 'boolean', 'money', 'date', 'time', 'datetime']

const TYPE_HINT: Record<FlowVariableType, string> = {
  string: 'Text — names, choices, codes.',
  number: 'Plain number — quantities, counts.',
  money: 'Currency amount — used in payments and totals.',
  boolean: 'True / false.',
  date: 'A calendar date — YYYY-MM-DD.',
  time: 'A time of day — HH:mm.',
  datetime: 'A date with time — YYYY-MM-DDTHH:mm.',
}

export interface VariableDraft {
  name: string
  type: FlowVariableType
  defaultValue: string | null
  description: string | null
}

interface VariableDialogProps {
  mode: 'create' | 'edit'
  initial?: FlowVariable | null
  /** Names already in use (excluding the one being edited) — for duplicate check. */
  existingNames: string[]
  onSave: (draft: VariableDraft) => void
  onClose: () => void
}

/** A variable name must be a valid expression identifier: a-z, 0-9, underscore. */
function nameError(name: string, existing: string[]): string | null {
  const n = name.trim()
  if (!n) return 'Name is required.'
  if (!/^[a-z][a-z0-9_]*$/.test(n))
    return 'Use lowercase letters, numbers and underscores (must start with a letter).'
  if (existing.includes(n)) return 'A variable with this name already exists.'
  return null
}

/**
 * VariableDialog
 *
 * Modal for creating or editing a single flow variable (name, type, default,
 * description). Keeps the Variables panel itself a clean list — all the input
 * lives here. Matches the app's dialog chrome (backdrop click / Escape close).
 */
export function VariableDialog({ mode, initial, existingNames, onSave, onClose }: VariableDialogProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<FlowVariableType>(initial?.type ?? 'string')
  const [defaultValue, setDefaultValue] = useState(initial?.defaultValue ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const error = nameError(name, existingNames)

  function save() {
    setTouched(true)
    if (error) return
    onSave({
      name: name.trim(),
      type,
      defaultValue: defaultValue.trim() === '' ? null : defaultValue.trim(),
      description: description.trim() === '' ? null : description.trim(),
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex w-full max-w-md flex-col rounded-xl bg-[#f5f0e8] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between rounded-t-xl border-b border-[#e6dfd8] bg-[#faf9f5] px-5 py-3">
          <span className="text-sm font-medium text-[#141413]">
            {mode === 'create' ? 'New variable' : 'Edit variable'}
          </span>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#8e8b82] hover:bg-[#e8e0d2] hover:text-[#141413]"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 p-5">
          <Field label="Name" hint="Referenced in expressions as {{name}}.">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="variable_name"
              className={`${textInputClass} ${
                touched && error ? 'border-[#c64545] focus:border-[#c64545] focus:ring-[#c64545]/20' : ''
              }`}
            />
            {touched && error && <p className="text-xs text-[#c64545]">{error}</p>}
          </Field>

          <Field label="Type" hint={TYPE_HINT[type]}>
            <Select value={type} onChange={(t) => setType(t as FlowVariableType)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Default value" hint="Optional — used if the respondent never sets it.">
            {type === 'boolean' ? (
              <Select value={defaultValue} onChange={setDefaultValue}>
                <option value="">None</option>
                <option value="true">true</option>
                <option value="false">false</option>
              </Select>
            ) : type === 'date' ? (
              <input
                type="date"
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
                className={textInputClass}
              />
            ) : type === 'time' ? (
              <input
                type="time"
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
                className={textInputClass}
              />
            ) : type === 'datetime' ? (
              <input
                type="datetime-local"
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
                className={textInputClass}
              />
            ) : (
              <input
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
                type={type === 'number' || type === 'money' ? 'number' : 'text'}
                placeholder={type === 'money' || type === 'number' ? '0' : 'Optional'}
                className={textInputClass}
              />
            )}
          </Field>

          <Field label="Description" hint="Optional — a note to your future self.">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this holds"
              className={textInputClass}
            />
          </Field>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 rounded-b-xl border-t border-[#e6dfd8] bg-[#faf9f5] px-5 py-3">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={!!error}>
            {mode === 'create' ? 'Add variable' : 'Save changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}
