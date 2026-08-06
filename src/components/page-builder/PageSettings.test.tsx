// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FormPage } from '../../lib/page-builder/types'
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
})
