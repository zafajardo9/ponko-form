// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PaymentLinkCard } from './PaymentLinkCard'

afterEach(cleanup)

const paymentLink = {
  id: 7,
  publicId: 'pay_once_123',
  title: 'Workshop deposit',
  description: 'Reserve one seat for the July workshop.',
  amount: 350000,
  currency: 'PHP',
  isActive: true,
  totalPayments: 4,
  totalRevenue: 1400000,
  createdAt: '2026-07-29T00:00:00.000Z',
}

describe('PaymentLinkCard', () => {
  it('presents a payment link as a one-time checkout', () => {
    render(
      <PaymentLinkCard
        link={paymentLink}
        onToggle={() => undefined}
        onDelete={() => undefined}
      />,
    )

    expect(screen.getByText('Workshop deposit')).toBeTruthy()
    expect(screen.getByText('Pay once')).toBeTruthy()
    expect(screen.getByText('Payments')).toBeTruthy()
    expect(screen.getByText('Collected')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open Workshop deposit payment page' })).toBeTruthy()
  })

  it('offers pause and delete actions from the card menu', () => {
    const onToggle = vi.fn()
    const onDelete = vi.fn()
    render(
      <PaymentLinkCard
        link={paymentLink}
        onToggle={onToggle}
        onDelete={onDelete}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Actions for Workshop deposit' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Pause link' }))
    expect(onToggle).toHaveBeenCalledWith(7, false)

    fireEvent.click(screen.getByRole('button', { name: 'Actions for Workshop deposit' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete link' }))
    expect(onDelete).toHaveBeenCalledWith(7)
  })
})
