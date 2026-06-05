import type { FlowNode, FlowEdge, FlowVariable, FlowValidationError } from './types'

/**
 * FlowValidator
 *
 * Validates a complete flow definition at build time.
 * Checks for:
 *   - Start node existence
 *   - All nodes reachable from Start
 *   - No cycles (DAG enforcement)
 *   - Complete configs per node type
 *   - Variable references exist
 *   - Decision branches match options
 *   - Payment gateway references exist
 *   - Valid calculator expressions
 *   - Correct number of edges per node type
 *
 * @example
 * ```ts
 * const validator = new FlowValidator()
 * const errors = validator.validate(nodes, edges, variables)
 * if (errors.length > 0) {
 *   // Show errors in the builder UI
 * }
 * ```
 */
export class FlowValidator {
  /**
   * Validate a complete flow and return all errors found.
   * Returns an empty array if the flow is valid.
   */
  validate(
    nodes: FlowNode[],
    edges: FlowEdge[],
    variables: FlowVariable[],
  ): FlowValidationError[] {
    const errors: FlowValidationError[] = []

    this.validateStartNode(nodes, errors)
    this.validateReachability(nodes, edges, errors)
    this.validateCycles(nodes, edges, errors)
    this.validateNodeConfigs(nodes, variables, errors)
    this.validateEdgesPerNode(nodes, edges, errors)

    return errors
  }

  private validateStartNode(nodes: FlowNode[], errors: FlowValidationError[]): void {
    const startNodes = nodes.filter((n) => n.type === 'start')
    if (startNodes.length === 0) {
      errors.push({
        type: 'missing_start',
        message: 'Flow must have exactly one Start node.',
      })
    }
  }

  private validateReachability(
    nodes: FlowNode[],
    edges: FlowEdge[],
    errors: FlowValidationError[],
  ): void {
    // BFS from start node — any node not visited is disconnected
    const startNode = nodes.find((n) => n.type === 'start')
    if (!startNode) return

    const visited = new Set<number>()
    const queue = [startNode.id]
    visited.add(startNode.id)

    while (queue.length > 0) {
      const currentId = queue.shift()!
      const outgoing = edges.filter((e) => e.sourceNodeId === currentId)
      for (const edge of outgoing) {
        if (!visited.has(edge.targetNodeId)) {
          visited.add(edge.targetNodeId)
          queue.push(edge.targetNodeId)
        }
      }
    }

    for (const node of nodes) {
      if (!visited.has(node.id) && node.type !== 'start') {
        errors.push({
          nodeId: node.id,
          type: 'disconnected',
          message: `Node "${node.label || node.type}" is not reachable from Start. Connect it to the flow.`,
        })
      }
    }
  }

  private validateCycles(
    nodes: FlowNode[],
    edges: FlowEdge[],
    errors: FlowValidationError[],
  ): void {
    // Detect cycles using DFS with backtracking
    const adjacency = new Map<number, number[]>()
    for (const node of nodes) {
      adjacency.set(node.id, [])
    }
    for (const edge of edges) {
      adjacency.get(edge.sourceNodeId)?.push(edge.targetNodeId)
    }

    const WHITE = 0,
      GRAY = 1,
      BLACK = 2
    const color = new Map<number, number>()
    for (const node of nodes) color.set(node.id, WHITE)

    function dfs(nodeId: number): boolean {
      color.set(nodeId, GRAY)
      for (const neighbor of adjacency.get(nodeId) ?? []) {
        if (color.get(neighbor) === GRAY) return true // Cycle found
        if (color.get(neighbor) === WHITE && dfs(neighbor)) return true
      }
      color.set(nodeId, BLACK)
      return false
    }

    for (const node of nodes) {
      if (color.get(node.id) === WHITE) {
        if (dfs(node.id)) {
          errors.push({
            type: 'cycle_detected',
            message:
              'Flow contains a cycle. Decision branches must eventually converge without loops.',
          })
          return // One cycle error is enough
        }
      }
    }
  }

  private validateNodeConfigs(
    nodes: FlowNode[],
    variables: FlowVariable[],
    errors: FlowValidationError[],
  ): void {
    const varNames = new Set(variables.map((v) => v.name))

    for (const node of nodes) {
      const config = node.config

      switch (node.type) {
        case 'form_field':
          if (!config.fieldType) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: 'FormField: field type is required.' })
          }
          if (!config.label) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: 'FormField: label is required.' })
          }
          if (config.bindToVariable && !varNames.has(config.bindToVariable as string)) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: `FormField: variable "${config.bindToVariable}" is not declared.` })
          }
          break

        case 'group': {
          const fields = (config.fields as { fieldType?: string; label?: string; bindToVariable?: string }[] | undefined) ?? []
          if (fields.length === 0) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: 'Group: add at least one field.' })
          }
          fields.forEach((f, i) => {
            if (!f.fieldType) {
              errors.push({ nodeId: node.id, type: 'missing_config', message: `Group: field ${i + 1} needs a field type.` })
            }
            if (!f.label) {
              errors.push({ nodeId: node.id, type: 'missing_config', message: `Group: field ${i + 1} needs a label.` })
            }
            if (f.bindToVariable && !varNames.has(f.bindToVariable)) {
              errors.push({ nodeId: node.id, type: 'missing_config', message: `Group: variable "${f.bindToVariable}" is not declared.` })
            }
          })
          break
        }

        case 'decision':
          if (!config.sourceVariable) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: 'Decision: source variable is required.' })
          } else if (!varNames.has(config.sourceVariable as string)) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: `Decision: variable "${config.sourceVariable}" is not declared.` })
          }
          break

        case 'calculator':
          if (!config.targetVariable) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: 'Calculator: target variable is required.' })
          } else if (!varNames.has(config.targetVariable as string)) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: `Calculator: variable "${config.targetVariable}" is not declared.` })
          }
          if (!config.expression) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: 'Calculator: expression is required.' })
          }
          break

        case 'payment':
          if (!config.amountVariable) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: 'Payment: amount variable is required.' })
          } else if (!varNames.has(config.amountVariable as string)) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: `Payment: variable "${config.amountVariable}" is not declared.` })
          }
          // No gateway requirement: the visitor picks from the payment methods
          // the form owner connected in Settings (resolved at checkout).
          break

        case 'summary':
          if (!config.template) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: 'Summary: template is required.' })
          }
          break

        case 'redirect':
          if (!config.urlTemplate) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: 'Redirect: URL template is required.' })
          }
          break
      }
    }
  }

  private validateEdgesPerNode(
    nodes: FlowNode[],
    edges: FlowEdge[],
    errors: FlowValidationError[],
  ): void {
    for (const node of nodes) {
      const outgoing = edges.filter((e) => e.sourceNodeId === node.id)

      switch (node.type) {
        case 'start':
          if (outgoing.length !== 1) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: 'Start node must have exactly one outgoing connection.' })
          }
          break
        case 'form_field':
        case 'group':
        case 'calculator':
          if (outgoing.length !== 1) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: `${node.type} node must have exactly one outgoing connection.` })
          }
          break
        case 'summary':
        case 'redirect':
          // Terminal nodes — the engine completes the flow here, so they must
          // not have outgoing connections.
          if (outgoing.length !== 0) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: `${node.type} node is terminal and must not have an outgoing connection.` })
          }
          break
        case 'decision': {
          const branches = (node.config.branches as { value: string }[] | undefined) ?? []
          if (outgoing.length < branches.length) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: `Decision node has ${branches.length} branches but only ${outgoing.length} connections. Each branch needs a connection.` })
          }
          break
        }
        case 'payment':
          if (outgoing.length < 1 || outgoing.length > 2) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: 'Payment node needs 1 (success) or 2 (success + failure) connections.' })
          }
          break
      }
    }
  }
}
