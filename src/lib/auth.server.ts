import { getRequestHeaders } from '@tanstack/react-start/server'
import { auth } from './auth'
import { isBetterAuthConfigured } from './auth-env'

export interface AuthIdentity {
  userId: string
  sessionId: string
  user: {
    email: string
    emailVerified: boolean
    name: string
    image: string | null | undefined
  }
}

export async function currentAuth(): Promise<{
  isAuthenticated: boolean
  userId: string | null
  sessionId: string | null
}> {
  if (!isBetterAuthConfigured()) {
    return { isAuthenticated: false, userId: null, sessionId: null }
  }
  const result = await auth.api.getSession({ headers: getRequestHeaders() })
  if (!result) return { isAuthenticated: false, userId: null, sessionId: null }
  return {
    isAuthenticated: true,
    userId: result.user.id,
    sessionId: result.session.id,
  }
}

export async function requireAuthIdentity(): Promise<AuthIdentity> {
  if (!isBetterAuthConfigured()) throw new Error('Unauthorized')
  const result = await auth.api.getSession({ headers: getRequestHeaders() })
  if (!result) {
    throw new Error('Unauthorized')
  }
  return {
    userId: result.user.id,
    sessionId: result.session.id,
    user: {
      email: result.user.email,
      emailVerified: result.user.emailVerified,
      name: result.user.name,
      image: result.user.image,
    },
  }
}
