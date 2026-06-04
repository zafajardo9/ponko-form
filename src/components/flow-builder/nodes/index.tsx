import type { NodeProps, NodeTypes } from '@xyflow/react'
import { NodeShell, type FlowNodeData } from './NodeShell'

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

export function GroupNode({ data, selected }: Props) {
  const count = (data.config.fields as unknown[] | undefined)?.length ?? 0
  return (
    <NodeShell
      icon="⊞"
      accent="bg-[#f3e3da] text-[#a9583e]"
      label={data.label || 'Field Group'}
      detail={count === 0 ? 'No fields yet' : `${count} field${count === 1 ? '' : 's'} on one step`}
      selected={selected}
      hasError={data.hasError}
      errorCount={data.errorCount}
      errorMessages={data.errorMessages}
    />
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
