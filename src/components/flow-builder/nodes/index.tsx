import { Handle, Position, type NodeProps, type NodeTypes } from '@xyflow/react'
import { NodeShell, type FlowNodeData } from './NodeShell'
import { FlowValidationBadge } from '../FlowValidationBadge'
import { GroupFieldsEditor } from '../config-forms/GroupFieldsEditor'
import { TextField } from '../config-forms/Controls'
import type { FlowVariable, GroupedField } from '../../../lib/flow-engine/types'

/**
 * Custom React Flow node components — one per flow node type.
 *
 * Each renders the shared NodeShell with a type-specific icon, accent color,
 * handle configuration, and a short detail line derived from its config.
 * The `nodeTypes` map at the bottom is passed to <ReactFlow nodeTypes={...} />.
 */

type Props = NodeProps & { data: FlowNodeData }

export function StartNode({ data, selected }: Props) {
  return (
    <NodeShell
      icon="▶"
      accent="bg-[#d8f0e0] text-[#2f7d52]"
      label={data.label || 'Start'}
      selected={selected}
      hasTarget={false}
    />
  )
}

export function FormFieldNode({ data, selected }: Props) {
  const fieldType = data.config.fieldType as string | undefined
  return (
    <NodeShell
      icon="☐"
      accent="bg-[#dbe7f7] text-[#2f5a9e]"
      label={data.label || 'Form Field'}
      detail={fieldType ? `Field: ${fieldType}` : 'Not configured'}
      selected={selected}
      hasError={data.hasError}
      errorCount={data.errorCount}
      errorMessages={data.errorMessages}
    />
  )
}

/**
 * GroupNode — a Field Group rendered on the canvas as a container ("page"),
 * mirroring the List view: a header (draggable) plus an inline, editable list
 * of the group's fields. Field editing happens in place; the body is guarded
 * with `nodrag`/`nopan` so interacting with inputs never drags or pans the
 * canvas. `variables` and `onUpdateConfig` are injected into the node `data`
 * by the editor so edits can bind to variables and persist.
 */
export function GroupNode({ data, selected }: Props) {
  const fields = (data.config.fields as GroupedField[] | undefined) ?? []
  const variables = (data.variables as FlowVariable[] | undefined) ?? []
  const onUpdateConfig = data.onUpdateConfig as
    | ((config: Record<string, unknown>) => void)
    | undefined

  return (
    <div
      className={`relative w-72 rounded-xl border bg-[#f3e3da]/40 shadow-sm transition-colors ${
        selected
          ? 'border-[#cc785c] ring-2 ring-[#cc785c]/40'
          : data.hasError
            ? 'border-[#c64545]'
            : 'border-[#e3cdbf]'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-[#8e8b82]"
      />

      {/* Header (draggable) */}
      <div className="flex items-center gap-2.5 border-b border-[#e3cdbf] px-3 py-2.5">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-[#f3e3da] text-sm font-semibold text-[#a9583e]">
          ⊞
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-[#141413]">
            {data.label || 'Field Group'}
          </div>
          <div className="text-xs text-[#8e8b82]">
            {fields.length === 0
              ? 'No fields yet'
              : `${fields.length} field${fields.length === 1 ? '' : 's'} on one page`}
          </div>
        </div>
      </div>

      {/* Body (inline field editor) */}
      <div className="nodrag nopan flex flex-col gap-2 px-3 py-3">
        <TextField
          resetKey={data.label}
          value={(data.config.title as string) ?? ''}
          onCommit={(v) =>
            onUpdateConfig?.({ ...data.config, title: v })
          }
          placeholder="Page title (optional)"
        />
        <GroupFieldsEditor
          fields={fields}
          variables={variables}
          insideCanvas
          onChange={(next) =>
            onUpdateConfig?.({ ...data.config, fields: next })
          }
        />
      </div>

      {data.hasError && (
        <FlowValidationBadge count={data.errorCount ?? 1} messages={data.errorMessages} />
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2.5 !w-2.5 !border-2 !border-white !bg-[#cc785c]"
      />
    </div>
  )
}

export function DecisionNode({ data, selected }: Props) {
  const branches = (data.config.branches as unknown[] | undefined)?.length ?? 0
  return (
    <NodeShell
      icon="◇"
      accent="bg-[#f7ecd0] text-[#9e7424]"
      label={data.label || 'Decision'}
      detail={`${branches} branch${branches === 1 ? '' : 'es'}`}
      selected={selected}
      hasError={data.hasError}
      errorCount={data.errorCount}
      errorMessages={data.errorMessages}
      diamond
    />
  )
}

export function CalculatorNode({ data, selected }: Props) {
  const expr = data.config.expression as string | undefined
  return (
    <NodeShell
      icon="∑"
      accent="bg-[#e7ddf7] text-[#6b46a8]"
      label={data.label || 'Calculator'}
      detail={expr || 'No expression'}
      selected={selected}
      hasError={data.hasError}
      errorCount={data.errorCount}
      errorMessages={data.errorMessages}
    />
  )
}

export function PaymentNode({ data, selected }: Props) {
  const amountVar = data.config.amountVariable as string | undefined
  return (
    <NodeShell
      icon="$"
      accent="bg-[#d8f0e0] text-[#2f7d52]"
      label={data.label || 'Payment'}
      detail={amountVar ? `Charge {{${amountVar}}}` : 'No amount set'}
      selected={selected}
      hasError={data.hasError}
      errorCount={data.errorCount}
      errorMessages={data.errorMessages}
    />
  )
}

export function SummaryNode({ data, selected }: Props) {
  const template = data.config.template as string | undefined
  return (
    <NodeShell
      icon="≡"
      accent="bg-[#ececea] text-[#57544d]"
      label={data.label || 'Summary'}
      detail={template ? template.slice(0, 28) : 'No template'}
      selected={selected}
      hasError={data.hasError}
      errorCount={data.errorCount}
      errorMessages={data.errorMessages}
      hasSource={false}
    />
  )
}

export function RedirectNode({ data, selected }: Props) {
  const url = data.config.urlTemplate as string | undefined
  return (
    <NodeShell
      icon="↗"
      accent="bg-[#ececea] text-[#57544d]"
      label={data.label || 'Redirect'}
      detail={url ? url.slice(0, 28) : 'No URL'}
      selected={selected}
      hasError={data.hasError}
      errorCount={data.errorCount}
      errorMessages={data.errorMessages}
      hasSource={false}
    />
  )
}

/** Registry passed to React Flow. Keys must match flowNodes.type values. */
export const nodeTypes: NodeTypes = {
  start: StartNode,
  form_field: FormFieldNode,
  group: GroupNode,
  decision: DecisionNode,
  calculator: CalculatorNode,
  payment: PaymentNode,
  summary: SummaryNode,
  redirect: RedirectNode,
}
