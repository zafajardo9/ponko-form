import { useEffect, useState, type ReactNode } from 'react'
import type { FlowVariable, FlowVariableType } from '../../../lib/flow-engine/types'
import { Switch } from '../../ui/Switch'

/**
 * Shared form controls for node config panels, styled to match the existing
 * FieldEditor / Input primitives.
 */

const selectClass =
  'h-10 w-full rounded-md border border-[#e6dfd8] bg-[#faf9f5] px-3 text-sm text-[#141413] outline-none focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/20 transition-colors'

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[#141413]">{label}</label>
      {children}
      {hint && <p className="text-xs text-[#8e8b82]">{hint}</p>}
    </div>
  )
}

export function Select({
  value,
  onChange,
  children,
}: {
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
      {children}
    </select>
  )
}

/** A <select> populated with declared variables, optionally filtered by type. */
export function VariableSelect({
  value,
  variables,
  onChange,
  filterTypes,
  placeholder = 'Select a variable…',
}: {
  value: string | undefined
  variables: FlowVariable[]
  onChange: (name: string) => void
  filterTypes?: FlowVariableType[]
  placeholder?: string
}) {
  const list = filterTypes ? variables.filter((v) => filterTypes.includes(v.type)) : variables
  return (
    <select className={selectClass} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {list.map((v) => (
        <option key={v.id} value={v.name}>
          {v.name} ({v.type})
        </option>
      ))}
    </select>
  )
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-[#e6dfd8] bg-[#faf9f5] px-3 py-2.5 transition-colors hover:border-[#cc785c]/60">
      <span>
        <span className="block text-sm font-medium text-[#141413]">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-5 text-[#8e8b82]">{description}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} stateLabel="hidden" size="md" aria-label={label} className="-mr-1 -mt-1" />
    </div>
  )
}

export const textInputClass =
  'h-10 w-full rounded-md border border-[#e6dfd8] bg-[#faf9f5] px-3.5 text-sm text-[#141413] placeholder:text-[#8e8b82] outline-none focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/20 transition-colors'

export const textAreaClass =
  'w-full rounded-md border border-[#e6dfd8] bg-[#faf9f5] px-3.5 py-2.5 text-sm text-[#141413] placeholder:text-[#8e8b82] outline-none focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/20 transition-colors'

/**
 * A text input that holds local state while typing and commits the value on
 * blur (matching the FieldEditor save-on-blur pattern). `resetKey` re-syncs the
 * local value when the selected node changes.
 */
export function TextField({
  value,
  onCommit,
  placeholder,
  type = 'text',
  resetKey,
}: {
  value: string
  onCommit: (value: string) => void
  placeholder?: string
  type?: 'text' | 'number'
  resetKey?: unknown
}) {
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [resetKey])
  return (
    <input
      type={type}
      value={local}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onCommit(local)}
      className={textInputClass}
    />
  )
}

export function TextAreaField({
  value,
  onCommit,
  placeholder,
  rows = 4,
  resetKey,
}: {
  value: string
  onCommit: (value: string) => void
  placeholder?: string
  rows?: number
  resetKey?: unknown
}) {
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [resetKey])
  return (
    <textarea
      value={local}
      placeholder={placeholder}
      rows={rows}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onCommit(local)}
      className={textAreaClass}
    />
  )
}

/** Common props every config form receives. */
export interface ConfigFormProps {
  /** The node id — used as a reset key so text fields re-sync when selection changes. */
  nodeId: number
  config: Record<string, unknown>
  variables: FlowVariable[]
  onChange: (patch: Record<string, unknown>) => void
  gateways?: { id: number; name: string }[]
}
