import { createServerFn } from '@tanstack/react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import { db } from '../../db/index'
import {
  flows,
  flowNodes,
  flowEdges,
  flowVariables,
  formFields,
} from '../../db/schema'
import { eq } from 'drizzle-orm'
import { assertFormOwner, uniqueVarName, variableTypeForField } from './flow-helpers'
import type { FlowNode, FlowEdge, FlowVariable } from '../flow-engine/types'

/**
 * getFlow(formId)
 *
 * Fetch the complete flow for a form — its nodes, edges, and variables —
 * structured for the frontend. Returns `null` if the form has no flow
 * (i.e. it is a legacy linear form, per REQ-4.1).
 *
 * Public: the end-user submission route calls this to detect a flow, and the
 * builder calls it to load the canvas. No ownership check on read.
 */
export const getFlow = createServerFn({ method: 'GET', strict: false })
  .inputValidator((data: { formId: number }) => data)
  .handler(async ({ data }) => {
    const [flow] = await db.select().from(flows).where(eq(flows.formId, data.formId)).limit(1)
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
  })

/**
 * buildFlowFromFields(formId)
 *
 * Build a flow for a form from its existing `form_fields`: a Start node, one
 * FormField node per field (each bound to a generated variable), chained in
 * order, ending in a Summary node. If the form has no fields, produces a blank
 * Start → Summary flow that is valid out of the box. The original formFields
 * are left untouched (backup). Internal helper — callers must verify ownership.
 * Returns the new flow id.
 */
async function buildFlowFromFields(formId: number): Promise<number> {
  const fields = await db
    .select()
    .from(formFields)
    .where(eq(formFields.formId, formId))
    .orderBy(formFields.order)

  const [flow] = await db.insert(flows).values({ formId }).returning()

  const [startNode] = await db
    .insert(flowNodes)
    .values({ flowId: flow.id, type: 'start', label: 'Start', positionX: 250, positionY: 100 })
    .returning()

  const used = new Set<string>()
  let prevNodeId = startNode.id
  let y = 240

  for (const field of fields) {
    const varName = uniqueVarName(field.label, used, `field_${field.id}`)
    await db.insert(flowVariables).values({
      flowId: flow.id,
      name: varName,
      type: variableTypeForField(field.type),
      description: `Imported from "${field.label}"`,
    })

    const [node] = await db
      .insert(flowNodes)
      .values({
        flowId: flow.id,
        type: 'form_field',
        label: field.label,
        positionX: 250,
        positionY: y,
        config: {
          fieldType: field.type,
          label: field.label,
          placeholder: field.placeholder ?? undefined,
          required: field.required,
          options: field.options ?? undefined,
          bindToVariable: varName,
        },
      })
      .returning()

    await db.insert(flowEdges).values({
      flowId: flow.id,
      sourceNodeId: prevNodeId,
      targetNodeId: node.id,
    })
    prevNodeId = node.id
    y += 140
  }

  // Summary node after the last field (terminal).
  const [summaryNode] = await db
    .insert(flowNodes)
    .values({
      flowId: flow.id,
      type: 'summary',
      label: 'Summary',
      positionX: 250,
      positionY: y,
      config: {
        title: 'Thank you!',
        template: 'Your response has been recorded.',
      },
    })
    .returning()

  await db.insert(flowEdges).values({
    flowId: flow.id,
    sourceNodeId: prevNodeId,
    targetNodeId: summaryNode.id,
  })

  await db
    .update(flows)
    .set({ startNodeId: startNode.id, updatedAt: new Date() })
    .where(eq(flows.id, flow.id))

  return flow.id
}

/**
 * ensureFlow(formId)
 *
 * Guarantee the form has a flow, returning its id. If a flow already exists it
 * is returned unchanged; otherwise one is built from the form's existing fields
 * (or a blank Start → Summary flow if there are none). This is the entry point
 * the unified editor calls on load — every form becomes flow-backed lazily,
 * with its legacy `form_fields` kept intact as a backup. Owner-gated.
 */
export const ensureFlow = createServerFn({ method: 'POST', strict: false })
  .inputValidator((data: { formId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)

    const [existing] = await db.select().from(flows).where(eq(flows.formId, data.formId)).limit(1)
    if (existing) return { flowId: existing.id, created: false }

    const flowId = await buildFlowFromFields(data.formId)
    return { flowId, created: true }
  })
