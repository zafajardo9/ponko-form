import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MailCheck, Send, Settings2 } from 'lucide-react'
import { requireAuth } from '@/lib/server-fns/auth'
import {
  getInvoicingView,
  retryEmailDelivery,
  saveInvoicingConfig,
  sendTestTemplate,
} from '@/lib/server-fns/invoicing'
import { FormWorkspaceLayout } from '@/components/forms/FormWorkspaceLayout'
import { ResponseEmailTemplateBuilder } from '@/components/invoicing/ResponseEmailTemplateBuilder'
import { DeliveryHistory } from '@/components/invoicing/DeliveryHistory'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import type { ConfirmationConfigDraft } from '@/lib/invoicing/types'

export const Route = createFileRoute('/forms/$formId/emails')({
  beforeLoad: ({ location }) => requireAuth({ data: { returnTo: location.href } }),
  component: ResponseEmailsPage,
})

function ResponseEmailsPage() {
  const { formId } = Route.useParams()
  const numericFormId = Number(formId)
  const query = useQuery({
    queryKey: ['response-email-view', formId],
    queryFn: () => getInvoicingView({ data: { formId: numericFormId } }),
    enabled: Number.isInteger(numericFormId) && numericFormId > 0,
  })

  if (query.isLoading) return <LoadingPage formId={formId} />
  if (query.error || !query.data) {
    return (
      <FormWorkspaceLayout formId={formId} active="emails" title="Response emails">
        <div className="rounded-xl border border-[#e6dfd8] bg-white p-10 text-center">
          <h1 className="text-xl font-medium text-[#141413]">Unable to load response emails</h1>
          <p className="mt-2 text-sm text-[#8e8b82]">
            {query.error instanceof Error ? query.error.message : 'This form could not be found.'}
          </p>
        </div>
      </FormWorkspaceLayout>
    )
  }

  return (
    <LoadedResponseEmailsPage
      key={`${formId}-${query.data.form.status}`}
      formId={formId}
      data={query.data}
    />
  )
}

function LoadedResponseEmailsPage({
  formId,
  data,
}: {
  formId: string
  data: Awaited<ReturnType<typeof getInvoicingView>>
}) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [confirmation, setConfirmation] = useState<ConfirmationConfigDraft>(data.confirmation)
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    data.confirmation.templates[0]?.id ?? 'default',
  )
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(data.confirmation))
  const [message, setMessage] = useState<string | null>(null)
  const [testEmail, setTestEmail] = useState('')
  const [retryingId, setRetryingId] = useState<number | null>(null)
  const currentSnapshot = useMemo(() => JSON.stringify(confirmation), [confirmation])
  const dirty = currentSnapshot !== savedSnapshot
  const hasEmailIntegration = data.emailAvailability.resend || data.emailAvailability.smtp
  const confirmationDeliveries = data.deliveries.filter(
    (delivery) => delivery.templateKind === 'confirmation',
  )

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const saveMutation = useMutation({
    mutationFn: () =>
      saveInvoicingConfig({
        data: { formId: Number(formId), invoice: data.invoice, confirmation },
      }),
    onSuccess: async () => {
      setSavedSnapshot(currentSnapshot)
      setMessage('Response email saved.')
      toast.success('Email automations saved', 'New submissions will use the latest enabled email rules.')
      await queryClient.invalidateQueries({ queryKey: ['response-email-view', formId] })
    },
    onError: (error) => {
      const detail = error instanceof Error ? error.message : 'Unable to save the response email'
      setMessage(detail)
      toast.error('Email automations were not saved', detail)
    },
  })

  const testMutation = useMutation({
    mutationFn: async () => {
      await saveInvoicingConfig({
        data: { formId: Number(formId), invoice: data.invoice, confirmation },
      })
      return sendTestTemplate({
        data: {
          formId: Number(formId),
          kind: 'confirmation',
          recipientEmail: testEmail,
          templateId: selectedTemplateId,
        },
      })
    },
    onSuccess: (result) => {
      setSavedSnapshot(currentSnapshot)
      setMessage(`Test accepted by ${result.provider}. CC recipients were not included in the test.`)
      toast.success('Test email accepted', `${result.provider} accepted the selected email for delivery.`)
    },
    onError: (error) => {
      const detail = error instanceof Error ? error.message : 'Unable to send the test email'
      setMessage(detail)
      toast.error('Test email was not sent', detail)
    },
  })

  const retryMutation = useMutation({
    mutationFn: (deliveryId: number) =>
      retryEmailDelivery({ data: { formId: Number(formId), deliveryId } }),
    onMutate: (deliveryId) => setRetryingId(deliveryId),
    onSuccess: async () => {
      setMessage('Delivery retry completed.')
      toast.success('Delivery retry completed')
      await queryClient.invalidateQueries({ queryKey: ['response-email-view', formId] })
    },
    onError: (error) => {
      const detail = error instanceof Error ? error.message : 'Unable to retry delivery'
      setMessage(detail)
      toast.error('Delivery retry failed', detail)
    },
    onSettled: () => setRetryingId(null),
  })

  return (
    <FormWorkspaceLayout
      formId={formId}
      formTitle={data.form.title}
      active="emails"
      hasPayment={data.hasPaymentPath}
      title="Response emails"
      titleAdornment={<Badge variant={data.form.status}>{data.form.status}</Badge>}
      description="Send a personalized confirmation after every successful form submission."
      wide
    >
      {!hasEmailIntegration ? (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-[#e2c49f] bg-[#fff8eb] px-5 py-4 text-sm text-[#79572e] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <strong>Email delivery is not connected.</strong>
            <p className="mt-1">Connect Resend or SMTP before enabling response emails.</p>
          </div>
          <Link
            to="/settings/integrations"
            className="inline-flex items-center gap-2 font-medium text-[#a9583e] hover:underline"
          >
            <Settings2 size={16} aria-hidden="true" />
            Open integrations
          </Link>
        </div>
      ) : null}

      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-[#e6dfd8] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p
          role="status"
          className={`text-sm ${
            message?.toLowerCase().includes('unable') ||
            message?.toLowerCase().includes('unknown')
              ? 'text-[#a33f32]'
              : 'text-[#6c6a64]'
          }`}
        >
          {message ?? (dirty ? 'You have unsaved changes.' : 'All changes saved.')}
        </p>
        <button
          type="button"
          disabled={!dirty || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#141413] px-4 text-sm font-medium text-white hover:bg-[#2b2b28] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <MailCheck size={15} aria-hidden="true" />
          {saveMutation.isPending ? 'Saving…' : 'Save email automations'}
        </button>
      </div>

      <ResponseEmailTemplateBuilder
        confirmation={confirmation}
        variables={data.variables}
        hasEmailIntegration={hasEmailIntegration}
        selectedTemplateId={selectedTemplateId}
        onSelectTemplate={setSelectedTemplateId}
        onChange={(next) => {
          setConfirmation(next)
          setMessage(null)
        }}
      />

      <section className="my-6 rounded-xl border border-[#e6dfd8] bg-white p-5">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <label
              className="mb-1.5 block text-sm font-medium text-[#141413]"
              htmlFor="response-email-test-address"
            >
              Send a test email
            </label>
            <input
              id="response-email-test-address"
              type="email"
              value={testEmail}
              onChange={(event) => setTestEmail(event.target.value)}
              placeholder="you@example.com"
              className="h-10 w-full rounded-md border border-[#e6dfd8] px-3 text-sm outline-none focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/20"
            />
            <p className="mt-1.5 text-xs text-[#8e8b82]">
              Tests the selected email with sample form values. CC recipients are not contacted.
            </p>
          </div>
          <button
            type="button"
            disabled={!hasEmailIntegration || !testEmail || testMutation.isPending}
            onClick={() => testMutation.mutate()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#d8cec5] bg-white px-4 text-sm font-medium text-[#141413] hover:bg-[#f5f0e8] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={15} aria-hidden="true" />
            {testMutation.isPending ? 'Sending…' : 'Save & send test'}
          </button>
        </div>
      </section>

      <DeliveryHistory
        deliveries={confirmationDeliveries}
        retryingId={retryingId}
        onRetry={(id) => retryMutation.mutate(id)}
      />
    </FormWorkspaceLayout>
  )
}

function LoadingPage({ formId }: { formId: string }) {
  return (
    <FormWorkspaceLayout formId={formId} active="emails" title="Response emails" wide>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.72fr)]">
        <div className="h-[760px] animate-pulse rounded-xl bg-[#efe9de]" />
        <div className="h-[560px] animate-pulse rounded-xl bg-[#efe9de]" />
      </div>
    </FormWorkspaceLayout>
  )
}
