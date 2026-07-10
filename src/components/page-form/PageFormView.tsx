import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { themeVars, type FormTheme } from '../../lib/theme'
import {
  advancePageSession,
  completePageSubmission,
  getPageSessionData,
  startPageSession,
} from '../../lib/server-fns/page-forms'
import {
  isFieldVisible,
  missingAddressParts,
  pruneHiddenValues,
  sanitizeFieldValue,
  validateFieldRules,
  visibleFields,
} from '../../lib/page-builder/conditions'
import { applyComputedFieldValues, buildReferenceMap } from '../../lib/page-builder/references'
import type { FormPage, FormReference, PageField } from '../../lib/page-builder/types'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { FieldRenderer } from '../form-builder/fields/FieldRenderer'
import type { FieldValue } from '../form-builder/fields/FieldRenderer'
import { PageProgressBar } from './PageProgressBar'
import { PagePaymentStep } from './PagePaymentStep'

interface PageFormViewProps {
  formId?: number
  title?: string
  description?: string | null
  pages?: FormPage[]
  references?: FormReference[]
  theme?: FormTheme | null
  embed?: boolean
  preview?: boolean
  resumeSessionId?: number
}

function interpolate(template: string, data: Record<string, unknown>) {
  return template.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_match, key) =>
    String(data[key] ?? ''),
  )
}

function fieldConfig(field: PageField) {
  return {
    id: field.id,
    type: field.fieldType,
    label: field.label || 'Untitled field',
    placeholder: field.placeholder,
    required: field.required,
    options: field.options,
  }
}

export function PageFormView({
  formId,
  title = 'Form',
  description,
  pages: initialPages,
  references: initialReferences = [],
  theme,
  embed = false,
  preview = false,
  resumeSessionId,
}: PageFormViewProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [data, setData] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sessionId, setSessionId] = useState<number | null>(resumeSessionId ?? null)
  const [paidPages, setPaidPages] = useState<Record<number, boolean>>({})
  const [paymentGateMessage, setPaymentGateMessage] = useState('')
  const [completed, setCompleted] = useState(false)
  const startedRef = useRef(false)
  const submissionQueuedRef = useRef<Record<string, unknown> | null>(null)

  const resumeQuery = useQuery({
    queryKey: ['page-session', resumeSessionId],
    queryFn: () => getPageSessionData({ data: { sessionId: resumeSessionId! } }),
    enabled: !!resumeSessionId,
  })

  const pages = (resumeQuery.data?.pages ?? initialPages ?? []).sort(
    (a, b) => a.position - b.position,
  )
  const references = resumeQuery.data?.references ?? initialReferences
  const referenceMap = useMemo(() => buildReferenceMap(references), [references])
  const resolvedTitle = resumeQuery.data?.form.title ?? title
  const resolvedDescription = resumeQuery.data?.form.description ?? description
  const resolvedTheme = (resumeQuery.data?.form.theme as FormTheme | null | undefined) ?? theme

  useEffect(() => {
    if (!resumeSessionId || preview || !resolvedTitle) return

    const previousTitle = document.title
    document.title = resolvedTitle

    return () => {
      document.title = previousTitle
    }
  }, [preview, resolvedTitle, resumeSessionId])

  const startMut = useMutation({
    mutationFn: (id: number) => startPageSession({ data: { formId: id } }),
    onSuccess: (session) => setSessionId(session.id),
  })
  const advanceMut = useMutation({
    mutationFn: (vars: { currentPageIndex: number; collectedData: Record<string, unknown> }) =>
      advancePageSession({ data: { sessionId: sessionId!, ...vars } }),
  })
  const completeMut = useMutation({
    mutationFn: (collectedData: Record<string, unknown>) =>
      completePageSubmission({ data: { sessionId: sessionId!, collectedData } }),
    onSuccess: () => setCompleted(true),
  })

  useEffect(() => {
    if (resumeQuery.data) {
      setCurrentPageIndex(resumeQuery.data.session.currentPageIndex)
      setData((resumeQuery.data.session.collectedData as Record<string, unknown>) ?? {})
      setSessionId(resumeQuery.data.session.id)
    }
  }, [resumeQuery.data])

  useEffect(() => {
    if (preview || resumeSessionId || startedRef.current || !formId) return
    startedRef.current = true
    startMut.mutate(formId)
  }, [formId, preview, resumeSessionId, startMut])

  // Retry queued submission once the session becomes available
  useEffect(() => {
    if (sessionId && submissionQueuedRef.current) {
      const queuedData = submissionQueuedRef.current
      submissionQueuedRef.current = null
      completeMut.mutate(queuedData)
    }
  }, [sessionId])

  const allFields = useMemo(() => pages.flatMap((page) => page.fields), [pages])
  const currentPage = pages[currentPageIndex]
  const currentPaymentPaid = currentPage?.hasPayment ? Boolean(paidPages[currentPage.id]) : true
  const computedData = useMemo(
    () => applyComputedFieldValues(allFields, data, references),
    [allFields, data, references],
  )
  const currentValues = computedData as Record<string, FieldValue>
  const themed = themeVars(resolvedTheme ?? null)
  const outerClass = embed ? 'w-full' : 'min-h-screen bg-[var(--ponko-bg,#faf9f5)]'
  const wrapperClass = embed
    ? 'w-full px-4 py-6'
    : 'mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8 lg:py-14'

  if (resumeQuery.isLoading) {
    return (
      <div className={outerClass} style={themed}>
        <div className={wrapperClass}>
          <div className="h-64 animate-pulse rounded-xl bg-[#efe9de]" />
        </div>
      </div>
    )
  }

  if (!currentPage) {
    return (
      <div className={outerClass} style={themed}>
        <div className={wrapperClass}>
          <Card className="text-center">This form has no pages yet.</Card>
        </div>
      </div>
    )
  }

  function fieldValueIsEmpty(field: PageField, value: unknown) {
    if (field.fieldType === 'address') {
      return missingAddressParts(field, value).length > 0
    }
    return value == null ||
      (Array.isArray(value) ? value.length === 0 : String(value).trim() === '')
  }

  function updateValue(field: PageField, value: FieldValue) {
    const sanitized = sanitizeFieldValue(field, value)
    setData((prev) => {
      const next = applyComputedFieldValues(allFields, { ...prev, [field.bindVariable]: sanitized }, references)
      return pruneHiddenValues(allFields, next, referenceMap)
    })
    setErrors((prev) => ({ ...prev, [field.bindVariable]: '' }))
  }

  function validatePage(page: FormPage, scopedData: Record<string, unknown>) {
    const nextErrors: Record<string, string> = {}
    for (const field of visibleFields(page.fields, scopedData, referenceMap)) {
      const value = scopedData[field.bindVariable]
      const empty = fieldValueIsEmpty(field, value)
      if (field.required && empty) {
        const missing = field.fieldType === 'address' ? missingAddressParts(field, value) : []
        nextErrors[field.bindVariable] = missing.length > 0
          ? `Please complete: ${missing.join(', ')}.`
          : 'This field is required.'
      }
      if (!empty) {
        const ruleError = validateFieldRules(field, value)
        if (ruleError) nextErrors[field.bindVariable] = ruleError
      }
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function goNext() {
    const nextData = pruneHiddenValues(allFields, applyComputedFieldValues(allFields, data, references), referenceMap)
    if (!currentPage.isFinal && !currentPage.hasPayment && !validatePage(currentPage, nextData)) {
      return
    }
    if (!preview && currentPage.hasPayment && !currentPaymentPaid) {
      setPaymentGateMessage('Please complete the payment before continuing.')
      return
    }
    setPaymentGateMessage('')
    setData(nextData)
    if (currentPageIndex >= pages.length - 1) {
      if (preview) {
        setCompleted(true)
      } else if (sessionId) {
        completeMut.mutate(nextData)
      } else {
        // Session pending — queue submission to fire when session is ready
        submissionQueuedRef.current = nextData
        setPaymentGateMessage('Preparing your submission...')
      }
      return
    }
    const nextIndex = currentPageIndex + 1
    if (!preview && sessionId) {
      await advanceMut.mutateAsync({ currentPageIndex: nextIndex, collectedData: nextData })
    }
    setCurrentPageIndex(nextIndex)
  }

  function goBack() {
    setCurrentPageIndex((index) => Math.max(0, index - 1))
  }

  if (completed) {
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

  const finalContent =
    currentPage.isFinal && currentPage.finalTemplate
      ? interpolate(currentPage.finalTemplate, { ...referenceMap, ...data })
      : 'Your response has been recorded.'

  return (
    <div className={outerClass} style={themed}>
      <div className={wrapperClass}>
        <Card>
          <div className="mb-8">
            <h1 className="text-2xl font-medium text-[#141413]">{resolvedTitle}</h1>
            {resolvedDescription && <p className="mt-2 text-[#6c6a64]">{resolvedDescription}</p>}
          </div>

          <PageProgressBar current={currentPageIndex + 1} total={pages.length} />

          <div className="mb-6">
            <h2 className="text-xl font-medium text-[#141413]">{currentPage.title}</h2>
            {currentPage.description && (
              <p className="mt-1 text-sm text-[#6c6a64]">{currentPage.description}</p>
            )}
          </div>

          {currentPage.isFinal ? (
            <div className="rounded-lg bg-[#faf9f5] p-5 text-center">
              <div className="mb-3 text-4xl">✓</div>
              <p className="whitespace-pre-wrap text-[#3d3d3a]">{finalContent}</p>
              {currentPage.finalRedirectUrl && !preview && (
                <RedirectAfterDelay url={interpolate(currentPage.finalRedirectUrl, { ...referenceMap, ...data })} />
              )}
            </div>
          ) : currentPage.hasPayment && sessionId && !preview ? (
            <PagePaymentStep
              sessionId={sessionId}
              pageId={currentPage.id}
              onPaymentStatusChange={(paid) => {
                setPaidPages((prev) => ({ ...prev, [currentPage.id]: paid }))
                if (paid) setPaymentGateMessage('')
              }}
            />
          ) : (
            <div className="flex flex-col gap-6">
              {currentPage.fields.filter((field) =>
                isFieldVisible(field, computedData, referenceMap) &&
                (field.fieldType !== 'computation' || field.validationRules?.computation?.showBreakdown !== false),
              ).map((field) => (
                <FieldRenderer
                  key={field.id}
                  field={fieldConfig(field)}
                  value={currentValues[field.bindVariable] ?? ''}
                  onChange={(value) => updateValue(field, value)}
                  error={errors[field.bindVariable]}
                />
              ))}
            </div>
          )}

          <div className="mt-8 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={goBack}
              disabled={currentPageIndex === 0}
            >
              Back
            </Button>
            <Button
              type="button"
              onClick={goNext}
              disabled={completeMut.isPending || (!preview && currentPage.hasPayment && !currentPaymentPaid)}
            >
              {currentPageIndex >= pages.length - 1
                ? completeMut.isPending
                  ? 'Submitting...'
                  : 'Submit'
                : currentPage.hasPayment && !currentPaymentPaid && !preview
                  ? 'Complete payment to continue'
                  : 'Next'}
            </Button>
          </div>

          {paymentGateMessage && (
            <p className="mt-4 text-sm text-[#c64545]">{paymentGateMessage}</p>
          )}

          {startMut.isError && (
            <p className="mt-4 text-sm text-[#e8a838]">
              Unable to save your progress. You can still fill out the form, but your responses may not be saved if you leave the page.
            </p>
          )}

          {completeMut.isError && (
            <p className="mt-4 text-sm text-[#c64545]">
              {(completeMut.error as Error)?.message ?? 'Submission failed.'}
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}

function RedirectAfterDelay({ url }: { url: string }) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.location.href = url
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [url])
  return <p className="mt-4 text-sm text-[#8e8b82]">Redirecting shortly...</p>
}
