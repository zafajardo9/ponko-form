import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '@/lib/server-fns/auth'
import { PopupBuilderWorkspace } from '@/components/popup-builder/PopupBuilderWorkspace'

export const Route = createFileRoute('/popups/$popupId/edit')({
  beforeLoad: ({ location }) => requireAuth({ data: { returnTo: location.href } }),
  component: PopupBuilderRoute,
})

function PopupBuilderRoute() {
  const { popupId } = Route.useParams()
  return <PopupBuilderWorkspace popupId={Number(popupId)} />
}
