// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PagePaymentStep } from './PagePaymentStep'

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
      <PagePaymentStep sessionId={10} pageId={20} />
    </QueryClientProvider>,
  )
}

describe('PagePaymentStep recovery', () => {
  beforeEach(() => {
    serverFns.ensurePagePaymentDraft.mockResolvedValue({ submissionId: 1 })
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
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

    expect(await screen.findByRole('button', { name: 'Connecting to PayPal…' })).toBeTruthy()
    expect(serverFns.initiatePagePayment).toHaveBeenCalledTimes(1)
  })
})
