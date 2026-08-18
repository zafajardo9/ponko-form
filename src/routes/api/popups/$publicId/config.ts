import { createFileRoute } from '@tanstack/react-router'
import { getPopupPreview, getPopupPublicConfig } from '../../../../lib/server-fns/popups'

/**
 * Public popup config for the host-side loader (placement/size/trigger/
 * frequency/style — never elements). CORS-open because the loader fetches
 * cross-origin from the host site; unpublished popups 404.
 */
export const Route = createFileRoute('/api/popups/$publicId/config')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const headers = { 'Access-Control-Allow-Origin': '*' }
        if (!params.publicId) {
          return Response.json({ error: 'Invalid popup id' }, { status: 400, headers })
        }

        const preview = new URL(request.url).searchParams.get('preview') === 'owner'
        const popup = preview
          ? await getPopupPreview({ data: { publicId: params.publicId } }).catch(() => null)
          : await getPopupPublicConfig({ data: { publicId: params.publicId } })
        const config = popup && preview ? {
          publicId: popup.publicId,
          title: popup.title,
          width: popup.width,
          height: popup.height,
          placement: popup.placement,
          trigger: popup.trigger,
          frequency: popup.frequency,
          schedule: popup.schedule,
          style: popup.style,
        } : popup
        if (!config) {
          return Response.json({ error: 'Popup not found' }, { status: 404, headers })
        }
        return Response.json(config, { headers })
      },
    },
  },
})
