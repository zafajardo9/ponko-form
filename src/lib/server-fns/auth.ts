import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'
import { isBetterAuthConfigured } from '../auth-env'

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

export const requireAuth = createServerFn({ method: 'GET' })
  .validator((data?: { returnTo?: string }) => ({
    returnTo: safeAuthReturnTo(data?.returnTo),
  }))
  .handler(async ({ data }) => {
    const { currentAuth } = await import('../auth.server')
    const { isAuthenticated, userId, sessionId } = await currentAuth()
    if (!isAuthenticated || !userId || !sessionId) {
      throw redirect({
        to: '/sign-in',
        search: { redirect_url: data.returnTo },
      })
    }
    const { ensureProfile } = await import('../profile.server')
    await ensureProfile(userId)
    return { userId, sessionId }
  })

export const redirectAuthenticatedUser = createServerFn({ method: 'GET' })
  .validator((data?: { returnTo?: string }) => ({
    returnTo: safeAuthReturnTo(data?.returnTo),
  }))
  .handler(async ({ data }) => {
    const { currentAuth } = await import('../auth.server')
    const { isAuthenticated, userId } = await currentAuth()
    if (isAuthenticated && userId) throw redirect({ href: data.returnTo })
    return { isAuthenticated: false as const }
  })

export const getAuthAvailability = createServerFn({ method: 'GET' }).handler(
  async () => ({ configured: isBetterAuthConfigured() }),
)
