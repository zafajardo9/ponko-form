import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { RecaptchaField } from './RecaptchaField'

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
  emailSurvey?: {
    token: string
    rating: string
    bindVariable: string
  }
  recaptchaSiteKey?: string | null
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

function createSessionClientToken() {
  const generated = globalThis.crypto?.randomUUID?.().replaceAll('-', '')
  if (generated) return generated
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
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
  emailSurvey,
  recaptchaSiteKey: initialRecaptchaSiteKey,
}: PageFormViewProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [data, setData] = useState<Record<string, unknown>>(() =>
    emailSurvey ? { [emailSurvey.bindVariable]: emailSurvey.rating } : {},
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sessionId, setSessionId] = useState<number | null>(resumeSessionId ?? null)
  const [paidPages, setPaidPages] = useState<Record<number, boolean>>({})
  const [paymentGateMessage, setPaymentGateMessage] = useState('')
  const [completed, setCompleted] = useState(false)
  const [captchaEpoch, setCaptchaEpoch] = useState(0)
  const [sessionClientToken] = useState(createSessionClientToken)
  const sessionCorrelationId = sessionClientToken.slice(0, 12)
  const startedRef = useRef(false)
  const submissionQueuedRef = useRef<Record<string, unknown> | null>(null)
  const failedSubmissionRef = useRef<Record<string, unknown> | null>(null)

  const resumeQuery = useQuery({
    queryKey: ['page-session', resumeSessionId],
    queryFn: () => getPageSessionData({ data: { sessionId: resumeSessionId! } }),
    enabled: !!resumeSessionId,
  })

  const pages = (resumeQuery.data?.pages ?? initialPages ?? []).sort(
    (a, b) => a.position - b.position,
  )
  const allFields = useMemo(() => pages.flatMap((page) => page.fields), [pages])
  const references = resumeQuery.data?.references ?? initialReferences
  const referenceMap = useMemo(() => buildReferenceMap(references), [references])
  const resolvedTitle = resumeQuery.data?.form.title ?? title
  const resolvedDescription = resumeQuery.data?.form.description ?? description
  const trimmedDescription = resolvedDescription?.trim()
  const visibleDescription =
    !trimmedDescription || trimmedDescription.toLocaleLowerCase() === resolvedTitle.trim().toLocaleLowerCase()
      ? null
      : trimmedDescription
  const resolvedTheme = (resumeQuery.data?.form.theme as FormTheme | null | undefined) ?? theme
  const recaptchaSiteKey = resumeQuery.data?.recaptchaSiteKey ?? initialRecaptchaSiteKey ?? null

  function resetCaptchaFields() {
    setData((current) => {
      const next = { ...current }
      for (const field of allFields) {
        if (field.fieldType === 'recaptcha') delete next[field.bindVariable]
      }
      return next
    })
    setCaptchaEpoch((value) => value + 1)
  }

  useEffect(() => {
    if (!resumeSessionId || preview || !resolvedTitle) return

    const previousTitle = document.title
    document.title = resolvedTitle

    return () => {
      document.title = previousTitle
    }
  }, [preview, resolvedTitle, resumeSessionId])

  const startMut = useMutation({
    mutationFn: (id: number) => startPageSession({
      data: {
        formId: id,
        clientToken: sessionClientToken,
        emailSurveyToken: emailSurvey?.token,
        emailSurveyRating: emailSurvey?.rating,
      },
    }),
    retry: 2,
    retryDelay: (attempt) => Math.min(750 * 2 ** attempt, 3_000),
    onSuccess: (session) => {
      setSessionId(session.id)
      if (session.collectedData && typeof session.collectedData === 'object') {
        setData((current) => session.status === 'completed'
          ? session.collectedData as Record<string, unknown>
          : { ...session.collectedData, ...current })
      }
      if (typeof session.currentPageIndex === 'number') setCurrentPageIndex(session.currentPageIndex)
      if (session.status === 'completed') setCompleted(true)
      setPaymentGateMessage('')
    },
    onError: () => {
      failedSubmissionRef.current = submissionQueuedRef.current
      submissionQueuedRef.current = null
      setPaymentGateMessage('')
    },
  })
  const advanceMut = useMutation({
    mutationFn: (vars: { currentPageIndex: number; collectedData: Record<string, unknown> }) =>
      advancePageSession({ data: { sessionId: sessionId!, ...vars } }),
    onError: resetCaptchaFields,
  })
  const completeMut = useMutation({
    mutationFn: (collectedData: Record<string, unknown>) =>
      completePageSubmission({ data: { sessionId: sessionId!, collectedData } }),
    onSuccess: () => setCompleted(true),
    onError: resetCaptchaFields,
  })

  useEffect(() => {
    if (resumeQuery.data) {
      setCurrentPageIndex(resumeQuery.data.session.currentPageIndex)
      setData((resumeQuery.data.session.collectedData as Record<string, unknown>) ?? {})
      setSessionId(resumeQuery.data.session.id)
      setCompleted(resumeQuery.data.session.status === 'completed')
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

  function retrySessionInitialization() {
    if (!formId || startMut.isPending) return
    submissionQueuedRef.current = failedSubmissionRef.current
    failedSubmissionRef.current = null
    startMut.reset()
    startMut.mutate(formId)
  }

  const currentPage = pages[currentPageIndex]
  const progressPageTotal = pages.filter((page) => !page.isFinal).length
  const progressPageCurrent = pages
    .slice(0, currentPageIndex + 1)
    .filter((page) => !page.isFinal).length
  const currentPaymentPaid = currentPage?.hasPayment ? Boolean(paidPages[currentPage.id]) : true
  const handlePaymentStatusChange = useCallback((paid: boolean) => {
    const pageId = currentPage?.id
    if (!pageId) return
    setPaidPages((previous) => {
      if (previous[pageId] === paid) return previous
      return { ...previous, [pageId]: paid }
    })
    if (paid) setPaymentGateMessage('')
  }, [currentPage?.id])
  const computedData = useMemo(
    () => applyComputedFieldValues(allFields, data, references),
    [allFields, data, references],
  )
  const currentValues = computedData as Record<string, FieldValue>
  const themed = themeVars(resolvedTheme ?? null)
  const outerClass = embed
    ? 'w-full'
    : 'flex min-h-screen items-center bg-[var(--ponko-bg,#faf9f5)]'
  const wrapperClass = embed
    ? 'w-full min-w-0 px-3 py-4 sm:px-4 sm:py-6'
    : 'mx-auto w-full min-w-0 max-w-5xl px-3 py-4 sm:px-6 sm:py-10 lg:px-8 lg:py-14'

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
      } else if (startMut.isError) {
        submissionQueuedRef.current = null
      } else {
        // Session pending — queue submission to fire when session is ready
        submissionQueuedRef.current = nextData
        setPaymentGateMessage('Preparing your submission...')
      }
      return
    }
    const nextIndex = currentPageIndex + 1
    if (!preview && sessionId) {
      try {
        await advanceMut.mutateAsync({ currentPageIndex: nextIndex, collectedData: nextData })
      } catch {
        return
      }
    }
    setCurrentPageIndex(nextIndex)
  }

  function goBack() {
    setCurrentPageIndex((index) => Math.max(0, index - 1))
  }

  if (completed) {
    const completedPage = pages.find((page) => page.isFinal)
    const completedRedirectUrl = completedPage?.finalRedirectUrl
      ? interpolate(completedPage.finalRedirectUrl, { ...referenceMap, ...data })
      : null
    return (
      <div className={outerClass} style={themed}>
        <div className={wrapperClass}>
          <Card className="text-center py-16">
            <div className="mb-4 text-5xl">✓</div>
            <h1 className="text-2xl font-medium text-[#141413]">Thank you!</h1>
            <p className="mt-2 text-[#6c6a64]">Your response has been recorded.</p>
            {completedRedirectUrl && !preview && <RedirectAfterDelay url={completedRedirectUrl} />}
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
        <Card className="min-w-0 max-sm:p-4">
          <div className="mb-8">
            <h1 className="text-2xl font-medium text-[#141413]">{resolvedTitle}</h1>
            {visibleDescription && <p className="mt-2 text-[#6c6a64]">{visibleDescription}</p>}
          </div>

          {!currentPage.isFinal && (
            <PageProgressBar current={progressPageCurrent} total={progressPageTotal} />
          )}

          {!preview && !resumeSessionId && startMut.isError && (
            <div className="mb-6 flex flex-col gap-3 rounded-lg border border-[#d7a84c] bg-[#fff8e7] px-4 py-3 text-sm text-[#6b4f16] sm:flex-row sm:items-center sm:justify-between" role="alert">
              <span>
                We couldn’t initialize this submission. Your entries are still here, but they cannot be submitted until the connection is restored.
                <span className="mt-1 block text-xs opacity-80">Reference: {sessionCorrelationId}</span>
              </span>
              <Button type="button" variant="secondary" onClick={retrySessionInitialization} disabled={startMut.isPending}>
                Retry
              </Button>
            </div>
          )}

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
            </div>
          ) : currentPage.hasPayment && !preview ? (
            sessionId ? (
              <PagePaymentStep
                sessionId={sessionId}
                pageId={currentPage.id}
                onPaymentStatusChange={handlePaymentStatusChange}
              />
            ) : (
              <div className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-5 text-center" role="status">
                <p className="font-medium text-[#141413]">
                  {startMut.isError ? 'Payment is unavailable until the submission reconnects.' : 'Preparing secure payment…'}
                </p>
                {startMut.isError && (
                  <Button className="mt-4" type="button" variant="secondary" onClick={retrySessionInitialization}>
                    Retry connection
                  </Button>
                )}
              </div>
            )
          ) : (
            <div className="flex flex-col gap-6">
              {currentPage.fields.filter((field) =>
                isFieldVisible(field, computedData, referenceMap) &&
                (field.fieldType !== 'computation' || field.validationRules?.computation?.showBreakdown !== false),
              ).map((field) => field.fieldType === 'recaptcha' ? (
                <RecaptchaField
                  key={`${field.id}-${captchaEpoch}`}
                  label={field.label}
                  required={field.required}
                  siteKey={recaptchaSiteKey}
                  preview={preview}
                  onChange={(value) => updateValue(field, value)}
                  error={errors[field.bindVariable]}
                />
              ) : (
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

          {(advanceMut.isError || completeMut.isError) && (
            <p className="mt-4 text-sm text-[#c64545]" role="alert">
              {((advanceMut.error ?? completeMut.error) as Error)?.message ?? 'Submission failed. Please try again.'}
            </p>
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
              disabled={
                completeMut.isPending ||
                (!preview && currentPage.hasPayment && !currentPaymentPaid) ||
                (!preview && currentPageIndex >= pages.length - 1 && startMut.isError)
              }
            >
              {currentPageIndex >= pages.length - 1
                ? completeMut.isPending
                  ? 'Submitting...'
                  : !preview && startMut.isError
                    ? 'Session unavailable'
                    : !preview && !sessionId
                      ? 'Preparing...'
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
