// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PaymentStep } from './PaymentStep'

const serverFns = vi.hoisted(() => ({
  getPaymentOptions: vi.fn(),
  initiatePayment: vi.fn(),
}))

vi.mock('../../lib/server-fns/payments', () => serverFns)

const clientToken = 'execution-client-token-1234'

function renderPaymentStep() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <PaymentStep
        executionId={18}
        clientToken={clientToken}
        amount={25}
        currency="USD"
      />
    </QueryClientProvider>,
  )
}

describe('PaymentStep execution access', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('uses the same execution token for options and checkout initiation', async () => {
    serverFns.getPaymentOptions.mockResolvedValue({
      amount: 25,
      currency: 'USD',
      gateways: [{ slug: 'paypal', name: 'PayPal' }],
    })
    serverFns.initiatePayment.mockReturnValue(new Promise(() => undefined))

    renderPaymentStep()

    await waitFor(() =>
      expect(serverFns.getPaymentOptions).toHaveBeenCalledWith({
        data: { executionId: 18, clientToken },
      }),
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Pay with PayPal' }))
    await waitFor(() =>
      expect(serverFns.initiatePayment).toHaveBeenCalledWith({
        data: {
          executionId: 18,
          clientToken,
          gatewaySlug: 'paypal',
        },
      }),
    )
  })
})
