import type { FlowNode, FlowEdge } from './types'

/**
 * Flow path utilities (pure, no DB/UI deps).
 *
 * The unified editor's List view shows a flow as an ordered, builder-style
 * list. That ordering is the flow's "primary path": starting at the Start node
 * and following the first outgoing edge of each node until a terminal node (or
 * a dead end). Nodes reachable only through a decision branch — i.e. not on the
 * primary path — are surfaced separately ("edit in Canvas").
 */

export interface LinearPath {
  /** Node ids on the primary path, in order, starting at the Start node. */
  ordered: number[]
  /** Node ids NOT on the primary path (branch-only / unreachable). */
  offPath: number[]
}

/** Outgoing edges of a node, ordered by edge id (oldest first = primary). */
export function outgoingEdges(edges: FlowEdge[], nodeId: number): FlowEdge[] {
  return edges
    .filter((e) => e.sourceNodeId === nodeId)
    .sort((a, b) => a.id - b.id)
}

/** The node's primary (first) outgoing edge, or null. */
export function primaryOutgoingEdge(edges: FlowEdge[], nodeId: number): FlowEdge | null {
  return outgoingEdges(edges, nodeId)[0] ?? null
}

/**
 * Linearize a flow into its primary path. Returns the ordered node ids from
 * Start plus any nodes not on that path. If there is no Start node, every node
 * is considered off-path.
 */
export function linearizePrimaryPath(nodes: FlowNode[], edges: FlowEdge[]): LinearPath {
  const start = nodes.find((n) => n.type === 'start')
  if (!start) return { ordered: [], offPath: nodes.map((n) => n.id) }

  const ordered: number[] = []
  const seen = new Set<number>()
  let cur: number | undefined = start.id

  while (cur != null && !seen.has(cur)) {
    seen.add(cur)
    ordered.push(cur)
    cur = primaryOutgoingEdge(edges, cur)?.targetNodeId
  }

  const offPath = nodes.filter((n) => !seen.has(n.id)).map((n) => n.id)
  return { ordered, offPath }
}

/**
 * Whether the flow is a pure linear chain — every node has at most one outgoing
 * edge and there are no off-path nodes. List-view reordering is only safe for
 * such flows; anything with branches is rearranged in Canvas view.
 */
export function isPureLinear(nodes: FlowNode[], edges: FlowEdge[]): boolean {
  const { offPath } = linearizePrimaryPath(nodes, edges)
  if (offPath.length > 0) return false
  for (const n of nodes) {
    if (outgoingEdges(edges, n.id).length > 1) return false
  }
  return true
}
