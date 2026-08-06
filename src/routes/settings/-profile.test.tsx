// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({
  changePassword: vi.fn(),
}))

vi.mock('../../lib/auth-client', () => ({
  authClient: { changePassword: auth.changePassword },
}))

vi.mock('../../lib/server-fns/auth', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('../../lib/server-fns/profile', () => ({
  getMyProfile: vi.fn(),
  updateMyProfile: vi.fn(),
}))

import { PasswordForm } from './profile'

describe('profile password settings', () => {
  beforeEach(() => auth.changePassword.mockReset())
  afterEach(cleanup)

  it('validates the new password and confirmation before submitting', () => {
    render(<PasswordForm />)

    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'current-password' } })
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'short' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'different' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Change password' }).closest('form')!)

    expect(auth.changePassword).not.toHaveBeenCalled()
    expect(screen.getByText('New password must be at least 8 characters.')).toBeTruthy()
    expect(screen.getByText('New passwords do not match.')).toBeTruthy()
  })

  it('changes the password, revokes other sessions, and clears the fields', async () => {
    auth.changePassword.mockResolvedValue({ data: { status: true }, error: null })
    render(<PasswordForm />)

    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'current-password' } })
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-password-123' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'new-password-123' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Change password' }).closest('form')!)

    await waitFor(() => expect(auth.changePassword).toHaveBeenCalledWith({
      currentPassword: 'current-password',
      newPassword: 'new-password-123',
      revokeOtherSessions: true,
    }))
    expect(screen.getByText('Password changed. Other sessions were signed out.')).toBeTruthy()
    expect(screen.getByLabelText('Current password')).toHaveProperty('value', '')
    expect(screen.getByLabelText('New password')).toHaveProperty('value', '')
    expect(screen.getByLabelText('Confirm new password')).toHaveProperty('value', '')
  })

  it('shows a clear error when the current password is incorrect', async () => {
    auth.changePassword.mockResolvedValue({
      data: null,
      error: { code: 'INVALID_PASSWORD', message: 'Invalid password' },
    })
    render(<PasswordForm />)

    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'wrong-password' } })
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-password-123' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'new-password-123' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Change password' }).closest('form')!)

    expect((await screen.findByRole('alert')).textContent).toContain('Your current password is incorrect.')
  })
})
