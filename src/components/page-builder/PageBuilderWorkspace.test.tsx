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

vi.mock('liquid-gooey', () => {
  const Liquid = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>
  Liquid.Item = ({ children, x, y, transition, delay, ...props }: React.HTMLAttributes<HTMLDivElement> & { x?: number; y?: number; transition?: string; delay?: number }) => (
    <div data-x={x} data-y={y} data-transition={transition} data-delay={delay} {...props}>{children}</div>
  )
  return { Liquid }
})

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
    finalContactEmail: null,
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

  it('configures a content block to appear when a choice option is selected', () => {
    const conditionalPages: FormPage[] = [{
      ...pages[0],
      fields: [
        {
          id: 21,
          pageId: 1,
          fieldType: 'radio',
          label: 'Service type',
          placeholder: null,
          required: true,
          options: [
            { label: 'Individual', value: 'individual' },
            { label: 'Business', value: 'business' },
          ],
          bindVariable: 'service_type',
          position: 0,
          width: 'full',
          validationRules: null,
          conditions: [],
        },
        {
          id: 22,
          pageId: 1,
          fieldType: 'content',
          label: 'Business instructions',
          placeholder: '<p>Bring your business documents.</p>',
          required: false,
          options: null,
          bindVariable: 'business_instructions',
          position: 1,
          width: 'full',
          validationRules: null,
          conditions: [],
        },
      ],
    }]
    renderBuilder(conditionalPages)

    const contentCardButton = screen.getByText('Business instructions').closest('button')
    expect(contentCardButton).toBeTruthy()
    fireEvent.click(contentCardButton!)
    fireEvent.click(screen.getByRole('button', { name: /Conditional visibility/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Add Rule' }))

    const matchMode = screen.getByLabelText('Match multiple rules') as HTMLSelectElement
    expect(matchMode.value).toBe('all')
    fireEvent.change(matchMode, { target: { value: 'any' } })
    expect(matchMode.value).toBe('any')
    expect((screen.getByLabelText('When field') as HTMLSelectElement).value).toBe('service_type')
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'business' } })
    expect(screen.getByRole('option', { name: 'Show block' })).toBeTruthy()

    expect(screen.getByText('1 logic rule')).toBeTruthy()
  })

  it('adds a palette field when it is dragged onto the canvas', () => {
    renderBuilder()

    const stored = new Map<string, string>()
    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: (type: string, value: string) => stored.set(type, value),
      getData: (type: string) => stored.get(type) ?? '',
    }
    const shortText = screen.getByRole('button', { name: 'Short text' })
    const canvas = screen.getByTestId('field-drop-canvas')

    fireEvent.dragStart(shortText, { dataTransfer })
    expect(screen.getByText('Drop to add Short text')).toBeTruthy()
    fireEvent.dragEnter(canvas, { dataTransfer })
    fireEvent.dragOver(canvas, { dataTransfer })
    expect(canvas.className).toContain('bg-[#f8ede7]')
    fireEvent.drop(canvas, { dataTransfer })

    expect(screen.getByRole('button', { name: /Untitled field.*Short text.*Editing/ })).toBeTruthy()
    expect(screen.queryByText('Drop to add Short text')).toBeNull()
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

  it('highlights conditional logic and validation as badges on field cards', () => {
    renderBuilder([{
      ...pages[0],
      fields: [{
        ...pages[0].fields[0],
        validationRules: { minLength: 2 },
        conditions: [{
          id: 91,
          fieldId: pages[0].fields[0].id,
          sourceFieldBinding: 'customer_type',
          operator: 'equals',
          value: 'business',
          action: 'show',
        }],
      }],
    }])

    const logicBadge = screen.getByText('1 logic rule')
    const validationBadge = screen.getByText('Validation rules')
    expect(logicBadge.className).toContain('rounded-full')
    expect(logicBadge.className).toContain('bg-[#f4eff9]')
    expect(validationBadge.className).toContain('rounded-full')
    expect(validationBadge.className).toContain('bg-[#fff2ec]')
  })

  it('shows the answer variable as a neutral code badge', () => {
    renderBuilder()

    const variable = screen.getByText('{{full_name}}')
    const badge = variable.parentElement
    expect(variable.className).toContain('font-mono')
    expect(badge?.className).toContain('rounded-full')
    expect(badge?.className).toContain('bg-[#f1ede7]')
    expect(badge?.querySelector('svg')).toBeNull()
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
