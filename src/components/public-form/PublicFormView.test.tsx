// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PublicFormView } from './PublicFormView'

const serverFns = vi.hoisted(() => ({
  getPublicForm: vi.fn(),
  getPublicFormRuntime: vi.fn(),
  submitFormResponse: vi.fn(),
  getEmailSurveyPrefill: vi.fn(),
  pageFormView: vi.fn((_props: Record<string, unknown>) => null),
  flowExecutionView: vi.fn((_props: Record<string, unknown>) => null),
}))

vi.mock('../../lib/server-fns/forms', () => ({
  getPublicForm: serverFns.getPublicForm,
  getPublicFormRuntime: serverFns.getPublicFormRuntime,
}))
vi.mock('../../lib/server-fns/submissions', () => ({ submitFormResponse: serverFns.submitFormResponse }))
vi.mock('../../lib/server-fns/email-surveys', () => ({ getEmailSurveyPrefill: serverFns.getEmailSurveyPrefill }))
vi.mock('../flow-execution/FlowExecutionContainer', () => ({
  FlowExecutionContainer: serverFns.flowExecutionView,
}))
vi.mock('../page-form/PageFormView', () => ({ PageFormView: serverFns.pageFormView }))

function renderPublicForm(props: { emailSurveyToken?: string; emailSurveyRating?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PublicFormView publicId="public-form" {...props} />
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

    const status = screen.getByRole('status', { name: 'Loading form' })
    expect(status.textContent).toContain('taking a little longer than usual')
    expect(status.querySelectorAll('svg')).toHaveLength(1)
    expect(status.querySelector('.animate-pulse')).toBeNull()
    expect(status.querySelector('.animate-bounce')).toBeNull()
  })

  it('keeps the simple loader visible until metadata and runtime are both ready', async () => {
    let resolveForm!: (value: {
      id: number
      title: string
      description: null
      theme: null
    }) => void
    let resolveRuntime!: (value: {
      kind: 'page'
      pages: { id: number }[]
      references: never[]
      recaptchaSiteKey: null
    }) => void
    serverFns.getPublicForm.mockReturnValue(new Promise((resolve) => {
      resolveForm = resolve
    }))
    serverFns.getPublicFormRuntime.mockReturnValue(new Promise((resolve) => {
      resolveRuntime = resolve
    }))

    renderPublicForm()
    expect(screen.getByRole('status', { name: 'Loading form' })).toBeTruthy()
    expect(serverFns.getPublicFormRuntime).not.toHaveBeenCalled()

    await act(async () => {
      resolveForm({ id: 7, title: 'Ready in stages', description: null, theme: null })
    })
    await waitFor(() => expect(serverFns.getPublicFormRuntime).toHaveBeenCalledOnce())
    expect(screen.getByRole('status', { name: 'Loading form' })).toBeTruthy()

    await act(async () => {
      resolveRuntime({
        kind: 'page',
        pages: [{ id: 1 }],
        references: [],
        recaptchaSiteKey: null,
      })
    })
    await waitFor(() => expect(serverFns.pageFormView).toHaveBeenCalledOnce())
    await waitFor(() =>
      expect(screen.queryByRole('status', { name: 'Loading form' })).toBeNull(),
    )
  })

  it('uses the form theme while its detailed definition is loading', async () => {
    serverFns.getPublicForm.mockResolvedValue({
      id: 7,
      title: 'Background Check',
      description: null,
      theme: { primaryColor: '#2563eb', backgroundColor: '#f5f3ff', radius: 'pill' },
    })
    serverFns.getPublicFormRuntime.mockReturnValue(new Promise(() => undefined))
    renderPublicForm()

    const loadingStatus = await screen.findByRole('status', { name: 'Loading form' })
    await waitFor(() =>
      expect(screen.getByRole('status', { name: 'Loading form' }).textContent)
        .toContain('Loading Background Check'),
    )
    expect(screen.queryByRole('heading', { name: 'Background Check' })).toBeNull()
    let themedAncestor: HTMLElement | null = loadingStatus
    while (themedAncestor && !themedAncestor.style.getPropertyValue('--ponko-primary')) {
      themedAncestor = themedAncestor.parentElement
    }
    expect(themedAncestor?.style.getPropertyValue('--ponko-primary')).toBe('#2563eb')
    expect(themedAncestor?.style.getPropertyValue('--ponko-bg')).toBe('#f5f3ff')
    expect(themedAncestor?.style.getPropertyValue('--ponko-radius')).toBe('9999px')
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

  it('validates an email survey token and passes the preselected rating to the page form', async () => {
    serverFns.getPublicForm.mockResolvedValue({ id: 7, title: 'Survey', description: null, theme: null })
    serverFns.getPublicFormRuntime.mockResolvedValue({
      kind: 'page',
      pages: [{ id: 1 }],
      references: [],
      recaptchaSiteKey: null,
    })
    serverFns.getEmailSurveyPrefill.mockResolvedValue({
      valid: true,
      completed: false,
      fieldId: 9,
      fieldLabel: 'Satisfaction',
      bindVariable: 'satisfaction_score',
      rating: '5',
    })

    renderPublicForm({ emailSurveyToken: 'a'.repeat(43), emailSurveyRating: '5' })

    await waitFor(() => expect(serverFns.pageFormView).toHaveBeenCalled())
    expect(serverFns.getPublicFormRuntime).toHaveBeenCalledTimes(1)
    expect(serverFns.getPublicFormRuntime).toHaveBeenCalledWith({ data: { formId: 7 } })
    expect(serverFns.pageFormView.mock.calls.at(-1)?.[0].emailSurvey).toEqual({
      token: 'a'.repeat(43),
      rating: '5',
      bindVariable: 'satisfaction_score',
    })
  })

  it('shows an expired-link message instead of opening the form', async () => {
    serverFns.getPublicForm.mockResolvedValue({ id: 7, title: 'Survey', description: null, theme: null })
    serverFns.getPublicFormRuntime.mockResolvedValue({
      kind: 'page',
      pages: [{ id: 1 }],
      references: [],
      recaptchaSiteKey: null,
    })
    serverFns.getEmailSurveyPrefill.mockResolvedValue({ valid: false, reason: 'expired' })

    renderPublicForm({ emailSurveyToken: 'a'.repeat(43), emailSurveyRating: '5' })

    expect(await screen.findByRole('heading', { name: /feedback link has expired/i })).toBeTruthy()
    expect(serverFns.pageFormView).not.toHaveBeenCalled()
  })

  it('renders a flow runtime from the consolidated definition request', async () => {
    serverFns.getPublicForm.mockResolvedValue({
      id: 7,
      title: 'Application flow',
      description: null,
      theme: null,
    })
    serverFns.getPublicFormRuntime.mockResolvedValue({
      kind: 'flow',
      flow: { flow: { id: 12 }, nodes: [], edges: [], variables: [] },
    })

    renderPublicForm()

    await waitFor(() => expect(serverFns.flowExecutionView).toHaveBeenCalled())
    expect(serverFns.flowExecutionView.mock.calls.at(-1)?.[0].flowId).toBe(12)
    expect(serverFns.getPublicFormRuntime).toHaveBeenCalledTimes(1)
  })

  it('renders legacy fields from the consolidated definition request', async () => {
    serverFns.getPublicForm.mockResolvedValue({
      id: 7,
      title: 'Legacy contact form',
      description: null,
      theme: null,
    })
    serverFns.getPublicFormRuntime.mockResolvedValue({
      kind: 'legacy',
      fields: [{
        id: 21,
        formId: 7,
        type: 'text',
        label: 'Full name',
        placeholder: null,
        required: true,
        options: null,
        order: 0,
      }],
    })

    renderPublicForm()

    expect(await screen.findByRole('textbox', { name: 'Full name' })).toBeTruthy()
    expect(serverFns.getPublicFormRuntime).toHaveBeenCalledTimes(1)
  })

  it('reuses a random idempotency token for a legacy submission', async () => {
    serverFns.getPublicForm.mockResolvedValue({
      id: 7,
      title: 'Legacy contact form',
      description: null,
      theme: null,
    })
    serverFns.getPublicFormRuntime.mockResolvedValue({
      kind: 'legacy',
      fields: [{
        id: 21,
        formId: 7,
        type: 'text',
        label: 'Full name',
        placeholder: null,
        required: true,
        options: null,
        order: 0,
      }],
    })
    serverFns.submitFormResponse.mockResolvedValue({ success: true })

    renderPublicForm()

    fireEvent.change(await screen.findByRole('textbox', { name: 'Full name' }), {
      target: { value: 'Ada' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }))

    await waitFor(() => expect(serverFns.submitFormResponse).toHaveBeenCalledOnce())
    expect(serverFns.submitFormResponse).toHaveBeenCalledWith({
      data: {
        formId: 7,
        clientToken: expect.stringMatching(/^[a-zA-Z0-9_-]{16,64}$/),
        formData: { 21: 'Ada' },
      },
    })
  })
})
