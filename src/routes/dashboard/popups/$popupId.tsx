import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/popups/$popupId')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/popups/$popupId/edit',
      params: { popupId: params.popupId },
      replace: true,
    })
  },
})
