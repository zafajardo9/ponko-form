// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CreatePaymentLinkDialog } from './CreatePaymentLinkDialog'

afterEach(cleanup)

describe('CreatePaymentLinkDialog accessibility', () => {
  it('associates every visible field with an accessible label', () => {
    render(
      <CreatePaymentLinkDialog
        open
        onClose={() => undefined}
        onSubmit={() => undefined}
      />,
    )

    expect(screen.getByRole('dialog', { name: 'Create payment link' })).toBeTruthy()
    expect(screen.getByLabelText('Payment title *')).toBeTruthy()
    expect(screen.getByLabelText('Description (optional)')).toBeTruthy()
    expect(screen.getByLabelText('One-time amount *')).toBeTruthy()
    expect(screen.getByLabelText('Currency')).toBeTruthy()
    expect(screen.getByLabelText('Payment provider')).toBeTruthy()
    const customAmountToggle = screen.getByLabelText(/Let the customer choose the amount/)
    expect(customAmountToggle).toBeTruthy()
    expect(screen.getByLabelText('Confirmation message (optional)')).toBeTruthy()
    expect(screen.getByLabelText('Continue to a page (optional)')).toBeTruthy()

    fireEvent.click(customAmountToggle)
    expect(screen.getByLabelText('Minimum (optional)')).toBeTruthy()
    expect(screen.getByLabelText('Maximum (optional)')).toBeTruthy()
  })

  it('closes when Escape is pressed', () => {
    const onClose = vi.fn()
    render(
      <CreatePaymentLinkDialog
        open
        onClose={onClose}
        onSubmit={() => undefined}
      />,
    )

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Create payment link' }), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })
})
