import type {
  FlowNode,
  FlowEdge,
  FlowVariable,
  FlowExecutionContext,
  ExecutionHistoryEntry,
  GroupedField,
} from './types'
import { ExpressionEvaluator } from './ExpressionEvaluator'
import { TemplateInterpolator } from './TemplateInterpolator'

/**
 * The current step to be rendered in the UI.
 */
export interface FlowStep {
  nodeId: number
  nodeType: string
  config: Record<string, unknown>
  /** The rendered label/title for this step */
  label: string
  /** Whether this step expects user input (FormField, Decision) */
  expectsInput: boolean
  /** Whether this step shows a payment interface */
  isPayment: boolean
  /** Whether this step is the final one */
  isTerminal: boolean
  /** For Summary: the rendered template text */
  renderedOutput?: string
  /** For Redirect: the constructed URL */
  redirectUrl?: string
}

/**
 * Input provided by the user when advancing a step.
 */
export interface StepInput {
  /** For FormField: the field value */
  formValue?: string | string[]
  /** For Decision: the selected branch value */
  decisionValue?: string
  /** For Group: collected values keyed by each grouped field's id */
  groupValues?: Record<string, string | string[]>
  /** For Payment: the payment result */
  paymentResult?: { success: boolean; gatewayPaymentId?: string }
}

/**
 * FlowEngine
 *
 * Drives step-by-step execution of a flow definition.
 * Each instance represents a single flow execution session.
 *
 * Usage:
 *   const engine = new FlowEngine(nodes, edges, variables, initialValues)
 *   const step = engine.getCurrentStep()
 *   // Render the step, user interacts...
 *   engine.advance({ formValue: 'Alice' })
 *   const nextStep = engine.getCurrentStep()
 *   // ... continue until engine.isComplete()
 *
 * The engine maintains all state internally and can produce a
 * serializable snapshot for persistence via getSnapshot().
 */
export class FlowEngine {
  private nodes: Map<number, FlowNode>
  private edges: FlowEdge[]
  private variables: FlowVariable[]
  private currentNodeId: number
  private variableValues: Record<string, unknown>
  private history: ExecutionHistoryEntry[]
  private completed: boolean
  private expressionEvaluator: ExpressionEvaluator
  private templateInterpolator: TemplateInterpolator

  constructor(
    nodes: FlowNode[],
    edges: FlowEdge[],
    variables: FlowVariable[],
    initialVariableValues?: Record<string, unknown>,
  ) {
    this.nodes = new Map(nodes.map((n) => [n.id, n]))
    this.edges = edges
    this.variables = variables
    this.expressionEvaluator = new ExpressionEvaluator()
    this.templateInterpolator = new TemplateInterpolator()

    // Initialize variable values from defaults, then override with any provided values
    this.variableValues = { ...this.getDefaultVariableValues(), ...initialVariableValues }

    // Find the start node
    const startNode = nodes.find((n) => n.type === 'start')
    if (!startNode) throw new Error('Flow must have a Start node')
    this.currentNodeId = startNode.id
    this.history = []
    this.completed = false

    // Record the start node visit
    this.recordEntry(startNode)
  }

  /**
   * Get the current step to render in the UI.
   */
  getCurrentStep(): FlowStep {
    const node = this.nodes.get(this.currentNodeId)
    if (!node) throw new Error(`Node ${this.currentNodeId} not found`)

    const base: FlowStep = {
      nodeId: node.id,
      nodeType: node.type,
      config: node.config,
      label: node.label ?? this.getDefaultLabel(node.type),
      expectsInput:
        node.type === 'form_field' ||
        node.type === 'decision' ||
        node.type === 'group',
      isPayment: node.type === 'payment',
      isTerminal: node.type === 'summary' || node.type === 'redirect',
    }

    // For summary nodes, render the template
    if (node.type === 'summary') {
      const template = node.config.template as string
      if (template) {
        base.renderedOutput = this.templateInterpolator.interpolate(template, {
          variables: this.variableValues,
          types: this.getVariableTypesMap(),
        })
      }
    }

    // For redirect nodes, build the URL
    if (node.type === 'redirect') {
      const urlTemplate = node.config.urlTemplate as string
      if (urlTemplate) {
        base.redirectUrl = this.templateInterpolator.interpolate(urlTemplate, {
          variables: this.variableValues,
        })
      }
    }

    return base
  }

  /**
   * Advance to the next node based on user input.
   * Call this after the user has completed the current step.
   */
  advance(input?: StepInput): void {
    if (this.completed) return

    const node = this.nodes.get(this.currentNodeId)
    if (!node) throw new Error(`Node ${this.currentNodeId} not found`)

    // Process the current node's action
    this.processNodeAction(node, input)

    // Find the next node(s)
    const outgoingEdges = this.edges.filter((e) => e.sourceNodeId === node.id)

    let nextNodeId: number | null = null

    switch (node.type) {
      case 'start':
      case 'form_field':
      case 'group':
      case 'calculator':
      case 'summary':
        // Follow the single outgoing edge
        nextNodeId = outgoingEdges[0]?.targetNodeId ?? null
        break

      case 'decision': {
        // Follow the edge matching the user's selection
        const selectedValue =
          input?.decisionValue ?? this.variableValues[node.config.sourceVariable as string]
        const matchingEdge = outgoingEdges.find(
          (e) => e.metadata.matchValue === String(selectedValue),
        )
        nextNodeId = matchingEdge?.targetNodeId ?? outgoingEdges[0]?.targetNodeId ?? null
        break
      }

      case 'payment':
        if (input?.paymentResult?.success) {
          // Follow success edge (first)
          this.variableValues['payment_ref'] = input.paymentResult.gatewayPaymentId
          nextNodeId = outgoingEdges[0]?.targetNodeId ?? null
        } else {
          // Follow failure edge (second) or first edge if no failure path
          nextNodeId = outgoingEdges[1]?.targetNodeId ?? outgoingEdges[0]?.targetNodeId ?? null
        }
        break

      case 'redirect':
        // Redirect is terminal — no next node
        this.completed = true
        return
    }

    if (nextNodeId === null) {
      this.completed = true
      return
    }

    this.currentNodeId = nextNodeId
    const nextNode = this.nodes.get(nextNodeId)
    if (nextNode) {
      this.recordEntry(nextNode)
    }

    // If the next node is a calculator, auto-advance
    if (nextNode && nextNode.type === 'calculator') {
      this.advance()
    }

    // If the next node is terminal (summary/redirect), mark as complete
    if (nextNode && (nextNode.type === 'summary' || nextNode.type === 'redirect')) {
      this.completed = true
    }
  }

  /**
   * Go back to the previous step (if history allows).
   */
  goBack(): boolean {
    if (this.history.length < 2) return false
    // Remove current entry
    this.history.pop()
    // Go to the previous entry
    const previous = this.history[this.history.length - 1]
    this.currentNodeId = previous.nodeId
    this.completed = false
    return true
  }

  /**
   * Whether the flow has reached a terminal node.
   */
  isComplete(): boolean {
    return this.completed
  }

  /**
   * Get the current variable values.
   */
  getVariableValues(): Record<string, unknown> {
    return { ...this.variableValues }
  }

  /**
   * Get the total number of steps (for progress indicator).
   */
  getTotalSteps(): number {
    return this.nodes.size - 1 // Exclude start node
  }

  /**
   * Get the current step number (1-based, excluding start node).
   */
  getCurrentStepNumber(): number {
    return this.history.length
  }

  /**
   * Serialize the current execution state for persistence.
   */
  getSnapshot(): FlowExecutionContext {
    return {
      executionId: 0, // Assigned by server on save
      flowId: 0, // Assigned by server on save
      status: this.completed ? 'completed' : 'in_progress',
      currentNodeId: this.currentNodeId,
      variables: { ...this.variableValues },
      history: [...this.history],
    }
  }

  // ── Private Helpers ──

  private processNodeAction(node: FlowNode, input?: StepInput): void {
    switch (node.type) {
      case 'form_field': {
        const bindTo = node.config.bindToVariable as string | undefined
        if (bindTo && input?.formValue !== undefined) {
          this.variableValues[bindTo] = input.formValue
        }
        break
      }
      case 'group': {
        // Bind each grouped field's collected value to its variable.
        const fields = (node.config.fields as GroupedField[] | undefined) ?? []
        const groupValues = input?.groupValues ?? {}
        for (const field of fields) {
          if (field.bindToVariable && groupValues[field.id] !== undefined) {
            this.variableValues[field.bindToVariable] = groupValues[field.id]
          }
        }
        break
      }
      case 'calculator': {
        const expression = node.config.expression as string
        const targetVar = node.config.targetVariable as string
        if (expression && targetVar) {
          const result = this.expressionEvaluator.evaluate(expression, {
            variables: this.variableValues,
          })
          if (result.success) {
            // Round money-typed results to 2 decimals to avoid floating-point
            // noise (e.g. 11200.000000000002) flowing into payment amounts.
            const targetType = this.variables.find((v) => v.name === targetVar)?.type
            this.variableValues[targetVar] =
              targetType === 'money' ? Math.round(result.value * 100) / 100 : result.value
          }
        }
        break
      }
      case 'payment': {
        // Payment is handled by the UI; we just store the result
        if (input?.paymentResult?.gatewayPaymentId) {
          this.variableValues['payment_ref'] = input.paymentResult.gatewayPaymentId
        }
        break
      }
    }
  }

  private recordEntry(node: FlowNode): void {
    this.history.push({
      nodeId: node.id,
      nodeType: node.type,
      enteredAt: new Date().toISOString(),
      data: { label: node.label },
    })
  }

  private getDefaultLabel(type: string): string {
    const labels: Record<string, string> = {
      start: 'Start',
      form_field: 'Form Field',
      group: 'Field Group',
      decision: 'Decision',
      calculator: 'Calculator',
      payment: 'Payment',
      summary: 'Summary',
      redirect: 'Redirect',
    }
    return labels[type] ?? 'Unknown'
  }

  private getDefaultVariableValues(): Record<string, unknown> {
    const values: Record<string, unknown> = {}
    for (const v of this.variables) {
      if (v.defaultValue !== null) {
        switch (v.type) {
          case 'number':
          case 'money':
            values[v.name] = Number(v.defaultValue)
            break
          case 'boolean':
            values[v.name] = v.defaultValue === 'true'
            break
          default:
            values[v.name] = v.defaultValue
        }
      }
    }
    return values
  }

  private getVariableTypesMap(): Record<string, 'string' | 'number' | 'boolean' | 'money'> {
    const types: Record<string, 'string' | 'number' | 'boolean' | 'money'> = {}
    for (const v of this.variables) {
      types[v.name] = v.type
    }
    return types
  }
}
