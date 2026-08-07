import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isSystemEmailConfigured,
  sendSystemEmail,
  sendSystemEmailSafely,
  systemPasswordResetMessage,
  systemSignInAlertMessage,
  systemWelcomeMessage,
} from './system'

describe('System-level Resend email', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('sends via the Resend API using the platform key from env', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_system_secret')
    vi.stubEnv('RESEND_FROM_EMAIL', 'no-reply@ponkoform.app')
    vi.stubEnv('RESEND_FROM_NAME', 'PonkoForm Accounts')
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'sys-email-1' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(sendSystemEmail({
      recipient: 'admin@example.com',
      subject: 'Test',
      html: '<p>Hi</p>',
      text: 'Hi',
    })).resolves.toEqual({ messageId: 'sys-email-1' })

    const [, request] = fetchMock.mock.calls[0]
    expect(request.headers.Authorization).toBe('Bearer re_system_secret')
    const body = JSON.parse(request.body)
    expect(body.from).toBe('PonkoForm Accounts <no-reply@ponkoform.app>')
    expect(body.to).toEqual(['admin@example.com'])
  })

  it('reports configuration only when both key and sender are set', () => {
    vi.stubEnv('RESEND_API_KEY', 're_key')
    vi.stubEnv('RESEND_FROM_EMAIL', '')
    expect(isSystemEmailConfigured()).toBe(false)

    vi.stubEnv('RESEND_FROM_EMAIL', 'no-reply@ponkoform.app')
    expect(isSystemEmailConfigured()).toBe(true)
  })

  it('fails clearly when the platform key or sender is missing', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('RESEND_FROM_EMAIL', '')
    await expect(sendSystemEmail({
      recipient: 'admin@example.com',
      subject: 'Test',
      html: '<p>Hi</p>',
      text: 'Hi',
    })).rejects.toThrow(/not configured/i)
  })

  it('builds a password reset message with the reset URL', () => {
    const message = systemPasswordResetMessage({
      user: { name: 'Ada Lovelace', email: 'ada@example.com' },
      url: 'https://ponkoform.app/reset-password?token=abc&x=1&y=2',
    })
    expect(message.recipient).toBe('ada@example.com')
    expect(message.subject).toContain('PonkoForm')
    expect(message.html).toContain('Ada Lovelace')
    expect(message.html).toContain('https://ponkoform.app/reset-password?token=abc&amp;x=1&amp;y=2')
    expect(message.text).toContain('https://ponkoform.app/reset-password?token=abc&x=1&y=2')
  })

  it('builds a welcome message pointing to the workspace', () => {
    const message = systemWelcomeMessage({
      user: { name: 'Grace Hopper', email: 'grace@example.com' },
      workspaceUrl: 'https://ponkoform.app/',
    })
    expect(message.recipient).toBe('grace@example.com')
    expect(message.subject).toBe('Welcome to PonkoForm!')
    expect(message.html).toContain('Grace Hopper')
    expect(message.html).toContain('https://ponkoform.app/forms')
    expect(message.text).toContain('https://ponkoform.app/forms')
  })

  it('builds a sign-in alert with sign-in details for repeat sign-ins', () => {
    const message = systemSignInAlertMessage({
      user: { name: 'Alan Turing', email: 'alan@example.com' },
      ip: '203.0.113.42',
      userAgent: 'Mozilla/5.0 (Macintosh)',
      workspaceUrl: 'https://ponkoform.app',
    })
    expect(message.recipient).toBe('alan@example.com')
    expect(message.subject).toContain('New sign-in')
    expect(message.html).toContain('203.0.113.42')
    expect(message.html).toContain('Mozilla/5.0 (Macintosh)')
    expect(message.html).toContain('https://ponkoform.app/sign-in')
    expect(message.text).toContain('IP address: 203.0.113.42')
  })

  it('swallows and logs failures so auth flows never break', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('RESEND_FROM_EMAIL', '')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(sendSystemEmailSafely({
      recipient: 'admin@example.com',
      subject: 'Test',
      html: '<p>Hi</p>',
      text: 'Hi',
    })).resolves.toBeUndefined()
    expect(errorSpy).toHaveBeenCalledOnce()
    errorSpy.mockRestore()
  })
})
