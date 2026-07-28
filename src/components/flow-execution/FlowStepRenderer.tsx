import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { FlowStep, StepInput } from '../../lib/flow-engine/FlowEngine'
import type { GroupedField } from '../../lib/flow-engine/types'
import { FieldRenderer, type FieldConfig, type FieldOption, type FieldValue } from '../form-builder/fields/FieldRenderer'
import { Button, navigationBackIconClass } from '../ui/Button'
import { FlowProgressBar } from './FlowProgressBar'
import { GroupStepView } from './GroupStepView'
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
  executionClientToken: string
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
  executionClientToken,
  stepNumber,
  totalSteps,
  canGoBack,
  onNext,
  onBack,
}: FlowStepRendererProps) {
  const config = step.config as Record<string, unknown>
  const [value, setValue] = useState<FieldValue>('')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    setValue('')
    setError('')
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
          <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--ponko-primary,#cc785c)]" />
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
        <PaymentStep
          executionId={executionId}
          clientToken={executionClientToken}
          amount={amount}
          currency={(config.currency as string) ?? 'USD'}
        />
        {canGoBack && (
          <Button variant="navigation" size="sm" onClick={onBack}>
            <ArrowLeft size={14} className={navigationBackIconClass} />
            Back
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
      options: config.options as FieldOption[] | undefined,
    }

    function submit() {
      const empty = Array.isArray(value)
        ? value.length === 0
        : value && typeof value === 'object'
          ? Object.values(value).every((item) => !String(item ?? '').trim())
          : String(value).trim() === ''
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

    return (
      <div className="flex flex-col gap-6">
        {progress}
        <GroupStepView
          key={step.nodeId}
          title={title}
          fields={fields}
          canGoBack={canGoBack}
          onBack={onBack}
          onSubmit={(groupValues) => onNext({ groupValues })}
        />
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
              className={`flex cursor-pointer items-center gap-3 rounded-[var(--ponko-radius,8px)] border px-3 py-2.5 transition-colors ${
                value === b.value
                  ? 'border-[var(--ponko-primary,#cc785c)] bg-[var(--ponko-primary-soft,#cc785c29)]'
                  : 'border-[#e6dfd8] hover:bg-[#faf9f5]'
              }`}
            >
              <input
                type="radio"
                name="decision"
                checked={value === b.value}
                onChange={() => setValue(b.value)}
                className="h-4 w-4 accent-[var(--ponko-primary,#cc785c)]"
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
        <Button variant="navigation" size="sm" onClick={onBack}>
          <ArrowLeft size={14} className={navigationBackIconClass} />
          Back
        </Button>
      ) : (
        <span />
      )}
      <Button onClick={onNext}>{nextLabel}</Button>
    </div>
  )
}
