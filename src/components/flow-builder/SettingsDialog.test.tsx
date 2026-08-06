// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_THEME } from '../../lib/theme'
import { SettingsDialog } from './SettingsDialog'

describe('SettingsDialog', () => {
  afterEach(cleanup)

  it('organizes settings beside a live respondent preview', () => {
    render(
      <SettingsDialog
        formTitle="Customer survey"
        theme={DEFAULT_THEME}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('dialog', { name: 'Form settings' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Form identity' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Appearance' })).toBeTruthy()
    expect(screen.getByText('Respondent view')).toBeTruthy()
    expect(screen.getByText('Everything is up to date.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('previews changes and saves the organized settings draft', () => {
    const onSave = vi.fn()
    render(
      <SettingsDialog
        formTitle="Customer survey"
        theme={DEFAULT_THEME}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('Form name'), { target: { value: 'Event feedback' } })
    fireEvent.click(screen.getByRole('button', { name: 'Accent color #2563eb' }))

    expect(screen.getByRole('heading', { name: 'Event feedback' })).toBeTruthy()
    expect(screen.getByText('You have unsaved changes.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(onSave).toHaveBeenCalledWith({
      title: 'Event feedback',
      theme: {
        primaryColor: '#2563eb',
        backgroundColor: DEFAULT_THEME.backgroundColor,
        radius: DEFAULT_THEME.radius,
      },
    })
  })

  it('closes with Escape and restores page scrolling', () => {
    const onClose = vi.fn()
    const { unmount } = render(
      <SettingsDialog formTitle="Survey" onSave={vi.fn()} onClose={onClose} />,
    )

    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    unmount()
    expect(document.body.style.overflow).toBe('')
  })
})
