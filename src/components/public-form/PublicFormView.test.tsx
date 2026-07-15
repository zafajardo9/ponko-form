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
  getEmailSurveyPrefill: vi.fn(),
  pageFormView: vi.fn((_props: Record<string, unknown>) => null),
}))

vi.mock('../../lib/server-fns/forms', () => ({ getPublicForm: serverFns.getPublicForm }))
vi.mock('../../lib/server-fns/fields', () => ({ getFields: serverFns.getFields }))
vi.mock('../../lib/server-fns/flows', () => ({ getFlow: serverFns.getFlow }))
vi.mock('../../lib/server-fns/page-forms', () => ({ getPageForm: serverFns.getPageForm }))
vi.mock('../../lib/server-fns/submissions', () => ({ submitFormResponse: serverFns.submitFormResponse }))
vi.mock('../../lib/server-fns/email-surveys', () => ({ getEmailSurveyPrefill: serverFns.getEmailSurveyPrefill }))
vi.mock('../flow-execution/FlowExecutionContainer', () => ({ FlowExecutionContainer: () => null }))
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

    expect(screen.getByText(/taking a little longer than usual/i)).toBeTruthy()
  })

  it('uses the form theme while its detailed definition is loading', async () => {
    serverFns.getPublicForm.mockResolvedValue({
      id: 7,
      title: 'Background Check',
      description: null,
      theme: { primaryColor: '#2563eb', backgroundColor: '#f5f3ff', radius: 'pill' },
    })
    serverFns.getFields.mockReturnValue(new Promise(() => undefined))
    serverFns.getFlow.mockReturnValue(new Promise(() => undefined))
    serverFns.getPageForm.mockReturnValue(new Promise(() => undefined))
    renderPublicForm()

    expect(await screen.findByRole('heading', { name: 'Background Check' })).toBeTruthy()
    const loadingStatus = screen.getByRole('status')
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
    serverFns.getFields.mockResolvedValue([])
    serverFns.getFlow.mockResolvedValue(null)
    serverFns.getPageForm.mockResolvedValue({ pages: [{ id: 1 }], references: [] })
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
    expect(serverFns.pageFormView.mock.calls.at(-1)?.[0].emailSurvey).toEqual({
      token: 'a'.repeat(43),
      rating: '5',
      bindVariable: 'satisfaction_score',
    })
  })

  it('shows an expired-link message instead of opening the form', async () => {
    serverFns.getPublicForm.mockResolvedValue({ id: 7, title: 'Survey', description: null, theme: null })
    serverFns.getFields.mockResolvedValue([])
    serverFns.getFlow.mockResolvedValue(null)
    serverFns.getPageForm.mockResolvedValue({ pages: [{ id: 1 }], references: [] })
    serverFns.getEmailSurveyPrefill.mockResolvedValue({ valid: false, reason: 'expired' })

    renderPublicForm({ emailSurveyToken: 'a'.repeat(43), emailSurveyRating: '5' })

    expect(await screen.findByRole('heading', { name: /feedback link has expired/i })).toBeTruthy()
    expect(serverFns.pageFormView).not.toHaveBeenCalled()
  })
})
