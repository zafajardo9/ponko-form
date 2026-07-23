// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FlowExecutionContainer } from './FlowExecutionContainer'

const serverFns = vi.hoisted(() => ({
  startFlowExecution: vi.fn(),
  advanceExecution: vi.fn(),
  completeExecution: vi.fn(),
  getResumeData: vi.fn(),
  navigate: vi.fn(),
}))

vi.mock('../../lib/server-fns/flow-executions', () => ({
  startFlowExecution: serverFns.startFlowExecution,
  advanceExecution: serverFns.advanceExecution,
  completeExecution: serverFns.completeExecution,
}))

vi.mock('../../lib/server-fns/payments', () => ({
  getResumeData: serverFns.getResumeData,
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => serverFns.navigate,
}))

vi.mock('../../lib/flow-engine/FlowEngine', () => ({
  FlowEngine: class {
    static restore() {
      return new this()
    }

    advance() {}

    getSnapshot() {
      return {
        currentNodeId: 11,
        variables: {},
        history: [],
        status: 'in_progress',
      }
    }

    isComplete() {
      return false
    }

    getCurrentStep() {
      return { nodeId: 11, nodeType: 'form_field', config: {} }
    }

    getVariableValues() {
      return {}
    }

    getCurrentStepNumber() {
      return 1
    }

    getTotalSteps() {
      return 1
    }

    goBack() {
      return false
    }
  },
}))

vi.mock('./FlowStepRenderer', () => ({
  FlowStepRenderer: () => <div>Flow ready</div>,
}))

describe('FlowExecutionContainer execution access', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('reuses one random token when starting and persisting an execution', async () => {
    serverFns.startFlowExecution.mockResolvedValue({
      id: 18,
      variables: {},
    })
    serverFns.advanceExecution.mockResolvedValue({ id: 18 })
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <FlowExecutionContainer
          flowId={7}
          title="Secure flow"
          nodes={[]}
          edges={[]}
          variables={[]}
        />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Flow ready')).toBeTruthy()
    const startRequest = serverFns.startFlowExecution.mock.calls[0][0]
    const clientToken = startRequest.data.clientToken
    expect(clientToken).toMatch(/^[a-zA-Z0-9_-]{16,64}$/)
    expect(startRequest).toEqual({
      data: { flowId: 7, clientToken },
    })
    await waitFor(() =>
      expect(serverFns.advanceExecution).toHaveBeenCalledWith({
        data: {
          executionId: 18,
          clientToken,
          currentNodeId: 11,
          variables: {},
          history: [],
          status: 'in_progress',
        },
      }),
    )
  })
})
