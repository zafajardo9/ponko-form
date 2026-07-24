// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PageBuilderWorkspace } from './PageBuilderWorkspace'
import type { FormPage } from '../../lib/page-builder/types'

vi.mock('../../lib/server-fns/page-forms', () => ({
  savePageForm: vi.fn(),
}))

afterEach(() => {
  cleanup()
})

const pages: FormPage[] = [
  {
    id: 1,
    formId: 10,
    title: 'Contact details',
    description: null,
    position: 0,
    isFinal: false,
    finalTemplate: null,
    finalRedirectUrl: null,
    hasPayment: false,
    paymentGatewayId: null,
    paymentAmountVariable: null,
    paymentCurrency: 'PHP',
    paymentComputation: null,
    subscriptionConfig: null,
    fields: [
      {
        id: 11,
        pageId: 1,
        fieldType: 'text',
        label: 'Full name',
        placeholder: null,
        required: true,
        options: null,
        bindVariable: 'full_name',
        position: 0,
        width: 'full',
        validationRules: null,
        conditions: [],
      },
      {
        id: 12,
        pageId: 1,
        fieldType: 'recaptcha',
        label: '',
        placeholder: null,
        required: true,
        options: null,
        bindVariable: 'recaptcha',
        position: 1,
        width: 'full',
        validationRules: null,
        conditions: [],
      },
    ],
  },
]

function renderBuilder() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <PageBuilderWorkspace
        formId={10}
        pages={pages}
        references={[]}
        gateways={[]}
        onChanged={vi.fn()}
      />
    </QueryClientProvider>,
  )
}

describe('PageBuilderWorkspace field configuration UX', () => {
  it('groups field types and explains the configuration workflow', () => {
    renderBuilder()

    expect(screen.getByRole('region', { name: 'Questions' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Choices' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Advanced' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Full name.*Short text.*Configure/ }))

    expect(screen.getByRole('heading', { name: 'What people see' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Placement' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Answer behavior' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Data and logic' })).toBeTruthy()
    expect((screen.getByLabelText(/Answer variable/) as HTMLInputElement).value).toBe('full_name')
    expect(screen.queryByLabelText('Accepted files')).toBeNull()
  })

  it('hides answer storage and validation controls for spam protection', () => {
    renderBuilder()

    fireEvent.click(screen.getByRole('button', { name: /Untitled field.*Spam protection.*Configure/ }))

    expect(screen.getByRole('heading', { level: 4, name: 'Spam protection' })).toBeTruthy()
    expect(screen.queryByLabelText(/Answer variable/)).toBeNull()
    expect(screen.queryByRole('button', { name: /Validation rules/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Conditional visibility/ })).toBeTruthy()
  })
})
