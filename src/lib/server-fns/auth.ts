import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'
import { auth } from '@clerk/tanstack-react-start/server'

const DEFAULT_AUTH_RETURN_TO = '/forms'

export function safeAuthReturnTo(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return DEFAULT_AUTH_RETURN_TO
  }
  try {
    const url = new URL(value, 'https://ponkoform.local')
    if (url.origin !== 'https://ponkoform.local') return DEFAULT_AUTH_RETURN_TO
    if (url.pathname.startsWith('/sign-in') || url.pathname.startsWith('/sign-up')) {
      return DEFAULT_AUTH_RETURN_TO
    }
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return DEFAULT_AUTH_RETURN_TO
  }
}

// auth() needs the server request context (set up by clerkMiddleware), so it
// must run inside a server function — calling it directly in beforeLoad fails
// on the client with "Cannot read properties of undefined (reading 'auth')".
export const requireAuth = createServerFn({ method: 'GET' })
  .validator((data?: { returnTo?: string }) => ({
    returnTo: safeAuthReturnTo(data?.returnTo),
  }))
  .handler(async ({ data }) => {
    const { isAuthenticated, userId, sessionId } = await auth()
    if (!isAuthenticated || !userId || !sessionId) {
      throw redirect({
        to: '/sign-in/$',
        params: { _splat: '' },
        search: { redirect_url: data.returnTo },
      })
    }
    return { userId, sessionId }
  })

export const redirectAuthenticatedUser = createServerFn({ method: 'GET' })
  .validator((data?: { returnTo?: string }) => ({
    returnTo: safeAuthReturnTo(data?.returnTo),
  }))
  .handler(async ({ data }) => {
    const { isAuthenticated, userId } = await auth()
    if (isAuthenticated && userId) throw redirect({ href: data.returnTo })
    return { isAuthenticated: false as const }
  })
