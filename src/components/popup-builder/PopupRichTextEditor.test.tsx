// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PopupRichTextEditor } from './PopupRichTextEditor'

afterEach(cleanup)

describe('PopupRichTextEditor', () => {
  it('renders legacy text through TipTap with accessible formatting controls', async () => {
    render(<PopupRichTextEditor value="Write flexible popup copy" onChange={vi.fn()} />)

    expect(await screen.findByRole('toolbar', { name: 'Popup text formatting' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Bold' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Italic' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Underline' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Bullet list' })).toBeTruthy()
    expect((await screen.findByRole('textbox', { name: 'Popup text content' })).textContent)
      .toContain('Write flexible popup copy')
  })
})
