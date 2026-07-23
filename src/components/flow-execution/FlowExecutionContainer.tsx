import { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { FlowEngine, type StepInput } from '../../lib/flow-engine/FlowEngine'
import type { FlowNode, FlowEdge, FlowVariable } from '../../lib/flow-engine/types'
import {
  startFlowExecution,
  advanceExecution,
  completeExecution,
} from '../../lib/server-fns/flow-executions'
import { getResumeData } from '../../lib/server-fns/payments'
import { themeVars, type FormTheme } from '../../lib/theme'
import { Card } from '../ui/Card'
import { FlowStepRenderer } from './FlowStepRenderer'
import { createPublicSessionToken } from '../../lib/public-session-access'

/**
 * FlowExecutionContainer
 *
 * Drives the end-user, step-by-step flow experience. Two entry modes:
 *
 * - Fresh start (default): create a new execution, run a client-side FlowEngine
 *   over the flow definition passed as props, render each step, persist progress,
 *   and on completion record the submission.
 *
 * - Resume (after a payment redirect): given an existing executionId and the
 *   payment result, fetch the persisted execution + flow definition, rebuild the
 *   engine at the payment node via FlowEngine.restore(), inject the result to
 *   advance onto the success/failure path, then continue normally.
 */
interface FlowExecutionContainerProps {
  /** Fresh-start props (omitted in resume mode — fetched via getResumeData). */
  flowId?: number
  title?: string
  description?: string | null
  nodes?: FlowNode[]
  edges?: FlowEdge[]
  variables?: FlowVariable[]
  /** Resume mode: continue an existing execution with a known payment result. */
  resume?: {
    executionId: number
    clientToken: string
    paymentResult: { success: boolean; gatewayPaymentId?: string }
  }
  /** Per-form theme (accent/background/corners). */
  theme?: FormTheme | null
  /** Embedded mode — transparent background to blend into the host site. */
  embed?: boolean
}

export function FlowExecutionContainer({
  flowId,
  title,
  description,
  nodes,
  edges,
  variables,
  resume,
  theme,
  embed = false,
}: FlowExecutionContainerProps) {
  const navigate = useNavigate()
  const engineRef = useRef<FlowEngine | null>(null)
  const executionIdRef = useRef<number | null>(null)
  const startedRef = useRef(false)
  const completedRef = useRef(false)
  const [executionClientToken] = useState(
    () => resume?.clientToken ?? createPublicSessionToken(),
  )
  const [ready, setReady] = useState(false)
  // Bumps on every navigation; `tick` re-keys the step wrapper (replaying the
  // transition) and `dir` picks the forward/back animation.
  const [nav, setNav] = useState<{ tick: number; dir: 'forward' | 'back' }>({
    tick: 0,
    dir: 'forward',
  })
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<{ title: string; description?: string | null }>({
    title: title ?? 'Form',
    description,
  })
  // In resume mode the theme is fetched (getResumeData); fresh-start gets it via prop.
  const [themeState, setThemeState] = useState<FormTheme | null>(theme ?? null)
  const themed = themeVars(themeState)
  const outerClass = embed
    ? 'w-full'
    : 'flex min-h-screen items-center bg-[var(--ponko-bg,#faf9f5)]'

  const startMut = useMutation({
    mutationFn: (id: number) =>
      startFlowExecution({
        data: { flowId: id, clientToken: executionClientToken },
      }),
  })
  const advanceMut = useMutation({
    mutationFn: (vars: {
      executionId: number
      currentNodeId: number
      variables: Record<string, unknown>
      history: any[]
      status?: any
    }) =>
      advanceExecution({
        data: { ...vars, clientToken: executionClientToken },
      }),
  })
  const completeMut = useMutation({
    mutationFn: (vars: { executionId: number; variables: Record<string, unknown>; history: any[] }) =>
      completeExecution({
        data: { ...vars, clientToken: executionClientToken },
      }),
  })

  // Initialise once: either start a new run or resume an existing one.
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    ;(async () => {
      try {
        if (resume) {
          const data = await getResumeData({
            data: {
              executionId: resume.executionId,
              clientToken: executionClientToken,
            },
          })
          executionIdRef.current = data.execution.id
          setMeta({ title: data.title, description: data.description })
          setThemeState((data.theme ?? null) as FormTheme | null)
          const engine = FlowEngine.restore(data.nodes, data.edges, data.variables, {
            currentNodeId: data.execution.currentNodeId!,
            variables: (data.execution.variables as Record<string, unknown>) ?? {},
            history: (data.execution.history as any[]) ?? [],
            completed: false,
          })
          // Apply the payment outcome to move onto the success/failure path.
          engine.advance({ paymentResult: resume.paymentResult })
          engineRef.current = engine
        } else {
          if (!flowId || !nodes || !edges || !variables) {
            throw new Error('Missing flow definition')
          }
          const execution = await startMut.mutateAsync(flowId)
          executionIdRef.current = execution.id
          const engine = new FlowEngine(nodes, edges, variables, execution.variables ?? {})
          engine.advance() // move past Start to the first interactive step
          engineRef.current = engine
        }
        persist()
        maybeComplete()
        setReady(true)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load the form.')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function persist() {
    const engine = engineRef.current
    const id = executionIdRef.current
    if (!engine || id == null) return
    const snap = engine.getSnapshot()
    advanceMut.mutate({
      executionId: id,
      currentNodeId: snap.currentNodeId,
      variables: snap.variables,
      history: snap.history,
      status: snap.status,
    })
  }

  function maybeComplete() {
    const engine = engineRef.current
    const id = executionIdRef.current
    if (!engine || id == null || completedRef.current) return
    if (!engine.isComplete()) return
    completedRef.current = true
    const snap = engine.getSnapshot()
    const step = engine.getCurrentStep()

    completeMut.mutateAsync({ executionId: id, variables: snap.variables, history: snap.history }).then(
      () => {
        if (step.nodeType === 'redirect' && step.redirectUrl) {
          // Redirect nodes navigate to their constructed URL after a brief pause.
          setTimeout(() => {
            window.location.href = step.redirectUrl!
          }, 1500)
        } else {
          // Otherwise show the dedicated completion / receipt page.
          navigate({
            to: '/flow/$executionId/complete',
            params: { executionId: String(id) },
            search: { executionClientToken },
          })
        }
      },
    )
  }

  function handleNext(input?: StepInput) {
    const engine = engineRef.current
    if (!engine) return
    engine.advance(input)
    persist()
    maybeComplete()
    setNav((s) => ({ tick: s.tick + 1, dir: 'forward' }))
  }

  function handleBack() {
    const engine = engineRef.current
    if (!engine) return
    if (engine.goBack()) setNav((s) => ({ tick: s.tick + 1, dir: 'back' }))
  }

  if (error) {
    return (
      <div className={outerClass} style={themed}>
        <div className="mx-auto w-full max-w-5xl px-6 py-24 text-center">
          <h1 className="text-2xl font-medium text-[#141413]">Something went wrong</h1>
          <p className="mt-2 text-[#6c6a64]">{error}</p>
        </div>
      </div>
    )
  }

  if (!ready || !engineRef.current) {
    return (
      <div className={outerClass} style={themed}>
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8 lg:py-14">
          <div className="h-64 animate-pulse rounded-xl bg-[#efe9de]" />
        </div>
      </div>
    )
  }

  const engine = engineRef.current
  const step = engine.getCurrentStep()

  return (
    <div className={outerClass} style={themed}>
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8 lg:py-14">
      <Card>
        <div className="mb-8">
          <h1 className="text-2xl font-medium text-[#141413]">{meta.title}</h1>
          {meta.description && <p className="mt-2 text-[#6c6a64]">{meta.description}</p>}
        </div>

        {/* Re-key per navigation so the step transition replays. Embedded forms
            skip the animation to stay calm inside a host page. */}
        <div
          key={embed ? undefined : nav.tick}
          className={embed ? undefined : `ponko-step-${nav.dir}`}
        >
          <FlowStepRenderer
            step={step}
            values={engine.getVariableValues()}
            complete={engine.isComplete()}
            executionId={executionIdRef.current}
            executionClientToken={executionClientToken}
            stepNumber={engine.getCurrentStepNumber()}
            totalSteps={engine.getTotalSteps()}
            canGoBack={engine.getCurrentStepNumber() > 1 && !engine.isComplete()}
            onNext={handleNext}
            onBack={handleBack}
          />
        </div>
      </Card>
      </div>
    </div>
  )
}
