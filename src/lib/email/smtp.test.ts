import { describe, expect, it } from 'vitest'
import { smtpDeliveryError, smtpTransportSecurity } from './smtp'

describe('smtpTransportSecurity', () => {
  it('uses implicit TLS on port 465', () => {
    expect(smtpTransportSecurity({ port: 465, secure: false })).toEqual({
      secure: true,
      requireTLS: false,
    })
  })

  it('uses STARTTLS on port 587 even when secure was saved as true', () => {
    expect(smtpTransportSecurity({ port: 587, secure: true })).toEqual({
      secure: false,
      requireTLS: true,
    })
  })

  it('preserves the explicit setting for non-standard ports', () => {
    expect(smtpTransportSecurity({ port: 2525, secure: false })).toEqual({
      secure: false,
      requireTLS: false,
    })
  })
})

describe('smtpDeliveryError', () => {
  it('turns a Brevo IP rejection into an actionable message', () => {
    const error = smtpDeliveryError(
      new Error('Invalid login: 525 5.7.1 Unauthorized IP address'),
    )

    expect(error.message).toBe(
      'Brevo blocked this server IP. Allow it in Brevo SMTP & API authorized IPs, then try again.',
    )
  })

  it('explains a TLS mode mismatch without exposing OpenSSL internals', () => {
    const error = smtpDeliveryError(
      new Error('tls_validate_record_header:wrong version number'),
    )

    expect(error.message).toBe(
      'The SMTP port and TLS mode do not match. Use STARTTLS for port 587 or SSL for port 465.',
    )
  })
})
