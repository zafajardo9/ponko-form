import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { finalizePaymentLinkPayment } from '@/lib/server-fns/payment-links'
import { PublicPaymentShell } from '@/components/payment-links/PublicPaymentShell'
import { AlertCircle, ArrowRight, Check, LoaderCircle } from 'lucide-react'

export const Route = createFileRoute('/pay/$publicId/success')({
  validateSearch: (search: Record<string, unknown>) => ({
    attempt: typeof search.attempt === 'string' ? search.attempt : '',
  }),
  component: PaymentLinkSuccessPage,
})

function PaymentLinkSuccessPage() {
  const { publicId } = Route.useParams()
  const { attempt } = Route.useSearch()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['payment-link-success', publicId, attempt],
    queryFn: () => finalizePaymentLinkPayment({ data: { publicId, attemptToken: attempt } }),
    enabled: Boolean(attempt),
    retry: 2,
    retryDelay: 1500,
    refetchInterval: (query) => query.state.data?.paid ? false : 2_000,
  })

  useEffect(() => {
    if (!data?.paid || !data.redirectUrl) return
    const timer = window.setTimeout(() => window.location.assign(data.redirectUrl!), 1500)
    return () => window.clearTimeout(timer)
  }, [data])

  const cannotVerify = !attempt || isError

  return (
    <PublicPaymentShell>
      {isLoading && attempt ? (
        <div role="status" className="rounded-2xl border border-[#dcd5ca] bg-white px-6 py-12 text-center shadow-[0_24px_80px_rgba(46,40,32,0.12)] sm:px-10">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f5eee8] text-[#a9583e]">
            <LoaderCircle size={25} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-xl font-semibold text-[#242320]">Confirming your payment</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#6c6962]">
            Keep this page open while we check the payment provider.
          </p>
        </div>
      ) : data?.paid ? (
        <div className="overflow-hidden rounded-2xl border border-[#cddaca] bg-white shadow-[0_24px_80px_rgba(46,40,32,0.12)]">
          <div className="bg-[#26372b] px-6 py-8 text-center text-white sm:px-10">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/20">
              <Check size={28} strokeWidth={2.5} aria-hidden="true" />
            </span>
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b9ccbd]">
              One-time payment complete
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Payment received</h1>
          </div>
          <div className="px-6 py-7 text-center sm:px-10 sm:py-8">
            {data.message && (
              <p className="text-sm leading-6 text-[#56534d]">{data.message}</p>
            )}
            <p className="mt-2 text-xs leading-5 text-[#85817a]">
              Your payment has been confirmed. You can safely close this page.
            </p>
            {data.redirectUrl && (
              <a
                href={data.redirectUrl}
                className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#242320] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#3a3834] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2"
              >
                Continue
                <ArrowRight size={15} aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      ) : cannotVerify ? (
        <div role="alert" className="rounded-2xl border border-[#e3d1ca] bg-white px-6 py-10 text-center shadow-[0_24px_80px_rgba(46,40,32,0.1)] sm:px-10">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#fff0eb] text-[#a9583e]">
            <AlertCircle size={22} aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-xl font-semibold text-[#242320]">We can&apos;t verify this return link</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#6c6962]">
            Open the original return link from your payment provider, or contact
            the person who requested the payment.
          </p>
        </div>
      ) : (
        <div role="status" className="rounded-2xl border border-[#dcd5ca] bg-white px-6 py-12 text-center shadow-[0_24px_80px_rgba(46,40,32,0.12)] sm:px-10">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f5eee8] text-[#a9583e]">
            <LoaderCircle size={25} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-xl font-semibold text-[#242320]">Payment is still processing</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#6c6962]">
            Some banks and payment methods need a little longer. We&apos;ll keep checking automatically.
          </p>
          <p className="mt-4 text-xs text-[#85817a]">You can safely leave this page after confirmation appears.</p>
        </div>
      )}
    </PublicPaymentShell>
  )
}
