import { createFileRoute } from '@tanstack/react-router'
import { auth } from '../../../lib/auth'
import { isBetterAuthConfigured } from '../../../lib/auth-env'

async function handleAuthRequest(request: Request) {
  if (!isBetterAuthConfigured()) {
    return Response.json(
      { message: 'Better Auth is not configured for this deployment.' },
      { status: 503 },
    )
  }
  return auth.handler(request)
}

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => handleAuthRequest(request),
      POST: ({ request }) => handleAuthRequest(request),
    },
  },
})
