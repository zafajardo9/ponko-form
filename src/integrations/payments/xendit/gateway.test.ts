import { afterEach, describe, expect, it, vi } from 'vitest'
import { XenditGateway } from './gateway'

const credentials = { secretKey: 'xnd_development_test', mode: 'sandbox' as const }

afterEach(() => vi.unstubAllGlobals())

describe('Xendit subscription gateway', () => {
  it('creates a hosted subscription session with customer and schedule data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      payment_session_id: 'ps-1',
      recurring_plan_id: 'repl-1',
      payment_link_url: 'https://dev.xen.to/test',
      status: 'ACTIVE',
      expires_at: '2026-08-01T00:00:00Z',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await new XenditGateway().createSubscription({
      amount: 250_000,
      currency: 'PHP',
      referenceId: 'ponkoform-payment-1',
      customerReferenceId: 'pf10',
      customerName: 'Ada Reyes',
      customerEmail: 'ada@example.com',
      description: 'Gym membership',
      interval: 'MONTH',
      intervalCount: 3,
      anchorDate: '2026-08-28T00:00:00Z',
      totalRecurrence: 8,
      immediatePayment: true,
      metadata: { paymentId: '1', pageSessionId: '10' },
      returnUrl: 'https://ponko.test/return',
      cancelUrl: 'https://ponko.test/cancel',
    }, credentials)

    expect(result).toMatchObject({
      success: true,
      paymentSessionId: 'ps-1',
      subscriptionPlanId: 'repl-1',
      paymentUrl: 'https://dev.xen.to/test',
    })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.xendit.co/sessions')
    expect(new Headers(init.headers).get('api-version')).toBe('2026-01-01')
    const body = JSON.parse(String(init.body))
    expect(body).toMatchObject({
      session_type: 'SUBSCRIPTION',
      mode: 'PAYMENT_LINK',
      amount: 2500,
      currency: 'PHP',
      country: 'PH',
      customer: { reference_id: 'pf10', email: 'ada@example.com' },
      subscription: {
        schedule: { interval: 'MONTH', interval_count: 3, total_recurrence: 8 },
        immediate_payment: true,
      },
    })
  })

  it('normalizes plan and cycle statuses for reconciliation', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'repl-1', status: 'CANCELLED', ended_at: '2026-09-01T00:00:00Z',
        schedule: { interval: 'MONTH', interval_count: 1 },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [
        { id: 'recy-1', status: 'SUCCEEDED', amount: 2500, currency: 'PHP', cycle_number: 2, paid_at: '2026-08-01T00:00:00Z' },
        { id: 'recy-2', status: 'RETRYING', amount: 2500, currency: 'PHP', cycle_number: 3 },
      ] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    const gateway = new XenditGateway()

    await expect(gateway.getSubscriptionPlan('repl-1', credentials)).resolves.toMatchObject({
      status: 'cancelled', endedAt: '2026-09-01T00:00:00Z',
    })
    await expect(gateway.listSubscriptionCycles('repl-1', credentials)).resolves.toMatchObject([
      { gatewayCycleId: 'recy-1', status: 'paid', amount: 250_000 },
      { gatewayCycleId: 'recy-2', status: 'retrying', amount: 250_000 },
    ])
  })

  it('returns a safe provider error without echoing response secrets', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: 'bad request', secret_key: 'must-not-leak' }),
      { status: 400 },
    )))
    const result = await new XenditGateway().createSubscription({
      amount: 100,
      currency: 'PHP',
      referenceId: 'ref',
      customerReferenceId: 'customer',
      customerName: 'Test User',
      customerEmail: 'test@example.com',
      description: 'Test',
      interval: 'MONTH',
      intervalCount: 1,
      anchorDate: '2026-08-01T00:00:00Z',
      immediatePayment: true,
      metadata: {},
      returnUrl: 'https://example.com/ok',
      cancelUrl: 'https://example.com/cancel',
    }, credentials)
    expect(result.error).toBe('Xendit subscription checkout failed (400)')
    expect(JSON.stringify(result)).not.toContain('must-not-leak')
  })
})
