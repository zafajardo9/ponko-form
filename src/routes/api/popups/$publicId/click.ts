import { createFileRoute } from '@tanstack/react-router'
import { recordPopupClick } from '../../../../lib/server-fns/popups'

/** Click beacon endpoint — fire-and-forget from the loader via sendBeacon. */
export const Route = createFileRoute('/api/popups/$publicId/click')({
  server: {
    handlers: {
      POST: async ({ params }) => {
        if (!params.publicId) return new Response(null, { status: 400 })
        await recordPopupClick({ data: { publicId: params.publicId } })
        return new Response(null, {
          status: 204,
          headers: { 'Access-Control-Allow-Origin': '*' },
        })
      },
    },
  },
})
