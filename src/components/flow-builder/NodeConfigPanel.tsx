import { Button } from '../ui/Button'
import type { FlowNode, FlowVariable } from '../../lib/flow-engine/types'
import { FormFieldConfig } from './config-forms/FormFieldConfig'
import { GroupConfig } from './config-forms/GroupConfig'
import { DecisionConfig } from './config-forms/DecisionConfig'
import { CalculatorConfig } from './config-forms/CalculatorConfig'
import { PaymentConfig } from './config-forms/PaymentConfig'
import { SummaryConfig } from './config-forms/SummaryConfig'
import { RedirectConfig } from './config-forms/RedirectConfig'
import { TextField } from './config-forms/controls'

const TYPE_LABELS: Record<string, string> = {
  start: 'Start',
  form_field: 'Form Field',
  group: 'Field Group',
  decision: 'Decision',
  calculator: 'Calculator',
  payment: 'Payment',
  summary: 'Summary',
  redirect: 'Redirect',
}

/**
 * NodeConfigPanel
 *
 * Right sidebar showing configuration for the selected node. Renders a
 * type-specific config form and persists changes (config patches are merged
 * into the node's config and saved via onUpdate). Mirrors the FieldEditor:
 * a header with the node type, the form, and a delete action at the bottom.
 */
interface NodeConfigPanelProps {
  node: FlowNode
  variables: FlowVariable[]
  gateways: { id: number; name: string }[]
  onUpdate: (nodeId: number, patch: { config?: Record<string, unknown>; label?: string }) => void
  onClose: () => void
  onDelete: (nodeId: number) => void
}

export function NodeConfigPanel({
  node,
  variables,
  gateways,
  onUpdate,
  onClose,
  onDelete,
}: NodeConfigPanelProps) {
  /** Merge a config patch and persist. */
  function patchConfig(patch: Record<string, unknown>) {
    onUpdate(node.id, { config: { ...node.config, ...patch } })
  }

  const formProps = {
    nodeId: node.id,
    config: node.config,
    variables,
    onChange: patchConfig,
    gateways,
  }

  return (
    <aside className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-[#8e8b82]">
          {TYPE_LABELS[node.type]} settings
        </p>
        <button onClick={onClose} className="text-sm text-[#8e8b82] hover:text-[#141413]">
          ✕
        </button>
      </div>

      {/* Node label (all types). */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[#141413]">Node label</label>
        <TextField
          resetKey={node.id}
          value={node.label ?? ''}
          onCommit={(v) => onUpdate(node.id, { label: v })}
          placeholder={TYPE_LABELS[node.type]}
        />
      </div>

      {node.type === 'form_field' && <FormFieldConfig {...formProps} />}
      {node.type === 'group' && <GroupConfig {...formProps} />}
      {node.type === 'decision' && <DecisionConfig {...formProps} />}
      {node.type === 'calculator' && <CalculatorConfig {...formProps} />}
      {node.type === 'payment' && <PaymentConfig {...formProps} />}
      {node.type === 'summary' && <SummaryConfig {...formProps} />}
      {node.type === 'redirect' && <RedirectConfig {...formProps} />}
      {node.type === 'start' && (
        <p className="text-sm text-[#8e8b82]">
          The Start node has no settings. Connect it to the first step of your flow.
        </p>
      )}

      {node.type !== 'start' && (
        <div className="mt-2 border-t border-[#e6dfd8] pt-4">
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              if (confirm('Delete this node and its connections?')) onDelete(node.id)
            }}
          >
            Delete node
          </Button>
        </div>
      )}
    </aside>
  )
}
