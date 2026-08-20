import { lazy, Suspense, useEffect, useState, type CSSProperties } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getPublicForm, getPublicFormRuntime } from '@/lib/server-fns/forms'
import { submitFormResponse } from '@/lib/server-fns/submissions'
import { getEmailSurveyPrefill } from '@/lib/server-fns/email-surveys'
import { FieldRenderer } from '../form-builder/fields/FieldRenderer'
import { validateForm } from '@/lib/form-utils'
import { useSkipValidation } from '@/lib/dev-test-mode'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { themeVars, type FormTheme } from '@/lib/theme'
import type { FieldConfig, FieldValue } from '../form-builder/fields/FieldRenderer'
import { createPublicSessionToken } from '@/lib/public-session-access'
import { FormLoadingIndicator } from './FormLoadingIndicator'
import { FormSuccessCard } from '../page-form/FormSuccessCard'

const FlowExecutionContainer = lazy(() =>
  import('../flow-execution/FlowExecutionContainer').then((module) => ({
    default: module.FlowExecutionContainer,
  })),
)

const PageFormView = lazy(() =>
  import('../page-form/PageFormView').then((module) => ({
    default: module.PageFormView,
  })),
)

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
  const [submissionClientToken] = useState(createPublicSessionToken)
  const skipValidation = useSkipValidation()

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
    queryFn: () => {
      if (!emailSurveyToken || !emailSurveyRating) {
        throw new Error('Missing email survey access')
      }
      return getEmailSurveyPrefill({
        data: { publicId, token: emailSurveyToken, rating: emailSurveyRating },
      })
    },
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

  const runtimeQuery = useQuery({
    queryKey: ['public-form-runtime', String(resolvedFormId ?? publicId)],
    queryFn: () => {
      if (!hasResolvedFormId) throw new Error('Missing form identifier')
      return getPublicFormRuntime({ data: { formId: resolvedFormId } })
    },
    enabled: hasResolvedFormId,
    retry: 2,
    retryDelay: (attempt) => Math.min(750 * 2 ** attempt, 3_000),
  })
  const runtime = runtimeQuery.data
  const fields = runtime?.kind === 'legacy' ? runtime.fields : []
  const flow = runtime?.kind === 'flow' ? runtime.flow : null
  const pageForm = runtime?.kind === 'page' ? runtime : null

  const submitMutation = useMutation({
    mutationFn: (formData: Record<string, unknown>) => {
      if (!hasResolvedFormId) throw new Error('Missing form identifier')
      return submitFormResponse({
        data: {
          formId: resolvedFormId,
          clientToken: submissionClientToken,
          formData,
        },
      })
    },
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

  const detailsLoading = !!form && runtimeQuery.isLoading
  const loading = formsLoading || detailsLoading || (hasEmailSurveyLink && emailSurveyQuery.isLoading)
  const loadError = formQuery.error ?? runtimeQuery.error ?? emailSurveyQuery.error

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
    if (runtimeQuery.isError) void runtimeQuery.refetch()
    if (emailSurveyQuery.isError) void emailSurveyQuery.refetch()
  }

  if (loadError) {
    return (
      <div className={outerClass} style={themed}>
        <div className={wrapperClass}>
          <div className="rounded-xl border border-[#d7a84c] bg-[#fff8e7] p-6 text-[#6b4f16]" role="alert">
            {form?.title && <h1 className="text-2xl font-medium text-[var(--ponko-foreground,#141413)]">{form.title}</h1>}
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
          <h1 className="text-2xl font-medium text-[var(--ponko-foreground,#141413)]">Form not found</h1>
          <p className="mt-2 text-[var(--ponko-foreground-muted,#6c6a64)]">
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
            <h1 className="text-2xl font-medium text-[var(--ponko-foreground,#141413)]">
              {expired ? 'This feedback link has expired' : 'This feedback link is not valid'}
            </h1>
            <p className="mt-2 text-[var(--ponko-foreground-muted,#6c6a64)]">
              Ask the sender for a new survey link, or open the regular form without the email rating link.
            </p>
          </Card>
        </div>
      </div>
    )
  }

  if (pageForm?.pages?.length && hasResolvedFormId) {
    return (
      <Suspense fallback={<RuntimeLoadingScreen outerClass={outerClass} wrapperClass={wrapperClass} themed={themed} title={form.title} />}>
        <PageFormView
          formId={resolvedFormId}
          title={form.title}
          description={form.description}
          pages={pageForm.pages}
          references={pageForm.references ?? []}
          recaptchaSiteKey={pageForm.recaptchaSiteKey}
          theme={theme}
          embed={embed}
          emailSurvey={emailSurveyQuery.data?.valid && emailSurveyToken ? {
            token: emailSurveyToken,
            rating: emailSurveyQuery.data.rating,
            bindVariable: emailSurveyQuery.data.bindVariable,
          } : undefined}
        />
      </Suspense>
    )
  }

  // Flow-powered legacy forms render the step-by-step runtime instead of the linear form.
  if (flow) {
    return (
      <Suspense fallback={<RuntimeLoadingScreen outerClass={outerClass} wrapperClass={wrapperClass} themed={themed} title={form.title} />}>
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
      </Suspense>
    )
  }

  if (submitted) {
    return (
      <div className={outerClass} style={themed}>
        <div className={wrapperClass}>
          <Card className="py-14 text-center sm:py-16">
            <FormSuccessCard title="Thank you!" message="Your response has been recorded." />
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
    if (!skipValidation) {
      const formErrors = validateForm(typedFields, values)
      if (Object.keys(formErrors).length > 0) {
        setErrors(formErrors)
        return
      }
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
            <h1 className="text-2xl font-medium text-[var(--ponko-foreground,#141413)]">{form.title}</h1>
            {form.description && (
              <p className="mt-2 text-[var(--ponko-foreground-muted,#6c6a64)]">{form.description}</p>
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

function RuntimeLoadingScreen({
  outerClass,
  wrapperClass,
  themed,
  title,
}: {
  outerClass: string
  wrapperClass: string
  themed: CSSProperties
  title: string
}) {
  return (
    <div className={outerClass} style={themed}>
      <div className={wrapperClass}>
        <FormLoadingScreen title={title} loadingSlow={false} />
      </div>
    </div>
  )
}

function FormLoadingScreen({ title, loadingSlow }: { title?: string; loadingSlow: boolean }) {
  const message = loadingSlow
    ? 'This form is taking a little longer than usual to load.'
    : title
      ? `Loading ${title}.`
      : 'Loading form.'
  return <FormLoadingIndicator message={message} />
}
