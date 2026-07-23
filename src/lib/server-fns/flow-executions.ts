import { createServerFn } from '@tanstack/react-start'
import { dispatchSubmissionEmails } from '../invoicing/delivery'
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
import { isValidPublicSessionToken } from '../public-session-access'
import { ensureFlowSubmissionDraft } from '../flow-engine/submission-draft'

function flowExecutionAccessWhere(executionId: number, clientToken: string) {
  if (!isValidPublicSessionToken(clientToken)) {
    throw new Error('Invalid execution token')
  }
  return and(
    eq(flowExecutions.id, executionId),
    eq(flowExecutions.clientToken, clientToken),
  )
}

function publicExecution(execution: typeof flowExecutions.$inferSelect) {
  return {
    id: execution.id,
    status: execution.status,
    currentNodeId: execution.currentNodeId,
    variables: execution.variables,
    history: execution.history,
    completedAt: execution.completedAt,
    createdAt: execution.createdAt,
  }
}

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
  .validator((data: { flowId: number; clientToken: string }) => data)
  .handler(async ({ data }) => {
    if (!isValidPublicSessionToken(data.clientToken)) {
      throw new Error('Invalid execution token')
    }
    const [record] = await db
      .select({ flow: flows })
      .from(flows)
      .innerJoin(forms, eq(flows.formId, forms.id))
      .where(and(eq(flows.id, data.flowId), eq(forms.status, 'published')))
      .limit(1)
    if (!record) throw new Error('Flow not found')
    const flow = record.flow

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
        clientToken: data.clientToken,
        status: 'in_progress',
        currentNodeId: startNodeId,
        variables: computeDefaultValues(variables as FlowVariable[]),
        history: [],
      })
      .returning()

    return publicExecution(execution)
  })

/**
 * advanceExecution(executionId, snapshot)
 * Persist the client engine's current snapshot — updated currentNodeId,
 * variables, history, and status. Returns the updated execution row.
 */
export const advanceExecution = createServerFn({ method: 'POST', strict: false })
  .validator(
    (data: {
      executionId: number
      clientToken: string
      currentNodeId: number
      variables: Record<string, unknown>
      history: ExecutionHistoryEntry[]
      status?: ExecutionStatus
    }) => data,
  )
  .handler(async ({ data }) => {
    const [existing] = await db
      .select({ flowId: flowExecutions.flowId })
      .from(flowExecutions)
      .where(flowExecutionAccessWhere(data.executionId, data.clientToken))
      .limit(1)
    if (!existing) throw new Error('Execution not found')
    const [currentNode] = await db
      .select({ id: flowNodes.id })
      .from(flowNodes)
      .where(
        and(
          eq(flowNodes.id, data.currentNodeId),
          eq(flowNodes.flowId, existing.flowId),
        ),
      )
      .limit(1)
    if (!currentNode) throw new Error('Flow node not found')
    const [execution] = await db
      .update(flowExecutions)
      .set({
        currentNodeId: data.currentNodeId,
        variables: data.variables,
        history: data.history,
        ...(data.status ? { status: data.status } : {}),
      })
      .where(flowExecutionAccessWhere(data.executionId, data.clientToken))
      .returning()
    if (!execution) throw new Error('Execution not found')
    return publicExecution(execution)
  })

/**
 * completeExecution(executionId, finalState)
 * Mark the execution completed, record a form submission with the final
 * variable values, and link it. Returns the execution and submission.
 */
export const completeExecution = createServerFn({ method: 'POST', strict: false })
  .validator(
    (data: {
      executionId: number
      clientToken: string
      variables: Record<string, unknown>
      history: ExecutionHistoryEntry[]
    }) => data,
  )
  .handler(async ({ data }) => {
    const [record] = await db
      .select({
        execution: flowExecutions,
        formId: flows.formId,
      })
      .from(flowExecutions)
      .innerJoin(flows, eq(flows.id, flowExecutions.flowId))
      .where(flowExecutionAccessWhere(data.executionId, data.clientToken))
      .limit(1)
    if (!record) throw new Error('Execution not found')
    const execution = record.execution

    // Record the run as a form submission (variable values + execution path).
    const formData = {
      ...data.variables,
      __executionPath: data.history.map((h) => ({ nodeId: h.nodeId, nodeType: h.nodeType })),
    }
    const submissionId = await ensureFlowSubmissionDraft(
      execution,
      record.formId,
      'incomplete',
    )
    const [submission] = await db
      .update(formSubmissions)
      .set({ status: 'completed', formData, submittedAt: new Date() })
      .where(
        and(
          eq(formSubmissions.id, submissionId),
          eq(formSubmissions.formId, record.formId),
        ),
      )
      .returning()
    if (!submission) throw new Error('Flow response not found')

    const [updated] = await db
      .update(flowExecutions)
      .set({
        status: 'completed',
        variables: data.variables,
        history: data.history,
        formSubmissionId: submission.id,
        completedAt: new Date(),
      })
      .where(flowExecutionAccessWhere(data.executionId, data.clientToken))
      .returning()

    await dispatchSubmissionEmails(submission.id).catch((error) => {
      console.error(`[submission:${submission.id}] Email dispatch failed`, error)
    })

    if (!updated) throw new Error('Execution not found')
    return { success: true, execution: publicExecution(updated) }
  })

/**
 * getCompletionData(executionId)
 * Everything the completion page needs in one call: the execution snapshot,
 * the form title + id, the flow's declared variables (for typed formatting),
 * and the summary node's title/template (if the run ended at one).
 */
export const getCompletionData = createServerFn({ method: 'GET', strict: false })
  .validator((data: { executionId: number; clientToken: string }) => data)
  .handler(async ({ data }) => {
    const [execution] = await db
      .select()
      .from(flowExecutions)
      .where(flowExecutionAccessWhere(data.executionId, data.clientToken))
      .limit(1)
    if (!execution) throw new Error('Execution not found')

    const [[context], variables, nodes, [payment]] = await Promise.all([
      db
        .select({ flow: flows, form: forms })
        .from(flows)
        .innerJoin(forms, eq(forms.id, flows.formId))
        .where(eq(flows.id, execution.flowId))
        .limit(1),
      db
        .select()
        .from(flowVariables)
        .where(eq(flowVariables.flowId, execution.flowId))
        .orderBy(flowVariables.id),
      db.select().from(flowNodes).where(eq(flowNodes.flowId, execution.flowId)),
      db
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
        .limit(1),
    ])
    const flow = context?.flow
    const form = context?.form

    // Find the summary node the run ended on (any summary node visited in history).
    const history = (execution.history as { nodeId: number; nodeType: string }[]) ?? []
    const visitedIds = new Set(history.map((h) => h.nodeId))
    const summaryNode =
      nodes.find((n) => n.type === 'summary' && visitedIds.has(n.id)) ??
      nodes.find((n) => n.type === 'summary')

    return {
      execution: publicExecution(execution),
      formId: flow?.formId ?? null,
      formPublicId: form?.publicId ?? null,
      formTitle: form?.title ?? 'Form',
      theme: form?.theme ?? null,
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
  .validator((data: { executionId: number; clientToken: string }) => data)
  .handler(async ({ data }) => {
    const [execution] = await db
      .select()
      .from(flowExecutions)
      .where(flowExecutionAccessWhere(data.executionId, data.clientToken))
      .limit(1)
    if (!execution) throw new Error('Execution not found')
    return publicExecution(execution)
  })
