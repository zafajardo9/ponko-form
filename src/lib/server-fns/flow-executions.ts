import { createServerFn } from '@tanstack/react-start'
import { db } from '../../db/index'
import {
  flows,
  flowNodes,
  flowVariables,
  flowExecutions,
  formSubmissions,
  forms,
  payments,
  paymentGateways,
} from '../../db/schema'
import { eq, and, desc } from 'drizzle-orm'
import type {
  ExecutionStatus,
  ExecutionHistoryEntry,
  FlowVariable,
} from '../flow-engine/types'

/**
 * Flow execution management (end-user, public — no auth).
 *
 * The runtime FlowEngine lives client-side (spec §5). These functions persist
 * execution progress so a session survives refresh/resume and so completed runs
 * are recorded as form submissions.
 */

/** Parse stored default values into typed runtime values (mirrors FlowEngine). */
function computeDefaultValues(variables: FlowVariable[]): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const v of variables) {
    if (v.defaultValue === null) continue
    switch (v.type) {
      case 'number':
      case 'money':
        values[v.name] = Number(v.defaultValue)
        break
      case 'boolean':
        values[v.name] = v.defaultValue === 'true'
        break
      default:
        values[v.name] = v.defaultValue
    }
  }
  return values
}

/**
 * startFlowExecution(flowId)
 * Create an in_progress execution seeded with default variable values, starting
 * at the flow's start node. Returns the execution row.
 */
export const startFlowExecution = createServerFn({ method: 'POST', strict: false })
  .inputValidator((data: { flowId: number }) => data)
  .handler(async ({ data }) => {
    const [flow] = await db.select().from(flows).where(eq(flows.id, data.flowId)).limit(1)
    if (!flow) throw new Error('Flow not found')

    const variables = await db
      .select()
      .from(flowVariables)
      .where(eq(flowVariables.flowId, data.flowId))

    // Resolve the start node (prefer the recorded reference).
    let startNodeId = flow.startNodeId
    if (!startNodeId) {
      const [start] = await db
        .select()
        .from(flowNodes)
        .where(and(eq(flowNodes.flowId, data.flowId), eq(flowNodes.type, 'start')))
        .limit(1)
      if (!start) throw new Error('Flow has no Start node')
      startNodeId = start.id
    }

    const [execution] = await db
      .insert(flowExecutions)
      .values({
        flowId: data.flowId,
        status: 'in_progress',
        currentNodeId: startNodeId,
        variables: computeDefaultValues(variables as FlowVariable[]),
        history: [],
      })
      .returning()

    return execution
  })

/**
 * advanceExecution(executionId, snapshot)
 * Persist the client engine's current snapshot — updated currentNodeId,
 * variables, history, and status. Returns the updated execution row.
 */
export const advanceExecution = createServerFn({ method: 'POST', strict: false })
  .inputValidator(
    (data: {
      executionId: number
      currentNodeId: number
      variables: Record<string, unknown>
      history: ExecutionHistoryEntry[]
      status?: ExecutionStatus
    }) => data,
  )
  .handler(async ({ data }) => {
    const [execution] = await db
      .update(flowExecutions)
      .set({
        currentNodeId: data.currentNodeId,
        variables: data.variables,
        history: data.history,
        ...(data.status ? { status: data.status } : {}),
      })
      .where(eq(flowExecutions.id, data.executionId))
      .returning()
    if (!execution) throw new Error('Execution not found')
    return execution
  })

/**
 * completeExecution(executionId, finalState)
 * Mark the execution completed, record a form submission with the final
 * variable values, and link it. Returns the execution and submission.
 */
export const completeExecution = createServerFn({ method: 'POST', strict: false })
  .inputValidator(
    (data: {
      executionId: number
      variables: Record<string, unknown>
      history: ExecutionHistoryEntry[]
    }) => data,
  )
  .handler(async ({ data }) => {
    const [execution] = await db
      .select()
      .from(flowExecutions)
      .where(eq(flowExecutions.id, data.executionId))
      .limit(1)
    if (!execution) throw new Error('Execution not found')

    const [flow] = await db.select().from(flows).where(eq(flows.id, execution.flowId)).limit(1)
    if (!flow) throw new Error('Flow not found')

    // Record the run as a form submission (variable values + execution path).
    const [submission] = await db
      .insert(formSubmissions)
      .values({
        formId: flow.formId,
        status: 'completed',
        formData: {
          ...data.variables,
          __executionPath: data.history.map((h) => ({ nodeId: h.nodeId, nodeType: h.nodeType })),
        },
      })
      .returning()

    const [updated] = await db
      .update(flowExecutions)
      .set({
        status: 'completed',
        variables: data.variables,
        history: data.history,
        formSubmissionId: submission.id,
        completedAt: new Date(),
      })
      .where(eq(flowExecutions.id, data.executionId))
      .returning()

    return { execution: updated, submission }
  })

/**
 * getCompletionData(executionId)
 * Everything the completion page needs in one call: the execution snapshot,
 * the form title + id, the flow's declared variables (for typed formatting),
 * and the summary node's title/template (if the run ended at one).
 */
export const getCompletionData = createServerFn({ method: 'GET', strict: false })
  .inputValidator((data: { executionId: number }) => data)
  .handler(async ({ data }) => {
    const [execution] = await db
      .select()
      .from(flowExecutions)
      .where(eq(flowExecutions.id, data.executionId))
      .limit(1)
    if (!execution) throw new Error('Execution not found')

    const [flow] = await db.select().from(flows).where(eq(flows.id, execution.flowId)).limit(1)
    const [form] = flow
      ? await db.select().from(forms).where(eq(forms.id, flow.formId)).limit(1)
      : []

    const variables = await db
      .select()
      .from(flowVariables)
      .where(eq(flowVariables.flowId, execution.flowId))
      .orderBy(flowVariables.id)

    // Find the summary node the run ended on (any summary node visited in history).
    const nodes = await db.select().from(flowNodes).where(eq(flowNodes.flowId, execution.flowId))
    const history = (execution.history as { nodeId: number; nodeType: string }[]) ?? []
    const visitedIds = new Set(history.map((h) => h.nodeId))
    const summaryNode =
      nodes.find((n) => n.type === 'summary' && visitedIds.has(n.id)) ??
      nodes.find((n) => n.type === 'summary')

    // Latest payment attempt for this run (if any), so the receipt can show a
    // paid/failed state and the gateway used.
    const [payment] = await db
      .select({
        status: payments.status,
        amount: payments.amount,
        currency: payments.currency,
        gatewayPaymentId: payments.gatewayPaymentId,
        gatewayName: paymentGateways.name,
      })
      .from(payments)
      .innerJoin(paymentGateways, eq(payments.paymentGatewayId, paymentGateways.id))
      .where(eq(payments.flowExecutionId, data.executionId))
      .orderBy(desc(payments.id))
      .limit(1)

    return {
      execution,
      formId: flow?.formId ?? null,
      formTitle: form?.title ?? 'Form',
      variables: variables as FlowVariable[],
      summary: summaryNode
        ? {
            title: (summaryNode.config as Record<string, unknown>).title as string | undefined,
            template: (summaryNode.config as Record<string, unknown>).template as string | undefined,
          }
        : null,
      payment: payment
        ? {
            status: payment.status,
            amount: payment.amount, // minor units (cents)
            currency: payment.currency,
            gatewayPaymentId: payment.gatewayPaymentId,
            gatewayName: payment.gatewayName,
          }
        : null,
    }
  })

/**
 * getExecutionState(executionId)
 * Fetch the current execution context (for page refresh / resume).
 */
export const getExecutionState = createServerFn({ method: 'GET', strict: false })
  .inputValidator((data: { executionId: number }) => data)
  .handler(async ({ data }) => {
    const [execution] = await db
      .select()
      .from(flowExecutions)
      .where(eq(flowExecutions.id, data.executionId))
      .limit(1)
    if (!execution) throw new Error('Execution not found')
    return execution
  })
