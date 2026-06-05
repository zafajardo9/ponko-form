import { useEffect, useState } from 'react'
import type { FlowStep, StepInput } from '../../lib/flow-engine/FlowEngine'
import type { GroupedField } from '../../lib/flow-engine/types'
import { FieldRenderer, type FieldConfig } from '../form-builder/fields/FieldRenderer'
import { Button } from '../ui/Button'
import { FlowProgressBar } from './FlowProgressBar'
import { PaymentStep } from './PaymentStep'

/**
 * FlowStepRenderer
 *
 * Renders the current step of a flow execution for the end user. It dispatches
 * on the step's nodeType and reuses the existing FieldRenderer for form fields.
 *
 * - form_field: FieldRenderer + Continue
 * - decision: radio choices + Continue
 * - payment: PaymentStep (delegates the charge)
 * - summary: interpolated template (terminal)
 * - redirect: "Redirecting…" message (terminal; container performs navigation)
 */
interface FlowStepRendererProps {
  step: FlowStep
  values: Record<string, unknown>
  complete: boolean
  /** The in-progress execution id — required by the payment step to charge. */
  executionId: number | null
  stepNumber: number
  totalSteps: number
  canGoBack: boolean
  onNext: (input?: StepInput) => void
  onBack: () => void
}

export function FlowStepRenderer({
  step,
  values,
  complete,
  executionId,
  stepNumber,
  totalSteps,
  canGoBack,
  onNext,
  onBack,
}: FlowStepRendererProps) {
  const config = step.config as Record<string, unknown>
  const [value, setValue] = useState<string | string[]>('')
  const [error, setError] = useState<string>('')
  const [groupValues, setGroupValues] = useState<Record<string, string | string[]>>({})
  const [groupErrors, setGroupErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    setValue('')
    setError('')
    setGroupValues({})
    setGroupErrors({})
  }, [step.nodeId])

  // ── Terminal: summary ──
  if (complete && step.nodeType === 'summary') {
    return (
      <div className="flex flex-col gap-5 text-center">
        <div className="text-5xl">✓</div>
        <h1 className="text-2xl font-medium text-[#141413]">{(config.title as string) ?? 'All done!'}</h1>
        {step.renderedOutput && <p className="text-[#6c6a64]">{step.renderedOutput}</p>}
      </div>
    )
  }

  // ── Terminal: redirect ──
  if (complete && step.nodeType === 'redirect') {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="flex items-center gap-1.5 text-[#8e8b82]">
          <span className="h-2 w-2 animate-bounce rounded-full bg-[#cc785c]" />
          <span className="ml-1 text-sm">Redirecting…</span>
        </div>
      </div>
    )
  }

  if (complete) {
    return (
      <div className="py-8 text-center">
        <div className="mb-3 text-4xl">✓</div>
        <p className="text-[#141413]">Thank you! Your submission is complete.</p>
      </div>
    )
  }

  const progress = <FlowProgressBar current={stepNumber} total={totalSteps} />

  // ── Payment ──
  if (step.isPayment) {
    const amountVar = config.amountVariable as string | undefined
    const amount = amountVar ? (values[amountVar] as number | string) ?? 0 : 0
    return (
      <div className="flex flex-col gap-6">
        {progress}
        <PaymentStep executionId={executionId} amount={amount} currency={(config.currency as string) ?? 'USD'} />
        {canGoBack && (
          <Button variant="text-link" size="sm" onClick={onBack}>
            ← Back
          </Button>
        )}
      </div>
    )
  }

  // ── Form field ──
  if (step.nodeType === 'form_field') {
    const field: FieldConfig = {
      id: step.nodeId,
      type: ((config.fieldType as string) ?? 'text') as FieldConfig['type'],
      label: (config.label as string) ?? step.label,
      placeholder: config.placeholder as string | undefined,
      required: Boolean(config.required),
      options: config.options as { label: string; value: string }[] | undefined,
    }

    function submit() {
      const empty = Array.isArray(value) ? value.length === 0 : String(value).trim() === ''
      if (field.required && empty) {
        setError('This field is required.')
        return
      }
      onNext({ formValue: value })
    }

    return (
      <div className="flex flex-col gap-6">
        {progress}
        <FieldRenderer field={field} value={value} onChange={setValue} error={error} />
        <StepNav onBack={onBack} canGoBack={canGoBack} onNext={submit} />
      </div>
    )
  }

  // ── Group: several fields on one step ──
  if (step.nodeType === 'group') {
    const title = (config.title as string) || step.label
    const fields = (config.fields as GroupedField[] | undefined) ?? []

    function submitGroup() {
      const errs: Record<string, string> = {}
      for (const f of fields) {
        const v = groupValues[f.id] ?? ''
        const empty = Array.isArray(v) ? v.length === 0 : String(v).trim() === ''
        if (f.required && empty) errs[f.id] = 'This field is required.'
      }
      if (Object.keys(errs).length > 0) {
        setGroupErrors(errs)
        return
      }
      onNext({ groupValues })
    }

    return (
      <div className="flex flex-col gap-6">
        {progress}
        {title && <p className="text-base font-medium text-[#141413]">{title}</p>}
        <div className="flex flex-col gap-5">
          {fields.map((f, i) => (
            <FieldRenderer
              key={f.id}
              field={{
                id: i,
                type: (f.fieldType ?? 'text') as FieldConfig['type'],
                label: f.label,
                placeholder: f.placeholder,
                required: Boolean(f.required),
                options: f.options,
              }}
              value={groupValues[f.id] ?? ''}
              onChange={(v) => {
                setGroupValues((s) => ({ ...s, [f.id]: v }))
                setGroupErrors((e) => ({ ...e, [f.id]: '' }))
              }}
              error={groupErrors[f.id]}
            />
          ))}
        </div>
        <StepNav onBack={onBack} canGoBack={canGoBack} onNext={submitGroup} />
      </div>
    )
  }

  // ── Decision ──
  if (step.nodeType === 'decision') {
    const branches = (config.branches as { value: string; label: string }[] | undefined) ?? []
    return (
      <div className="flex flex-col gap-6">
        {progress}
        <div className="flex flex-col gap-2">
          <p className="text-base font-medium text-[#141413]">{step.label}</p>
          {branches.map((b) => (
            <label
              key={b.value}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                value === b.value ? 'border-[#cc785c] bg-[#efe9de]' : 'border-[#e6dfd8] hover:bg-[#faf9f5]'
              }`}
            >
              <input
                type="radio"
                name="decision"
                checked={value === b.value}
                onChange={() => setValue(b.value)}
                className="h-4 w-4 accent-[#cc785c]"
              />
              <span className="text-sm text-[#141413]">{b.label}</span>
            </label>
          ))}
          {error && <p className="text-xs text-[#c64545]">{error}</p>}
        </div>
        <StepNav
          onBack={onBack}
          canGoBack={canGoBack}
          onNext={() => {
            if (!value) {
              setError('Please choose an option.')
              return
            }
            onNext({ decisionValue: value as string })
          }}
        />
      </div>
    )
  }

  // Fallback (start or unknown) — just advance.
  return (
    <div className="flex flex-col gap-6">
      {progress}
      <p className="text-[#6c6a64]">{step.label}</p>
      <StepNav onBack={onBack} canGoBack={canGoBack} onNext={() => onNext()} nextLabel="Begin" />
    </div>
  )
}

function StepNav({
  onBack,
  canGoBack,
  onNext,
  nextLabel = 'Continue',
}: {
  onBack: () => void
  canGoBack: boolean
  onNext: () => void
  nextLabel?: string
}) {
  return (
    <div className="flex items-center justify-between">
      {canGoBack ? (
        <Button variant="text-link" size="sm" onClick={onBack}>
          ← Back
        </Button>
      ) : (
        <span />
      )}
      <Button onClick={onNext}>{nextLabel}</Button>
    </div>
  )
}
