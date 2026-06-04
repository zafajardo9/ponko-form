import { describe, it, expect } from 'vitest'
import { linearizePrimaryPath, isPureLinear, primaryOutgoingEdge } from './path-utils'
import type { FlowNode, FlowEdge } from './types'

function node(id: number, type: FlowNode['type']): FlowNode {
  return { id, flowId: 1, type, label: type, config: {}, positionX: 0, positionY: 0 }
}
function edge(id: number, source: number, target: number, metadata: FlowEdge['metadata'] = {}): FlowEdge {
  return { id, flowId: 1, sourceNodeId: source, targetNodeId: target, metadata }
}

describe('path-utils', () => {
  it('linearizes a simple chain in order', () => {
    const nodes = [node(1, 'start'), node(2, 'form_field'), node(3, 'form_field'), node(4, 'summary')]
    const edges = [edge(1, 1, 2), edge(2, 2, 3), edge(3, 3, 4)]
    const { ordered, offPath } = linearizePrimaryPath(nodes, edges)
    expect(ordered).toEqual([1, 2, 3, 4])
    expect(offPath).toEqual([])
    expect(isPureLinear(nodes, edges)).toBe(true)
  })

  it('follows the first edge of a decision and marks the other branch off-path', () => {
    const nodes = [
      node(1, 'start'),
      node(2, 'decision'),
      node(3, 'form_field'), // primary branch (lower edge id)
      node(4, 'form_field'), // secondary branch
      node(5, 'summary'),
    ]
    const edges = [
      edge(1, 1, 2),
      edge(2, 2, 3, { matchValue: 'a' }), // primary (id 2 < 3)
      edge(3, 2, 4, { matchValue: 'b' }),
      edge(4, 3, 5),
      edge(5, 4, 5),
    ]
    const { ordered, offPath } = linearizePrimaryPath(nodes, edges)
    expect(ordered).toEqual([1, 2, 3, 5])
    expect(offPath).toEqual([4])
    expect(isPureLinear(nodes, edges)).toBe(false)
  })

  it('treats everything as off-path when there is no start node', () => {
    const nodes = [node(2, 'form_field'), node(3, 'summary')]
    const { ordered, offPath } = linearizePrimaryPath(nodes, [])
    expect(ordered).toEqual([])
    expect(offPath).toEqual([2, 3])
  })

  it('picks the lowest-id outgoing edge as primary', () => {
    const edges = [edge(7, 2, 9), edge(3, 2, 5), edge(11, 2, 4)]
    expect(primaryOutgoingEdge(edges, 2)?.targetNodeId).toBe(5)
  })
})
