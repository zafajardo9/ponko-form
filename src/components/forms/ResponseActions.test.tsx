// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResponseActionDialog, ResponseRowActions } from './ResponseActions'

describe('Response actions', () => {
  afterEach(cleanup)

  it('offers view, archive, and delete for an active response', () => {
    const onView = vi.fn()
    const onArchive = vi.fn()
    const onDelete = vi.fn()
    render(
      <ResponseRowActions
        archived={false}
        busy={false}
        onView={onView}
        onArchive={onArchive}
        onRestore={vi.fn()}
        onDelete={onDelete}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'View response' }))
    fireEvent.click(screen.getByRole('button', { name: 'Archive response' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete response' }))
    expect(onView).toHaveBeenCalledOnce()
    expect(onArchive).toHaveBeenCalledOnce()
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('explains permanent deletion before confirming it', () => {
    const onConfirm = vi.fn()
    render(
      <ResponseActionDialog
        kind="delete"
        number={3}
        busy={false}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    )

    expect(screen.getByRole('alertdialog', { name: 'Delete response #3?' })).toBeTruthy()
    expect(screen.getByText(/cannot be undone/)).toBeTruthy()
    expect(screen.getByText(/Payment transactions remain available/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })
})
