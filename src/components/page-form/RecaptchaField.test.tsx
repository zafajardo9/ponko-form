// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RecaptchaField } from './RecaptchaField'

describe('RecaptchaField', () => {
  afterEach(() => {
    cleanup()
    delete window.grecaptcha
    delete window.__ponkoRecaptchaLoaded
    document.getElementById('ponko-recaptcha-script')?.remove()
  })

  it('shows a safe widget placeholder in builder preview', () => {
    render(<RecaptchaField label="Spam protection" siteKey="site-key" preview onChange={() => undefined} />)
    expect(screen.getByText('I’m not a robot')).toBeTruthy()
    expect(document.getElementById('ponko-recaptcha-script')).toBeNull()
  })

  it('does not render a label when the optional label is blank', () => {
    render(<RecaptchaField label="" siteKey="site-key" preview onChange={() => undefined} />)
    expect(screen.queryByText('Spam protection')).toBeNull()
    expect(screen.getByText('I’m not a robot')).toBeTruthy()
  })

  it('explains when the creator has not configured credentials', () => {
    render(<RecaptchaField label="Spam protection" onChange={() => undefined} />)
    expect(screen.getByRole('alert').textContent).toMatch(/not configured/i)
  })

  it('passes the Google response token to the form state', async () => {
    const onChange = vi.fn()
    let callback: ((token: string) => void) | undefined
    const renderWidget = vi.fn((_container, options) => {
      callback = options.callback
      return 3
    })
    render(<RecaptchaField label="Spam protection" siteKey="site-key" onChange={onChange} />)
    window.grecaptcha = { render: renderWidget, reset: vi.fn() }
    window.__ponkoRecaptchaLoaded?.()

    await waitFor(() => expect(renderWidget).toHaveBeenCalled())
    callback?.('google-response-token')
    expect(onChange).toHaveBeenCalledWith('google-response-token')
  })
})
