import { createServerFn } from '@tanstack/react-start'
import { getRequestUrl } from '@tanstack/react-start/server'
import { eq, desc } from 'drizzle-orm'
import { db } from '../../db/index'
import { withTimeout } from '../../db/with-timeout'
import {
  flows,
  flowNodes,
  flowEdges,
  flowVariables,
  flowExecutions,
  forms,
  formSubmissions,
  payments,
  paymentGateways,
} from '../../db/schema'
import { loadIntegrationConfigs } from '../integrations/credentials'
import { paymentRegistry } from '../../integrations/payments/index'
import type { GatewayCredentials } from '../../integrations/payments/types'
import type { FlowNode, FlowEdge, FlowVariable } from '../flow-engine/types'
import { reconcilePayment } from '../payments/reconciliation'

/**
 * Real payment server functions (end-user, public — no auth).
 *
 * Everything that matters for charging money — the amount and the gateway
 * credentials — is resolved SERVER-SIDE from the persisted execution. The
 * client only ever passes an `executionId` (and which gateway it picked), so a
 * visitor cannot tamper with the amount or reach another owner's keys.
 *
 * This file exports ONLY createServerFn results; the db/gateway/credential
 * imports are referenced solely inside `.handler()` bodies, so the TanStack
 * Start compiler strips them (and the Postgres driver) from the client bundle.
 */

type GatewaySlug = 'paypal' | 'xendit'

interface ResolvedContext {
  execution: typeof flowExecutions.$inferSelect
  node: typeof flowNodes.$inferSelect
  formProfileId: number
}

/** execution → current node (must be a payment node) → owning profile id. */
async function resolvePaymentContext(executionId: number): Promise<ResolvedContext> {
  const [execution] = await db
    .select()
    .from(flowExecutions)
    .where(eq(flowExecutions.id, executionId))
    .limit(1)
  if (!execution) throw new Error('Execution not found')
  if (execution.currentNodeId == null) throw new Error('Execution has no current step')

  const [node] = await db
    .select()
    .from(flowNodes)
    .where(eq(flowNodes.id, execution.currentNodeId))
    .limit(1)
  if (!node || node.type !== 'payment') throw new Error('Current step is not a payment')

  const [flow] = await db.select().from(flows).where(eq(flows.id, execution.flowId)).limit(1)
  if (!flow) throw new Error('Flow not found')
  const [form] = await db.select().from(forms).where(eq(forms.id, flow.formId)).limit(1)
  if (!form) throw new Error('Form not found')

  return { execution, node, formProfileId: form.profileId }
}

/** Map a gateway slug to the owner's decrypted credentials (or null if unset). */
function credentialsForSlug(
  slug: GatewaySlug,
  configs: Awaited<ReturnType<typeof loadIntegrationConfigs>>,
): GatewayCredentials | null {
  if (slug === 'xendit') {
    return configs.xendit
      ? {
          secretKey: configs.xendit.secretKey,
          publicKey: configs.xendit.publicKey,
          mode: configs.xendit.mode,
        }
      : null
  }
  return configs.paypal
    ? {
        clientId: configs.paypal.clientId,
        clientSecret: configs.paypal.clientSecret,
        mode: configs.paypal.mode,
      }
    : null
}

/** Resolve-or-insert the paymentGateways row for a slug; returns its id. */
async function gatewayRowId(slug: GatewaySlug, name: string): Promise<number> {
  const [existing] = await db
    .select({ id: paymentGateways.id })
    .from(paymentGateways)
    .where(eq(paymentGateways.slug, slug))
    .limit(1)
  if (existing) return existing.id
  const [created] = await db
    .insert(paymentGateways)
    .values({ name, slug, isActive: true })
    .returning({ id: paymentGateways.id })
  return created.id
}

function originForReturnUrls(): string {
  try {
    return new URL(getRequestUrl()).origin
  } catch {
    return process.env.APP_URL ?? 'http://localhost:3000'
  }
}

/**
 * getPaymentOptions({ executionId })
 * What the inline payment step needs: the amount + currency for display, and
 * the list of gateways the FORM OWNER has connected (so the visitor can choose).
 */
export const getPaymentOptions = createServerFn({ method: 'GET', strict: false })
  .inputValidator((data: { executionId: number }) => data)
  .handler(async ({ data }) => {
    return withTimeout((async () => {
    const { execution, node, formProfileId } = await resolvePaymentContext(data.executionId)
    const config = node.config as Record<string, unknown>
    const amountVar = config.amountVariable as string | undefined
    const amount = amountVar ? Number((execution.variables as Record<string, unknown>)?.[amountVar] ?? 0) : 0
    const currency = (config.currency as string) ?? 'USD'

    const configs = await loadIntegrationConfigs(formProfileId)
    const connected: { slug: GatewaySlug; name: string }[] = []
    if (configs.paypal) connected.push({ slug: 'paypal', name: configs.paypal.mode === 'live' ? 'PayPal' : 'PayPal Test' })
    if (configs.xendit) connected.push({ slug: 'xendit', name: configs.xendit.mode === 'live' ? 'Xendit' : 'Xendit Test' })

    // Only offer gateways that can actually process this form's currency. (A USD
    // form with only Xendit connected ends up with no options — handled by the UI.)
    const gateways = connected.filter((g) =>
      paymentRegistry.get(g.slug)?.getSupportedCurrencies().includes(currency),
    )

      return { amount, currency, gateways }
    })(), 8_000, 'getPaymentOptions', {
      correlationId: `flow-${data.executionId}`,
      phase: 'payment-options',
    })
  })

/**
 * initiatePayment({ executionId, gatewaySlug })
 * Creates the gateway order/invoice with the owner's credentials, records a
 * pending payment, marks the execution payment_pending, and returns the hosted
 * checkout URL for the client to redirect to.
 */
export const initiatePayment = createServerFn({ method: 'POST', strict: false })
  .inputValidator((data: { executionId: number; gatewaySlug: GatewaySlug }) => data)
  .handler(async ({ data }) => {
    return withTimeout((async () => {
    const context = { correlationId: `flow-${data.executionId}`, phase: 'payment-initiation' }
    const { execution, node, formProfileId } = await withTimeout(
      resolvePaymentContext(data.executionId),
      8_000,
      'initiatePayment.resolveContext',
      context,
    )
    const config = node.config as Record<string, unknown>
    const amountVar = config.amountVariable as string | undefined
    const currency = (config.currency as string) ?? 'USD'
    if (!amountVar) throw new Error('Payment step has no amount configured')

    const amountMajor = Number((execution.variables as Record<string, unknown>)?.[amountVar] ?? 0)
    if (!Number.isFinite(amountMajor) || amountMajor <= 0) {
      throw new Error('Nothing to pay — the amount is zero or invalid')
    }
    const amountMinor = Math.round(amountMajor * 100)

    const gateway = paymentRegistry.get(data.gatewaySlug)
    if (!gateway) throw new Error(`Unknown gateway: ${data.gatewaySlug}`)

    const configs = await withTimeout(
      loadIntegrationConfigs(formProfileId),
      8_000,
      'initiatePayment.loadCredentials',
      context,
    )
    const credentials = credentialsForSlug(data.gatewaySlug, configs)
    if (!credentials) {
      throw new Error(`The form owner has not connected ${gateway.getGatewayName()}`)
    }

    const origin = originForReturnUrls()
    const base = `${origin}/forms/payment-return?executionId=${execution.id}`
    const gwId = await withTimeout(
      gatewayRowId(data.gatewaySlug, gateway.getGatewayName()),
      8_000,
      'initiatePayment.resolveGateway',
      context,
    )
    let submissionId = execution.formSubmissionId
    if (!submissionId) {
      const [flow] = await db.select().from(flows).where(eq(flows.id, execution.flowId)).limit(1)
      if (!flow) throw new Error('Flow not found')
      const [draft] = await db.insert(formSubmissions).values({
        formId: flow.formId,
        formData: execution.variables as Record<string, unknown>,
        status: 'pending_payment',
      }).returning({ id: formSubmissions.id })
      submissionId = draft.id
      await db.update(flowExecutions).set({ formSubmissionId: submissionId })
        .where(eq(flowExecutions.id, execution.id))
    }
    const [payment] = await db.insert(payments).values({
      paymentGatewayId: gwId,
      flowExecutionId: execution.id,
      formSubmissionId: submissionId,
      amount: amountMinor,
      currency,
      status: 'pending',
      gatewayResponse: { environment: credentials.mode ?? 'sandbox' },
    }).returning({ id: payments.id })
    const externalId = `ponkoform-payment-${payment.id}`
    await db.update(payments).set({ externalId }).where(eq(payments.id, payment.id))
    const result = await withTimeout(gateway.createPayment(
      {
        amount: amountMinor,
        currency,
        externalId,
        metadata: { executionId: String(execution.id), paymentId: String(payment.id) },
        returnUrl: base,
        cancelUrl: `${base}&cancelled=1`,
      },
      credentials,
    ), 15_000, 'initiatePayment.gatewayCreate', context)

    if (!result.success || !result.paymentUrl) {
      await db.update(payments).set({
        status: 'failed', failureReason: result.error ?? 'Gateway creation failed', failedAt: new Date(), updatedAt: new Date(),
      }).where(eq(payments.id, payment.id))
      throw new Error(result.error ?? 'Could not start the payment')
    }

    await withTimeout(db.update(payments).set({
      gatewayPaymentId: result.gatewayPaymentId,
      paymentUrl: result.paymentUrl,
      expiresAt: result.expiresAt ? new Date(result.expiresAt) : null,
      gatewayResponse: { environment: credentials.mode ?? 'sandbox' },
      updatedAt: new Date(),
    }).where(eq(payments.id, payment.id)), 8_000, 'initiatePayment.updatePayment', context)

    await withTimeout(db
      .update(flowExecutions)
      .set({ status: 'payment_pending' })
      .where(eq(flowExecutions.id, execution.id)), 8_000, 'initiatePayment.updateExecution', context)

      return { paymentUrl: result.paymentUrl }
    })(), 25_000, 'initiatePayment', {
      correlationId: `flow-${data.executionId}`,
      phase: 'payment-initiation-total',
    })
  })

/**
 * finalizePayment({ executionId })
 * Called when the gateway redirects back. Verifies the latest pending payment
 * (PayPal captures the order; Xendit reads the invoice), updates the payment +
 * execution status, and reports the outcome so the flow can resume.
 */
export const finalizePayment = createServerFn({ method: 'POST', strict: false })
  .inputValidator((data: { executionId: number }) => data)
  .handler(async ({ data }) => {
    return withTimeout((async () => {
    const [execution] = await db
      .select()
      .from(flowExecutions)
      .where(eq(flowExecutions.id, data.executionId))
      .limit(1)
    if (!execution) throw new Error('Execution not found')

    const [payment] = await db
      .select({
        id: payments.id,
        gatewayPaymentId: payments.gatewayPaymentId,
      })
      .from(payments)
      .innerJoin(paymentGateways, eq(payments.paymentGatewayId, paymentGateways.id))
      .where(eq(payments.flowExecutionId, data.executionId))
      .orderBy(desc(payments.id))
      .limit(1)

    if (!payment || !payment.gatewayPaymentId) {
      return { status: 'failed' as const, success: false, gatewayPaymentId: null }
    }

    const reconciliation = await reconcilePayment({ paymentId: payment.id, source: 'return' })
    const paymentStatus = reconciliation.status

    // Leave the execution in payment_pending while a Xendit invoice settles;
    // mark payment_failed on a definite failure. Success is reflected by the
    // flow advancing onto the success edge (handled client-side on resume).
    if (paymentStatus === 'failed') {
      await db
        .update(flowExecutions)
        .set({ status: 'payment_failed' })
        .where(eq(flowExecutions.id, execution.id))
    }

      return {
      status: paymentStatus,
      success: paymentStatus === 'completed',
      gatewayPaymentId: payment.gatewayPaymentId,
      }
    })(), 15_000, 'finalizePayment', {
      correlationId: `flow-${data.executionId}`,
      phase: 'payment-verification',
    })
  })

/**
 * getResumeData({ executionId })
 * Everything the resume render needs in one call: the persisted execution plus
 * the full flow definition and form metadata, so FlowExecutionContainer can
 * rebuild the engine via FlowEngine.restore() after the payment redirect.
 */
export const getResumeData = createServerFn({ method: 'GET', strict: false })
  .inputValidator((data: { executionId: number }) => data)
  .handler(async ({ data }) => {
    const [execution] = await db
      .select()
      .from(flowExecutions)
      .where(eq(flowExecutions.id, data.executionId))
      .limit(1)
    if (!execution) throw new Error('Execution not found')

    const [flow] = await db.select().from(flows).where(eq(flows.id, execution.flowId)).limit(1)
    if (!flow) throw new Error('Flow not found')
    const [form] = await db.select().from(forms).where(eq(forms.id, flow.formId)).limit(1)

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
      execution,
      formId: flow.formId,
      title: form?.title ?? 'Form',
      description: form?.description ?? null,
      theme: form?.theme ?? null,
      nodes: nodes as FlowNode[],
      edges: edges as FlowEdge[],
      variables: variables as FlowVariable[],
    }
  })
