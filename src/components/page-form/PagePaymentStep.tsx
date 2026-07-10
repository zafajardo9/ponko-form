import { useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getPagePaymentOptions, initiatePagePayment } from '../../lib/server-fns/page-forms'
import { Button } from '../ui/Button'

interface PagePaymentStepProps {
  sessionId: number
  pageId: number
  onPaymentStatusChange?: (paid: boolean) => void
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(amount)
}

export function PagePaymentStep({ sessionId, pageId, onPaymentStatusChange }: PagePaymentStepProps) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['page-payment-options', sessionId, pageId],
    queryFn: () => getPagePaymentOptions({ data: { sessionId, pageId } }),
  })
  const paid = data?.paymentStatus === 'completed'

  useEffect(() => {
    onPaymentStatusChange?.(paid)
  }, [onPaymentStatusChange, paid])

  const initiate = useMutation({
    mutationFn: (gatewaySlug: 'paypal' | 'xendit') =>
      initiatePagePayment({ data: { sessionId, pageId, gatewaySlug } }),
    onSuccess: (result) => {
      window.location.href = result.paymentUrl
    },
  })

  if (isLoading) {
    return <div className="h-24 animate-pulse rounded-lg bg-[#efe9de]" />
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-4 text-sm text-[#6c6a64]">
        Payment setup could not be loaded.
        <button onClick={() => refetch()} className="ml-2 text-[#cc785c] underline">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-4">
      <p className="text-sm text-[#6c6a64]">Amount due</p>
      <p className="mt-1 text-2xl font-medium text-[#141413]">
        {formatMoney(data.amount, data.currency)}
      </p>

      {paid && (
        <p className="mt-3 rounded-lg border border-[#d8ead4] bg-[#f3fbf1] px-3 py-2 text-sm text-[#3f7a42]">
          Payment confirmed. You can continue.
        </p>
      )}

      {data.showBreakdown && data.breakdown.length > 0 && (
        <div className="mt-4 rounded-lg border border-[#e6dfd8] bg-white p-3">
          <p className="mb-2 text-sm font-medium text-[#141413]">Price breakdown</p>
          <div className="flex flex-col gap-1.5">
            {data.breakdown.map((line, index) => (
              <div
                key={`${line.label}-${index}`}
                className={`flex items-center justify-between gap-3 text-sm ${
                  line.kind === 'total'
                    ? 'border-t border-[#e6dfd8] pt-2 font-medium text-[#141413]'
                    : line.kind === 'subtotal'
                      ? 'mt-1 text-[#141413]'
                      : 'text-[#6c6a64]'
                }`}
              >
                <span>{line.label}</span>
                <span>{formatMoney(line.amount, data.currency)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.missingReferences.length > 0 && (
        <p className="mt-3 text-sm text-[#c64545]">
          Some referenced prices are missing: {data.missingReferences.join(', ')}.
        </p>
      )}

      {data.gateways.length === 0 ? (
        <p className="mt-4 text-sm text-[#c64545]">
          No connected gateway can process this currency.
        </p>
      ) : (
        <div className="mt-5 flex flex-wrap gap-2">
          {data.gateways.map((gateway) => (
            <Button
              key={gateway.slug}
              onClick={() => initiate.mutate(gateway.slug)}
              disabled={initiate.isPending || paid}
            >
              {paid ? 'Paid' : `Pay with ${gateway.name}`}
            </Button>
          ))}
        </div>
      )}

      {initiate.isError && (
        <p className="mt-3 text-sm text-[#c64545]">
          {(initiate.error as Error)?.message ?? 'Could not start payment.'}
        </p>
      )}
    </div>
  )
}
