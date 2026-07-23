// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RichTextEditor, { RichTextEditorLoading } from './RichTextEditor'

describe('page-builder RichTextEditor', () => {
  const execCommand = vi.fn(() => true)

  beforeEach(() => {
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    })
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

  it('renders a stable loading fallback for the lazy boundary', () => {
    render(<RichTextEditorLoading />)
    expect(screen.getByRole('status', { name: 'Loading rich text editor' })).toBeTruthy()
  })

  it('renders and emits ordinary HTML without an editor framework', () => {
    const onChange = vi.fn()
    render(
      <RichTextEditor value="<p>Hello builder</p>" onChange={onChange} />,
    )

    const editor = screen.getByRole('textbox', { name: 'Rich text content' })
    expect(editor.innerHTML).toBe('<p>Hello builder</p>')
    editor.innerHTML = '<h2>Updated locally</h2>'
    fireEvent.input(editor)

    expect(onChange).toHaveBeenLastCalledWith('<h2>Updated locally</h2>')
    expect(document.querySelector('.ProseMirror')).toBeNull()
  })

  it('runs every supported formatting command from accessible controls', () => {
    render(<RichTextEditor value="<p>Hello</p>" onChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Heading 1' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Heading 2' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Numbered list' })).toBeTruthy()

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Bold' }))
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Heading 2' }))
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Bullet list' }))

    expect(execCommand).toHaveBeenCalledWith('bold', false, undefined)
    expect(execCommand).toHaveBeenCalledWith('formatBlock', false, 'h2')
    expect(execCommand).toHaveBeenCalledWith('insertUnorderedList', false, undefined)
  })

  it('synchronizes HTML supplied by the parent without emitting a change', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <RichTextEditor value="<p>Draft</p>" onChange={onChange} />,
    )

    rerender(
      <RichTextEditor value="<p>Saved externally</p>" onChange={onChange} />,
    )

    expect(screen.getByRole('textbox', { name: 'Rich text content' }).innerHTML)
      .toBe('<p>Saved externally</p>')
    expect(onChange).not.toHaveBeenCalled()
  })
})
