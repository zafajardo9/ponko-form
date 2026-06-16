/**
 * Flow Engine — Core Types (FT001, spec.md §4)
 *
 * Pure TypeScript type definitions shared by the Builder UI, the Execution UI,
 * and the runtime engine. No UI or DB dependencies live here.
 */

/** The node types that make up a flow graph. */
export type FlowNodeType =
  | 'start'
  | 'form_field'
  | 'group'
  | 'decision'
  | 'calculator'
  | 'payment'
  | 'summary'
  | 'redirect'

/** Supported variable value types. */
export type FlowVariableType = 'string' | 'number' | 'boolean' | 'money' | 'date' | 'time' | 'datetime'

/**
 * A single field inside a Group node. Mirrors a FormField's config but lives
 * inline in the group's config (it is not its own graph node), so a group can
 * render several fields together on one step. `id` is a stable client-side
 * identifier used to key inputs and map collected values back to bindings.
 */
export interface GroupedField {
  id: string
  fieldType: string
  label: string
  placeholder?: string
  required?: boolean
  options?: { label: string; value: string }[]
  bindToVariable?: string
}

/**
 * Union of every possible config field across all node types. Each node only
 * uses the subset relevant to its `type` (see schema.ts flowNodes docs).
 */
export interface FlowNodeConfig {
  // FormField
  fieldType?: string
  label?: string
  placeholder?: string
  required?: boolean
  options?: { label: string; value: string }[]
  bindToVariable?: string

  // Group — renders several fields together on one step.
  fields?: GroupedField[]

  // Decision
  sourceVariable?: string
  branches?: { value: string; label: string }[]

  // Calculator
  targetVariable?: string
  expression?: string

  // Payment
  amountVariable?: string
  currency?: string
  gatewayId?: number | null

  // Summary
  title?: string
  template?: string

  // Redirect
  urlTemplate?: string

  // Allow forward-compatible extra keys.
  [key: string]: unknown
}

/** A node in the flow graph. */
export interface FlowNode {
  id: number
  flowId: number
  type: FlowNodeType
  label: string | null
  config: FlowNodeConfig
  positionX: number
  positionY: number
}

/** A directed connection between two nodes. */
export interface FlowEdge {
  id: number
  flowId: number
  sourceNodeId: number
  targetNodeId: number
  metadata: {
    /** For Decision edges — which option value routes through this edge. */
    matchValue?: string
    /** Optional display label on the edge. */
    label?: string
  }
}

/** A typed variable declaration scoped to a flow. */
export interface FlowVariable {
  id: number
  flowId: number
  name: string
  type: FlowVariableType
  defaultValue: string | null
  description: string | null
}

/** Runtime status of a single flow execution. */
export type ExecutionStatus =
  | 'in_progress'
  | 'completed'
  | 'payment_pending'
  | 'payment_failed'
  | 'cancelled'

/** One entry in the execution history, recorded as each node is entered. */
export interface ExecutionHistoryEntry {
  nodeId: number
  nodeType: string
  /** ISO timestamp of when the node was entered. */
  enteredAt: string
  /** Snapshot of data captured at this step. */
  data?: unknown
}

/** Serializable snapshot of an in-flight or completed execution. */
export interface FlowExecutionContext {
  executionId: number
  flowId: number
  status: ExecutionStatus
  currentNodeId: number
  variables: Record<string, unknown>
  history: ExecutionHistoryEntry[]
}

/** A validation problem found in a flow definition. */
export interface FlowValidationError {
  /** The offending node, if the error is node-specific. */
  nodeId?: number
  type:
    | 'missing_start'
    | 'disconnected'
    | 'cycle_detected'
    | 'missing_config'
  message: string
}
