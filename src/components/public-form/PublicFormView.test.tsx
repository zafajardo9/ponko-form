// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PublicFormView } from './PublicFormView'

const serverFns = vi.hoisted(() => ({
  getPublicForm: vi.fn(),
  getFields: vi.fn(),
  getFlow: vi.fn(),
  getPageForm: vi.fn(),
  submitFormResponse: vi.fn(),
}))

vi.mock('../../lib/server-fns/forms', () => ({ getPublicForm: serverFns.getPublicForm }))
vi.mock('../../lib/server-fns/fields', () => ({ getFields: serverFns.getFields }))
vi.mock('../../lib/server-fns/flows', () => ({ getFlow: serverFns.getFlow }))
vi.mock('../../lib/server-fns/page-forms', () => ({ getPageForm: serverFns.getPageForm }))
vi.mock('../../lib/server-fns/submissions', () => ({ submitFormResponse: serverFns.submitFormResponse }))
vi.mock('../flow-execution/FlowExecutionContainer', () => ({ FlowExecutionContainer: () => null }))
vi.mock('../page-form/PageFormView', () => ({ PageFormView: () => null }))

function renderPublicForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PublicFormView publicId="public-form" />
    </QueryClientProvider>,
  )
}

describe('PublicFormView recovery', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('shows a slow-server message after three seconds', async () => {
    vi.useFakeTimers()
    serverFns.getPublicForm.mockReturnValue(new Promise(() => undefined))
    renderPublicForm()

    await act(async () => undefined)
    await act(async () => vi.advanceTimersByTimeAsync(3_000))

    expect(screen.getByText(/server is taking longer than expected/i)).toBeTruthy()
  })

  it('retries a failed definition query without losing the recovery UI', async () => {
    serverFns.getPublicForm.mockRejectedValue(new Error('offline'))
    renderPublicForm()

    expect(await screen.findByRole('alert', {}, { timeout: 5_000 })).toBeTruthy()
    expect(serverFns.getPublicForm).toHaveBeenCalledTimes(3)

    serverFns.getPublicForm.mockResolvedValue(null)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => expect(serverFns.getPublicForm).toHaveBeenCalledTimes(4))
    expect(await screen.findByRole('heading', { name: 'Form not found' })).toBeTruthy()
  })
})
