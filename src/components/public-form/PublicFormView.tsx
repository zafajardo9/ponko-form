import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getFields } from '../../lib/server-fns/fields'
import { getPublicForm } from '../../lib/server-fns/forms'
import { getFlow } from '../../lib/server-fns/flows'
import { submitFormResponse } from '../../lib/server-fns/submissions'
import { FieldRenderer } from '../form-builder/fields/FieldRenderer'
import { FlowExecutionContainer } from '../flow-execution/FlowExecutionContainer'
import { validateForm } from '../../lib/form-utils'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { themeVars, type FormTheme } from '../../lib/theme'
import type { FieldConfig } from '../form-builder/fields/FieldRenderer'

interface PublicFormViewProps {
  formId: number
  /**
   * When true, the form is rendered for embedding inside an <iframe>: it fills
   * the host container (no centered max-width, no large vertical padding) and
   * uses a transparent background so it blends into the parent site.
   */
  embed?: boolean
}

/**
 * PublicFormView
 *
 * The end-user form experience, shared by the standalone shareable page
 * (`/forms/submit/$formId`) and the embeddable page (`/forms/embed/$formId`).
 * Both render without the app navigation; the only difference is the `embed`
 * layout, which is responsive to whatever container the iframe is placed in.
 */
export function PublicFormView({ formId, embed = false }: PublicFormViewProps) {
  const [values, setValues] = useState<Record<number, string | string[]>>({})
  const [errors, setErrors] = useState<Record<number, string>>({})
  const [submitted, setSubmitted] = useState(false)

  const { data: form, isLoading: formsLoading } = useQuery({
    queryKey: ['public-form', String(formId)],
    queryFn: () => getPublicForm({ data: { formId } }),
  })

  const { data: fields = [], isLoading: fieldsLoading } = useQuery({
    queryKey: ['fields', String(formId)],
    queryFn: () => getFields({ data: { formId } }),
  })

  const { data: flow, isLoading: flowLoading } = useQuery({
    queryKey: ['flow', String(formId)],
    queryFn: () => getFlow({ data: { formId } }),
  })

  const submitMutation = useMutation({
    mutationFn: (formData: Record<string, unknown>) =>
      submitFormResponse({ data: { formId, formData } }),
    onSuccess: () => setSubmitted(true),
  })

  // Outer wrapper: centered card on the standalone page, fluid full-width when embedded.
  const wrapperClass = embed
    ? 'w-full px-4 py-6'
    : 'mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-16'

  // Per-form theming: set CSS vars on a full-bleed wrapper (standalone gets the
  // themed page background; embed stays transparent to blend into the host site).
  const theme = (form?.theme ?? null) as FormTheme | null
  const themed = themeVars(theme)
  const outerClass = embed ? 'w-full' : 'min-h-screen bg-[var(--ponko-bg,#faf9f5)]'

  if (formsLoading || fieldsLoading || flowLoading) {
    return (
      <div className={outerClass} style={themed}>
        <div className={wrapperClass}>
          <div className="h-64 animate-pulse rounded-xl bg-[#efe9de]" />
        </div>
      </div>
    )
  }

  if (!form) {
    return (
      <div className={outerClass} style={themed}>
        <div className={embed ? 'w-full px-4 py-12 text-center' : 'mx-auto max-w-xl px-6 py-24 text-center'}>
          <h1 className="text-2xl font-medium text-[#141413]">Form not found</h1>
          <p className="mt-2 text-[#6c6a64]">
            This form is not available or hasn't been published yet.
          </p>
        </div>
      </div>
    )
  }

  // Flow-powered forms render the step-by-step runtime instead of the linear form.
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

  function handleChange(fieldId: number, value: string | string[]) {
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
      <Card>
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
