import { eq } from 'drizzle-orm'
import { db } from '../../db/index'
import { flowEdges, flowNodes, flows, flowVariables } from '../../db/schema'
import type { FlowEdge, FlowNode, FlowVariable } from './types'

export async function loadFlow(formId: number) {
  const [flow] = await db.select().from(flows).where(eq(flows.formId, formId)).limit(1)
  if (!flow) return null

  const [nodes, edges, variables] = await Promise.all([
    db.select().from(flowNodes).where(eq(flowNodes.flowId, flow.id)).orderBy(flowNodes.id),
    db.select().from(flowEdges).where(eq(flowEdges.flowId, flow.id)).orderBy(flowEdges.id),
    db
      .select()
      .from(flowVariables)
      .where(eq(flowVariables.flowId, flow.id))
      .orderBy(flowVariables.id),
  ])

  return {
    flow,
    nodes: nodes as FlowNode[],
    edges: edges as FlowEdge[],
    variables: variables as FlowVariable[],
  }
}
