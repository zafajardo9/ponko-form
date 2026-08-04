import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  getSession: vi.fn(),
  headers: new Headers({ cookie: 'better-auth.session_token=test-token' }),
}))

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: () => state.headers,
}))

vi.mock('./auth', () => ({
  auth: { api: { getSession: state.getSession } },
}))

vi.mock('./auth-env', () => ({ isBetterAuthConfigured: () => true }))

import { currentAuth, requireAuthIdentity } from './auth.server'

describe('Better Auth server session authentication', () => {
  beforeEach(() => state.getSession.mockReset())

  it('treats a missing Better Auth session as signed out', async () => {
    state.getSession.mockResolvedValue(null)

    await expect(currentAuth()).resolves.toEqual({
      isAuthenticated: false,
      userId: null,
      sessionId: null,
    })
    expect(state.getSession).toHaveBeenCalledWith({ headers: state.headers })
  })

  it('returns the Better Auth user and session identifiers', async () => {
    state.getSession.mockResolvedValue(sessionResult())

    await expect(currentAuth()).resolves.toEqual({
      isAuthenticated: true,
      userId: 'auth-user-1',
      sessionId: 'session-1',
    })
  })

  it('returns verified user data to the profile resolver', async () => {
    state.getSession.mockResolvedValue(sessionResult())

    await expect(requireAuthIdentity()).resolves.toEqual({
      userId: 'auth-user-1',
      sessionId: 'session-1',
      user: {
        email: 'user@example.com',
        emailVerified: true,
        name: 'Test User',
        image: 'https://example.com/avatar.png',
      },
    })
  })

  it('rejects a missing session when authentication is required', async () => {
    state.getSession.mockResolvedValue(null)
    await expect(requireAuthIdentity()).rejects.toThrow('Unauthorized')
  })
})

function sessionResult() {
  return {
    session: { id: 'session-1' },
    user: {
      id: 'auth-user-1',
      email: 'user@example.com',
      emailVerified: true,
      name: 'Test User',
      image: 'https://example.com/avatar.png',
    },
  }
}
