/**
 * seed-flow.ts — Development seed for the Flow Builder (FT001)
 *
 * Creates a sample "Payment Plan" flow on the first available form
 * (creating a demo profile + form if none exist). The flow demonstrates
 * every concept from the feature: variables, a form-field input, a decision
 * branch, two calculators, a payment node, and a summary.
 *
 * Run with:  npx tsx scripts/seed-flow.ts
 *
 * The script is idempotent — re-running it deletes any existing flow on the
 * target form (cascade removes its nodes/edges/variables/executions) and
 * rebuilds it from scratch.
 */
import { config } from 'dotenv'
config({ path: ['.env.local', '.env'] })

import { drizzle } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'
import * as schema from '../src/db/schema.ts'

const {
  profiles,
  forms,
  paymentGateways,
  flows,
  flowVariables,
  flowNodes,
  flowEdges,
} = schema

const db = drizzle(process.env.DATABASE_URL!, { schema })

async function main() {
  // 1. Find a target form, or create a demo profile + form.
  let [form] = await db.select().from(forms).limit(1)
  if (!form) {
    let [profile] = await db.select().from(profiles).limit(1)
    if (!profile) {
      ;[profile] = await db
        .insert(profiles)
        .values({ authId: 'seed_demo_user', displayName: 'Seed Demo' })
        .returning()
    }
    ;[form] = await db
      .insert(forms)
      .values({
        profileId: profile.id,
        publicId: 'seed-payment-plan',
        title: 'Payment Plan (Seed)',
        description: 'Sample flow-powered form created by seed-flow.ts',
        status: 'draft',
      })
      .returning()
    console.log(`Created demo form #${form.id}`)
  } else {
    console.log(`Using existing form #${form.id} ("${form.title}")`)
  }

  // 2. Remove any existing flow for this form (cascade clears children).
  await db.delete(flows).where(eq(flows.formId, form.id))

  // 3. Create the flow.
  const [flow] = await db.insert(flows).values({ formId: form.id }).returning()
  console.log(`Created flow #${flow.id}`)

  // 4. Declare variables.
  await db.insert(flowVariables).values([
    { flowId: flow.id, name: 'payment_plan', type: 'string', defaultValue: 'full', description: 'Selected payment plan' },
    { flowId: flow.id, name: 'subtotal', type: 'money', defaultValue: '10000', description: 'Base price before VAT' },
    // Both branches write the amount the payment node charges, so whichever plan
    // the visitor picks flows straight into checkout.
    { flowId: flow.id, name: 'amount_due', type: 'money', description: 'Amount charged at checkout (full total or monthly installment)' },
    { flowId: flow.id, name: 'payment_ref', type: 'string', description: 'Gateway payment reference' },
  ])

  // 5. Pick a payment gateway if one exists.
  const [gateway] = await db.select().from(paymentGateways).limit(1)

  // 6. Create nodes (positions laid out top-to-bottom, branching mid-flow).
  const [startNode] = await db
    .insert(flowNodes)
    .values({ flowId: flow.id, type: 'start', label: 'Start', positionX: 250, positionY: 40 })
    .returning()

  const [fieldNode] = await db
    .insert(flowNodes)
    .values({
      flowId: flow.id,
      type: 'form_field',
      label: 'Choose Payment Plan',
      positionX: 250,
      positionY: 180,
      config: {
        fieldType: 'select',
        label: 'Payment Plan',
        required: true,
        options: [
          { label: 'Full Payment', value: 'full' },
          { label: 'Installment (6 months)', value: 'installment' },
        ],
        bindToVariable: 'payment_plan',
      },
    })
    .returning()

  const [decisionNode] = await db
    .insert(flowNodes)
    .values({
      flowId: flow.id,
      type: 'decision',
      label: 'Plan?',
      positionX: 250,
      positionY: 320,
      config: {
        sourceVariable: 'payment_plan',
        branches: [
          { value: 'full', label: 'Full Payment' },
          { value: 'installment', label: 'Installment' },
        ],
      },
    })
    .returning()

  const [calcFullNode] = await db
    .insert(flowNodes)
    .values({
      flowId: flow.id,
      type: 'calculator',
      label: 'Full Total (×1.12)',
      positionX: 80,
      positionY: 470,
      config: {
        targetVariable: 'amount_due',
        expression: '{{subtotal}} * 1.12',
        label: 'Full payment total incl. 12% VAT',
      },
    })
    .returning()

  const [calcInstallmentNode] = await db
    .insert(flowNodes)
    .values({
      flowId: flow.id,
      type: 'calculator',
      label: 'Monthly (÷6)',
      positionX: 420,
      positionY: 470,
      config: {
        targetVariable: 'amount_due',
        expression: 'round(({{subtotal}} * 1.12) / 6, 2)',
        label: 'Installment monthly payment over 6 months',
      },
    })
    .returning()

  const [paymentNode] = await db
    .insert(flowNodes)
    .values({
      flowId: flow.id,
      type: 'payment',
      label: 'Pay Now',
      positionX: 250,
      positionY: 610,
      config: {
        amountVariable: 'amount_due',
        currency: 'USD',
        gatewayId: gateway?.id ?? null,
        label: 'Complete your payment',
      },
    })
    .returning()

  const [summaryNode] = await db
    .insert(flowNodes)
    .values({
      flowId: flow.id,
      type: 'summary',
      label: 'Confirmation',
      positionX: 250,
      positionY: 750,
      config: {
        title: 'Order Confirmation',
        template:
          'Thank you! Plan: {{payment_plan}}. Amount due: {{amount_due}}. Reference: {{payment_ref}}.',
      },
    })
    .returning()

  // 7. Record the start node on the flow.
  await db.update(flows).set({ startNodeId: startNode.id }).where(eq(flows.id, flow.id))

  // 8. Connect the nodes with edges.
  await db.insert(flowEdges).values([
    { flowId: flow.id, sourceNodeId: startNode.id, targetNodeId: fieldNode.id },
    { flowId: flow.id, sourceNodeId: fieldNode.id, targetNodeId: decisionNode.id },
    { flowId: flow.id, sourceNodeId: decisionNode.id, targetNodeId: calcFullNode.id, metadata: { matchValue: 'full', label: 'Full Payment' } },
    { flowId: flow.id, sourceNodeId: decisionNode.id, targetNodeId: calcInstallmentNode.id, metadata: { matchValue: 'installment', label: 'Installment' } },
    { flowId: flow.id, sourceNodeId: calcFullNode.id, targetNodeId: paymentNode.id },
    { flowId: flow.id, sourceNodeId: calcInstallmentNode.id, targetNodeId: paymentNode.id },
    { flowId: flow.id, sourceNodeId: paymentNode.id, targetNodeId: summaryNode.id, metadata: { label: 'Success' } },
  ])

  console.log('Seeded sample "Payment Plan" flow:')
  console.log('  4 variables, 7 nodes, 7 edges')
  if (!gateway) {
    console.log('  Note: no payment gateway found — payment node gatewayId left null.')
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
