// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InvoiceTemplateBuilder } from './InvoiceTemplateBuilder'
import type { InvoiceConfigDraft, TemplateVariable } from '../../lib/invoicing/types'

vi.mock('./TemplateRichTextEditor', () => ({
  TemplateRichTextEditor: () => <div role="textbox" aria-label="Email body editor" />,
}))

vi.mock('./InvoicePreview', () => ({
  InvoicePreview: () => <div data-testid="invoice-preview" />,
}))

const invoice: InvoiceConfigDraft = {
  enabled: false,
  respondentEmailField: 'email',
  subjectTemplate: 'Invoice {{invoice_number}}',
  bodyTemplate: '<p>Thank you.</p>',
  fromName: 'Acme Billing',
  logoUrl: '',
  accentColor: '#cc785c',
  invoicePrefix: 'INV',
  invoiceStartNumber: 1,
  includePaymentDetails: true,
  includeLineItems: false,
  lineItemFields: [],
}

const variables: TemplateVariable[] = [{
  key: 'email',
  label: 'Email address',
  category: 'respondent',
  emailCandidate: true,
  sampleValue: 'jane@example.com',
}]

describe('InvoiceTemplateBuilder', () => {
  afterEach(cleanup)

  it('keeps the rich-text editor outside a native label', () => {
    render(
      <InvoiceTemplateBuilder
        invoice={invoice}
        variables={variables}
        hasPaymentPath
        hasEmailIntegration
        numberingLocked={false}
        onInvoiceChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('textbox', { name: 'Email body editor' }).closest('label')).toBeNull()
    expect(screen.getByLabelText('Subject')).toBeTruthy()
    expect(screen.getByLabelText('Accent color')).toBeTruthy()
  })
})
