import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendPaymentReminderEmail, sendResendEmail } from './resend'

describe('Resend payment reminders', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends the payment link without exposing the API key in the body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'email-1' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(sendPaymentReminderEmail({
      config: { apiKey: 're_secret', fromEmail: 'payments@example.com', fromName: 'Example' },
      recipient: 'customer@example.com',
      formTitle: 'Background Check',
      amount: 'PHP 100.00',
      paymentUrl: 'https://checkout.xendit.co/inv-1',
    })).resolves.toEqual({ messageId: 'email-1' })

    const [, request] = fetchMock.mock.calls[0]
    expect(request.headers.Authorization).toBe('Bearer re_secret')
    expect(request.body).toContain('https://checkout.xendit.co/inv-1')
    expect(request.body).not.toContain('re_secret')
  })

  it('requires a configured sender address', async () => {
    await expect(sendPaymentReminderEmail({
      config: { apiKey: 're_secret' },
      recipient: 'customer@example.com',
      formTitle: 'Form',
      amount: 'PHP 100.00',
      paymentUrl: 'https://example.com/pay',
    })).rejects.toThrow(/sender email/i)
  })

  it('forwards a stable idempotency key to the email API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'email-2' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await sendResendEmail({
      config: { apiKey: 're_secret', fromEmail: 'forms@example.com' },
      recipient: 'customer@example.com',
      subject: 'Submission received',
      html: '<p>Thanks</p>',
      text: 'Thanks',
      idempotencyKey: 'submission-delivery/42',
    })

    const [, request] = fetchMock.mock.calls[0]
    expect(request.headers['Idempotency-Key']).toBe('submission-delivery/42')
  })

  it('includes configured CC recipients in a response email', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'email-3' }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await sendResendEmail({
      config: { apiKey: 're_secret', fromEmail: 'forms@example.com' },
      recipient: 'customer@example.com',
      cc: ['owner@example.com', 'support@example.com'],
      subject: 'Submission received',
      html: '<p>Thanks</p>',
      text: 'Thanks',
    })

    const [, request] = fetchMock.mock.calls[0]
    expect(JSON.parse(request.body).cc).toEqual([
      'owner@example.com',
      'support@example.com',
    ])
  })
})
