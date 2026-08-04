// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}))

vi.mock('../../lib/auth-client', () => ({
  authClient: {
    signIn: { email: auth.signIn },
    signUp: { email: auth.signUp },
  },
}))

import { SignInPage } from './SignInPage'

describe('email and password authentication page', () => {
  beforeEach(() => {
    auth.signIn.mockReset()
    auth.signUp.mockReset()
  })
  afterEach(cleanup)

  it('submits normalized email credentials and shows a recoverable sign-in error', async () => {
    auth.signIn.mockResolvedValue({
      data: null,
      error: { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid credentials' },
    })
    render(<SignInPage returnTo="/forms" configured />)

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: ' USER@Example.COM ' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(auth.signIn).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password123',
      rememberMe: true,
      callbackURL: '/forms',
    }))
    expect(screen.getByRole('alert').textContent).toContain('email or password is incorrect')
  })

  it('validates account creation before calling Better Auth', async () => {
    auth.signUp.mockResolvedValue({
      data: null,
      error: { code: 'USER_ALREADY_EXISTS', message: 'Already exists' },
    })
    render(<SignInPage returnTo="/dashboard" configured />)
    fireEvent.click(screen.getByRole('tab', { name: 'Create account' }))

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'A' } })
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'not-an-email' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'short' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'different' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(auth.signUp).not.toHaveBeenCalled()
    expect(screen.getByText('Enter your name.')).toBeTruthy()
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy()
    expect(screen.getByText('Password must be at least 8 characters.')).toBeTruthy()
    expect(screen.getByText('Passwords do not match.')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada Builder' } })
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'ada@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'strong-password' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'strong-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => expect(auth.signUp).toHaveBeenCalledWith({
      name: 'Ada Builder',
      email: 'ada@example.com',
      password: 'strong-password',
      callbackURL: '/dashboard',
    }))
    expect(screen.getByRole('alert').textContent).toContain('already exists')
  })

  it('supports password visibility and reports missing server configuration', () => {
    render(<SignInPage returnTo="/forms" configured={false} />)
    const password = screen.getByLabelText('Password') as HTMLInputElement
    expect(password.type).toBe('password')
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password.type).toBe('text')

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'user@example.com' } })
    fireEvent.change(password, { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByRole('alert').textContent).toContain('not configured')
    expect(auth.signIn).not.toHaveBeenCalled()
  })
})
