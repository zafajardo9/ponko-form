// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PageBuilderWorkspace } from './PageBuilderWorkspace'
import { ToastProvider } from '../ui/Toast'
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

function renderBuilder(builderPages = pages) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <PageBuilderWorkspace
          formId={10}
          pages={builderPages}
          references={[]}
          gateways={[]}
          onChanged={vi.fn()}
        />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('PageBuilderWorkspace field configuration UX', () => {
  it('searches field types and switches between list and grid views', () => {
    renderBuilder()

    expect(screen.queryByText('Choose what people will see or answer.')).toBeNull()

    const search = screen.getByRole('searchbox', { name: 'Search field types' })
    fireEvent.change(search, { target: { value: 'calculated' } })

    expect(screen.getByRole('button', { name: 'Calculated value' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Short text' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Questions' })).toBeNull()
    expect(screen.getByRole('status', { name: 'Field search results' }).textContent).toContain('1 field types found')

    const listView = screen.getByRole('button', { name: 'List view' })
    const gridView = screen.getByRole('button', { name: 'Grid view' })
    expect(listView.getAttribute('aria-pressed')).toBe('true')
    expect(gridView.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(gridView)
    expect(listView.getAttribute('aria-pressed')).toBe('false')
    expect(gridView.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Clear field search' }))
    expect((search as HTMLInputElement).value).toBe('')
    expect(screen.getByRole('button', { name: 'Short text' })).toBeTruthy()
  })

  it('offers a useful empty search state', () => {
    renderBuilder()

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search field types' }), {
      target: { value: 'does not exist' },
    })

    expect(screen.getByText('No matching fields')).toBeTruthy()
    expect(screen.getByRole('status', { name: 'Field search results' }).textContent).toContain('0 field types found')
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(screen.getByRole('region', { name: 'Questions' })).toBeTruthy()
  })

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

  it('offers a typed, responsive calculation studio with text variables and live preview', () => {
    const calculationPages: FormPage[] = [{
      ...pages[0],
      fields: [
        pages[0].fields[0],
        {
          id: 13,
          pageId: 1,
          fieldType: 'number',
          label: 'Hours',
          placeholder: null,
          required: false,
          options: null,
          bindVariable: 'hours',
          position: 1,
          width: 'full',
          validationRules: null,
          conditions: [],
        },
        {
          id: 14,
          pageId: 1,
          fieldType: 'computation',
          label: 'Customer summary',
          placeholder: null,
          required: false,
          options: null,
          bindVariable: 'customer_summary',
          position: 2,
          width: 'full',
          validationRules: {
            computation: {
              mode: 'expression',
              editorMode: 'visual',
              outputMode: 'number',
              numericType: 'automatic',
              terms: [],
              showBreakdown: true,
            },
          },
          conditions: [],
        },
      ],
    }]
    renderBuilder(calculationPages)

    fireEvent.click(screen.getByRole('button', { name: /Customer summary.*Calculated value.*Configure/ }))
    fireEvent.click(screen.getByRole('button', { name: /Open calculation studio/ }))

    const dialog = screen.getByRole('dialog', { name: 'Calculation studio' })
    expect(dialog.className).toContain('sm:max-w-6xl')
    expect(screen.getByText('What should this field produce?')).toBeTruthy()
    expect(screen.getByText('Result preview')).toBeTruthy()
    expect(screen.getAllByText('{{customer_summary}}').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('radio', { name: /Text.*Combine written answers/ }))
    expect(screen.getByRole('button', { name: /Combine text/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Formula syntax' }))

    expect(screen.getByRole('button', { name: /Full name.*full_name.*Answer/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Hours.*hours.*Number/ })).toBeTruthy()
    expect(screen.getByPlaceholderText('{{first_name}} concat " " concat {{last_name}}')).toBeTruthy()
  })
})
