import { useMemo, useRef, useState } from 'react'
import { FlowEngine, type StepInput } from '../../lib/flow-engine/FlowEngine'
import type { FlowNode, FlowEdge, FlowVariable } from '../../lib/flow-engine/types'
import { FieldRenderer, type FieldConfig } from '../form-builder/fields/FieldRenderer'
import { FlowProgressBar } from '../flow-execution/FlowProgressBar'
import { PaymentStep } from '../flow-execution/PaymentStep'
import { Button } from './Button'

/**
 * FlowPreviewModal
 *
 * End-user preview of a flow — runs the flow engine inside the preview dialog,
 * stepping through each node as a form step, calculator, decision, or payment.
 * Payments are simulated. No server persistence.
 */
interface FlowPreviewModalProps {
  nodes: FlowNode[]
  edges: FlowEdge[]
  variables: FlowVariable[]
}

export function FlowPreviewModal({ nodes, edges, variables }: FlowPreviewModalProps) {
  const engineRef = useRef<FlowEngine | null>(null)
  const [, force] = useState(0)
  const [fieldValue, setFieldValue] = useState<string | string[]>('')
  const [decisionValue, setDecisionValue] = useState<string>('')
  const [fieldError, setFieldError] = useState('')

  const [resetKey, setResetKey] = useState(0)

  useMemo(() => {
    try {
      engineRef.current = new FlowEngine(nodes, edges, variables)
    } catch {
      engineRef.current = null
    }
    setFieldValue('')
    setDecisionValue('')
    setFieldError('')
  }, [nodes, edges, variables, resetKey])

  const engine = engineRef.current

  if (!engine) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-sm text-[#c64545]">This flow has no Start node yet.</p>
      </div>
    )
  }

  const step = engine.getCurrentStep()
  const values = engine.getVariableValues()
  const complete = engine.isComplete()
  const config = step.config as Record<string, unknown>

  function next(input?: StepInput) {
    setFieldError('')
    engine!.advance(input)
    setFieldValue('')
    setDecisionValue('')
    force((n) => n + 1)
  }

  function handleBack() {
    if (engine!.goBack()) {
      setFieldValue('')
      setDecisionValue('')
      setFieldError('')
      force((n) => n + 1)
    }
  }

  // ── Terminal: summary ──
  if (complete && step.nodeType === 'summary') {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#d8f0e0] text-3xl text-[#2f7d52]">✓</div>
        <h2 className="text-xl font-medium text-[#141413]">{(config.title as string) ?? 'All done!'}</h2>
        {step.renderedOutput && <p className="text-[#6c6a64]">{step.renderedOutput}</p>}
        <div className="mt-4 flex gap-3">
          <Button variant="secondary" size="sm" onClick={() => setResetKey((k) => k + 1)}>
            Restart preview
          </Button>
        </div>
      </div>
    )
  }

  // ── Terminal: redirect ──
  if (complete && step.nodeType === 'redirect') {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm text-[#6c6a64]">Would redirect to:</p>
        <p className="break-all text-sm font-mono text-[#141413]">{step.redirectUrl}</p>
        <div className="mt-4 flex gap-3">
          <Button variant="secondary" size="sm" onClick={() => setResetKey((k) => k + 1)}>
            Restart preview
          </Button>
        </div>
      </div>
    )
  }

  const progress = (
    <FlowProgressBar current={engine.getCurrentStepNumber()} total={engine.getTotalSteps()} />
  )

  // ── Payment ──
  if (step.isPayment) {
    const amountVar = config.amountVariable as string | undefined
    const amount = amountVar ? (values[amountVar] as number | string) ?? 0 : 0
    return (
      <div className="flex flex-col gap-6">
        {progress}
        <PaymentStep
          amount={amount}
          currency={(config.currency as string) ?? 'USD'}
          onResult={(r) => next({ paymentResult: r })}
        />
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
      const empty = Array.isArray(fieldValue) ? fieldValue.length === 0 : String(fieldValue).trim() === ''
      if (field.required && empty) {
        setFieldError('This field is required.')
        return
      }
      next({ formValue: fieldValue })
    }

    return (
      <div className="flex flex-col gap-6">
        {progress}
        <FieldRenderer field={field} value={fieldValue} onChange={setFieldValue} error={fieldError} />
        <div className="flex items-center justify-between">
          {engine.getCurrentStepNumber() > 1 ? (
            <Button variant="text-link" size="sm" onClick={handleBack}>
              ← Back
            </Button>
          ) : <span />}
          <Button onClick={submit}>Continue</Button>
        </div>
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
                decisionValue === b.value ? 'border-[#cc785c] bg-[#efe9de]' : 'border-[#e6dfd8] hover:bg-[#faf9f5]'
              }`}
            >
              <input
                type="radio"
                name="decision"
                checked={decisionValue === b.value}
                onChange={() => setDecisionValue(b.value)}
                className="h-4 w-4 accent-[#cc785c]"
              />
              <span className="text-sm text-[#141413]">{b.label}</span>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between">
          {engine.getCurrentStepNumber() > 1 ? (
            <Button variant="text-link" size="sm" onClick={handleBack}>
              ← Back
            </Button>
          ) : <span />}
          <Button onClick={() => next({ decisionValue })} disabled={!decisionValue}>
            Continue
          </Button>
        </div>
      </div>
    )
  }

  // ── Calculator ──
  if (step.nodeType === 'calculator') {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        {progress}
        <p className="text-sm text-[#6c6a64]">{step.label}</p>
        <p className="text-lg font-medium text-[#141413]">
          {config.targetVariable as string} = {config.expression as string}
        </p>
        <Button onClick={() => next()}>Continue</Button>
      </div>
    )
  }

  // ── Start or unknown — just advance ──
  return (
    <div className="flex flex-col gap-4 py-8 text-center">
      <p className="text-[#6c6a64]">{step.label}</p>
      <div className="flex justify-center">
        <Button onClick={() => next()}>Begin</Button>
      </div>
    </div>
  )
}
