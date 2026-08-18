import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/popups/')({
  beforeLoad: () => {
    throw redirect({ to: '/popups', replace: true })
  },
})
