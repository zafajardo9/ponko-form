import { createServerFn } from '@tanstack/react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import { db } from '../../db/index'
import { flowNodes, flowEdges, flowVariables, flows } from '../../db/schema'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { assertFlowOwner, uniqueVarName, variableTypeForField } from './flow-helpers'
import { primaryOutgoingEdge } from '../flow-engine/path-utils'
import type { FlowNodeType, FlowEdge } from '../flow-engine/types'

/** Touch the flow's updatedAt so the dashboard reflects recent edits. */
async function touchFlow(flowId: number) {
  await db.update(flows).set({ updatedAt: new Date() }).where(eq(flows.id, flowId))
}

async function assertFlowNodeIds(flowId: number, nodeIds: number[]) {
  const uniqueIds = [...new Set(nodeIds)]
  if (uniqueIds.length !== nodeIds.length) throw new Error('Duplicate flow node')
  if (uniqueIds.length === 0) return
  const ownedNodes = await db
    .select({ id: flowNodes.id })
    .from(flowNodes)
    .where(and(eq(flowNodes.flowId, flowId), inArray(flowNodes.id, uniqueIds)))
  if (ownedNodes.length !== uniqueIds.length) throw new Error('Flow node not found')
}

/**
 * addFlowNode(flowId, type, positionX, positionY)
 * Insert a new node and return it.
 */
export const addFlowNode = createServerFn({ method: 'POST', strict: false })
  .validator(
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
  .validator(
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
      .where(and(eq(flowNodes.id, data.nodeId), eq(flowNodes.flowId, data.flowId)))
      .returning()
    if (!node) throw new Error('Not found')
    await touchFlow(data.flowId)
    return node
  })

/**
 * deleteFlowNode(nodeId) — deletes the node; its incoming and outgoing edges
 * are removed automatically by the FK cascade.
 */
export const deleteFlowNode = createServerFn({ method: 'POST' })
  .validator((data: { flowId: number; nodeId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFlowOwner(data.flowId, userId)

    const [node] = await db
      .select()
      .from(flowNodes)
      .where(and(eq(flowNodes.id, data.nodeId), eq(flowNodes.flowId, data.flowId)))
      .limit(1)
    if (!node) throw new Error('Not found')

    // Clear startNodeId if we're deleting the start node reference.
    await db
      .update(flows)
      .set({ startNodeId: null })
      .where(and(eq(flows.id, data.flowId), eq(flows.startNodeId, data.nodeId)))

    await db
      .delete(flowNodes)
      .where(and(eq(flowNodes.id, data.nodeId), eq(flowNodes.flowId, data.flowId)))
    await touchFlow(data.flowId)
    return { success: true }
  })

/**
 * addFlowEdge(flowId, sourceNodeId, targetNodeId, metadata) — connect two nodes.
 */
export const addFlowEdge = createServerFn({ method: 'POST', strict: false })
  .validator(
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
    if (data.sourceNodeId === data.targetNodeId) {
      throw new Error('A flow node cannot connect to itself')
    }
    await assertFlowNodeIds(data.flowId, [data.sourceNodeId, data.targetNodeId])

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
  .validator(
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
      .where(and(eq(flowEdges.id, data.edgeId), eq(flowEdges.flowId, data.flowId)))
      .returning()
    if (!edge) throw new Error('Not found')
    await touchFlow(data.flowId)
    return edge
  })

/**
 * deleteFlowEdge(edgeId) — remove an edge.
 */
export const deleteFlowEdge = createServerFn({ method: 'POST' })
  .validator((data: { flowId: number; edgeId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFlowOwner(data.flowId, userId)

    const [edge] = await db
      .select()
      .from(flowEdges)
      .where(and(eq(flowEdges.id, data.edgeId), eq(flowEdges.flowId, data.flowId)))
      .limit(1)
    if (!edge) throw new Error('Not found')

    await db
      .delete(flowEdges)
      .where(and(eq(flowEdges.id, data.edgeId), eq(flowEdges.flowId, data.flowId)))
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
  .validator(
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
      .where(and(eq(flowNodes.id, data.afterNodeId), eq(flowNodes.flowId, data.flowId)))
      .limit(1)
    if (!afterNode) throw new Error('Not found')

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
      await db
        .delete(flowEdges)
        .where(and(eq(flowEdges.id, nextEdge.id), eq(flowEdges.flowId, data.flowId)))
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
  .validator((data: { flowId: number; nodeId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFlowOwner(data.flowId, userId)

    const [node] = await db
      .select()
      .from(flowNodes)
      .where(and(eq(flowNodes.id, data.nodeId), eq(flowNodes.flowId, data.flowId)))
      .limit(1)
    if (!node) throw new Error('Not found')
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
    await db
      .delete(flowNodes)
      .where(and(eq(flowNodes.id, data.nodeId), eq(flowNodes.flowId, data.flowId)))

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
 * moveFieldIntoGroup — fold an existing standalone `form_field` node into a
 * Field Group's inline `config.fields`, then remove the node from the primary
 * path (re-stitching prev → next so the chain stays connected).
 *
 * The field's `bindToVariable` is carried over unchanged, so the answer is
 * still captured under the same variable — and the variable itself is left in
 * place (it may be referenced elsewhere). This is the inverse of building a
 * group field from scratch: the field simply moves from its own step onto the
 * group's page.
 */
export const moveFieldIntoGroup = createServerFn({ method: 'POST' })
  .validator((data: { flowId: number; nodeId: number; groupId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFlowOwner(data.flowId, userId)

    const [node] = await db
      .select()
      .from(flowNodes)
      .where(and(eq(flowNodes.id, data.nodeId), eq(flowNodes.flowId, data.flowId)))
      .limit(1)
    if (!node) throw new Error('Field not found')
    if (node.type !== 'form_field') throw new Error('Only form fields can be moved into a group')

    const [group] = await db
      .select()
      .from(flowNodes)
      .where(and(eq(flowNodes.id, data.groupId), eq(flowNodes.flowId, data.flowId)))
      .limit(1)
    if (!group) throw new Error('Group not found')
    if (group.type !== 'group') throw new Error('Target is not a Field Group')

    // Convert the node's config into a grouped field entry.
    const cfg = (node.config ?? {}) as Record<string, unknown>
    const groupedField = {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      fieldType: (cfg.fieldType as string) ?? 'text',
      label: (cfg.label as string) || node.label || 'Field',
      placeholder: cfg.placeholder as string | undefined,
      required: Boolean(cfg.required),
      options: cfg.options as { label: string; value: string }[] | undefined,
      bindToVariable: cfg.bindToVariable as string | undefined,
    }

    const groupCfg = (group.config ?? {}) as Record<string, unknown>
    const existingFields = (groupCfg.fields as unknown[] | undefined) ?? []
    await db
      .update(flowNodes)
      .set({ config: { ...groupCfg, fields: [...existingFields, groupedField] } })
      .where(and(eq(flowNodes.id, data.groupId), eq(flowNodes.flowId, data.flowId)))

    // Re-stitch the primary path around the removed node (prev → next).
    const edges = (await db
      .select()
      .from(flowEdges)
      .where(eq(flowEdges.flowId, data.flowId))) as FlowEdge[]
    const incoming = edges
      .filter((e) => e.targetNodeId === data.nodeId)
      .sort((a, b) => a.id - b.id)[0]
    const outgoing = primaryOutgoingEdge(edges, data.nodeId)

    await db
      .delete(flowNodes)
      .where(and(eq(flowNodes.id, data.nodeId), eq(flowNodes.flowId, data.flowId)))

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
  .validator((data: { flowId: number; orderedNodeIds: number[] }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFlowOwner(data.flowId, userId)
    await assertFlowNodeIds(data.flowId, data.orderedNodeIds)

    const edges = (await db
      .select()
      .from(flowEdges)
      .where(eq(flowEdges.flowId, data.flowId))) as FlowEdge[]
    const idSet = new Set(data.orderedNodeIds)

    // Drop existing edges internal to the reordered set.
    const toDelete = edges.filter((e) => idSet.has(e.sourceNodeId) && idSet.has(e.targetNodeId))
    if (toDelete.length > 0) {
      await db
        .delete(flowEdges)
        .where(
          and(
            eq(flowEdges.flowId, data.flowId),
            inArray(flowEdges.id, toDelete.map((edge) => edge.id)),
          ),
        )
    }

    // Recreate the consecutive chain.
    const edgeValues = data.orderedNodeIds
      .slice(0, -1)
      .map((sourceNodeId, index) => ({
        flowId: data.flowId,
        sourceNodeId,
        targetNodeId: data.orderedNodeIds[index + 1],
      }))
    if (edgeValues.length > 0) {
      await db.insert(flowEdges).values(edgeValues)
    }

    await touchFlow(data.flowId)
    return { success: true }
  })

/**
 * saveFlowLayout(flowId, nodes) — bulk-update node positions after a drag.
 */
export const saveFlowLayout = createServerFn({ method: 'POST', strict: false })
  .validator(
    (data: {
      flowId: number
      nodes: { id: number; positionX: number; positionY: number }[]
    }) => data,
  )
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFlowOwner(data.flowId, userId)

    if (data.nodes.length > 0) {
      const positionX = sql<number>`case ${sql.join(
        data.nodes.map(
          (node) =>
            sql`when ${flowNodes.id} = ${node.id} then ${Math.round(node.positionX)}`,
        ),
        sql.raw(' '),
      )} else ${flowNodes.positionX} end`
      const positionY = sql<number>`case ${sql.join(
        data.nodes.map(
          (node) =>
            sql`when ${flowNodes.id} = ${node.id} then ${Math.round(node.positionY)}`,
        ),
        sql.raw(' '),
      )} else ${flowNodes.positionY} end`
      await db
        .update(flowNodes)
        .set({ positionX, positionY })
        .where(
          and(
            eq(flowNodes.flowId, data.flowId),
            inArray(
              flowNodes.id,
              data.nodes.map((node) => node.id),
            ),
          ),
        )
    }
    await touchFlow(data.flowId)
    return { success: true }
  })
