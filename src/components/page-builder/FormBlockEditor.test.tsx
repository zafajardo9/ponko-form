// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tiptap/extension-drag-handle-react', () => ({
  DragHandle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import FormBlockEditor from './FormBlockEditor'

afterEach(cleanup)

describe('FormBlockEditor', () => {
  it('hydrates legacy content into the EditorCN block surface', async () => {
    render(<FormBlockEditor value={'First line\nSecond line'} label="Instructions content" onChange={vi.fn()} />)

    const editor = await screen.findByRole('textbox', { name: 'Instructions content' })
    expect(editor.classList.contains('ProseMirror')).toBe(true)
    expect(editor.textContent).toContain('First line')
    expect(editor.textContent).toContain('Second line')
    expect(screen.getByLabelText('Block editor tips').textContent).toContain('Type / for blocks')
  })

  it('hydrates replacement content when the selected builder item changes', async () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <FormBlockEditor key="draft" value="<p>Draft</p>" label="Confirmation message" onChange={onChange} />,
    )
    await screen.findByRole('textbox', { name: 'Confirmation message' })

    rerender(
      <FormBlockEditor key="saved" value="<h2>Saved externally</h2>" label="Confirmation message" onChange={onChange} />,
    )

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Confirmation message' }).innerHTML).toBe('<h2>Saved externally</h2>'))
    expect(onChange).not.toHaveBeenCalled()
  })
})
