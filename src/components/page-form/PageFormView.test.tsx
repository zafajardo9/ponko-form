// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FormPage } from '../../lib/page-builder/types'
import { PageFormView } from './PageFormView'

const serverFns = vi.hoisted(() => ({
  startPageSession: vi.fn(),
  advancePageSession: vi.fn(),
  completePageSubmission: vi.fn(),
  getPageSessionData: vi.fn(),
}))

vi.mock('../../lib/server-fns/page-forms', () => serverFns)

vi.mock('../form-builder/fields/FieldRenderer', () => ({
  FieldRenderer: ({ field, value, onChange }: {
    field: { label: string }
    value: string
    onChange: (value: string) => void
  }) => (
    <label>
      {field.label}
      <input aria-label={field.label} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  ),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const pages = [
  {
    id: 1,
    formId: 1,
    title: 'Your details',
    description: null,
    position: 0,
    isFinal: false,
    finalTemplate: null,
    finalRedirectUrl: null,
    hasPayment: false,
    paymentGatewayId: null,
    paymentAmountVariable: null,
    paymentCurrency: 'USD',
    paymentComputation: null,
    fields: [{
      id: 1,
      pageId: 1,
      fieldType: 'text',
      label: 'Name',
      placeholder: null,
      required: false,
      options: null,
      bindVariable: 'name',
      position: 0,
      width: 'full',
      validationRules: null,
      conditions: [],
    }],
  },
  {
    id: 2,
    formId: 1,
    title: 'Finish',
    description: null,
    position: 1,
    isFinal: true,
    finalTemplate: 'Ready to submit.',
    finalRedirectUrl: null,
    hasPayment: false,
    paymentGatewayId: null,
    paymentAmountVariable: null,
    paymentCurrency: 'USD',
    paymentComputation: null,
    fields: [],
  },
] as FormPage[]

function renderPageForm(testPages = pages, description?: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <PageFormView formId={1} title="Contact form" description={description} pages={testPages} />
    </QueryClientProvider>,
  )
}

function renderResumedPageForm(sessionStatus: 'in_progress' | 'completed') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  serverFns.getPageSessionData.mockResolvedValue({
    session: {
      id: 10,
      currentPageIndex: pages.length - 1,
      collectedData: { name: 'Ada' },
      status: sessionStatus,
    },
    form: { title: 'Contact form', description: null, theme: null },
    pages,
    references: [],
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <PageFormView resumeSessionId={10} />
    </QueryClientProvider>,
  )
}

describe('PageFormView session resilience', () => {
  beforeEach(() => {
    serverFns.advancePageSession.mockResolvedValue({ id: 10 })
    serverFns.completePageSubmission.mockResolvedValue({})
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders fields without a blocking status while session initialization is pending', () => {
    serverFns.startPageSession.mockReturnValue(new Promise(() => undefined))

    renderPageForm()

    expect(screen.getByRole('heading', { name: 'Contact form' })).toBeTruthy()
    expect(screen.getByLabelText('Name')).toBeTruthy()
    expect(screen.queryByText('Preparing secure submission…')).toBeNull()
  })

  it('shows the form name once when the description duplicates it', () => {
    serverFns.startPageSession.mockResolvedValue({ id: 10 })

    renderPageForm(pages, ' contact FORM ')

    expect(screen.getAllByText('Contact form')).toHaveLength(1)
  })

  it('preserves entries after failure and retries initialization', async () => {
    serverFns.startPageSession.mockRejectedValue(new Error('offline'))
    renderPageForm()
    const input = screen.getByLabelText('Name') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Ada' } })

    expect(await screen.findByRole('alert', {}, { timeout: 5_000 })).toBeTruthy()
    expect(screen.getByText(/^Reference: [a-zA-Z0-9_-]{12}$/)).toBeTruthy()
    expect(input.value).toBe('Ada')
    expect(serverFns.startPageSession).toHaveBeenCalledTimes(3)
    const clientTokens = serverFns.startPageSession.mock.calls.map(
      ([request]) => request.data.clientToken,
    )
    expect(new Set(clientTokens).size).toBe(1)

    serverFns.startPageSession.mockResolvedValue({ id: 10 })
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))

    await waitFor(() => expect(serverFns.startPageSession).toHaveBeenCalledTimes(4))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(input.value).toBe('Ada')
  })

  it('submits one queued final response when the session becomes available', async () => {
    const session = deferred<{ id: number }>()
    serverFns.startPageSession.mockReturnValue(session.promise)
    renderPageForm()

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Preparing...' }))
    session.resolve({ id: 10 })

    await waitFor(() => expect(serverFns.completePageSubmission).toHaveBeenCalledTimes(1))
    expect(serverFns.completePageSubmission).toHaveBeenCalledWith({
      data: { sessionId: 10, collectedData: { name: 'Ada' } },
    })
  })

  it('records an ordinary page form and replaces the submit screen with confirmation', async () => {
    serverFns.startPageSession.mockResolvedValue({ id: 10 })
    renderPageForm()

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Submit' }))

    expect(await screen.findByRole('heading', { name: 'Thank you!' })).toBeTruthy()
    expect(serverFns.completePageSubmission).toHaveBeenCalledWith({
      data: { sessionId: 10, collectedData: { name: 'Ada' } },
    })
    expect(screen.queryByRole('button', { name: 'Submit' })).toBeNull()
  })

  it('shows a payment preparation state until a session exists', () => {
    serverFns.startPageSession.mockReturnValue(new Promise(() => undefined))
    renderPageForm([{ ...pages[0], hasPayment: true, fields: [] }, pages[1]])

    expect(screen.getByText('Preparing secure payment…')).toBeTruthy()
  })

  it('shows only the recorded confirmation when a completed payment session resumes', async () => {
    renderResumedPageForm('completed')

    expect(await screen.findByRole('heading', { name: 'Thank you!' })).toBeTruthy()
    expect(screen.getByText('Your response has been recorded.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Submit' })).toBeNull()
  })
})
