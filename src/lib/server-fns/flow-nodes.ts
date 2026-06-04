import { createServerFn } from '@tanstack/react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import { db } from '../../db/index'
import { flowNodes, flowEdges, flowVariables, flows } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { assertFlowOwner, uniqueVarName, variableTypeForField } from './flow-helpers'
import { primaryOutgoingEdge } from '../flow-engine/path-utils'
import type { FlowNodeType, FlowEdge } from '../flow-engine/types'

/** Touch the flow's updatedAt so the dashboard reflects recent edits. */
async function touchFlow(flowId: number) {
  await db.update(flows).set({ updatedAt: new Date() }).where(eq(flows.id, flowId))
}

/**
 * addFlowNode(flowId, type, positionX, positionY)
 * Insert a new node and return it.
 */
export const addFlowNode = createServerFn({ method: 'POST', strict: false })
  .inputValidator(
    (data: {
      flowId: number
      type: FlowNodeType
      positionX: number
      positionY: number
      label?: string
    }) => data,
  )
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFlowOwner(data.flowId, userId)

    const [node] = await db
      .insert(flowNodes)
      .values({
        flowId: data.flowId,
        type: data.type,
        label: data.label ?? null,
        positionX: Math.round(data.positionX),
        positionY: Math.round(data.positionY),
      })
      .returning()
    await touchFlow(data.flowId)
    return node
  })

/**
 * updateFlowNode(nodeId, config) — also label and/or position.
 */
export const updateFlowNode = createServerFn({ method: 'POST', strict: false })
  .inputValidator(
    (data: {
      flowId: number
      nodeId: number
      config?: Record<string, unknown>
      label?: string
      positionX?: number
      positionY?: number
    }) => data,
  )
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFlowOwner(data.flowId, userId)

    const changes: Record<string, unknown> = {}
    if (data.config !== undefined) changes.config = data.config
    if (data.label !== undefined) changes.label = data.label
    if (data.positionX !== undefined) changes.positionX = Math.round(data.positionX)
    if (data.positionY !== undefined) changes.positionY = Math.round(data.positionY)

    const [node] = await db
      .update(flowNodes)
      .set(changes)
      .where(eq(flowNodes.id, data.nodeId))
      .returning()
    if (!node || node.flowId !== data.flowId) throw new Error('Not found')
    await touchFlow(data.flowId)
    return node
  })

/**
 * deleteFlowNode(nodeId) — deletes the node; its incoming and outgoing edges
 * are removed automatically by the FK cascade.
 */
export const deleteFlowNode = createServerFn({ method: 'POST' })
  .inputValidator((data: { flowId: number; nodeId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFlowOwner(data.flowId, userId)

    const [node] = await db.select().from(flowNodes).where(eq(flowNodes.id, data.nodeId)).limit(1)
    if (!node || node.flowId !== data.flowId) throw new Error('Not found')

    // Clear startNodeId if we're deleting the start node reference.
    await db
      .update(flows)
      .set({ startNodeId: null })
      .where(eq(flows.startNodeId, data.nodeId))

    await db.delete(flowNodes).where(eq(flowNodes.id, data.nodeId))
    await touchFlow(data.flowId)
    return { success: true }
  })

/**
 * addFlowEdge(flowId, sourceNodeId, targetNodeId, metadata) — connect two nodes.
 */
export const addFlowEdge = createServerFn({ method: 'POST', strict: false })
  .inputValidator(
    (data: {
      flowId: number
      sourceNodeId: number
      targetNodeId: number
      metadata?: { matchValue?: string; label?: string }
    }) => data,
  )
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFlowOwner(data.flowId, userId)

    const [edge] = await db
      .insert(flowEdges)
      .values({
        flowId: data.flowId,
        sourceNodeId: data.sourceNodeId,
        targetNodeId: data.targetNodeId,
        metadata: data.metadata ?? {},
      })
      .returning()
    await touchFlow(data.flowId)
    return edge
  })

/**
 * updateFlowEdge(edgeId, metadata) — e.g. set matchValue for decision branches.
 */
export const updateFlowEdge = createServerFn({ method: 'POST', strict: false })
  .inputValidator(
    (data: {
      flowId: number
      edgeId: number
      metadata: { matchValue?: string; label?: string }
    }) => data,
  )
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFlowOwner(data.flowId, userId)

    const [edge] = await db
      .update(flowEdges)
      .set({ metadata: data.metadata })
      .where(eq(flowEdges.id, data.edgeId))
      .returning()
    if (!edge || edge.flowId !== data.flowId) throw new Error('Not found')
    await touchFlow(data.flowId)
    return edge
  })

/**
 * deleteFlowEdge(edgeId) — remove an edge.
 */
export const deleteFlowEdge = createServerFn({ method: 'POST' })
  .inputValidator((data: { flowId: number; edgeId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFlowOwner(data.flowId, userId)

    const [edge] = await db.select().from(flowEdges).where(eq(flowEdges.id, data.edgeId)).limit(1)
    if (!edge || edge.flowId !== data.flowId) throw new Error('Not found')

    await db.delete(flowEdges).where(eq(flowEdges.id, data.edgeId))
    await touchFlow(data.flowId)
    return { success: true }
  })

// ── List-view primary-path operations ──
// These maintain the linear chain of edges automatically so the List view feels
// like the old form builder (add / reorder / delete without drawing edges).
// They only touch primary-path edges; decision branch edges are preserved.

/**
 * insertNodeInPath — add a node into the primary chain right after `afterNodeId`.
 *
 * Splices the node between `afterNodeId` and whatever it currently points to
 * (delete after→next, add after→new and new→next). For `form_field` nodes a
 * bound variable is auto-created from the label, so the field's answer is
 * captured by name with no manual variable setup.
 */
export const insertNodeInPath = createServerFn({ method: 'POST', strict: false })
  .inputValidator(
    (data: {
      flowId: number
      type: FlowNodeType
      afterNodeId: number
      fieldType?: string
      label?: string
      config?: Record<string, unknown>
    }) => data,
  )
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFlowOwner(data.flowId, userId)

    const [afterNode] = await db
      .select()
      .from(flowNodes)
      .where(eq(flowNodes.id, data.afterNodeId))
      .limit(1)
    if (!afterNode || afterNode.flowId !== data.flowId) throw new Error('Not found')

    // Build the new node's config (and auto-bound variable for form fields).
    let config: Record<string, unknown> = data.config ?? {}
    const label = data.label ?? null
    if (data.type === 'form_field' && data.fieldType) {
      const existingVars = await db
        .select({ name: flowVariables.name })
        .from(flowVariables)
        .where(eq(flowVariables.flowId, data.flowId))
      const used = new Set(existingVars.map((v) => v.name))
      const varName = uniqueVarName(data.label ?? data.fieldType, used, `field_${Date.now()}`)
      await db.insert(flowVariables).values({
        flowId: data.flowId,
        name: varName,
        type: variableTypeForField(data.fieldType),
        description: data.label ? `Answer to "${data.label}"` : undefined,
      })
      config = {
        fieldType: data.fieldType,
        label: data.label ?? '',
        required: false,
        bindToVariable: varName,
        ...config,
      }
    }

    const [node] = await db
      .insert(flowNodes)
      .values({
        flowId: data.flowId,
        type: data.type,
        label,
        positionX: afterNode.positionX,
        positionY: afterNode.positionY + 140,
        config,
      })
      .returning()

    // Splice into the chain.
    const edges = (await db
      .select()
      .from(flowEdges)
      .where(eq(flowEdges.flowId, data.flowId))) as FlowEdge[]
    const nextEdge = primaryOutgoingEdge(edges, data.afterNodeId)

    await db
      .insert(flowEdges)
      .values({ flowId: data.flowId, sourceNodeId: data.afterNodeId, targetNodeId: node.id })
    if (nextEdge) {
      await db.delete(flowEdges).where(eq(flowEdges.id, nextEdge.id))
      await db
        .insert(flowEdges)
        .values({ flowId: data.flowId, sourceNodeId: node.id, targetNodeId: nextEdge.targetNodeId })
    }

    await touchFlow(data.flowId)
    return node
  })

/**
 * removeNodeFromPath — delete a node and re-stitch its predecessor to its
 * primary successor (prev→next), so the chain stays connected. The bound
 * variable, if any, is left in place (it may be referenced elsewhere).
 */
export const removeNodeFromPath = createServerFn({ method: 'POST' })
  .inputValidator((data: { flowId: number; nodeId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFlowOwner(data.flowId, userId)

    const [node] = await db.select().from(flowNodes).where(eq(flowNodes.id, data.nodeId)).limit(1)
    if (!node || node.flowId !== data.flowId) throw new Error('Not found')
    if (node.type === 'start') throw new Error('The Start node cannot be deleted.')

    const edges = (await db
      .select()
      .from(flowEdges)
      .where(eq(flowEdges.flowId, data.flowId))) as FlowEdge[]
    const incoming = edges
      .filter((e) => e.targetNodeId === data.nodeId)
      .sort((a, b) => a.id - b.id)[0]
    const outgoing = primaryOutgoingEdge(edges, data.nodeId)

    // Deleting the node cascades its edges away.
    await db.delete(flowNodes).where(eq(flowNodes.id, data.nodeId))

    // Re-stitch prev → next when both exist.
    if (incoming && outgoing && incoming.sourceNodeId !== outgoing.targetNodeId) {
      await db.insert(flowEdges).values({
        flowId: data.flowId,
        sourceNodeId: incoming.sourceNodeId,
        targetNodeId: outgoing.targetNodeId,
      })
    }

    await touchFlow(data.flowId)
    return { success: true }
  })

/**
 * reorderPath — rebuild the primary chain to match `orderedNodeIds` (Start
 * first, terminal last). Only safe for pure-linear flows; the List view guards
 * this and falls back to Canvas when branches exist. Edges whose endpoints are
 * both in the set are dropped and recreated as a consecutive chain.
 */
export const reorderPath = createServerFn({ method: 'POST', strict: false })
  .inputValidator((data: { flowId: number; orderedNodeIds: number[] }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFlowOwner(data.flowId, userId)

    const edges = (await db
      .select()
      .from(flowEdges)
      .where(eq(flowEdges.flowId, data.flowId))) as FlowEdge[]
    const idSet = new Set(data.orderedNodeIds)

    // Drop existing edges internal to the reordered set.
    const toDelete = edges.filter((e) => idSet.has(e.sourceNodeId) && idSet.has(e.targetNodeId))
    await Promise.all(
      toDelete.map((e) => db.delete(flowEdges).where(eq(flowEdges.id, e.id))),
    )

    // Recreate the consecutive chain.
    for (let i = 0; i < data.orderedNodeIds.length - 1; i++) {
      await db.insert(flowEdges).values({
        flowId: data.flowId,
        sourceNodeId: data.orderedNodeIds[i],
        targetNodeId: data.orderedNodeIds[i + 1],
      })
    }

    await touchFlow(data.flowId)
    return { success: true }
  })

/**
 * saveFlowLayout(flowId, nodes) — bulk-update node positions after a drag.
 */
export const saveFlowLayout = createServerFn({ method: 'POST', strict: false })
  .inputValidator(
    (data: {
      flowId: number
      nodes: { id: number; positionX: number; positionY: number }[]
    }) => data,
  )
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFlowOwner(data.flowId, userId)

    await Promise.all(
      data.nodes.map((n) =>
        db
          .update(flowNodes)
          .set({ positionX: Math.round(n.positionX), positionY: Math.round(n.positionY) })
          .where(eq(flowNodes.id, n.id)),
      ),
    )
    await touchFlow(data.flowId)
    return { success: true }
  })
