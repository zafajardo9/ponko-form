import { describe, it, expect } from 'vitest'
import { FlowEngine } from './FlowEngine'
import type { FlowNode, FlowEdge, FlowVariable } from './types'

function node(id: number, type: FlowNode['type'], config: FlowNode['config'] = {}, label = type): FlowNode {
  return { id, flowId: 1, type, label, config, positionX: 0, positionY: 0 }
}
function edge(id: number, source: number, target: number, metadata: FlowEdge['metadata'] = {}): FlowEdge {
  return { id, flowId: 1, sourceNodeId: source, targetNodeId: target, metadata }
}
function variable(
  id: number,
  name: string,
  type: FlowVariable['type'],
  defaultValue: string | null = null,
): FlowVariable {
  return { id, flowId: 1, name, type, defaultValue, description: null }
}

describe('FlowEngine', () => {
  it('runs a linear FormField -> Summary flow', () => {
    const nodes = [
      node(1, 'start'),
      node(2, 'form_field', { bindToVariable: 'name', label: 'Name' }),
      node(3, 'summary', { template: 'Hi {{name}}' }),
    ]
    const edges = [edge(1, 1, 2), edge(2, 2, 3)]
    const vars = [variable(1, 'name', 'string')]
    const engine = new FlowEngine(nodes, edges, vars)

    engine.advance() // start -> form_field
    expect(engine.getCurrentStep().nodeType).toBe('form_field')

    engine.advance({ formValue: 'Alice' }) // form_field -> summary (terminal)
    expect(engine.isComplete()).toBe(true)
    const step = engine.getCurrentStep()
    expect(step.nodeType).toBe('summary')
    expect(step.renderedOutput).toBe('Hi Alice')
  })

  it('binds every grouped field on a single group step', () => {
    const nodes = [
      node(1, 'start'),
      node(2, 'group', {
        title: 'Your details',
        fields: [
          { id: 'a', fieldType: 'text', label: 'First name', bindToVariable: 'first' },
          { id: 'b', fieldType: 'text', label: 'Last name', bindToVariable: 'last' },
        ],
      }),
      node(3, 'summary', { template: '{{first}} {{last}}' }),
    ]
    const edges = [edge(1, 1, 2), edge(2, 2, 3)]
    const vars = [variable(1, 'first', 'string'), variable(2, 'last', 'string')]
    const engine = new FlowEngine(nodes, edges, vars)

    engine.advance() // start -> group
    const step = engine.getCurrentStep()
    expect(step.nodeType).toBe('group')
    expect(step.expectsInput).toBe(true)

    engine.advance({ groupValues: { a: 'Ada', b: 'Lovelace' } }) // group -> summary
    const vals = engine.getVariableValues()
    expect(vals.first).toBe('Ada')
    expect(vals.last).toBe('Lovelace')
    expect(engine.isComplete()).toBe(true)
    expect(engine.getCurrentStep().renderedOutput).toBe('Ada Lovelace')
  })

  it('computes a calculator value and auto-advances', () => {
    const nodes = [
      node(1, 'start'),
      node(2, 'calculator', { targetVariable: 'total', expression: '{{subtotal}} * 1.12' }),
      node(3, 'summary', { template: 'Total {{total}}' }),
    ]
    const edges = [edge(1, 1, 2), edge(2, 2, 3)]
    const vars = [variable(1, 'subtotal', 'money', '1000'), variable(2, 'total', 'money')]
    const engine = new FlowEngine(nodes, edges, vars)

    engine.advance() // start -> calculator -> (auto) summary
    expect(engine.getVariableValues().total).toBeCloseTo(1120)
    expect(engine.isComplete()).toBe(true)
    expect(engine.getCurrentStep().nodeType).toBe('summary')
  })

  it('routes a decision node based on the selected branch', () => {
    const nodes = [
      node(1, 'start'),
      node(2, 'decision', { sourceVariable: 'plan', branches: [
        { value: 'full', label: 'Full' },
        { value: 'installment', label: 'Installment' },
      ] }),
      node(3, 'summary', { template: 'Full path' }),
      node(4, 'summary', { template: 'Installment path' }),
    ]
    const edges = [
      edge(1, 1, 2),
      edge(2, 2, 3, { matchValue: 'full' }),
      edge(3, 2, 4, { matchValue: 'installment' }),
    ]
    const vars = [variable(1, 'plan', 'string', 'full')]
    const engine = new FlowEngine(nodes, edges, vars)

    engine.advance() // start -> decision
    expect(engine.getCurrentStep().nodeType).toBe('decision')

    engine.advance({ decisionValue: 'installment' })
    expect(engine.getCurrentStep().nodeId).toBe(4)
    expect(engine.getCurrentStep().renderedOutput).toBe('Installment path')
  })

  it('follows the success path on payment success', () => {
    const nodes = [
      node(1, 'start'),
      node(2, 'payment', { amountVariable: 'total', gatewayId: 1 }),
      node(3, 'summary', { template: 'Paid {{payment_ref}}' }),
      node(4, 'summary', { template: 'Payment failed' }),
    ]
    const edges = [edge(1, 1, 2), edge(2, 2, 3), edge(3, 2, 4)]
    const engine = new FlowEngine(nodes, edges, [])

    engine.advance() // start -> payment
    engine.advance({ paymentResult: { success: true, gatewayPaymentId: 'pay_123' } })
    expect(engine.getCurrentStep().nodeId).toBe(3)
    expect(engine.getVariableValues().payment_ref).toBe('pay_123')
  })

  it('follows the failure path on payment failure', () => {
    const nodes = [
      node(1, 'start'),
      node(2, 'payment', { amountVariable: 'total', gatewayId: 1 }),
      node(3, 'summary', { template: 'Paid' }),
      node(4, 'summary', { template: 'Payment failed' }),
    ]
    const edges = [edge(1, 1, 2), edge(2, 2, 3), edge(3, 2, 4)]
    const engine = new FlowEngine(nodes, edges, [])

    engine.advance() // start -> payment
    engine.advance({ paymentResult: { success: false } })
    expect(engine.getCurrentStep().nodeId).toBe(4)
  })

  it('supports go-back navigation', () => {
    const nodes = [
      node(1, 'start'),
      node(2, 'form_field', { bindToVariable: 'name' }),
      node(3, 'summary', { template: 'Hi {{name}}' }),
    ]
    const edges = [edge(1, 1, 2), edge(2, 2, 3)]
    const engine = new FlowEngine(nodes, edges, [variable(1, 'name', 'string')])

    engine.advance() // start -> form_field
    expect(engine.getCurrentStepNumber()).toBe(2)
    expect(engine.goBack()).toBe(true)
    expect(engine.getCurrentStep().nodeType).toBe('start')
    expect(engine.isComplete()).toBe(false)
  })

  it('throws when there is no start node', () => {
    expect(() => new FlowEngine([node(1, 'summary')], [], [])).toThrow('Start node')
  })

  it('restores at a payment node and follows the success path (resume after redirect)', () => {
    const nodes = [
      node(1, 'start'),
      node(2, 'form_field', { bindToVariable: 'email' }),
      node(3, 'payment', { amountVariable: 'total' }),
      node(4, 'summary', { template: 'Paid {{payment_ref}}' }),
      node(5, 'summary', { template: 'Payment failed' }),
    ]
    const edges = [edge(1, 1, 2), edge(2, 2, 3), edge(3, 3, 4), edge(4, 3, 5)]
    const vars = [variable(1, 'email', 'string'), variable(2, 'total', 'money')]

    // Simulate the persisted snapshot at the moment the user left for the gateway.
    const snapshot = {
      currentNodeId: 3,
      variables: { email: 'a@b.com', total: 100 },
      history: [
        { nodeId: 1, nodeType: 'start', enteredAt: 'x' },
        { nodeId: 2, nodeType: 'form_field', enteredAt: 'x' },
        { nodeId: 3, nodeType: 'payment', enteredAt: 'x' },
      ],
      completed: false,
    }

    const engine = FlowEngine.restore(nodes, edges, vars, snapshot)
    expect(engine.getCurrentStep().nodeId).toBe(3)
    expect(engine.getVariableValues().email).toBe('a@b.com')

    engine.advance({ paymentResult: { success: true, gatewayPaymentId: 'INV-9' } })
    expect(engine.getCurrentStep().nodeId).toBe(4)
    expect(engine.isComplete()).toBe(true)
    expect(engine.getVariableValues().payment_ref).toBe('INV-9')
  })

  it('restores at a payment node and follows the failure path', () => {
    const nodes = [
      node(1, 'start'),
      node(2, 'payment', { amountVariable: 'total' }),
      node(3, 'summary', { template: 'Paid' }),
      node(4, 'summary', { template: 'Payment failed' }),
    ]
    const edges = [edge(1, 1, 2), edge(2, 2, 3), edge(3, 2, 4)]
    const engine = FlowEngine.restore(nodes, edges, [], {
      currentNodeId: 2,
      variables: { total: 50 },
      history: [
        { nodeId: 1, nodeType: 'start', enteredAt: 'x' },
        { nodeId: 2, nodeType: 'payment', enteredAt: 'x' },
      ],
    })

    engine.advance({ paymentResult: { success: false } })
    expect(engine.getCurrentStep().nodeId).toBe(4)
  })
})
