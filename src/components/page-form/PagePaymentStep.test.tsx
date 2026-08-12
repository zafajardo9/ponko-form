// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PagePaymentStep } from './PagePaymentStep'

const sessionClientToken = 'session-client-token-1234'

const serverFns = vi.hoisted(() => ({
  getPagePaymentOptions: vi.fn(),
  initiatePagePayment: vi.fn(),
  ensurePagePaymentDraft: vi.fn(),
}))

vi.mock('../../lib/server-fns/page-forms', () => serverFns)

function renderPaymentStep() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PagePaymentStep
        sessionId={10}
        clientToken={sessionClientToken}
        pageId={20}
      />
    </QueryClientProvider>,
  )
}

describe('PagePaymentStep recovery', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    serverFns.ensurePagePaymentDraft.mockResolvedValue({ submissionId: 1 })
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('shows a slow-server payment message after three seconds', async () => {
    vi.useFakeTimers()
    serverFns.getPagePaymentOptions.mockReturnValue(new Promise(() => undefined))
    renderPaymentStep()

    await act(async () => undefined)
    await act(async () => vi.advanceTimersByTimeAsync(3_000))

    expect(screen.getByText(/still loading payment options/i)).toBeTruthy()
  })

  it('names the gateway while initiation is pending and does not retry it', async () => {
    serverFns.getPagePaymentOptions.mockResolvedValue({
      amount: 25,
      currency: 'USD',
      gateways: [{ slug: 'paypal', name: 'PayPal' }],
      breakdown: [],
      showBreakdown: false,
      missingReferences: [],
      paymentStatus: null,
    })
    serverFns.initiatePagePayment.mockReturnValue(new Promise(() => undefined))
    renderPaymentStep()

    fireEvent.click(await screen.findByRole('button', { name: 'Pay with PayPal' }))

    expect(await screen.findByRole('button', { name: 'Opening PayPal…' })).toBeTruthy()
    expect(serverFns.initiatePagePayment).toHaveBeenCalledTimes(1)
  })

  it('shows a recoverable checkout problem with a support reference', async () => {
    serverFns.getPagePaymentOptions.mockResolvedValue({
      amount: 18894.29,
      currency: 'PHP',
      gateways: [
        { slug: 'paypal', name: 'PayPal' },
        { slug: 'xendit', name: 'Xendit' },
      ],
      breakdown: [],
      showBreakdown: false,
      missingReferences: [],
      paymentStatus: null,
    })
    serverFns.initiatePagePayment.mockResolvedValue({
      paymentUrl: null,
      issue: {
        code: 'gateway_configuration',
        title: 'PayPal could not open checkout',
        message: 'This payment method needs attention from the form owner.',
        reference: 'PAY-000005',
        gatewaySlug: 'paypal',
        retryable: true,
        debugDetail: 'PayPal checkout failed (400): INVALID_REQUEST',
      },
    })
    renderPaymentStep()

    fireEvent.click(await screen.findByRole('button', { name: 'Pay with PayPal' }))

    expect((await screen.findByRole('alert')).textContent).toContain('PayPal could not open checkout')
    expect(vi.mocked(console.error)).toHaveBeenCalledWith(
      '[PonkoForm payment] Checkout creation failed',
      expect.objectContaining({
        reference: 'PAY-000005',
        detail: 'PayPal checkout failed (400): INVALID_REQUEST',
      }),
    )
    expect(screen.getByText(/PAY-000005/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy()
    expect(screen.getByText(/select another payment method/i)).toBeTruthy()
  })

  it('does not report the same status again when only the callback identity changes', async () => {
    serverFns.getPagePaymentOptions.mockResolvedValue({
      amount: 25,
      currency: 'USD',
      gateways: [{ slug: 'paypal', name: 'PayPal' }],
      breakdown: [],
      showBreakdown: false,
      missingReferences: [],
      paymentStatus: null,
    })
    const firstCallback = vi.fn()
    const secondCallback = vi.fn()
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const view = render(
      <QueryClientProvider client={client}>
        <PagePaymentStep
          sessionId={10}
          clientToken={sessionClientToken}
          pageId={20}
          onPaymentStatusChange={firstCallback}
        />
      </QueryClientProvider>,
    )

    await waitFor(() => expect(firstCallback).toHaveBeenCalledOnce())
    view.rerender(
      <QueryClientProvider client={client}>
        <PagePaymentStep
          sessionId={10}
          clientToken={sessionClientToken}
          pageId={20}
          onPaymentStatusChange={secondCallback}
        />
      </QueryClientProvider>,
    )

    await act(async () => undefined)
    expect(secondCallback).not.toHaveBeenCalled()
  })

  it('discloses subscription schedule and uses enrollment language', async () => {
    serverFns.getPagePaymentOptions.mockResolvedValue({
      amount: 2500,
      currency: 'PHP',
      gateways: [{ slug: 'xendit', name: 'Xendit' }],
      breakdown: [],
      showBreakdown: false,
      missingReferences: [],
      paymentStatus: null,
      paymentMode: 'subscription',
      subscription: {
        interval: 'monthly', intervalUnit: 'MONTH', intervalCount: 1,
        trialPeriodDays: 14, maxCycles: 12,
      },
    })
    renderPaymentStep()

    expect(await screen.findByText(/14-day trial/i)).toBeTruthy()
    expect(screen.getByText(/ends after 12 billing cycles/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Subscribe with Xendit' })).toBeTruthy()
  })

  it('shows selected receipt details above the price breakdown', async () => {
    serverFns.getPagePaymentOptions.mockResolvedValue({
      amount: 500,
      currency: 'PHP',
      gateways: [{ slug: 'xendit', name: 'Xendit' }],
      receiptDetails: [{ binding: 'plan', label: 'Selected plan', value: 'Premium' }],
      breakdown: [{ label: 'Total', amount: 500, kind: 'total' }],
      showBreakdown: true,
      missingReferences: [],
      paymentStatus: null,
      paymentMode: 'one_time',
      subscription: null,
      discount: null,
      discountError: null,
    })
    renderPaymentStep()

    expect(await screen.findByText('Selected plan')).toBeTruthy()
    expect(screen.getByText('Premium')).toBeTruthy()
    const receiptHeading = screen.getByText('Receipt details')
    const priceHeading = screen.getByText('Price breakdown')
    expect(receiptHeading.compareDocumentPosition(priceHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
