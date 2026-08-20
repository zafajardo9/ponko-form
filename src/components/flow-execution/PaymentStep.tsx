import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getPaymentOptions, initiatePayment } from '../../lib/server-fns/payments'
import { Button } from '../ui/Button'

/**
 * PaymentStep
 *
 * Real payment handoff during flow execution. Shows the amount and the gateways
 * the FORM OWNER has connected (PayPal / Xendit). The visitor picks one; we ask
 * the server to create the order/invoice (with the owner's own credentials) and
 * then redirect the browser to the gateway's hosted checkout. After paying, the
 * gateway returns the visitor to `/forms/payment-return`, which verifies the
 * charge and resumes the flow on the success or failure path.
 */
interface PaymentStepProps {
  executionId: number | null
  clientToken: string
  amount: number | string
  currency: string
}

export function PaymentStep({
  executionId,
  clientToken,
  amount,
  currency,
}: PaymentStepProps) {
  const [redirecting, setRedirecting] = useState(false)

  const { data: options, isLoading } = useQuery({
    queryKey: ['payment-options', String(executionId)],
    queryFn: () => {
      if (executionId == null) throw new Error('Missing flow execution')
      return getPaymentOptions({
        data: { executionId, clientToken },
      })
    },
    enabled: executionId != null,
  })

  const initiate = useMutation({
    mutationFn: (gatewaySlug: 'paypal' | 'xendit' | 'maya') => {
      if (executionId == null) throw new Error('Missing flow execution')
      return initiatePayment({
        data: { executionId, clientToken, gatewaySlug },
      })
    },
    onSuccess: ({ paymentUrl }) => {
      setRedirecting(true)
      window.location.href = paymentUrl
    },
  })

  const displayAmount = options?.amount ?? amount
  const displayCurrency = options?.currency ?? currency
  const formattedAmount =
    typeof displayAmount === 'number'
      ? displayAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : displayAmount

  const gateways = options?.gateways ?? []
  const busy = initiate.isPending || redirecting

  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <div>
        <p className="text-sm text-[var(--ponko-foreground-muted,#6c6a64)]">Amount due</p>
        <p className="mt-1 text-4xl font-semibold text-[var(--ponko-foreground,#141413)]">
          {displayCurrency} {formattedAmount}
        </p>
        <p className="mt-1 text-xs text-[var(--ponko-foreground-faint,#8e8b82)]">
          You’ll be charged in {displayCurrency}.
        </p>
      </div>

      {isLoading ? (
        <div className="h-10 w-48 animate-pulse rounded-md bg-[#efe9de]" />
      ) : gateways.length === 0 ? (
        <p className="max-w-xs text-sm text-[#c64545]">
          No payment method is available for {displayCurrency} right now — please contact the form
          owner.
        </p>
      ) : (
        <div className="flex w-full max-w-xs flex-col gap-2">
          {gateways.length > 1 && (
            <p className="text-sm text-[var(--ponko-foreground-muted,#6c6a64)]">Choose how you’d like to pay</p>
          )}
          {gateways.map((g) => (
            <Button key={g.slug} onClick={() => initiate.mutate(g.slug)} disabled={busy}>
              {busy ? 'Redirecting…' : `Pay with ${g.name}`}
            </Button>
          ))}
        </div>
      )}

      {initiate.isError && (
        <p className="max-w-xs text-sm text-[#c64545]">
          {(initiate.error as Error).message || 'Could not start the payment. Please try again.'}
        </p>
      )}

      <p className="flex items-center gap-1.5 text-xs text-[var(--ponko-foreground-faint,#8e8b82)]">
        <span aria-hidden>🔒</span> Secure checkout — you’ll be redirected to complete payment
      </p>
    </div>
  )
}
