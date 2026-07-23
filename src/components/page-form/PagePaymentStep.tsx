import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ensurePagePaymentDraft, getPagePaymentOptions, initiatePagePayment } from '../../lib/server-fns/page-forms'
import { Button } from '../ui/Button'
import { AlertTriangle, CheckCircle2, Info, LockKeyhole, RotateCcw, X } from 'lucide-react'

interface PagePaymentStepProps {
  sessionId: number
  clientToken: string
  pageId: number
  onPaymentStatusChange?: (paid: boolean) => void
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(amount)
}

/** Modal dialog explaining how each payment gateway works. */
function PaymentGuideDialog({
  open,
  onClose,
  gateways,
}: {
  open: boolean
  onClose: () => void
  gateways: { slug: string; name: string }[]
}) {
  const hasPayPal = gateways.some((g) => g.slug === 'paypal')
  const hasXendit = gateways.some((g) => g.slug === 'xendit')

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label="Payment guide"
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[#e6dfd8] bg-[#faf9f5] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e6dfd8] px-6 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-[#141413]">
            <Info size={18} className="text-[#cc785c]" aria-hidden="true" />
            How payment works
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8e8b82] transition-colors hover:bg-[#efe9de] hover:text-[#141413]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5 text-sm leading-relaxed text-[#3d3d3a]">
          <p>
            After you click <strong>Pay</strong>, you'll be redirected to the payment provider's secure
            checkout page. Your form answers are saved automatically — you won't lose anything.
          </p>

          {hasPayPal && (
            <div className="rounded-xl border border-[#d6e0f0] bg-[#f5f8fc] p-4">
              <p className="flex items-center gap-1.5 font-semibold text-[#003087]">
                PayPal
              </p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[#2c3e5a]">
                <li>Pay with your PayPal balance, linked bank account, or credit/debit card.</li>
                <li>You do <strong>not</strong> need a PayPal account — guest checkout with a card is available.</li>
                <li>After completing payment, you'll be sent back to this form automatically.</li>
                <li>If you close the page before returning, your payment is still processed — refresh this page to continue.</li>
              </ul>
            </div>
          )}

          {hasXendit && (
            <div className="rounded-xl border border-[#d6e0f0] bg-[#f5f8fc] p-4">
              <p className="flex items-center gap-1.5 font-semibold text-[#003087]">
                Xendit
              </p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[#2c3e5a]">
                <li>Choose from GCash, bank transfer, credit/debit card, or over-the-counter at convenience stores.</li>
                <li>For bank transfers, a unique virtual account number is generated. Copy it and pay via your banking app.</li>
                <li>GCash and card payments confirm instantly. Bank transfers may take a few minutes.</li>
                <li>After payment, you'll return to this form to continue.</li>
              </ul>
            </div>
          )}

          {!hasPayPal && !hasXendit && (
            <p className="italic text-[#6c6a64]">
              No payment gateways are connected for this form. If payment is expected here, the form
              owner may need to configure their payment settings.
            </p>
          )}

          <div className="flex items-start gap-2 rounded-lg border border-[#e6dfd8] bg-white p-3 text-xs text-[#6c6a64]">
            <LockKeyhole size={14} className="mt-0.5 shrink-0 text-[#8e8b82]" aria-hidden="true" />
            <span>
              All payment details are handled securely by the provider. PonkoForm never sees your
              payment method, card number, or banking credentials.
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PagePaymentStep({
  sessionId,
  clientToken,
  pageId,
  onPaymentStatusChange,
}: PagePaymentStepProps) {
  const [loadingSlow, setLoadingSlow] = useState(false)
  const [pendingGateway, setPendingGateway] = useState<string | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const [paymentIssue, setPaymentIssue] = useState<{
    title: string
    message: string
    reference: string
    gatewaySlug: string
    retryable: boolean
  } | null>(null)
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['page-payment-options', sessionId, pageId],
    queryFn: () => getPagePaymentOptions({ data: { sessionId, clientToken, pageId } }),
    retry: 2,
    retryDelay: (attempt) => Math.min(750 * 2 ** attempt, 3_000),
  })
  const ensureDraft = useMutation({
    mutationFn: () => ensurePagePaymentDraft({ data: { sessionId, clientToken, pageId } }),
  })
  const paid = data?.paymentStatus === 'completed'
  const paymentStatusCallbackRef = useRef(onPaymentStatusChange)

  useEffect(() => {
    paymentStatusCallbackRef.current = onPaymentStatusChange
  }, [onPaymentStatusChange])

  useEffect(() => {
    paymentStatusCallbackRef.current?.(paid)
  }, [paid])

  useEffect(() => {
    ensureDraft.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, pageId])

  useEffect(() => {
    if (!isLoading) {
      setLoadingSlow(false)
      return
    }
    const timer = window.setTimeout(() => setLoadingSlow(true), 3_000)
    return () => window.clearTimeout(timer)
  }, [isLoading])

  const initiate = useMutation({
    mutationFn: (gatewaySlug: 'paypal' | 'xendit') =>
      initiatePagePayment({ data: { sessionId, clientToken, pageId, gatewaySlug } }),
    retry: false,
    onMutate: (gatewaySlug) => {
      setPendingGateway(gatewaySlug)
      setPaymentIssue(null)
    },
    onSuccess: (result) => {
      setPendingGateway(null)
      if (result.paymentUrl) {
        window.location.href = result.paymentUrl
        return
      }
      if (result.issue) setPaymentIssue(result.issue)
    },
    onError: () => setPendingGateway(null),
  })

  if (isLoading) {
    return loadingSlow ? (
      <div className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-6 text-center" role="status">
        <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
          <span className="h-2 w-2 animate-bounce rounded-full bg-[#cc785c]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-[#cc785c] [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-[#cc785c] [animation-delay:300ms]" />
        </div>
        <p className="mt-3 text-sm text-[#6c6a64]">The server is taking longer than expected. We're still loading payment options.</p>
      </div>
    ) : <div className="h-24 animate-pulse rounded-lg bg-[#efe9de]" />
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
      <p className="text-sm text-[#6c6a64]">
        {data.paymentMode === 'subscription' ? 'Subscription amount' : 'Amount due'}
      </p>
      <p className="mt-1 text-2xl font-medium text-[#141413]">
        {formatMoney(data.amount, data.currency)}
        {data.paymentMode === 'subscription' && data.subscription && (
          <span className="ml-1 text-sm font-normal text-[#6c6a64]">
            /{data.subscription.interval === 'weekly'
              ? 'week'
              : data.subscription.interval === 'monthly'
                ? 'month'
                : data.subscription.interval === 'quarterly'
                  ? '3 months'
                  : data.subscription.interval === 'semiannual' ? '6 months' : 'year'}
          </span>
        )}
      </p>
      {data.paymentMode === 'subscription' && data.subscription && (
        <div className="mt-3 rounded-lg border border-[#e6dfd8] bg-white p-3 text-xs leading-relaxed text-[#6c6a64]">
          {data.subscription.trialPeriodDays > 0
            ? `Your ${data.subscription.trialPeriodDays}-day trial starts after you securely link an eligible auto-debit payment method with Xendit.`
            : 'Xendit will securely link an eligible auto-debit payment method and attempt charges on this schedule.'}
          {data.subscription.maxCycles
            ? ` This subscription ends after ${data.subscription.maxCycles} billing cycles.`
            : ' Billing continues until the subscription is cancelled.'}
        </div>
      )}

      {paid && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#cfe3ca] bg-[#f3fbf1] px-4 py-3 text-[#356a39]" role="status">
          <CheckCircle2 className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">
              {data.paymentMode === 'subscription' ? 'Subscription active' : 'Payment confirmed'}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed">
              {data.paymentMode === 'subscription'
                ? 'Xendit confirmed your enrollment. Future billing attempts will follow the schedule above.'
                : 'Your transaction was verified. You can continue with the form.'}
            </p>
          </div>
        </div>
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
          {data.paymentMode === 'subscription'
            ? 'Xendit subscription checkout is not available for this form.'
            : 'No connected gateway can process this currency.'}
        </p>
      ) : (
        <div className="mt-5">
          <div className="flex flex-wrap gap-2">
            {data.gateways.map((gateway) => (
              <Button
                key={gateway.slug}
                onClick={() => initiate.mutate(gateway.slug)}
                disabled={initiate.isPending || paid}
              >
                {paid
                  ? data.paymentMode === 'subscription' ? 'Subscribed' : 'Paid'
                  : initiate.isPending && pendingGateway === gateway.slug
                    ? `Opening ${gateway.name}…`
                    : data.paymentMode === 'subscription'
                      ? `Subscribe with ${gateway.name}`
                      : `Pay with ${gateway.name}`}
              </Button>
            ))}
          </div>
          {!paid && (
            <div className="mt-3 flex items-center gap-3">
              <p className="flex items-center gap-1.5 text-xs text-[#7b766f]">
                <LockKeyhole size={13} aria-hidden="true" />
                Checkout opens securely with the payment provider. Your form answers stay saved here.
              </p>
              <button
                type="button"
                onClick={() => setGuideOpen(true)}
                className="inline-flex items-center gap-1 rounded-full border border-[#e6dfd8] bg-white px-2.5 py-1 text-xs text-[#6c6a64] transition-colors hover:border-[#cc785c] hover:text-[#cc785c]"
              >
                <Info size={13} aria-hidden="true" />
                How this works
              </button>
            </div>
          )}
        </div>
      )}

      <PaymentGuideDialog
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        gateways={data.gateways ?? []}
      />

      {(paymentIssue || initiate.isError) && (
        <div className="mt-4 overflow-hidden rounded-xl border border-[#e6bf72] bg-[#fffaf0]" role="alert">
          <div className="flex items-start gap-3 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f9e7bd] text-[#946313]">
              <AlertTriangle size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#4d3915]">
                {paymentIssue?.title ?? 'Checkout could not be opened'}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-[#725a2b]">
                {paymentIssue?.message ?? 'Your answers are safe. Please try again or choose another payment method.'}
              </p>
              {paymentIssue?.reference && (
                <p className="mt-2 text-xs text-[#8b7449]">
                  Support reference: <span className="font-mono font-medium">{paymentIssue.reference}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-[#ead5a8] bg-[#fff7e6] px-4 py-3">
            {paymentIssue?.retryable && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => initiate.mutate(paymentIssue.gatewaySlug as 'paypal' | 'xendit')}
                disabled={initiate.isPending}
              >
                <RotateCcw size={14} aria-hidden="true" />
                Try again
              </Button>
            )}
            {data.gateways.length > 1 && (
              <span className="text-xs text-[#725a2b]">Or select another payment method above.</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
