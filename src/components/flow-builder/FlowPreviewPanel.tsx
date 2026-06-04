import { useMemo, useRef, useState } from 'react'
import { FlowEngine, type FlowStep, type StepInput } from '../../lib/flow-engine/FlowEngine'
import type { FlowNode, FlowEdge, FlowVariable, GroupedField } from '../../lib/flow-engine/types'
import { Button } from '../ui/Button'
import { textInputClass } from './config-forms/controls'

/**
 * FlowPreviewPanel
 *
 * Test-runs the flow client-side using FlowEngine — no server calls. Steps
 * through nodes, lets the creator enter values and make decisions, simulates
 * payments, and shows a live variable inspector. Replaces the config panel.
 */
interface FlowPreviewPanelProps {
  nodes: FlowNode[]
  edges: FlowEdge[]
  variables: FlowVariable[]
  onClose: () => void
}

export function FlowPreviewPanel({ nodes, edges, variables, onClose }: FlowPreviewPanelProps) {
  const engineRef = useRef<FlowEngine | null>(null)
  const [, force] = useState(0)
  const [input, setInput] = useState<string>('')
  const [groupInput, setGroupInput] = useState<Record<string, string>>({})

  // (Re)create the engine. Memo on the data identity; reset bumps a key.
  const [resetKey, setResetKey] = useState(0)
  useMemo(() => {
    try {
      engineRef.current = new FlowEngine(nodes, edges, variables)
    } catch {
      engineRef.current = null
    }
    setInput('')
    setGroupInput({})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, variables, resetKey])

  const engine = engineRef.current
  if (!engine) {
    return (
      <PanelFrame onClose={onClose}>
        <p className="text-sm text-[#c64545]">
          Can't preview — the flow has no Start node yet.
        </p>
      </PanelFrame>
    )
  }

  const step = engine.getCurrentStep()
  const values = engine.getVariableValues()
  const complete = engine.isComplete()

  function next(stepInput?: StepInput) {
    engine!.advance(stepInput)
    setInput('')
    setGroupInput({})
    force((n) => n + 1)
  }

  function back() {
    if (engine!.goBack()) {
      setInput('')
      setGroupInput({})
      force((n) => n + 1)
    }
  }

  return (
    <PanelFrame onClose={onClose}>
      <div className="flex items-center justify-between">
        <span className="rounded bg-[#f7ecd0] px-1.5 py-0.5 text-[11px] font-medium text-[#9e7424]">
          TEST MODE
        </span>
        <span className="text-xs text-[#8e8b82]">
          Step {engine.getCurrentStepNumber()} of {engine.getTotalSteps()}
        </span>
      </div>

      <StepBody
        step={step}
        complete={complete}
        input={input}
        setInput={setInput}
        groupInput={groupInput}
        setGroupInput={setGroupInput}
        onNext={next}
      />

      {!complete && step.nodeType !== 'start' && (
        <p className="text-xs text-[#8e8b82]">
          {step.expectsInput ? 'Enter a value and continue.' : 'Continue to the next step.'}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={back} disabled={engine.getCurrentStepNumber() <= 1}>
          Back
        </Button>
        {!complete && !step.isPayment && (
          <Button
            size="sm"
            onClick={() =>
              next(
                step.nodeType === 'form_field'
                  ? { formValue: input }
                  : step.nodeType === 'decision'
                    ? { decisionValue: input }
                    : step.nodeType === 'group'
                      ? { groupValues: groupInput }
                      : undefined,
              )
            }
            disabled={step.expectsInput && step.nodeType !== 'group' && !input}
          >
            {step.nodeType === 'start' ? 'Start' : 'Next'}
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={() => setResetKey((k) => k + 1)}>
          Reset
        </Button>
      </div>

      {/* Variable inspector */}
      <div className="mt-2 border-t border-[#e6dfd8] pt-3">
        <p className="text-xs font-medium uppercase tracking-wider text-[#8e8b82]">Variables</p>
        <div className="mt-2 flex flex-col gap-1">
          {variables.length === 0 && <span className="text-xs text-[#8e8b82]">None declared.</span>}
          {variables.map((v) => (
            <div key={v.id} className="flex items-center justify-between text-xs">
              <span className="text-[#57544d]">{v.name}</span>
              <span className="font-mono text-[#141413]">
                {values[v.name] === undefined ? '—' : String(values[v.name])}
              </span>
            </div>
          ))}
        </div>
      </div>
    </PanelFrame>
  )
}

function PanelFrame({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <aside className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-[#8e8b82]">Preview</p>
        <button onClick={onClose} className="text-sm text-[#8e8b82] hover:text-[#141413]">
          ✕
        </button>
      </div>
      {children}
    </aside>
  )
}

function StepBody({
  step,
  complete,
  input,
  setInput,
  groupInput,
  setGroupInput,
  onNext,
}: {
  step: FlowStep
  complete: boolean
  input: string
  setInput: (v: string) => void
  groupInput: Record<string, string>
  setGroupInput: (v: Record<string, string>) => void
  onNext: (i?: StepInput) => void
}) {
  const config = step.config as Record<string, unknown>

  if (complete && step.nodeType === 'summary') {
    return (
      <div className="rounded-lg border border-[#e6dfd8] bg-white p-3">
        <p className="text-sm font-medium text-[#141413]">{(config.title as string) ?? 'Summary'}</p>
        <p className="mt-1 text-sm text-[#57544d]">{step.renderedOutput}</p>
      </div>
    )
  }
  if (complete && step.nodeType === 'redirect') {
    return (
      <div className="rounded-lg border border-[#e6dfd8] bg-white p-3 text-sm text-[#57544d]">
        Would redirect to: <span className="break-all font-mono text-[#141413]">{step.redirectUrl}</span>
      </div>
    )
  }
  if (complete) {
    return <p className="text-sm text-[#2f7d52]">Flow complete.</p>
  }

  if (step.nodeType === 'start') {
    return <p className="text-sm text-[#57544d]">Ready to start the flow.</p>
  }

  if (step.nodeType === 'form_field') {
    const label = (config.label as string) ?? 'Field'
    const fieldType = (config.fieldType as string) ?? 'text'
    const options = (config.options as { label: string; value: string }[] | undefined) ?? []
    return (
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-[#141413]">{label}</label>
        {fieldType === 'textarea' ? (
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="rounded-md border border-[#e6dfd8] bg-[#faf9f5] px-3 py-2 text-sm"
            rows={3}
          />
        ) : ['select', 'radio'].includes(fieldType) ? (
          <div className="flex flex-col gap-1.5">
            {options.map((o) => (
              <label key={o.value} className="flex items-center gap-2 text-sm text-[#141413]">
                <input
                  type="radio"
                  name="preview-field"
                  checked={input === o.value}
                  onChange={() => setInput(o.value)}
                  className="accent-[#cc785c]"
                />
                {o.label}
              </label>
            ))}
          </div>
        ) : (
          <input
            type={fieldType === 'number' ? 'number' : fieldType === 'email' ? 'email' : 'text'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className={textInputClass}
          />
        )}
      </div>
    )
  }

  if (step.nodeType === 'group') {
    const title = (config.title as string) || step.label
    const fields = (config.fields as GroupedField[] | undefined) ?? []
    return (
      <div className="flex flex-col gap-3">
        {title && <p className="text-sm font-medium text-[#141413]">{title}</p>}
        {fields.length === 0 && <p className="text-xs text-[#8e8b82]">No fields in this group yet.</p>}
        {fields.map((f) => {
          const options = f.options ?? []
          const val = groupInput[f.id] ?? ''
          return (
            <div key={f.id} className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#141413]">{f.label}</label>
              {f.fieldType === 'textarea' ? (
                <textarea
                  value={val}
                  onChange={(e) => setGroupInput({ ...groupInput, [f.id]: e.target.value })}
                  className="rounded-md border border-[#e6dfd8] bg-[#faf9f5] px-3 py-2 text-sm"
                  rows={2}
                />
              ) : ['select', 'radio'].includes(f.fieldType) ? (
                <div className="flex flex-col gap-1.5">
                  {options.map((o) => (
                    <label key={o.value} className="flex items-center gap-2 text-sm text-[#141413]">
                      <input
                        type="radio"
                        name={`preview-group-${f.id}`}
                        checked={val === o.value}
                        onChange={() => setGroupInput({ ...groupInput, [f.id]: o.value })}
                        className="accent-[#cc785c]"
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              ) : (
                <input
                  type={f.fieldType === 'number' ? 'number' : f.fieldType === 'email' ? 'email' : 'text'}
                  value={val}
                  onChange={(e) => setGroupInput({ ...groupInput, [f.id]: e.target.value })}
                  className={textInputClass}
                />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  if (step.nodeType === 'decision') {
    const branches = (config.branches as { value: string; label: string }[] | undefined) ?? []
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-[#141413]">{step.label}</p>
        {branches.map((b) => (
          <label key={b.value} className="flex items-center gap-2 text-sm text-[#141413]">
            <input
              type="radio"
              name="preview-decision"
              checked={input === b.value}
              onChange={() => setInput(b.value)}
              className="accent-[#cc785c]"
            />
            {b.label} <span className="text-xs text-[#8e8b82]">({b.value})</span>
          </label>
        ))}
      </div>
    )
  }

  if (step.isPayment) {
    const amountVar = config.amountVariable as string | undefined
    const currency = (config.currency as string) ?? 'USD'
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-[#e6dfd8] bg-white p-3 text-sm text-[#57544d]">
          [TEST] Would charge <span className="font-medium text-[#141413]">{amountVar}</span> ({currency}).
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => onNext({ paymentResult: { success: true, gatewayPaymentId: 'TEST_REF_123' } })}
          >
            Simulate success
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onNext({ paymentResult: { success: false } })}
          >
            Simulate failure
          </Button>
        </div>
      </div>
    )
  }

  return <p className="text-sm text-[#57544d]">{step.label}</p>
}
