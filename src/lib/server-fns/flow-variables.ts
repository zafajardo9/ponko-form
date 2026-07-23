import { createServerFn } from '@tanstack/react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import { db } from '../../db/index'
import { flowVariables, flowNodes } from '../../db/schema'
import { eq, and } from 'drizzle-orm'
import { assertFlowOwner } from './flow-helpers'
import type { FlowVariableType } from '../flow-engine/types'

/** snake_case identifier check for variable names. */
function isValidVariableName(name: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(name)
}

/**
 * getFlowVariables(flowId) — list all variables for a flow.
 */
export const getFlowVariables = createServerFn({ method: 'GET' })
  .validator((data: { flowId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFlowOwner(data.flowId, userId)
    return db
      .select()
      .from(flowVariables)
      .where(eq(flowVariables.flowId, data.flowId))
      .orderBy(flowVariables.id)
  })

/**
 * createFlowVariable(flowId, name, type, defaultValue?, description?)
 * Declares a new variable. Validates snake_case name and uniqueness within the flow.
 */
export const createFlowVariable = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      flowId: number
      name: string
      type: FlowVariableType
      defaultValue?: string
      description?: string
    }) => data,
  )
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFlowOwner(data.flowId, userId)

    if (!isValidVariableName(data.name)) {
      throw new Error(
        'Variable name must be snake_case (lowercase letters, numbers, underscores; starting with a letter).',
      )
    }

    const [existing] = await db
      .select()
      .from(flowVariables)
      .where(and(eq(flowVariables.flowId, data.flowId), eq(flowVariables.name, data.name)))
      .limit(1)
    if (existing) throw new Error(`A variable named "${data.name}" already exists in this flow.`)

    const [variable] = await db
      .insert(flowVariables)
      .values({
        flowId: data.flowId,
        name: data.name,
        type: data.type,
        defaultValue: data.defaultValue ?? null,
        description: data.description ?? null,
      })
      .returning()
    return variable
  })

/**
 * updateFlowVariable(varId, changes) — update variable properties.
 * Re-validates name uniqueness if the name changes.
 */
export const updateFlowVariable = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      flowId: number
      varId: number
      name?: string
      type?: FlowVariableType
      defaultValue?: string | null
      description?: string | null
    }) => data,
  )
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFlowOwner(data.flowId, userId)

    const changes: Record<string, unknown> = {}
    if (data.name !== undefined) {
      if (!isValidVariableName(data.name)) {
        throw new Error('Variable name must be snake_case.')
      }
      const [clash] = await db
        .select()
        .from(flowVariables)
        .where(and(eq(flowVariables.flowId, data.flowId), eq(flowVariables.name, data.name)))
        .limit(1)
      if (clash && clash.id !== data.varId) {
        throw new Error(`A variable named "${data.name}" already exists in this flow.`)
      }
      changes.name = data.name
    }
    if (data.type !== undefined) changes.type = data.type
    if (data.defaultValue !== undefined) changes.defaultValue = data.defaultValue
    if (data.description !== undefined) changes.description = data.description

    const [variable] = await db
      .update(flowVariables)
      .set(changes)
      .where(and(eq(flowVariables.id, data.varId), eq(flowVariables.flowId, data.flowId)))
      .returning()
    if (!variable) throw new Error('Not found')
    return variable
  })

/**
 * deleteFlowVariable(varId) — remove a variable.
 * Refuses if any node references it (by name) in its config.
 */
export const deleteFlowVariable = createServerFn({ method: 'POST' })
  .validator((data: { flowId: number; varId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFlowOwner(data.flowId, userId)

    const [variable] = await db
      .select()
      .from(flowVariables)
      .where(and(eq(flowVariables.id, data.varId), eq(flowVariables.flowId, data.flowId)))
      .limit(1)
    if (!variable) throw new Error('Not found')

    // Check no node references this variable.
    const nodes = await db.select().from(flowNodes).where(eq(flowNodes.flowId, data.flowId))
    const name = variable.name
    const referencedBy = nodes.filter((n) => nodeReferencesVariable(n.config, name))
    if (referencedBy.length > 0) {
      throw new Error(
        `Cannot delete "${name}" — it is referenced by ${referencedBy.length} node(s). Remove those references first.`,
      )
    }

    await db
      .delete(flowVariables)
      .where(and(eq(flowVariables.id, data.varId), eq(flowVariables.flowId, data.flowId)))
    return { success: true }
  })

/** Whether a node's config references a variable by name (binding, source, target, or in a template/expression). */
function nodeReferencesVariable(config: Record<string, unknown>, name: string): boolean {
  if (config.bindToVariable === name) return true
  if (config.sourceVariable === name) return true
  if (config.targetVariable === name) return true
  if (config.amountVariable === name) return true
  const placeholder = `{{${name}}}`
  for (const key of ['expression', 'template', 'urlTemplate'] as const) {
    const val = config[key]
    if (typeof val === 'string' && val.includes(placeholder)) return true
  }
  return false
}
