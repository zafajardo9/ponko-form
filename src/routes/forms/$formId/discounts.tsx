import { createFileRoute, Navigate } from '@tanstack/react-router'
import { requireAuth } from '@/lib/server-fns/auth'

export const Route = createFileRoute('/forms/$formId/discounts')({
  beforeLoad: ({ location }) => requireAuth({ data: { returnTo: location.href } }),
  component: () => <Navigate to="/discounts" />,
})
