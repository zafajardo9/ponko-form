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
import { loadFlow } from '../flow-engine/server-data'

/**
 * getFlow(formId)
 *
 * Fetch the complete flow for a form — its nodes, edges, and variables —
 * structured for the frontend. Returns `null` if the form has no flow
 * (i.e. it is a legacy linear form, per REQ-4.1).
 *
 * Editor-only: public runtimes use `getPublicFormRuntime`, which enforces
 * published status. This endpoint owner-gates the complete draft definition.
 */
export const getFlow = createServerFn({ method: 'GET', strict: false })
  .validator((data: { formId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)
    return loadFlow(data.formId)
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
  const used = new Set<string>()
  const fieldPlans = fields.map((field, index) => {
    const varName = uniqueVarName(field.label, used, `field_${field.id}`)
    return {
      variable: {
        flowId: flow.id,
        name: varName,
        type: variableTypeForField(field.type),
        description: `Imported from "${field.label}"`,
      } satisfies typeof flowVariables.$inferInsert,
      node: {
        flowId: flow.id,
        type: 'form_field' as const,
        label: field.label,
        positionX: 250,
        positionY: 240 + index * 140,
        config: {
          fieldType: field.type,
          label: field.label,
          placeholder: field.placeholder ?? undefined,
          required: field.required,
          options: field.options ?? undefined,
          bindToVariable: varName,
        },
      } satisfies typeof flowNodes.$inferInsert,
      variableName: varName,
    }
  })

  const summaryY = 240 + fields.length * 140
  const nodeValues: (typeof flowNodes.$inferInsert)[] = [
    {
      flowId: flow.id,
      type: 'start',
      label: 'Start',
      positionX: 250,
      positionY: 100,
    },
    ...fieldPlans.map((plan) => plan.node),
    {
      flowId: flow.id,
      type: 'summary',
      label: 'Summary',
      positionX: 250,
      positionY: summaryY,
      config: {
        title: 'Thank you!',
        template: 'Your response has been recorded.',
      },
    },
  ]

  const [, createdNodes] = await Promise.all([
    fieldPlans.length > 0
      ? db.insert(flowVariables).values(fieldPlans.map((plan) => plan.variable))
      : Promise.resolve(),
    db.insert(flowNodes).values(nodeValues).returning(),
  ])

  const startNode = createdNodes.find((node) => node.type === 'start')
  const summaryNode = createdNodes.find((node) => node.type === 'summary')
  const fieldNodeByVariable = new Map(
    createdNodes
      .filter((node) => node.type === 'form_field')
      .map((node) => [
        (node.config as Record<string, unknown>).bindToVariable,
        node.id,
      ]),
  )
  const orderedNodeIds = [
    startNode?.id,
    ...fieldPlans.map((plan) => fieldNodeByVariable.get(plan.variableName)),
    summaryNode?.id,
  ]
  if (orderedNodeIds.some((id) => id === undefined)) {
    throw new Error('Unable to create the legacy form flow')
  }

  await db.insert(flowEdges).values(
    orderedNodeIds.slice(0, -1).map((sourceNodeId, index) => ({
      flowId: flow.id,
      sourceNodeId: sourceNodeId!,
      targetNodeId: orderedNodeIds[index + 1]!,
    })),
  )

  await db
    .update(flows)
    .set({ startNodeId: startNode!.id, updatedAt: new Date() })
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
  .validator((data: { formId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)

    const [existing] = await db.select().from(flows).where(eq(flows.formId, data.formId)).limit(1)
    if (existing) return { flowId: existing.id, created: false }

    const flowId = await buildFlowFromFields(data.formId)
    return { flowId, created: true }
  })
