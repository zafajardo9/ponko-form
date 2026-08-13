// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BuilderAIAssistant } from './BuilderAIAssistant'
import { chatWithBuilderAI } from '../../lib/server-fns/ai-assistant'
import type { FormPage } from '../../lib/page-builder/types'

vi.mock('../../lib/server-fns/ai-assistant', () => ({ chatWithBuilderAI: vi.fn() }))

const pages: FormPage[] = [{
  id: 1,
  formId: 10,
  title: 'Contact',
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
  fields: [],
}]

function renderAssistant(mode: 'guide' | 'generate' = 'guide') {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const onApply = vi.fn()
  const onModeChange = vi.fn()
  const onClose = vi.fn()
  render(
    <QueryClientProvider client={queryClient}>
      <BuilderAIAssistant
        formId={10}
        formTitle="Contact form"
        open
        mode={mode}
        pages={pages}
        references={[]}
        onModeChange={onModeChange}
        onApply={onApply}
        onClose={onClose}
      />
    </QueryClientProvider>,
  )
  return { onApply, onModeChange, onClose }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('BuilderAIAssistant', () => {
  it('opens as a near-full-width modal with chat and the current visual preview', () => {
    renderAssistant()

    const dialog = screen.getByRole('dialog', { name: 'Ponko assistant' })
    expect(dialog.className).toContain('t-modal')
    expect(dialog.className).toContain('w-[min(98vw,1480px)]')
    expect(screen.getByRole('region', { name: 'Current form preview' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Contact' })).toBeTruthy()
  })

  it('sends guide questions with current draft context', async () => {
    vi.mocked(chatWithBuilderAI).mockResolvedValue({ kind: 'answer', message: 'Use a required Email field.' })
    renderAssistant()

    fireEvent.change(screen.getByLabelText('Ask a builder question'), { target: { value: 'How do I collect email?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(await screen.findByText('Use a required Email field.')).toBeTruthy()
    expect(chatWithBuilderAI).toHaveBeenCalledWith({ data: expect.objectContaining({
      formId: 10,
      mode: 'guide',
      draft: expect.objectContaining({
        formTitle: 'Contact form',
        pages: expect.any(Array),
        references: expect.any(Array),
      }),
    }) })
  })

  it('previews generated pages and applies only after confirmation', async () => {
    const candidate = {
      pages: [
        {
          title: 'Registration', description: null, isFinal: false, finalTemplate: null,
          fields: [{
            fieldType: 'email' as const, label: 'Email', placeholder: null, required: true,
            options: null, bindVariable: 'email', width: 'full' as const, validationRules: null,
          }],
        },
        { title: 'Thank you', description: null, isFinal: true, finalTemplate: '<p>Registered.</p>', fields: [] },
      ],
    }
    vi.mocked(chatWithBuilderAI).mockResolvedValue({ kind: 'generation', message: 'Your draft is ready.', candidate })
    const { onApply } = renderAssistant('generate')

    fireEvent.change(screen.getByLabelText('Describe or refine your form'), { target: { value: 'Create registration' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(await screen.findByRole('region', { name: 'Generated form preview' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Registration' })).toBeTruthy()
    expect(screen.getByText('Email')).toBeTruthy()
    expect(onApply).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Replace draft' }))
    expect(onApply).toHaveBeenCalledWith(candidate)
  })

  it('keeps provider-neutral errors retryable and switches modes without losing chat', async () => {
    vi.mocked(chatWithBuilderAI).mockResolvedValue({
      kind: 'error', code: 'temporarily_unavailable', message: 'The assistant could not respond right now.',
    })
    const { onModeChange } = renderAssistant()
    fireEvent.change(screen.getByLabelText('Ask a builder question'), { target: { value: 'Help' } })
    fireEvent.submit(screen.getByLabelText('Ask a builder question').closest('form')!)

    expect((await screen.findByRole('alert')).textContent).toContain('The assistant could not respond right now.')
    expect(screen.getByRole('button', { name: /Retry/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Generate Form' }))
    expect(onModeChange).toHaveBeenCalledWith('generate')
    expect(screen.getByText('Help')).toBeTruthy()
  })
})
