import { useState } from 'react'
import { Button } from '../ui/Button'
import { Select, TextField } from './config-forms/controls'
import type { FlowNode, FlowVariable, FlowVariableType } from '../../lib/flow-engine/types'

const TYPES: FlowVariableType[] = ['string', 'number', 'boolean', 'money']

const TYPE_BADGE: Record<FlowVariableType, string> = {
  string: 'bg-[#dbe7f7] text-[#2f5a9e]',
  number: 'bg-[#e7ddf7] text-[#6b46a8]',
  boolean: 'bg-[#f7ecd0] text-[#9e7424]',
  money: 'bg-[#d8f0e0] text-[#2f7d52]',
}

/** Whether a node references a variable by name (binding/source/target/amount or placeholder). */
export function nodeReferencesVariable(config: Record<string, unknown>, name: string): boolean {
  if ([config.bindToVariable, config.sourceVariable, config.targetVariable, config.amountVariable].includes(name))
    return true
  const placeholder = `{{${name}}}`
  for (const key of ['expression', 'template', 'urlTemplate'] as const) {
    const val = config[key]
    if (typeof val === 'string' && val.includes(placeholder)) return true
  }
  return false
}

/**
 * VariablesManager
 *
 * Lists declared variables with editable name/type/default/description, a
 * reference count, and add/delete actions. Delete is disabled when a variable
 * is referenced by any node. Changes auto-save on blur (text) or on change
 * (selects).
 */
interface VariablesManagerProps {
  variables: FlowVariable[]
  nodes: FlowNode[]
  onCreate: (v: { name: string; type: FlowVariableType; defaultValue?: string; description?: string }) => void
  onUpdate: (varId: number, changes: Partial<Pick<FlowVariable, 'name' | 'type' | 'defaultValue' | 'description'>>) => void
  onDelete: (varId: number) => void
  onClose: () => void
}

export function VariablesManager({
  variables,
  nodes,
  onCreate,
  onUpdate,
  onDelete,
  onClose,
}: VariablesManagerProps) {
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<FlowVariableType>('string')

  function refCount(name: string): number {
    return nodes.filter((n) => nodeReferencesVariable(n.config, name)).length
  }

  function addVariable() {
    const name = newName.trim()
    if (!name) return
    onCreate({ name, type: newType })
    setNewName('')
    setNewType('string')
  }

  return (
    <aside className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-[#8e8b82]">Variables</p>
        <button onClick={onClose} className="text-sm text-[#8e8b82] hover:text-[#141413]">
          ✕
        </button>
      </div>

      {/* Add new */}
      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-[#e6dfd8] p-3">
        <TextField value={newName} onCommit={setNewName} resetKey={variables.length} placeholder="variable_name (snake_case)" />
        <Select value={newType} onChange={(v) => setNewType(v as FlowVariableType)}>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Button size="sm" onClick={addVariable}>
          + Add Variable
        </Button>
      </div>

      {/* List */}
      <div className="flex flex-col gap-3">
        {variables.length === 0 && (
          <p className="text-center text-sm text-[#8e8b82]">No variables yet.</p>
        )}
        {variables.map((v) => {
          const count = refCount(v.name)
          return (
            <div key={v.id} className="flex flex-col gap-2 rounded-lg border border-[#e6dfd8] bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${TYPE_BADGE[v.type]}`}>
                  {v.type}
                </span>
                <button
                  disabled={count > 0}
                  title={count > 0 ? `Referenced by ${count} node(s)` : 'Delete variable'}
                  onClick={() => onDelete(v.id)}
                  className="text-sm text-[#8e8b82] enabled:hover:text-[#c64545] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ✕
                </button>
              </div>

              <TextField
                resetKey={v.id}
                value={v.name}
                onCommit={(name) => name !== v.name && onUpdate(v.id, { name })}
                placeholder="name"
              />
              <Select value={v.type} onChange={(t) => onUpdate(v.id, { type: t as FlowVariableType })}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
              <TextField
                resetKey={v.id}
                value={v.defaultValue ?? ''}
                onCommit={(dv) => onUpdate(v.id, { defaultValue: dv === '' ? null : dv })}
                placeholder="default value (optional)"
              />
              <TextField
                resetKey={v.id}
                value={v.description ?? ''}
                onCommit={(d) => onUpdate(v.id, { description: d === '' ? null : d })}
                placeholder="description (optional)"
              />
              <p className="text-xs text-[#8e8b82]">
                {count === 0 ? 'Unused' : `Used by ${count} node${count === 1 ? '' : 's'}`}
              </p>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
