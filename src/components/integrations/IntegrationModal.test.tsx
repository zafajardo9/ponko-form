// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IntegrationModal } from './IntegrationModal'

vi.mock('../../lib/server-fns/google-oauth', () => ({
  getGoogleAuthUrl: vi.fn(),
}))

describe('payment integration environments', () => {
  afterEach(cleanup)

  it('saves Xendit with an explicit live environment', () => {
    const onSave = vi.fn()
    render(
      <IntegrationModal
        provider="xendit"
        open
        onClose={() => undefined}
        onSave={onSave}
        configured={false}
      />,
    )

    const testMode = screen.getByRole('radio', { name: /test/i })
    const liveMode = screen.getByRole('radio', { name: /live/i })
    expect(testMode.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(liveMode)
    expect(screen.getByText(/live payments are enabled/i)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /save integration/i }))
    expect(onSave).toHaveBeenCalledWith('xendit', expect.objectContaining({ mode: 'live' }))
  })

  it('shows PayPal sandbox and live choices instead of boolean values', () => {
    render(
      <IntegrationModal
        provider="paypal"
        open
        onClose={() => undefined}
        onSave={() => undefined}
        configured
        meta={{ mode: 'sandbox' }}
      />,
    )

    expect(screen.getByRole('radio', { name: /test/i })).toBeTruthy()
    expect(screen.getByRole('radio', { name: /live/i })).toBeTruthy()
    expect(screen.getByText(/safe testing environment/i)).toBeTruthy()
  })

  it('does not carry a credential typed for one environment into the other', () => {
    render(
      <IntegrationModal
        provider="xendit"
        open
        onClose={() => undefined}
        onSave={() => undefined}
        configured
        meta={{ mode: 'sandbox', sandboxConfigured: 'true', liveConfigured: 'true' }}
      />,
    )

    const secretKey = screen.getByLabelText(/secret api key/i) as HTMLInputElement
    fireEvent.change(secretKey, { target: { value: 'xnd_development_new' } })
    fireEvent.click(screen.getByRole('radio', { name: /live/i }))

    expect(secretKey.value).toBe('')
    expect(secretKey.placeholder).toMatch(/saved for live/i)
  })
})
