import { createFileRoute } from '@tanstack/react-router'
import { safeEqual } from '../../../lib/crypto'
import { reconcileStalePayments } from '../../../lib/payments/reconciliation'

export const Route = createFileRoute('/api/internal/reconcile-payments')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET
        const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
        if (!secret || !safeEqual(secret, supplied)) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
        return Response.json(await reconcileStalePayments())
      },
    },
  },
})
