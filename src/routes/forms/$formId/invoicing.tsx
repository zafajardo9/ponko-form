import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Send, Settings2 } from 'lucide-react'
import { requireAuth } from '../../../lib/server-fns/auth'
import {
  getInvoicingView,
  retryEmailDelivery,
  saveInvoicingConfig,
  sendTestTemplate,
  type InvoicingTemplateKind,
} from '../../../lib/server-fns/invoicing'
import { FormWorkspaceLayout } from '../../../components/forms/FormWorkspaceLayout'
import { InvoiceTemplateBuilder } from '../../../components/invoicing/InvoiceTemplateBuilder'
import { DeliveryHistory } from '../../../components/invoicing/DeliveryHistory'
import { Badge } from '../../../components/ui/Badge'
import type { ConfirmationConfigDraft, InvoiceConfigDraft } from '../../../lib/invoicing/types'

export const Route = createFileRoute('/forms/$formId/invoicing')({
  beforeLoad: ({ location }) => requireAuth({ data: { returnTo: location.href } }),
  component: InvoicingPage,
})

function InvoicingPage() {
  const { formId } = Route.useParams()
  const numericFormId = Number(formId)
  const query = useQuery({
    queryKey: ['invoicing-view', formId],
    queryFn: () => getInvoicingView({ data: { formId: numericFormId } }),
    enabled: Number.isInteger(numericFormId) && numericFormId > 0,
  })

  if (query.isLoading) return <LoadingPage formId={formId} />
  if (query.error || !query.data) {
    return (
      <FormWorkspaceLayout formId={formId} active="invoicing" title="Invoicing">
        <div className="rounded-xl border border-[#e6dfd8] bg-white p-10 text-center">
          <h1 className="text-xl font-medium text-[#141413]">Unable to load invoicing</h1>
          <p className="mt-2 text-sm text-[#8e8b82]">{query.error instanceof Error ? query.error.message : 'This form could not be found.'}</p>
        </div>
      </FormWorkspaceLayout>
    )
  }
  return <LoadedInvoicingPage key={`${formId}-${query.data.form.status}`} formId={formId} data={query.data} />
}

function LoadedInvoicingPage({
  formId,
  data,
}: {
  formId: string
  data: Awaited<ReturnType<typeof getInvoicingView>>
}) {
  const queryClient = useQueryClient()
  const [invoice, setInvoice] = useState<InvoiceConfigDraft>(data.invoice)
  const [confirmation, setConfirmation] = useState<ConfirmationConfigDraft>(data.confirmation)
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify({ invoice: data.invoice, confirmation: data.confirmation }))
  const [message, setMessage] = useState<string | null>(null)
  const [testEmail, setTestEmail] = useState('')
  const [testKind, setTestKind] = useState<InvoicingTemplateKind>('invoice')
  const [retryingId, setRetryingId] = useState<number | null>(null)
  const currentSnapshot = useMemo(() => JSON.stringify({ invoice, confirmation }), [invoice, confirmation])
  const dirty = currentSnapshot !== savedSnapshot

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const saveMutation = useMutation({
    mutationFn: () => saveInvoicingConfig({ data: { formId: Number(formId), invoice, confirmation } }),
    onSuccess: async () => {
      setSavedSnapshot(currentSnapshot)
      setMessage('Templates saved.')
      await queryClient.invalidateQueries({ queryKey: ['invoicing-view', formId] })
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Unable to save templates'),
  })
  const testMutation = useMutation({
    mutationFn: async () => {
      await saveInvoicingConfig({ data: { formId: Number(formId), invoice, confirmation } })
      return sendTestTemplate({ data: { formId: Number(formId), kind: testKind, recipientEmail: testEmail } })
    },
    onSuccess: (result) => {
      setSavedSnapshot(currentSnapshot)
      setMessage(`Test accepted by ${result.provider}.`)
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Unable to send test'),
  })
  const retryMutation = useMutation({
    mutationFn: (deliveryId: number) => retryEmailDelivery({ data: { formId: Number(formId), deliveryId } }),
    onMutate: (deliveryId) => setRetryingId(deliveryId),
    onSuccess: async () => {
      setMessage('Delivery retry completed.')
      await queryClient.invalidateQueries({ queryKey: ['invoicing-view', formId] })
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Unable to retry delivery'),
    onSettled: () => setRetryingId(null),
  })
  const hasEmailIntegration = data.emailAvailability.resend || data.emailAvailability.smtp

  return (
    <FormWorkspaceLayout
      formId={formId}
      formTitle={data.form.title}
      active="invoicing"
      title="Invoicing"
      titleAdornment={<Badge variant={data.form.status}>{data.form.status}</Badge>}
      description="Design the invoice and confirmation emails respondents receive after successful completion."
    >
      {!hasEmailIntegration && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-[#e2c49f] bg-[#fff8eb] px-5 py-4 text-sm text-[#79572e] sm:flex-row sm:items-center sm:justify-between">
          <div><strong>Email delivery is not connected.</strong><p className="mt-1">Connect Resend or SMTP before enabling respondent emails.</p></div>
          <Link to="/settings/integrations" className="inline-flex items-center gap-2 font-medium text-[#a9583e] hover:underline"><Settings2 size={16} /> Open integrations</Link>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e6dfd8] bg-white px-4 py-3">
        <p role="status" className={`text-sm ${message?.toLowerCase().includes('unable') || message?.toLowerCase().includes('unknown') ? 'text-[#a33f32]' : 'text-[#6c6a64]'}`}>
          {message ?? (dirty ? 'You have unsaved changes.' : 'All changes saved.')}
        </p>
        <button type="button" disabled={!dirty || saveMutation.isPending} onClick={() => saveMutation.mutate()} className="rounded-md bg-[#141413] px-4 py-2 text-sm font-medium text-white hover:bg-[#2b2b28] disabled:cursor-not-allowed disabled:opacity-40">
          {saveMutation.isPending ? 'Saving…' : 'Save templates'}
        </button>
      </div>

      <InvoiceTemplateBuilder
        invoice={invoice}
        confirmation={confirmation}
        variables={data.variables}
        hasPaymentPath={data.hasPaymentPath}
        hasEmailIntegration={hasEmailIntegration}
        numberingLocked={data.invoiceNumberingLocked}
        onInvoiceChange={(next) => { setInvoice(next); setMessage(null) }}
        onConfirmationChange={(next) => { setConfirmation(next); setMessage(null) }}
      />

      <section className="my-6 flex flex-col gap-4 rounded-xl border border-[#e6dfd8] bg-white p-5 md:flex-row md:items-end">
        <div className="flex-1"><label className="mb-1.5 block text-sm font-medium text-[#141413]" htmlFor="test-email">Send a test email</label><input id="test-email" type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="you@example.com" className="h-10 w-full rounded-md border border-[#e6dfd8] px-3 text-sm outline-none focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/20" /></div>
        <select aria-label="Test template kind" value={testKind} onChange={(event) => setTestKind(event.target.value as InvoicingTemplateKind)} className="h-10 rounded-md border border-[#e6dfd8] bg-white px-3 text-sm"><option value="invoice">Invoice template</option><option value="confirmation">Confirmation template</option></select>
        <button type="button" disabled={!hasEmailIntegration || !testEmail || testMutation.isPending} onClick={() => testMutation.mutate()} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#e6dfd8] px-4 text-sm font-medium text-[#141413] hover:bg-[#f5f0e8] disabled:opacity-40"><Send size={15} />{testMutation.isPending ? 'Sending…' : 'Save & send test'}</button>
      </section>

      <DeliveryHistory deliveries={data.deliveries} retryingId={retryingId} onRetry={(id) => retryMutation.mutate(id)} />
    </FormWorkspaceLayout>
  )
}

function LoadingPage({ formId }: { formId: string }) {
  return (
    <FormWorkspaceLayout formId={formId} active="invoicing" title="Invoicing">
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="h-[700px] animate-pulse rounded-xl bg-[#efe9de]" />
        <div className="h-[700px] animate-pulse rounded-xl bg-[#efe9de]" />
      </div>
    </FormWorkspaceLayout>
  )
}
