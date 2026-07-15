import { useEffect, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getFields } from '../../lib/server-fns/fields'
import { getPublicForm } from '../../lib/server-fns/forms'
import { getFlow } from '../../lib/server-fns/flows'
import { getPageForm } from '../../lib/server-fns/page-forms'
import { submitFormResponse } from '../../lib/server-fns/submissions'
import { getEmailSurveyPrefill } from '../../lib/server-fns/email-surveys'
import { FieldRenderer } from '../form-builder/fields/FieldRenderer'
import { FlowExecutionContainer } from '../flow-execution/FlowExecutionContainer'
import { PageFormView } from '../page-form/PageFormView'
import { validateForm } from '../../lib/form-utils'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { themeVars, type FormTheme } from '../../lib/theme'
import type { FieldConfig, FieldValue } from '../form-builder/fields/FieldRenderer'

interface PublicFormViewProps {
  publicId: string
  /**
   * When true, the form is rendered for embedding inside an <iframe>: it fills
   * the host container (no centered max-width, no large vertical padding) and
   * uses a transparent background so it blends into the parent site.
   */
  embed?: boolean
  emailSurveyToken?: string | null
  emailSurveyRating?: string | null
}

/**
 * PublicFormView
 *
 * The end-user form experience, shared by the standalone shareable page
 * (`/forms/submit/$formId`) and the embeddable page (`/forms/embed/$formId`).
 * Both render without the app navigation; the only difference is the `embed`
 * layout, which is responsive to whatever container the iframe is placed in.
 */
export function PublicFormView({
  publicId,
  embed = false,
  emailSurveyToken,
  emailSurveyRating,
}: PublicFormViewProps) {
  const [values, setValues] = useState<Record<number, FieldValue>>({})
  const [errors, setErrors] = useState<Record<number, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [loadingSlow, setLoadingSlow] = useState(false)

  const formQuery = useQuery({
    queryKey: ['public-form', publicId],
    queryFn: () => getPublicForm({ data: { publicId } }),
    enabled: !!publicId,
    retry: 2,
    retryDelay: (attempt) => Math.min(750 * 2 ** attempt, 3_000),
  })
  const { data: form, isLoading: formsLoading } = formQuery
  const hasEmailSurveyLink = Boolean(emailSurveyToken && emailSurveyRating)
  const emailSurveyQuery = useQuery({
    queryKey: ['email-survey-prefill', publicId, emailSurveyToken, emailSurveyRating],
    queryFn: () => getEmailSurveyPrefill({
      data: { publicId, token: emailSurveyToken!, rating: emailSurveyRating! },
    }),
    enabled: hasEmailSurveyLink,
    retry: false,
  })

  useEffect(() => {
    if (!form?.title) return

    const previousTitle = document.title
    document.title = form.title

    return () => {
      document.title = previousTitle
    }
  }, [form?.title])

  const resolvedFormId = form?.id
  const hasResolvedFormId = typeof resolvedFormId === 'number' && Number.isFinite(resolvedFormId)

  const fieldsQuery = useQuery({
    queryKey: ['fields', String(resolvedFormId ?? publicId)],
    queryFn: () => getFields({ data: { formId: resolvedFormId! } }),
    enabled: hasResolvedFormId,
    retry: 2,
    retryDelay: (attempt) => Math.min(750 * 2 ** attempt, 3_000),
  })
  const { data: fields = [], isLoading: fieldsLoading } = fieldsQuery

  const flowQuery = useQuery({
    queryKey: ['flow', String(resolvedFormId ?? publicId)],
    queryFn: () => getFlow({ data: { formId: resolvedFormId! } }),
    enabled: hasResolvedFormId,
    retry: 2,
    retryDelay: (attempt) => Math.min(750 * 2 ** attempt, 3_000),
  })
  const { data: flow, isLoading: flowLoading } = flowQuery

  const pageFormQuery = useQuery({
    queryKey: ['page-form', String(resolvedFormId ?? publicId)],
    queryFn: () => getPageForm({ data: { formId: resolvedFormId! } }),
    enabled: hasResolvedFormId,
    retry: 2,
    retryDelay: (attempt) => Math.min(750 * 2 ** attempt, 3_000),
  })
  const { data: pageForm, isLoading: pagesLoading } = pageFormQuery

  const submitMutation = useMutation({
    mutationFn: (formData: Record<string, unknown>) =>
      submitFormResponse({ data: { formId: resolvedFormId!, formData } }),
    onSuccess: () => setSubmitted(true),
  })

  // Outer wrapper: centered card on the standalone page, fluid full-width when embedded.
  const wrapperClass = embed
    ? 'w-full min-w-0 px-3 py-4 sm:px-4 sm:py-6'
    : 'mx-auto w-full min-w-0 max-w-5xl px-3 py-4 sm:px-6 sm:py-10 lg:px-8 lg:py-14'

  // Per-form theming: set CSS vars on a full-bleed wrapper (standalone gets the
  // themed page background; embed stays transparent to blend into the host site).
  const theme = (form?.theme ?? null) as FormTheme | null
  const themed = themeVars(theme)
  const outerClass = embed
    ? 'w-full'
    : 'flex min-h-screen items-center bg-[var(--ponko-bg,#faf9f5)]'

  const detailsLoading = !!form && (fieldsLoading || flowLoading || pagesLoading)
  const loading = formsLoading || detailsLoading || (hasEmailSurveyLink && emailSurveyQuery.isLoading)
  const loadError = formQuery.error ?? fieldsQuery.error ?? flowQuery.error ?? pageFormQuery.error ?? emailSurveyQuery.error

  useEffect(() => {
    if (!loading) {
      setLoadingSlow(false)
      return
    }
    const timer = window.setTimeout(() => setLoadingSlow(true), 3_000)
    return () => window.clearTimeout(timer)
  }, [loading])

  function retryFailedQueries() {
    if (formQuery.isError) void formQuery.refetch()
    if (fieldsQuery.isError) void fieldsQuery.refetch()
    if (flowQuery.isError) void flowQuery.refetch()
    if (pageFormQuery.isError) void pageFormQuery.refetch()
    if (emailSurveyQuery.isError) void emailSurveyQuery.refetch()
  }

  if (loadError) {
    return (
      <div className={outerClass} style={themed}>
        <div className={wrapperClass}>
          <div className="rounded-xl border border-[#d7a84c] bg-[#fff8e7] p-6 text-[#6b4f16]" role="alert">
            {form?.title && <h1 className="text-2xl font-medium text-[#141413]">{form.title}</h1>}
            <p className={form?.title ? 'mt-3 text-sm' : 'text-sm font-medium'}>
              The form could not be loaded from the server. Your connection may still be recovering.
            </p>
            <Button className="mt-4" type="button" variant="secondary" onClick={retryFailedQueries}>
              Try again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={outerClass} style={themed}>
        <div className={wrapperClass}>
          <FormLoadingScreen title={form?.title} loadingSlow={loadingSlow} />
        </div>
      </div>
    )
  }

  if (!form) {
    return (
      <div className={outerClass} style={themed}>
        <div className={embed ? 'w-full px-4 py-12 text-center' : 'mx-auto w-full max-w-5xl px-6 py-24 text-center'}>
          <h1 className="text-2xl font-medium text-[#141413]">Form not found</h1>
          <p className="mt-2 text-[#6c6a64]">
            This form is not available or hasn't been published yet.
          </p>
        </div>
      </div>
    )
  }

  if (hasEmailSurveyLink && emailSurveyQuery.data && !emailSurveyQuery.data.valid) {
    const expired = emailSurveyQuery.data.reason === 'expired'
    return (
      <div className={outerClass} style={themed}>
        <div className={wrapperClass}>
          <Card className="py-16 text-center">
            <h1 className="text-2xl font-medium text-[#141413]">
              {expired ? 'This feedback link has expired' : 'This feedback link is not valid'}
            </h1>
            <p className="mt-2 text-[#6c6a64]">
              Ask the sender for a new survey link, or open the regular form without the email rating link.
            </p>
          </Card>
        </div>
      </div>
    )
  }

  if (pageForm?.pages.length) {
    return (
      <PageFormView
        formId={resolvedFormId!}
        title={form.title}
        description={form.description}
        pages={pageForm.pages}
        references={pageForm.references ?? []}
        theme={theme}
        embed={embed}
        emailSurvey={emailSurveyQuery.data?.valid ? {
          token: emailSurveyToken!,
          rating: emailSurveyQuery.data.rating,
          bindVariable: emailSurveyQuery.data.bindVariable,
        } : undefined}
      />
    )
  }

  // Flow-powered legacy forms render the step-by-step runtime instead of the linear form.
  if (flow) {
    return (
      <FlowExecutionContainer
        flowId={flow.flow.id}
        title={form.title}
        description={form.description}
        nodes={flow.nodes}
        edges={flow.edges}
        variables={flow.variables}
        theme={theme}
        embed={embed}
      />
    )
  }

  if (submitted) {
    return (
      <div className={outerClass} style={themed}>
        <div className={wrapperClass}>
          <Card className="text-center py-16">
            <div className="mb-4 text-5xl">✓</div>
            <h1 className="text-2xl font-medium text-[#141413]">Thank you!</h1>
            <p className="mt-2 text-[#6c6a64]">Your response has been recorded.</p>
          </Card>
        </div>
      </div>
    )
  }

  function handleChange(fieldId: number, value: FieldValue) {
    setValues((v) => ({ ...v, [fieldId]: value }))
    setErrors((e) => ({ ...e, [fieldId]: '' }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const typedFields = fields as FieldConfig[]
    const formErrors = validateForm(typedFields, values)
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors)
      return
    }

    const formData: Record<string, unknown> = {}
    for (const field of typedFields) {
      formData[String(field.id)] = values[field.id] ?? ''
    }
    submitMutation.mutate(formData)
  }

  return (
    <div className={outerClass} style={themed}>
      <div className={wrapperClass}>
        <Card className="min-w-0 max-sm:p-4">
          <div className="mb-8">
            <h1 className="text-2xl font-medium text-[#141413]">{form.title}</h1>
            {form.description && (
              <p className="mt-2 text-[#6c6a64]">{form.description}</p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {(fields as FieldConfig[]).map((field) => (
              <FieldRenderer
                key={field.id}
                field={field}
                value={values[field.id] ?? ''}
                onChange={(v) => handleChange(field.id, v)}
                error={errors[field.id]}
              />
            ))}

            {submitMutation.isError && (
              <p className="text-sm text-[#c64545]">
                {(submitMutation.error as Error)?.message ?? 'Submission failed. Please try again.'}
              </p>
            )}

            <Button type="submit" disabled={submitMutation.isPending}>
              {submitMutation.isPending ? 'Submitting…' : 'Submit'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}

function FormLoadingScreen({ title, loadingSlow }: { title?: string; loadingSlow: boolean }) {
  return (
    <div
      className="relative overflow-hidden border border-black/5 bg-white/75 px-5 py-10 shadow-[0_24px_70px_-34px_rgba(20,20,19,0.4)] backdrop-blur-sm sm:px-10 sm:py-12"
      style={{ borderRadius: 'var(--ponko-radius-card,16px)' }}
      role="status"
      aria-live="polite"
      aria-label="Loading form"
    >
      <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[var(--ponko-primary-soft,#cc785c29)] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 h-52 w-52 rounded-full bg-[var(--ponko-primary-soft,#cc785c29)] blur-3xl" />

      <div className="relative mx-auto max-w-xl text-center">
        <div className="relative mx-auto flex h-16 w-16 items-center justify-center" aria-hidden="true">
          <div className="absolute inset-0 animate-ping rounded-full bg-[var(--ponko-primary-soft,#cc785c29)] [animation-duration:1.8s]" />
          <div className="absolute inset-1 rounded-full border-2 border-[var(--ponko-primary-soft,#cc785c29)]" />
          <div className="absolute inset-1 animate-spin rounded-full border-2 border-transparent border-t-[var(--ponko-primary,#cc785c)] [animation-duration:1.1s]" />
          <div className="h-2.5 w-2.5 rounded-full bg-[var(--ponko-primary,#cc785c)] shadow-[0_0_18px_var(--ponko-primary,#cc785c)]" />
        </div>

        <h1 className="mt-5 text-2xl font-medium tracking-tight text-[#141413] sm:text-3xl">
          {title || 'Preparing your form'}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6c6a64]">
          {loadingSlow
            ? 'This is taking a little longer than usual. Your form is still loading safely.'
            : 'Just a moment while we prepare everything for you.'}
        </p>

        <div
          className="mx-auto mt-8 max-w-lg border border-black/5 bg-[var(--ponko-surface,#f5f0e8)] p-4 text-left sm:p-5"
          style={{ borderRadius: 'var(--ponko-radius-card,16px)' }}
          aria-hidden="true"
        >
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--ponko-primary,#cc785c)]" />
            <div className="h-2.5 w-24 animate-pulse rounded-full bg-[var(--ponko-primary-soft,#cc785c29)]" />
          </div>
          <div className="mt-5 space-y-4">
            <div>
              <div className="h-2.5 w-20 animate-pulse rounded-full bg-black/10" />
              <div className="mt-2 h-11 animate-pulse bg-white/80" style={{ borderRadius: 'var(--ponko-radius,8px)' }} />
            </div>
            <div>
              <div className="h-2.5 w-28 animate-pulse rounded-full bg-black/10 [animation-delay:120ms]" />
              <div className="mt-2 h-11 animate-pulse bg-white/80 [animation-delay:120ms]" style={{ borderRadius: 'var(--ponko-radius,8px)' }} />
            </div>
          </div>
          <div className="mt-5 h-1 overflow-hidden rounded-full bg-black/5">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--ponko-primary,#cc785c)]" />
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-1.5" aria-hidden="true">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--ponko-primary,#cc785c)]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--ponko-primary,#cc785c)] [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--ponko-primary,#cc785c)] [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )
}
