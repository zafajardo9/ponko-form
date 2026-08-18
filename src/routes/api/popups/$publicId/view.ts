import { createFileRoute } from '@tanstack/react-router'
import { recordPopupView } from '../../../../lib/server-fns/popups'

/** View beacon endpoint — fire-and-forget from the loader via sendBeacon. */
export const Route = createFileRoute('/api/popups/$publicId/view')({
  server: {
    handlers: {
      POST: async ({ params }) => {
        if (!params.publicId) return new Response(null, { status: 400 })
        await recordPopupView({ data: { publicId: params.publicId } })
        return new Response(null, {
          status: 204,
          headers: { 'Access-Control-Allow-Origin': '*' },
        })
      },
    },
  },
})
