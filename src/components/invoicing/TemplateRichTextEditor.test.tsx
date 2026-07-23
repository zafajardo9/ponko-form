// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TemplateRichTextEditor } from './TemplateRichTextEditor'

const variables = [
  {
    key: 'customer_name',
    label: 'Customer name',
    category: 'respondent' as const,
    sampleValue: 'Alex',
  },
  {
    key: 'invoice_number',
    label: 'Invoice number',
    category: 'payment' as const,
    sampleValue: 'INV-42',
  },
]

describe('TemplateRichTextEditor', () => {
  const execCommand = vi.fn(() => true)

  beforeEach(() => {
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand })
    Object.defineProperty(document, 'queryCommandState', {
      configurable: true,
      value: vi.fn(() => false),
    })
    Object.defineProperty(document, 'queryCommandValue', {
      configurable: true,
      value: vi.fn(() => 'p'),
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    execCommand.mockClear()
  })

  it('renders existing HTML and emits edited markup', () => {
    const onChange = vi.fn()
    render(
      <TemplateRichTextEditor
        value="<p>Hello <strong>there</strong></p>"
        variables={variables}
        onChange={onChange}
      />,
    )
    const editor = screen.getByRole('textbox', { name: 'Email body editor' })

    expect(editor.innerHTML).toBe('<p>Hello <strong>there</strong></p>')
    editor.innerHTML = '<h1>Updated invoice</h1>'
    fireEvent.input(editor)

    expect(onChange).toHaveBeenLastCalledWith('<h1>Updated invoice</h1>')
  })

  it('runs formatting and variable insertion commands without submitting the form', () => {
    render(
      <TemplateRichTextEditor
        value="<p>Hello</p>"
        variables={variables}
        onChange={vi.fn()}
      />,
    )

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Bold' }))
    expect(execCommand).toHaveBeenCalledWith('bold', false, undefined)

    fireEvent.change(screen.getByRole('combobox', { name: 'Insert template variable' }), {
      target: { value: 'invoice_number' },
    })
    expect(execCommand).toHaveBeenCalledWith('insertText', false, '{{invoice_number}}')
  })

  it('synchronizes a saved value supplied by the parent', () => {
    const { rerender } = render(
      <TemplateRichTextEditor
        value="<p>Draft</p>"
        variables={variables}
        onChange={vi.fn()}
      />,
    )
    rerender(
      <TemplateRichTextEditor
        value="<p>Saved and sanitized</p>"
        variables={variables}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('textbox', { name: 'Email body editor' }).innerHTML)
      .toBe('<p>Saved and sanitized</p>')
  })
})
