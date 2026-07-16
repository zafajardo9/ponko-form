import { describe, expect, it } from 'vitest'
import {
  extractTemplateTokens,
  formatMoney,
  interpolateHtml,
  renderTemplateMessage,
  sanitizeTemplateHtml,
  validateTemplateTokens,
} from './template'
import type { InvoiceTemplateContext, TemplateVariable } from './types'

const context: InvoiceTemplateContext = {
  values: {
    name: '<img src=x onerror=alert(1)> Jane',
    email: 'jane@example.com',
    interests: ['Design', 'Engineering'],
    17: 'Legacy value',
  },
  formTitle: 'Registration',
  submissionId: 42,
  submittedAt: new Date('2026-07-16T00:00:00.000Z'),
  paymentAmount: '$49.00',
  paymentCurrency: 'USD',
  paymentDate: 'July 16, 2026',
  paymentGateway: 'PayPal',
  paymentId: 'PAY-42',
  invoiceNumber: 'INV-1000',
}

describe('invoice template rendering', () => {
  it('escapes respondent values while preserving allowed template markup', () => {
    const html = interpolateHtml('<h1>Hello {{name}}</h1><p>{{interests}}</p><p>{{17}}</p>', context)
    expect(html).toContain('<h1>Hello &lt;img src=x onerror=alert(1)&gt; Jane</h1>')
    expect(html).toContain('Design, Engineering')
    expect(html).toContain('Legacy value')
    expect(html).not.toContain('<img')
  })

  it('removes scripts, event handlers, styles, and unsafe links', () => {
    const html = sanitizeTemplateHtml('<script>alert(1)</script><p onclick="alert(1)" style="color:red">Safe</p><a href="javascript:alert(1)">Bad</a><a href="https://example.com">Good</a>')
    expect(html).not.toContain('script')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('style=')
    expect(html).not.toContain('javascript:')
    expect(html).toContain('https://example.com')
    expect(html).toContain('noopener noreferrer')
  })

  it('renders structured invoice details and a plain-text fallback', () => {
    const message = renderTemplateMessage('invoice', {
      subjectTemplate: 'Invoice {{invoice_number}} for {{form_title}}',
      bodyTemplate: '<p>Hi {{name}}</p>',
      accentColor: '#cc785c',
      includePaymentDetails: true,
      includeLineItems: true,
      lineItemFields: [{ label: 'Interests', variable: 'interests' }],
    }, context)
    expect(message.subject).toBe('Invoice INV-1000 for Registration')
    expect(message.html).toContain('Payment details')
    expect(message.html).toContain('Submission details')
    expect(message.text).toContain('Design, Engineering')
  })

  it('discovers and rejects unknown tokens', () => {
    const variables: TemplateVariable[] = [{ key: 'name', label: 'Name', category: 'respondent', sampleValue: 'Jane' }]
    expect(extractTemplateTokens('{{name}} {{invoice_number}} {{missing}}')).toEqual(['name', 'invoice_number', 'missing'])
    expect(validateTemplateTokens(['{{name}} {{invoice_number}} {{missing}}'], variables)).toEqual(['missing'])
  })

  it('formats minor-unit currencies and falls back for invalid codes', () => {
    expect(formatMoney(4900, 'USD')).toBe('$49.00')
    expect(formatMoney(245000, 'PHP')).toMatch(/2,450\.00/)
    expect(formatMoney(100, 'invalid')).toBe('INVALID 1.00')
  })
})
