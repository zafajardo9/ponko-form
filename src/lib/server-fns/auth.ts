import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'
import { auth } from '@clerk/tanstack-react-start/server'

// auth() needs the server request context (set up by clerkMiddleware), so it
// must run inside a server function — calling it directly in beforeLoad fails
// on the client with "Cannot read properties of undefined (reading 'auth')".
export const requireAuth = createServerFn().handler(async () => {
  const { userId } = await auth()
  if (!userId) throw redirect({ to: '/sign-in/$', params: { _splat: '' } })
  return { userId }
})
