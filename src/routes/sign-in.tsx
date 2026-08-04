import { createFileRoute } from '@tanstack/react-router'
import { SignInPage } from '../components/auth/SignInPage'
import { getAuthAvailability, redirectAuthenticatedUser, safeAuthReturnTo } from '../lib/server-fns/auth'

export const Route = createFileRoute('/sign-in')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect_url: safeAuthReturnTo(search.redirect_url),
  }),
  beforeLoad: ({ search }) =>
    redirectAuthenticatedUser({ data: { returnTo: search.redirect_url } }),
  loader: () => getAuthAvailability(),
  component: Page,
})

function Page() {
  const { redirect_url } = Route.useSearch()
  const { configured } = Route.useLoaderData()
  return <SignInPage returnTo={redirect_url} configured={configured} />
}
