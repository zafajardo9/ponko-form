import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { VariableDialog, type VariableDraft } from './VariableDialog'
import type { FlowNode, FlowVariable, FlowVariableType } from '../../lib/flow-engine/types'

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
 * A clean, scannable list of the flow's declared variables. Each row shows the
 * name, type, optional default, and how many nodes use it. Creating and editing
 * happen in a dedicated {@link VariableDialog} (opened via "Add variable" or the
 * per-row edit button), so the panel itself stays a simple list. Delete is
 * disabled while a variable is referenced by any node.
 */
type DialogState =
  | { mode: 'create' }
  | { mode: 'edit'; variable: FlowVariable }
  | null

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
  const [dialog, setDialog] = useState<DialogState>(null)

  function refCount(name: string): number {
    return nodes.filter((n) => nodeReferencesVariable(n.config, name)).length
  }

  function handleSave(draft: VariableDraft) {
    if (dialog?.mode === 'edit') {
      onUpdate(dialog.variable.id, {
        name: draft.name,
        type: draft.type,
        defaultValue: draft.defaultValue,
        description: draft.description,
      })
    } else {
      onCreate({
        name: draft.name,
        type: draft.type,
        defaultValue: draft.defaultValue ?? undefined,
        description: draft.description ?? undefined,
      })
    }
    setDialog(null)
  }

  // Names taken — excluding the one being edited (so renaming to itself is fine).
  const takenNames = variables
    .filter((v) => !(dialog?.mode === 'edit' && v.id === dialog.variable.id))
    .map((v) => v.name)

  return (
    <aside className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-[#8e8b82]">Variables</p>
        <button onClick={onClose} className="text-sm text-[#8e8b82] hover:text-[#141413]">
          ✕
        </button>
      </div>

      <button
        onClick={() => setDialog({ mode: 'create' })}
        className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#cc785c]/50 px-3 py-2 text-sm font-medium text-[#cc785c] hover:bg-[#f3e3da]/40"
      >
        <Plus size={15} /> Add variable
      </button>

      {/* List */}
      <div className="flex flex-col gap-2">
        {variables.length === 0 && (
          <p className="rounded-lg border border-dashed border-[#e6dfd8] px-3 py-6 text-center text-sm text-[#8e8b82]">
            No variables yet. Add one to capture and compute values across your flow.
          </p>
        )}
        {variables.map((v) => {
          const count = refCount(v.name)
          return (
            <div
              key={v.id}
              className="group flex items-center gap-2.5 rounded-lg border border-[#e6dfd8] bg-white px-3 py-2.5"
            >
              <span
                className={`flex-none rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${TYPE_BADGE[v.type]}`}
              >
                {v.type}
              </span>
              <button
                onClick={() => setDialog({ mode: 'edit', variable: v })}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate font-mono text-sm text-[#141413]">{v.name}</span>
                <span className="block truncate text-xs text-[#8e8b82]">
                  {v.defaultValue ? `= ${v.defaultValue} · ` : ''}
                  {count === 0 ? 'Unused' : `Used by ${count} node${count === 1 ? '' : 's'}`}
                </span>
              </button>
              <button
                onClick={() => setDialog({ mode: 'edit', variable: v })}
                className="hidden flex-none text-[#8e8b82] hover:text-[#cc785c] group-hover:block"
                aria-label="Edit variable"
              >
                <Pencil size={14} />
              </button>
              <button
                disabled={count > 0}
                title={count > 0 ? `Referenced by ${count} node(s)` : 'Delete variable'}
                onClick={() => onDelete(v.id)}
                className="flex-none text-[#8e8b82] enabled:hover:text-[#c64545] disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Delete variable"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )
        })}
      </div>

      {dialog && (
        <VariableDialog
          mode={dialog.mode}
          initial={dialog.mode === 'edit' ? dialog.variable : null}
          existingNames={takenNames}
          onSave={handleSave}
          onClose={() => setDialog(null)}
        />
      )}
    </aside>
  )
}
