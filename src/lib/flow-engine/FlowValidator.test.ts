import { describe, it, expect } from 'vitest'
import { FlowValidator } from './FlowValidator'
import type { FlowNode, FlowEdge, FlowVariable } from './types'

const validator = new FlowValidator()

/** Test helpers to build flow fixtures concisely. */
function node(id: number, type: FlowNode['type'], config: FlowNode['config'] = {}, label = type): FlowNode {
  return { id, flowId: 1, type, label, config, positionX: 0, positionY: 0 }
}
function edge(id: number, source: number, target: number, metadata: FlowEdge['metadata'] = {}): FlowEdge {
  return { id, flowId: 1, sourceNodeId: source, targetNodeId: target, metadata }
}
function variable(id: number, name: string, type: FlowVariable['type'] = 'string'): FlowVariable {
  return { id, flowId: 1, name, type, defaultValue: null, description: null }
}

describe('FlowValidator', () => {
  it('passes a valid flow', () => {
    const nodes = [
      node(1, 'start'),
      node(2, 'form_field', { fieldType: 'text', label: 'Name', bindToVariable: 'name' }),
      node(3, 'summary', { title: 'Done', template: 'Hi {{name}}' }),
    ]
    const edges = [edge(1, 1, 2), edge(2, 2, 3)]
    const vars = [variable(1, 'name')]
    expect(validator.validate(nodes, edges, vars)).toEqual([])
  })

  it('detects a missing start node', () => {
    const nodes = [node(2, 'summary', { template: 'x' })]
    const errors = validator.validate(nodes, [], [])
    expect(errors.some((e) => e.type === 'missing_start')).toBe(true)
  })

  it('detects disconnected nodes', () => {
    const nodes = [
      node(1, 'start'),
      node(2, 'summary', { template: 'x' }),
      node(3, 'summary', { template: 'y' }), // unreachable
    ]
    const edges = [edge(1, 1, 2)]
    const errors = validator.validate(nodes, edges, [])
    expect(errors.some((e) => e.type === 'disconnected' && e.nodeId === 3)).toBe(true)
  })

  it('detects cycles', () => {
    const nodes = [
      node(1, 'start'),
      node(2, 'calculator', { targetVariable: 'a', expression: '1' }),
      node(3, 'calculator', { targetVariable: 'b', expression: '1' }),
    ]
    // 1 -> 2 -> 3 -> 2 (cycle)
    const edges = [edge(1, 1, 2), edge(2, 2, 3), edge(3, 3, 2)]
    const vars = [variable(1, 'a', 'number'), variable(2, 'b', 'number')]
    const errors = validator.validate(nodes, edges, vars)
    expect(errors.some((e) => e.type === 'cycle_detected')).toBe(true)
  })

  it('detects missing config fields per node type', () => {
    const nodes = [
      node(1, 'start'),
      node(2, 'calculator', {}), // missing targetVariable + expression
    ]
    const edges = [edge(1, 1, 2)]
    const errors = validator.validate(nodes, edges, [])
    const msgs = errors.map((e) => e.message)
    expect(msgs.some((m) => m.includes('target variable is required'))).toBe(true)
    expect(msgs.some((m) => m.includes('expression is required'))).toBe(true)
  })

  it('detects invalid variable references', () => {
    const nodes = [
      node(1, 'start'),
      node(2, 'decision', { sourceVariable: 'missing_var', branches: [] }),
    ]
    const edges = [edge(1, 1, 2)]
    const errors = validator.validate(nodes, edges, [])
    expect(errors.some((e) => e.message.includes('"missing_var" is not declared'))).toBe(true)
  })

  it('detects incorrect edge counts per node type', () => {
    // Start node with no outgoing edge
    const nodes = [node(1, 'start'), node(2, 'summary', { template: 'x' })]
    const edges: FlowEdge[] = [] // start has 0 outgoing, summary unreachable
    const errors = validator.validate(nodes, edges, [])
    expect(
      errors.some((e) => e.message.includes('Start node must have exactly one outgoing')),
    ).toBe(true)
  })

  it('flags a terminal node that has an outgoing connection', () => {
    const nodes = [
      node(1, 'start'),
      node(2, 'summary', { template: 'x' }),
      node(3, 'summary', { template: 'y' }),
    ]
    const edges = [edge(1, 1, 2), edge(2, 2, 3)] // summary #2 wrongly has outgoing
    const errors = validator.validate(nodes, edges, [])
    expect(
      errors.some((e) => e.nodeId === 2 && e.message.includes('terminal')),
    ).toBe(true)
  })
})
