// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FormPage, PageField } from '../../lib/page-builder/types'
import { PageSettings } from './PageSettings'

const paymentPage: FormPage = {
  id: 1,
  formId: 10,
  title: 'Payment',
  description: null,
  position: 0,
  isFinal: false,
  finalTemplate: null,
  finalRedirectUrl: null,
  finalContactEmail: null,
  hasPayment: true,
  paymentGatewayId: null,
  paymentAmountVariable: null,
  paymentCurrency: 'USD',
  paymentComputation: null,
  subscriptionConfig: null,
  fields: [],
}

describe('PageSettings payment currency', () => {
  afterEach(cleanup)

  it('lists supported currencies with readable names', () => {
    const onUpdate = vi.fn()
    render(
      <PageSettings
        page={paymentPage}
        gateways={[]}
        pages={[paymentPage]}
        references={[]}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />,
    )

    const currency = screen.getByLabelText(/Currency/) as HTMLSelectElement
    expect(currency.value).toBe('USD')
    expect(screen.getByRole('option', { name: 'PHP — Philippine peso' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'EUR — Euro' })).toBeTruthy()

    fireEvent.change(currency, { target: { value: 'PHP' } })
    expect(onUpdate).toHaveBeenCalledWith({ paymentCurrency: 'PHP' })
  })

  it('keeps a legacy saved currency visible', () => {
    render(
      <PageSettings
        page={{ ...paymentPage, paymentCurrency: 'JPY' }}
        gateways={[]}
        pages={[{ ...paymentPage, paymentCurrency: 'JPY' }]}
        references={[]}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect((screen.getByLabelText(/Currency/) as HTMLSelectElement).value).toBe('JPY')
    expect(screen.getByRole('option', { name: 'JPY — Saved currency' })).toBeTruthy()
  })

  it('offers calculated values, priced choices, ratings, and references as payment amount sources', () => {
    const fields = [
      {
        id: 11,
        pageId: 1,
        fieldType: 'computation',
        label: 'Order total',
        bindVariable: 'order_total',
        validationRules: { computation: { mode: 'expression', outputMode: 'number' } },
      },
      {
        id: 12,
        pageId: 1,
        fieldType: 'radio',
        label: 'Plan',
        bindVariable: 'plan',
        validationRules: { optionPricesEnabled: true },
        options: [{ label: 'Premium', value: 'premium', price: 500 }],
      },
      {
        id: 13,
        pageId: 1,
        fieldType: 'satisfaction',
        label: 'Rating amount',
        bindVariable: 'rating_amount',
        options: [{ label: 'Five', value: '5' }],
      },
    ].map((field, position) => ({
      placeholder: null,
      required: false,
      position,
      width: 'full' as const,
      conditions: [],
      options: null,
      validationRules: null,
      ...field,
    })) as PageField[]
    const page = {
      ...paymentPage,
      fields,
      paymentComputation: { mode: 'field' as const, fieldBindings: ['order_total'] },
      paymentAmountVariable: 'order_total',
    }

    render(
      <PageSettings
        page={page}
        gateways={[]}
        pages={[page]}
        references={[{
          id: 21,
          formId: 10,
          key: 'deposit_amount',
          type: 'number',
          value: '750',
          label: 'Deposit amount',
          description: null,
          position: 0,
        }]}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    expect(screen.getByRole('option', { name: /Order total.*Calculated/ })).toBeTruthy()
    expect(screen.getByRole('option', { name: /Plan.*Selected option prices/ })).toBeTruthy()
    expect(screen.getByRole('option', { name: /Rating amount.*Rating/ })).toBeTruthy()
    expect(screen.getByRole('option', { name: /Deposit amount.*750/ })).toBeTruthy()
  })

  it('lets the creator choose fields to display as receipt details', () => {
    const answerField = {
      id: 31,
      pageId: 2,
      fieldType: 'radio' as const,
      label: 'Selected package',
      placeholder: null,
      required: true,
      options: [{ label: 'Premium', value: 'premium' }],
      bindVariable: 'selected_package',
      position: 0,
      width: 'full' as const,
      validationRules: null,
      conditions: [],
    }
    const answerPage = { ...paymentPage, id: 2, position: 0, hasPayment: false, fields: [answerField] }
    const page = {
      ...paymentPage,
      id: 3,
      position: 1,
      paymentComputation: {
        mode: 'fixed' as const,
        fixedAmount: 500,
        showBreakdown: true,
        receiptFieldBindings: ['selected_package'],
      },
    }

    render(
      <PageSettings
        page={page}
        gateways={[]}
        pages={[answerPage, page]}
        references={[]}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    )

    const receiptField = screen.getByRole('checkbox', { name: 'Selected package' }) as HTMLInputElement
    expect(receiptField.checked).toBe(true)
    expect(screen.getByText('Show on receipt')).toBeTruthy()
  })
})
