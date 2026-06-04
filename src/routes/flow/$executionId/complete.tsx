import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCompletionData } from '../../../lib/server-fns/flow-executions'
import { TemplateInterpolator } from '../../../lib/flow-engine/TemplateInterpolator'
import { Card } from '../../../components/ui/Card'
import { Button } from '../../../components/ui/Button'
import type { FlowVariable } from '../../../lib/flow-engine/types'

export const Route = createFileRoute('/flow/$executionId/complete')({
  component: CompletePage,
})

const interpolator = new TemplateInterpolator()

/**
 * CompletePage — shown after a flow execution completes.
 *
 * Renders a success state, the Summary node's interpolated template, a
 * receipt-style table of variable values (money-formatted by type), and links
 * back to the form or to submit another response.
 */
function CompletePage() {
  const { executionId } = Route.useParams()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['completion', executionId],
    queryFn: () => getCompletionData({ data: { executionId: Number(executionId) } }),
  })

  // If a redirect URL was recorded, this page is a brief stop — but redirect
  // navigation happens in the runtime container, so here we just render the receipt.
  useEffect(() => {}, [])

  if (isLoading) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <div className="h-64 animate-pulse rounded-xl bg-[#efe9de]" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-2xl font-medium text-[#141413]">Receipt unavailable</h1>
        <p className="mt-2 text-[#6c6a64]">We couldn't load this completion record.</p>
      </div>
    )
  }

  const variables = data.variables as FlowVariable[]
  const values = (data.execution.variables as Record<string, unknown>) ?? {}
  const typesMap: Record<string, 'string' | 'number' | 'boolean' | 'money'> = {}
  for (const v of variables) typesMap[v.name] = v.type

  const rendered =
    data.summary?.template &&
    interpolator.interpolate(data.summary.template, { variables: values, types: typesMap })

  const paymentRef = values.payment_ref as string | undefined

  function format(name: string): string {
    const value = values[name]
    if (value === undefined || value === null || value === '') return '—'
    if (typesMap[name] === 'money') {
      const num = Number(value)
      if (!isNaN(num))
        return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
    return Array.isArray(value) ? value.join(', ') : String(value)
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <Card>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#d8f0e0] text-3xl text-[#2f7d52]">
            ✓
          </div>
          <h1 className="text-2xl font-medium text-[#141413]">
            {data.summary?.title ?? 'All done!'}
          </h1>
          {rendered && <p className="text-[#6c6a64]">{rendered}</p>}
        </div>

        {/* Receipt */}
        {variables.length > 0 && (
          <div className="mt-8">
            <p className="text-xs font-medium uppercase tracking-wider text-[#8e8b82]">Details</p>
            <dl className="mt-2 divide-y divide-[#e6dfd8] rounded-lg border border-[#e6dfd8] bg-[#faf9f5]">
              {variables.map((v) => (
                <div key={v.id} className="flex items-center justify-between px-3 py-2">
                  <dt className="text-sm text-[#6c6a64]">{v.description || v.name}</dt>
                  <dd className="text-sm font-medium text-[#141413]">{format(v.name)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {paymentRef && (
          <p className="mt-4 text-center text-xs text-[#8e8b82]">
            Payment reference: <span className="font-mono text-[#57544d]">{paymentRef}</span>
          </p>
        )}

        {data.formId != null && (
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to="/forms/submit/$formId" params={{ formId: String(data.formId) }}>
              <Button variant="secondary" size="sm">
                Submit another response
              </Button>
            </Link>
          </div>
        )}
      </Card>
    </div>
  )
}
