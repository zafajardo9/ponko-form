import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getCompletionData } from '@/lib/server-fns/flow-executions'
import { TemplateInterpolator } from '@/lib/flow-engine/TemplateInterpolator'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { buildInvoice } from '@/components/flow-execution/InvoiceUtils'
import { InvoiceDownloadButton } from '@/components/flow-execution/InvoiceDownloadButton'
import { themeVars, type FormTheme } from '@/lib/theme'
import type { FlowVariable, FlowVariableType } from '@/lib/flow-engine/types'
import { isValidPublicSessionToken } from '@/lib/public-session-access'

export const Route = createFileRoute('/flow/$executionId/complete')({
  validateSearch: (search: Record<string, unknown>) => ({
    executionClientToken:
      typeof search.executionClientToken === 'string' &&
      isValidPublicSessionToken(search.executionClientToken)
        ? search.executionClientToken
        : null,
  }),
  component: CompletePage,
})

const interpolator = new TemplateInterpolator()

function CompletePage() {
  const { executionId } = Route.useParams()
  const { executionClientToken } = Route.useSearch()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['completion', executionId, Boolean(executionClientToken)],
    queryFn: () => {
      if (!executionClientToken) throw new Error('Missing execution token')
      return getCompletionData({
        data: {
          executionId: Number(executionId),
          clientToken: executionClientToken,
        },
      })
    },
    enabled: Boolean(executionClientToken),
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <div className="h-64 animate-pulse rounded-xl bg-[#efe9de]" />
      </div>
    )
  }

  if (!executionClientToken || isError || !data) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-2xl font-medium text-[#141413]">Receipt unavailable</h1>
        <p className="mt-2 text-[#6c6a64]">We couldn't load this completion record.</p>
      </div>
    )
  }

  const variables = data.variables as FlowVariable[]
  const values = (data.execution.variables as Record<string, unknown>) ?? {}
  const typesMap: Record<string, FlowVariableType> = {}
  for (const v of variables) typesMap[v.name] = v.type

  const rendered =
    data.summary?.template &&
    interpolator.interpolate(data.summary.template, { variables: values, types: typesMap })

  const payment = data.payment
  const paymentFailed = !!payment && payment.status !== 'completed'

  // ── Failed payment ──
  if (paymentFailed) {
    return (
      <FailedView
        title={data.summary?.title}
        message={rendered || undefined}
        gatewayName={payment.gatewayName}
        reference={payment.gatewayPaymentId}
        formPublicId={data.formPublicId}
        theme={data.theme}
      />
    )
  }

  // ── Success: invoice / receipt ──
  const invoice = buildInvoice({
    formTitle: data.formTitle,
    executionId: Number(executionId),
    createdAt: data.execution.createdAt as unknown as string,
    variables,
    values,
    payment,
  })

  return (
    <div className="mx-auto max-w-2xl px-6 py-12" style={themeVars(data.theme)}>
      {/* Success banner */}
      <div className="mb-5 flex flex-col items-center gap-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#d8f0e0] text-2xl text-[#2f7d52]">
          ✓
        </div>
        <h1 className="text-2xl font-medium text-[#141413]">
          {data.summary?.title ?? (payment ? 'Payment successful' : 'All done!')}
        </h1>
        {rendered && <p className="max-w-md text-[#6c6a64]">{rendered}</p>}
      </div>

      {/* Invoice card */}
      <Card className="!bg-white !p-0 overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-[#e6dfd8] px-7 py-6">
          <div>
            <p className="text-lg font-semibold text-[#141413]">{invoice.issuer}</p>
            <p className="mt-0.5 text-xs text-[#8e8b82]">Receipt / Invoice</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold tracking-wide text-[var(--ponko-primary,#cc785c)]">INVOICE</p>
            <p className="mt-0.5 text-xs text-[#8e8b82]">{invoice.invoiceNo}</p>
            <p className="text-xs text-[#8e8b82]">{invoice.dateText}</p>
            {invoice.paid && (
              <span className="mt-2 inline-block rounded bg-[#d8f0e0] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#2f7d52]">
                PAID
              </span>
            )}
          </div>
        </div>

        {invoice.lines.length > 0 && (
          <div className="px-7 py-5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8e8b82]">
              Details
            </p>
            <dl className="mt-2">
              {invoice.lines.map((line, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between border-b border-[#f0ebe3] py-2 last:border-0"
                >
                  <dt className="pr-4 text-sm text-[#6c6a64]">{line.label}</dt>
                  <dd className="text-right text-sm font-medium text-[#141413]">{line.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {invoice.totalText && (
          <div className="mx-7 mb-6 flex items-center justify-between rounded-lg border border-[#e6dfd8] bg-[#faf9f5] px-5 py-4">
            <span className="text-sm text-[#6c6a64]">Amount paid</span>
            <span className="text-2xl font-semibold text-[#141413]">{invoice.totalText}</span>
          </div>
        )}

        {(invoice.gatewayName || invoice.reference) && (
          <div className="border-t border-[#e6dfd8] px-7 py-4 text-xs text-[#8e8b82]">
            {invoice.gatewayName && <p>Paid via {invoice.gatewayName}</p>}
            {invoice.reference && (
              <p>
                Reference: <span className="font-mono text-[#57544d]">{invoice.reference}</span>
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Actions */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <InvoiceDownloadButton invoice={invoice} fileName={`${invoice.invoiceNo}.pdf`} />
        {data.formPublicId && (
          <Link to="/forms/submit/$formId" params={{ formId: data.formPublicId }}>
            <Button variant="secondary">Submit another response</Button>
          </Link>
        )}
      </div>
    </div>
  )
}

function FailedView({
  title,
  message,
  gatewayName,
  reference,
  formPublicId,
  theme,
}: {
  title?: string
  message?: string
  gatewayName?: string | null
  reference?: string | null
  formPublicId?: string | null
  theme?: FormTheme | null
}) {
  return (
    <div className="mx-auto max-w-md px-6 py-16" style={themeVars(theme)}>
      <Card className="!bg-white text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#fbe4e1] text-3xl text-[#c64545]">
          ✕
        </div>
        <h1 className="text-2xl font-medium text-[#141413]">
          {title ?? 'Payment unsuccessful'}
        </h1>
        <p className="mt-2 text-[#6c6a64]">
          {message ?? 'Your payment didn’t go through. No charge was made — you can try again.'}
        </p>

        {(gatewayName || reference) && (
          <div className="mt-5 rounded-lg border border-[#e6dfd8] bg-[#faf9f5] px-4 py-3 text-left text-xs text-[#8e8b82]">
            {gatewayName && <p>Provider: {gatewayName}</p>}
            {reference && (
              <p>
                Reference: <span className="font-mono text-[#57544d]">{reference}</span>
              </p>
            )}
          </div>
        )}

        {formPublicId && (
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link to="/forms/submit/$formId" params={{ formId: formPublicId }}>
              <Button>Try again</Button>
            </Link>
          </div>
        )}
      </Card>
    </div>
  )
}
