import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { finalizePayment } from '../../lib/server-fns/payments'
import { finalizePagePayment } from '../../lib/server-fns/page-forms'
import { FlowExecutionContainer } from '../../components/flow-execution/FlowExecutionContainer'
import { PageFormView } from '../../components/page-form/PageFormView'
import { Button } from '../../components/ui/Button'
import { paymentVerificationPhase } from '../../lib/payment-verification'

/**
 * Payment return route.
 *
 * Where PayPal / Xendit send the visitor back after the hosted checkout. We
 * verify the charge server-side (finalizePayment), then resume the flow at the
 * payment node with the outcome so it advances onto the success or failure
 * path. Rendered bare (no app nav — see __root ChromeNav).
 */
export const Route = createFileRoute('/forms/payment-return')({
  validateSearch: (search: Record<string, unknown>) => ({
    executionId: search.executionId == null ? null : Number(search.executionId),
    pageSessionId: search.pageSessionId == null ? null : Number(search.pageSessionId),
    cancelled: search.cancelled === '1' || search.cancelled === 1 || search.cancelled === true,
  }),
  component: PaymentReturnPage,
})

type Phase = 'verifying' | 'pending' | 'verification_error' | 'done'

function PaymentReturnPage() {
  const { executionId, cancelled } = Route.useSearch()
  const { pageSessionId } = Route.useSearch()
  const [phase, setPhase] = useState<Phase>(cancelled ? 'done' : 'verifying')
  const [result, setResult] = useState<{ success: boolean; gatewayPaymentId?: string }>({
    success: false,
  })
  const startedRef = useRef(false)

  const finalize = useMutation({
    mutationFn: () =>
      pageSessionId
        ? finalizePagePayment({ data: { sessionId: pageSessionId } })
        : finalizePayment({ data: { executionId: executionId! } }),
    onSuccess: (data) => {
      const nextPhase = paymentVerificationPhase(data)
      if (nextPhase !== 'done') {
        setPhase(nextPhase)
        return
      }
      setResult({ success: data.success, gatewayPaymentId: data.gatewayPaymentId ?? undefined })
      setPhase('done')
    },
    onError: () => setPhase(paymentVerificationPhase(undefined, true)),
  })

  // Kick off verification once (unless the visitor cancelled at the gateway).
  useEffect(() => {
    if (startedRef.current || cancelled) return
    startedRef.current = true
    finalize.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!Number.isFinite(executionId ?? pageSessionId)) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-2xl font-medium text-[#141413]">Invalid payment link</h1>
        <p className="mt-2 text-[#6c6a64]">We couldn’t identify this payment.</p>
      </div>
    )
  }

  if (phase === 'verifying') {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <div className="flex items-center justify-center gap-1.5 text-[#8e8b82]">
          <span className="h-2 w-2 animate-bounce rounded-full bg-[#cc785c]" />
          <span className="ml-1 text-sm">Confirming your payment…</span>
        </div>
      </div>
    )
  }

  if (phase === 'pending') {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-2xl font-medium text-[#141413]">Almost there</h1>
        <p className="mt-2 text-[#6c6a64]">
          Your payment is still being confirmed by the provider. This can take a moment.
        </p>
        <div className="mt-6">
          <Button onClick={() => finalize.mutate()} disabled={finalize.isPending}>
            {finalize.isPending ? 'Checking…' : 'Check again'}
          </Button>
        </div>
      </div>
    )
  }

  if (phase === 'verification_error') {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center" role="alert">
        <h1 className="text-2xl font-medium text-[#141413]">We couldn’t verify the payment yet</h1>
        <p className="mt-2 text-[#6c6a64]">
          Your payment may still have completed. Check again before trying to pay another time.
        </p>
        <div className="mt-6">
          <Button
            onClick={() => {
              setPhase('verifying')
              finalize.mutate()
            }}
            disabled={finalize.isPending}
          >
            {finalize.isPending ? 'Checking…' : 'Check again'}
          </Button>
        </div>
      </div>
    )
  }

  // phase === 'done' — resume the flow with the verified outcome.
  if (pageSessionId) {
    return <PageFormView resumeSessionId={pageSessionId} />
  }

  return <FlowExecutionContainer resume={{ executionId: executionId!, paymentResult: result }} />
}
