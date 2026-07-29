// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ToastProvider, useToast } from './Toast'

function ToastTrigger() {
  const toast = useToast()
  return (
    <button
      type="button"
      onClick={() => toast.success('Changes saved', 'The latest version is now recorded.')}
    >
      Show notification
    </button>
  )
}

describe('ToastProvider', () => {
  afterEach(cleanup)

  it('announces completed actions and allows dismissal', () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Show notification' }))
    expect(screen.getByRole('status').textContent).toContain('Changes saved')
    expect(screen.getByText('The latest version is now recorded.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    expect(screen.queryByRole('status')).toBeNull()
  })
})
