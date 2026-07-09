import { useQuery, useMutation } from '@tanstack/react-query'
import { getPagePaymentOptions, initiatePagePayment } from '../../lib/server-fns/page-forms'
import { Button } from '../ui/Button'

interface PagePaymentStepProps {
  sessionId: number
  pageId: number
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(amount)
}

export function PagePaymentStep({ sessionId, pageId }: PagePaymentStepProps) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['page-payment-options', sessionId, pageId],
    queryFn: () => getPagePaymentOptions({ data: { sessionId, pageId } }),
  })

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
              disabled={initiate.isPending}
            >
              Pay with {gateway.name}
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
