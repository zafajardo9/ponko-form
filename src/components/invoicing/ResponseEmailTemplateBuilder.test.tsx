// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResponseEmailTemplateBuilder } from './ResponseEmailTemplateBuilder'
import type { ConfirmationConfigDraft, TemplateVariable } from '../../lib/invoicing/types'

vi.mock('./TemplateRichTextEditor', () => ({
  TemplateRichTextEditor: ({ value }: { value: string }) => (
    <div data-testid="email-editor">{value}</div>
  ),
}))

vi.mock('./InvoicePreview', () => ({
  InvoicePreview: ({ snapshot }: { snapshot: { subjectTemplate: string } }) => (
    <div data-testid="email-preview">{snapshot.subjectTemplate}</div>
  ),
}))

const template = {
  id: 'default',
  name: 'Response confirmation',
  enabled: false,
  recipientMode: 'field' as const,
  respondentEmailField: 'email',
  recipientEmail: '',
  subjectTemplate: 'Thanks for submitting {{form_title}}',
  bodyTemplate: '<p>Thank you.</p>',
  fromName: '',
  ccRecipients: [] as string[],
}

const confirmation: ConfirmationConfigDraft = {
  enabled: false,
  respondentEmailField: 'email',
  subjectTemplate: template.subjectTemplate,
  bodyTemplate: template.bodyTemplate,
  fromName: '',
  ccRecipients: [],
  templates: [template],
}

const variables: TemplateVariable[] = [
  {
    key: 'email',
    label: 'Email address',
    category: 'respondent',
    emailCandidate: true,
    sampleValue: 'jane@example.com',
  },
  {
    key: 'name',
    label: 'Full name',
    category: 'respondent',
    sampleValue: 'Jane',
  },
]

function renderBuilder(overrides: Partial<React.ComponentProps<typeof ResponseEmailTemplateBuilder>> = {}) {
  return render(
    <ResponseEmailTemplateBuilder
      confirmation={confirmation}
      variables={variables}
      hasEmailIntegration
      selectedTemplateId="default"
      onSelectTemplate={vi.fn()}
      onChange={vi.fn()}
      {...overrides}
    />,
  )
}

describe('ResponseEmailTemplateBuilder', () => {
  afterEach(cleanup)

  it('shows a list workspace and the three configuration tabs', () => {
    renderBuilder()
    expect(screen.getAllByText('Response confirmation')).toHaveLength(2)
    expect(screen.getByRole('tab', { name: 'Email' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Recipients' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Advanced' })).toBeTruthy()
  })

  it('adds a validated CC recipient to the selected email', () => {
    const onChange = vi.fn()
    renderBuilder({ onChange })
    fireEvent.click(screen.getByRole('tab', { name: 'Recipients' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'CC email address' }), {
      target: { value: 'team@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add CC' }))

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        templates: [
          expect.objectContaining({ ccRecipients: ['team@example.com'] }),
        ],
      }),
    )
  })

  it('opens the email preview in a dialog', () => {
    renderBuilder()
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByTestId('email-preview').textContent).toContain('Thanks for submitting')
  })

  it('cannot enable a rule until its recipient and integration are ready', () => {
    renderBuilder({
      confirmation: {
        ...confirmation,
        templates: [{ ...template, respondentEmailField: '' }],
      },
      variables: [],
      hasEmailIntegration: false,
    })

    fireEvent.click(screen.getByRole('switch', { name: 'Enable email automation' }))
    expect(screen.getByRole('alert').textContent).toContain('Connect Resend or SMTP')
    expect(screen.getByRole('tab', { name: 'Advanced' }).getAttribute('aria-selected')).toBe('true')
  })
})
