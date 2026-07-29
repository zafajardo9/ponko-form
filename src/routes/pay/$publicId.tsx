import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { getPublicPaymentLink, initiatePaymentLinkCheckout } from '@/lib/server-fns/payment-links'
import { Button } from '@/components/ui/Button'
import { PublicPaymentShell } from '@/components/payment-links/PublicPaymentShell'
import { AlertCircle, ArrowRight, CreditCard, ShieldCheck } from 'lucide-react'

function formatMoney(amount: number, currency: string) {
  const normalizedCurrency = currency.trim().toUpperCase() || 'PHP'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: normalizedCurrency }).format(amount)
  } catch {
    return `${normalizedCurrency} ${amount.toFixed(2)}`
  }
}

export const Route = createFileRoute('/pay/$publicId')({
  component: PaymentLinkPage,
})

function PaymentLinkPage() {
  const { publicId } = Route.useParams()
  const [customAmount, setCustomAmount] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: link, isLoading, isError } = useQuery({
    queryKey: ['payment-link', publicId],
    queryFn: () => getPublicPaymentLink({ data: { publicId } }),
    retry: 1,
  })

  const initiate = useMutation({
    mutationFn: () => {
      const custom = link?.allowCustomAmount && customAmount
        ? Number(customAmount)
        : undefined
      return initiatePaymentLinkCheckout({ data: { publicId, customAmount: custom } })
    },
    onSuccess: (result) => {
      if (result.paymentUrl) {
        window.location.href = result.paymentUrl
      }
    },
    onError: (err) => {
      setError((err as Error).message ?? 'Could not open checkout')
    },
  })

  const displayAmount = link
    ? formatMoney(link.amount / 100, link.currency)
    : ''
  const payableAmount = link?.allowCustomAmount && customAmount && Number(customAmount) > 0
    ? formatMoney(Number(customAmount), link.currency)
    : displayAmount
  const customAmountNumber = customAmount === '' ? null : Number(customAmount)
  const customAmountError = link?.allowCustomAmount && customAmountNumber != null
    ? !Number.isFinite(customAmountNumber) || customAmountNumber <= 0
      ? 'Enter an amount greater than zero.'
      : link.minAmount != null && customAmountNumber * 100 < link.minAmount
        ? `Minimum payment is ${formatMoney(link.minAmount / 100, link.currency)}.`
        : link.maxAmount != null && customAmountNumber * 100 > link.maxAmount
          ? `Maximum payment is ${formatMoney(link.maxAmount / 100, link.currency)}.`
          : null
    : null

  return (
    <PublicPaymentShell>
      {isLoading ? (
        <div role="status" aria-label="Loading checkout" className="overflow-hidden rounded-2xl border border-[#ded8ce] bg-white shadow-[0_22px_70px_rgba(46,40,32,0.12)]">
          <div className="space-y-4 p-6 sm:p-8">
            <div className="h-5 w-28 animate-pulse rounded bg-[#eee9e1] motion-reduce:animate-none" />
            <div className="h-7 w-3/4 animate-pulse rounded bg-[#eee9e1] motion-reduce:animate-none" />
            <div className="h-4 w-full animate-pulse rounded bg-[#f3efe8] motion-reduce:animate-none" />
          </div>
          <div className="h-40 animate-pulse bg-[#242320] motion-reduce:animate-none" />
        </div>
      ) : isError ? (
        <div role="alert" className="rounded-2xl border border-[#e1d9cf] bg-white px-6 py-10 text-center shadow-[0_22px_70px_rgba(46,40,32,0.1)] sm:px-10">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#fff0eb] text-[#a9583e]">
            <AlertCircle size={22} aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-xl font-semibold text-[#242320]">This payment link is unavailable</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#6c6962]">
            It may have been turned off or removed. Ask the person who shared it
            with you for an active link.
          </p>
        </div>
      ) : link ? (
        <section aria-labelledby="checkout-title" className="overflow-hidden rounded-2xl border border-[#dcd5ca] bg-white shadow-[0_24px_80px_rgba(46,40,32,0.14)]">
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#f5eee8] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8a513e]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#cc785c]" />
                One-time payment
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#77736c]">
                <CreditCard size={14} aria-hidden="true" />
                {link.providerName}
              </span>
            </div>

            <h1 id="checkout-title" className="mt-6 text-2xl font-semibold tracking-[-0.025em] text-[#242320] sm:text-[1.75rem]">
              {link.title}
            </h1>
            {link.description && (
              <p className="mt-2 max-w-md text-sm leading-6 text-[#6c6962]">{link.description}</p>
            )}
          </div>

          <div className="bg-[#242320] px-6 py-7 text-white sm:px-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#aaa69f]">
              {link.allowCustomAmount ? 'Suggested amount' : 'Amount to pay'}
            </p>
            <p className="mt-1 text-[2.55rem] font-semibold leading-none tracking-[-0.045em] tabular-nums sm:text-5xl">
              {displayAmount}
            </p>
            <p className="mt-3 text-xs text-[#bdb9b2]">Charged once · No subscription</p>
          </div>

          <div className="border-t border-dashed border-[#dcd5ca] p-6 sm:p-8">
            {link.allowCustomAmount && (
              <div className="mb-6">
                <label htmlFor="payment-link-custom-amount" className="block text-sm font-semibold text-[#242320]">
                  Choose your payment amount
                </label>
                <p className="mt-1 text-xs leading-5 text-[#77736c]">
                  Leave this blank to pay the suggested amount.
                </p>
                <div className={`mt-3 flex h-12 items-center rounded-lg border bg-[#faf8f4] transition focus-within:ring-2 focus-within:ring-[#cc785c]/20 ${
                  customAmountError ? 'border-[#c64545]' : 'border-[#dcd5ca] focus-within:border-[#cc785c]'
                }`}>
                  <span className="border-r border-[#e3ddd4] px-3 text-xs font-semibold text-[#77736c]">
                    {link.currency}
                  </span>
                  <input
                    id="payment-link-custom-amount"
                    type="number"
                    inputMode="decimal"
                    value={customAmount}
                    onChange={(e) => {
                      setCustomAmount(e.target.value)
                      setError(null)
                    }}
                    placeholder={(link.amount / 100).toFixed(2)}
                    min={link.minAmount ? link.minAmount / 100 : undefined}
                    max={link.maxAmount ? link.maxAmount / 100 : undefined}
                    aria-describedby={customAmountError ? 'custom-amount-error' : 'custom-amount-help'}
                    aria-invalid={Boolean(customAmountError)}
                    className="h-full min-w-0 flex-1 bg-transparent px-3 text-base font-semibold tabular-nums text-[#242320] outline-none placeholder:font-normal placeholder:text-[#aaa69f]"
                  />
                </div>
                {customAmountError ? (
                  <p id="custom-amount-error" role="alert" className="mt-2 text-xs text-[#b33d3d]">
                    {customAmountError}
                  </p>
                ) : (
                  <p id="custom-amount-help" className="mt-2 text-xs text-[#8a867f]">
                    {link.minAmount != null && link.maxAmount != null
                      ? `${formatMoney(link.minAmount / 100, link.currency)} minimum · ${formatMoney(link.maxAmount / 100, link.currency)} maximum`
                      : link.minAmount != null
                        ? `Minimum ${formatMoney(link.minAmount / 100, link.currency)}`
                        : link.maxAmount != null
                          ? `Maximum ${formatMoney(link.maxAmount / 100, link.currency)}`
                          : 'Enter the amount you want to pay.'}
                  </p>
                )}
              </div>
            )}

            {error && (
              <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-[#e8b9aa] bg-[#fff3ef] px-4 py-3 text-sm leading-5 text-[#824735]" role="alert">
                <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <Button
              onClick={() => initiate.mutate()}
              disabled={initiate.isPending || Boolean(customAmountError)}
              className="h-12 w-full rounded-lg text-[15px] font-semibold shadow-[0_8px_20px_rgba(169,88,62,0.2)]"
            >
              {initiate.isPending ? (
                'Opening secure checkout\u2026'
              ) : (
                <>
                  Pay {payableAmount}
                  <ArrowRight size={17} aria-hidden="true" />
                </>
              )}
            </Button>

            <div className="mt-4 flex items-start gap-3 rounded-lg bg-[#f7f4ef] px-3.5 py-3">
              <ShieldCheck size={17} className="mt-0.5 shrink-0 text-[#56705c]" aria-hidden="true" />
              <p className="text-xs leading-5 text-[#6c6962]">
                You&apos;ll continue to <strong className="font-semibold text-[#403d38]">{link.providerName}</strong> to
                choose a payment method and complete this one-time payment.
              </p>
            </div>
          </div>
        </section>
      ) : null}
    </PublicPaymentShell>
  )
}
