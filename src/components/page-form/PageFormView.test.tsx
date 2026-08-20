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
  ensurePagePaymentDraft: vi.fn(),
  getPagePaymentOptions: vi.fn(),
  initiatePagePayment: vi.fn(),
}))

const sessionClientToken = 'session-client-token-1234'

vi.mock('../../lib/server-fns/page-forms', () => serverFns)

vi.mock('../form-builder/fields/FieldRenderer', () => ({
  FieldRenderer: ({ field, value, onChange }: {
    field: { label: string; type?: string; options?: { label: string; value: string }[] }
    value: string | string[]
    onChange: (value: string | string[]) => void
  }) => field.type === 'checkbox' ? (
    <fieldset>
      <legend>{field.label}</legend>
      {(field.options ?? []).map((option) => {
        const selected = Array.isArray(value) && value.includes(option.value)
        return (
          <label key={option.value}>
            <input
              type="checkbox"
              aria-label={option.label}
              checked={selected}
              onChange={() => onChange(selected
                ? value.filter((item) => item !== option.value)
                : [...(Array.isArray(value) ? value : []), option.value])}
            />
            {option.label}
          </label>
        )
      })}
    </fieldset>
  ) : (
    <label>
      {field.label}
      <input aria-label={field.label} value={String(value)} onChange={(event) => onChange(event.target.value)} />
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
    finalContactEmail: null,
    hasPayment: false,
    paymentGatewayId: null,
    paymentAmountVariable: null,
    paymentCurrency: 'USD',
    paymentComputation: null,
    subscriptionConfig: null,
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
    finalContactEmail: null,
    hasPayment: false,
    paymentGatewayId: null,
    paymentAmountVariable: null,
    paymentCurrency: 'USD',
    paymentComputation: null,
    subscriptionConfig: null,
    fields: [],
  },
] as FormPage[]

function renderPageForm(
  testPages = pages,
  description?: string,
  emailSurvey?: { token: string; rating: string; bindVariable: string },
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <PageFormView formId={1} title="Contact form" description={description} pages={testPages} emailSurvey={emailSurvey} />
    </QueryClientProvider>,
  )
}

function renderPageFormPreview(testPages: FormPage[]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <PageFormView
        title="Membership"
        pages={testPages}
        references={[]}
        preview
      />
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
      <PageFormView
        resumeSessionId={10}
        resumeClientToken={sessionClientToken}
      />
    </QueryClientProvider>,
  )
}

describe('PageFormView session resilience', () => {
  beforeEach(() => {
    serverFns.advancePageSession.mockResolvedValue({ id: 10 })
    serverFns.completePageSubmission.mockResolvedValue({
      success: true,
      submissionId: 42,
    })
    serverFns.ensurePagePaymentDraft.mockResolvedValue({ submissionId: 1 })
    serverFns.getPagePaymentOptions.mockResolvedValue({
      amount: 25,
      currency: 'USD',
      gateways: [{ slug: 'paypal', name: 'PayPal' }],
      breakdown: [],
      showBreakdown: false,
      missingReferences: [],
      paymentStatus: null,
    })
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

  it('hides the progress bar when the form has a single page', () => {
    serverFns.startPageSession.mockReturnValue(new Promise(() => undefined))

    renderPageForm()

    expect(screen.queryByText(/^Page \d+ of \d+$/)).toBeNull()
  })

  it('shows progress across multiple pages without counting the final page', () => {
    serverFns.startPageSession.mockReturnValue(new Promise(() => undefined))
    const multiPages = [
      { ...pages[0], id: 3, position: 0, title: 'First', fields: [] },
      { ...pages[0], id: 4, position: 1, title: 'Second', fields: [] },
      pages[1],
    ] as FormPage[]

    renderPageForm(multiPages)

    expect(screen.getByText('Page 1 of 2')).toBeTruthy()
    expect(screen.queryByText('Page 1 of 3')).toBeNull()
  })

  it('shows the form name once when the description duplicates it', () => {
    serverFns.startPageSession.mockResolvedValue({ id: 10 })

    renderPageForm(pages, ' contact FORM ')

    expect(screen.getAllByText('Contact form')).toHaveLength(1)
  })

  it('shows every selected priced option and their total beneath progress', () => {
    serverFns.startPageSession.mockReturnValue(new Promise(() => undefined))
    const pricedPages = [{
      ...pages[0],
      paymentCurrency: 'PHP',
      fields: [{
        ...pages[0].fields[0],
        fieldType: 'checkbox',
        label: 'Add-ons',
        bindVariable: 'addons',
        validationRules: { optionPricesEnabled: true },
        options: [
          { label: 'Gift wrap', value: 'wrap', price: 50 },
          { label: 'Priority handling', value: 'priority', price: 100, additionalPrice: 25 },
        ],
      }],
    }, pages[1]] as FormPage[]

    renderPageForm(pricedPages)
    expect(screen.queryByLabelText('Selected options and prices')).toBeNull()

    fireEvent.click(screen.getByLabelText('Gift wrap'))
    fireEvent.click(screen.getByLabelText('Priority handling'))

    const trigger = screen.getByRole('button', { name: /2 selected options, total ₱175\.00/i })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.textContent).toContain('Total')
    expect(trigger.textContent).toContain('₱175.00')

    fireEvent.mouseEnter(trigger.parentElement!)

    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    const summary = screen.getByLabelText('Selected options and prices')
    expect(summary.getAttribute('aria-hidden')).toBe('false')
    expect(summary.textContent).toContain('Gift wrap')
    expect(summary.textContent).toContain('₱50.00')
    expect(summary.textContent).toContain('Priority handling')
    expect(summary.textContent).toContain('₱125.00')

    fireEvent.mouseLeave(trigger.parentElement!)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('omits the selected-price summary on payment pages', () => {
    const paymentPages = [
      {
        ...pages[0],
        fields: [{
          ...pages[0].fields[0],
          fieldType: 'checkbox',
          label: 'Add-ons',
          bindVariable: 'addons',
          validationRules: { optionPricesEnabled: true },
          options: [
            { label: 'Gift wrap', value: 'wrap', price: 50 },
            { label: 'Priority handling', value: 'priority', price: 100 },
          ],
        }],
      },
      {
        ...pages[1],
        isFinal: false,
        hasPayment: true,
        paymentCurrency: 'PHP',
        paymentComputation: {
          mode: 'fixed' as const,
          fixedAmount: 2500,
          showBreakdown: true,
        },
        fields: [],
      },
    ] as FormPage[]

    renderPageFormPreview(paymentPages)

    fireEvent.click(screen.getByLabelText('Gift wrap'))
    expect(screen.getByRole('button', { name: /1 selected option, total ₱50\.00/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.getByText('Amount due')).toBeTruthy()
    expect(screen.getByText('Price breakdown')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /selected option/i })).toBeNull()
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
      data: {
        sessionId: 10,
        clientToken: expect.any(String),
        collectedData: { name: 'Ada' },
      },
    })
  })

  it('records an ordinary page form and replaces the submit screen with confirmation', async () => {
    serverFns.startPageSession.mockResolvedValue({ id: 10 })
    renderPageForm()

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Review before submitting')).toBeTruthy()
    expect(screen.getByText('Not submitted yet')).toBeTruthy()
    expect(screen.queryByText('Response recorded')).toBeNull()
    expect(screen.getByText('Ada')).toBeTruthy()
    const review = screen.getByText('Review before submitting').closest('section')
    expect(review?.className).toContain('max-w-lg')
    expect(review?.querySelector('dl')?.className).toContain('max-h-44')
    expect(review?.querySelector('dl')?.className).toContain('overflow-y-auto')

    fireEvent.click(await screen.findByRole('button', { name: 'Submit response' }))

    expect(await screen.findByRole('heading', { name: 'Thank you!' })).toBeTruthy()
    expect(screen.getByText('Response recorded')).toBeTruthy()
    expect(screen.getByText('PF-000042')).toBeTruthy()
    expect(serverFns.completePageSubmission).toHaveBeenCalledWith({
      data: {
        sessionId: 10,
        clientToken: expect.any(String),
        collectedData: { name: 'Ada' },
      },
    })
    expect(screen.queryByRole('button', { name: 'Submit response' })).toBeNull()
  })

  it('starts an email survey session with its rating preselected', async () => {
    const surveyPages = [{
      ...pages[0],
      fields: [{
        ...pages[0].fields[0],
        fieldType: 'satisfaction' as const,
        label: 'Satisfaction',
        bindVariable: 'satisfaction_score',
        options: [
          { label: 'Poor', value: '1' },
          { label: 'Excellent', value: '5' },
        ],
      }],
    }, pages[1]] as FormPage[]
    serverFns.startPageSession.mockResolvedValue({
      id: 10,
      currentPageIndex: 0,
      collectedData: { satisfaction_score: '5' },
      status: 'in_progress',
    })

    renderPageForm(surveyPages, undefined, {
      token: 'a'.repeat(43),
      rating: '5',
      bindVariable: 'satisfaction_score',
    })

    expect((screen.getByLabelText('Satisfaction') as HTMLInputElement).value).toBe('5')
    await waitFor(() => expect(serverFns.startPageSession).toHaveBeenCalledWith({
      data: {
        formId: 1,
        clientToken: expect.any(String),
        emailSurveyToken: 'a'.repeat(43),
        emailSurveyRating: '5',
      },
    }))
  })

  it('uses the payment-return token when resuming a session', async () => {
    renderResumedPageForm('completed')

    await waitFor(() =>
      expect(serverFns.getPageSessionData).toHaveBeenCalledWith({
        data: {
          sessionId: 10,
          clientToken: sessionClientToken,
        },
      }),
    )
  })

  it('shows a payment preparation state until a session exists', () => {
    serverFns.startPageSession.mockReturnValue(new Promise(() => undefined))
    renderPageForm([{ ...pages[0], hasPayment: true, fields: [] }, pages[1]])

    expect(screen.getByText('Preparing secure payment…')).toBeTruthy()
  })

  it('shows the configured subscription payment in form preview', () => {
    const subscriptionPages = [
      {
        ...pages[0],
        title: 'Membership payment',
        hasPayment: true,
        paymentGatewayId: 1,
        paymentCurrency: 'PHP',
        paymentComputation: {
          mode: 'fixed' as const,
          fixedAmount: 2500,
          showBreakdown: true,
        },
        subscriptionConfig: {
          enabled: true as const,
          interval: 'monthly' as const,
          intervalUnit: 'MONTH' as const,
          intervalCount: 1,
          trialPeriodDays: 14,
          maxCycles: 12,
          customerNameField: 'name',
          customerEmailField: 'email',
        },
        fields: [],
      },
      pages[1],
    ] as FormPage[]

    renderPageFormPreview(subscriptionPages)

    expect(screen.getByText('Subscription amount')).toBeTruthy()
    expect(screen.getByText(/14-day trial/i)).toBeTruthy()
    expect(screen.getByText(/ends after 12 billing cycles/i)).toBeTruthy()
    expect(
      (
        screen.getByRole('button', {
          name: 'Subscribe with Xendit',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true)
    expect(serverFns.getPagePaymentOptions).not.toHaveBeenCalled()
  })

  it('does not loop when an unpaid payment page reports its status', async () => {
    serverFns.startPageSession.mockResolvedValue({ id: 10 })
    const paymentPages = [{ ...pages[0], hasPayment: true, fields: [] }, pages[1]]
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    renderPageForm(paymentPages)

    expect(await screen.findByText('Amount due')).toBeTruthy()
    await waitFor(() => expect(serverFns.getPagePaymentOptions).toHaveBeenCalledTimes(1))
    expect(
      consoleError.mock.calls.some((call) =>
        call.some((value) => String(value).includes('Maximum update depth exceeded')),
      ),
    ).toBe(false)
  })

  it('shows only the recorded confirmation when a completed payment session resumes', async () => {
    renderResumedPageForm('completed')

    expect(await screen.findByRole('heading', { name: 'Thank you!' })).toBeTruthy()
    expect(screen.getByText('Ready to submit.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Submit response' })).toBeNull()
  })

  it('shows the configured support email on the confirmation screen', async () => {
    serverFns.startPageSession.mockResolvedValue({ id: 10 })
    const supportPages = [
      pages[0],
      {
        ...pages[1],
        finalContactEmail: 'support@example.com',
        finalTemplate: 'Thanks {{name}} — we got your response.',
      },
    ] as FormPage[]

    renderPageForm(supportPages)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Submit response' }))

    expect(await screen.findByText('Thanks Ada — we got your response.')).toBeTruthy()
    expect(screen.getByText('Need help?')).toBeTruthy()
    const contactLink = screen.getByRole('link', { name: 'support@example.com' })
    expect((contactLink as HTMLAnchorElement).href).toBe('mailto:support@example.com')
  })
})
