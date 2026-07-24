import { Info, Trash2, X } from 'lucide-react'
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
      <div className="flex items-start justify-between gap-3 rounded-lg border border-[#e6dfd8] bg-[#f5f0e8] p-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[#8e8b82]">Configure step</p>
          <h3 className="mt-1 text-lg font-medium text-[#141413]">{node.label || TYPE_LABELS[node.type]}</h3>
          <p className="mt-1 text-xs text-[#6c6a64]">{TYPE_LABELS[node.type]} settings</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-[#e6dfd8] bg-white text-[#8e8b82] hover:text-[#141413]"
          aria-label="Close step settings"
        >
          <X size={15} />
        </button>
      </div>

      {/* Node label (all types). */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-[#141413]">Builder label</label>
        <TextField
          resetKey={node.id}
          value={node.label ?? ''}
          onCommit={(v) => onUpdate(node.id, { label: v })}
          placeholder={TYPE_LABELS[node.type]}
        />
        <p className="text-xs leading-5 text-[#8e8b82]">Used to identify this step in the builder. Respondent-facing text is configured below.</p>
      </div>

      {node.type === 'form_field' && <FormFieldConfig {...formProps} />}
      {node.type === 'group' && <GroupConfig {...formProps} />}
      {node.type === 'decision' && <DecisionConfig {...formProps} />}
      {node.type === 'calculator' && <CalculatorConfig {...formProps} />}
      {node.type === 'payment' && <PaymentConfig {...formProps} />}
      {node.type === 'summary' && <SummaryConfig {...formProps} />}
      {node.type === 'redirect' && <RedirectConfig {...formProps} />}
      {node.type === 'start' && (
        <div className="flex items-start gap-2 rounded-lg border border-[#e6dfd8] bg-[#f5f0e8] p-3 text-sm text-[#6c6a64]">
          <Info size={15} className="mt-0.5 flex-none text-[#cc785c]" />
          <p>The Start step has no respondent-facing settings. Connect it to the first step of your flow.</p>
        </div>
      )}

      {node.type !== 'start' && (
        <div className="mt-2 rounded-lg border border-[#f0c2b8] bg-[#fff3ef] p-3">
          <p className="text-sm font-medium text-[#9f3f35]">Remove this step</p>
          <p className="mt-1 text-xs leading-5 text-[#9f5b50]">This also removes the step’s connections from the flow.</p>
          <Button
            variant="danger"
            size="sm"
            className="mt-3"
            onClick={() => {
              if (confirm('Delete this node and its connections?')) onDelete(node.id)
            }}
          >
            <Trash2 size={14} /> Delete step
          </Button>
        </div>
      )}
    </aside>
  )
}
