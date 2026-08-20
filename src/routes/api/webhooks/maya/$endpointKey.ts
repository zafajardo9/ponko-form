import { createFileRoute } from '@tanstack/react-router'
import { getIntegrationByWebhookEndpoint } from '@/lib/integrations/credentials'
import type { MayaConfig } from '@/lib/integrations/types'
import { paymentByGatewayReference, reconcilePayment } from '@/lib/payments/reconciliation'
import { completePaidPageSubmission } from '@/lib/page-builder/complete-submission'

const MAX_BODY_BYTES = 256_000

/**
 * Maya Checkout webhook receiver.
 *
 * Maya POSTs checkout status updates to the per-merchant URL registered at
 * `/api/webhooks/maya/{endpointKey}`. The endpoint key is unguessable (a
 * random UUID stored on the integration row), so the URL itself authenticates
 * the request — the same model Xendit uses. The payload's
 * `requestReferenceNumber` maps to our stored `externalId`, and `id` maps to
 * the checkout id (`gatewayPaymentId`).
 */
export const Route = createFileRoute('/api/webhooks/maya/$endpointKey')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const integration = await getIntegrationByWebhookEndpoint<MayaConfig>(params.endpointKey)
        if (!integration) return Response.json({ error: 'Unknown webhook endpoint' }, { status: 404 })

        const contentLength = Number(request.headers.get('content-length') ?? 0)
        if (contentLength > MAX_BODY_BYTES) return Response.json({ error: 'Payload too large' }, { status: 413 })

        let text: string
        try {
          text = await request.text()
          if (text.length > MAX_BODY_BYTES) return Response.json({ error: 'Payload too large' }, { status: 413 })
        } catch {
          return Response.json({ error: 'Invalid payload' }, { status: 400 })
        }

        let payload: Record<string, unknown>
        try {
          payload = JSON.parse(text) as Record<string, unknown>
        } catch {
          return Response.json({ error: 'Invalid JSON payload' }, { status: 400 })
        }

        const status = typeof payload.status === 'string' ? payload.status : 'payment.verification'
        const reference =
          (typeof payload.requestReferenceNumber === 'string' && payload.requestReferenceNumber) ||
          (typeof payload.id === 'string' && payload.id) ||
          null
        if (!reference) {
          return Response.json({ received: true, ignored: true }, { status: 202 })
        }

        const payment = await paymentByGatewayReference(reference)
        if (!payment) {
          return Response.json({ received: true, ignored: true }, { status: 202 })
        }

        try {
          const result = await reconcilePayment({
            paymentId: payment.id,
            source: 'webhook',
            eventType: status,
            gatewayEventId: typeof payload.id === 'string' ? payload.id : null,
            payload,
            expectedProfileId: integration.profileId,
          })
          if (payment.pageSessionId && result.status === 'completed') {
            await completePaidPageSubmission(payment.pageSessionId)
          }
          return Response.json({ received: true, duplicate: result.duplicate })
        } catch (error) {
          console.error('[maya-webhook-failed]', {
            paymentId: payment.id,
            category: error instanceof Error ? error.name : 'UnknownError',
          })
          return Response.json({ error: 'Webhook processing failed' }, { status: 500 })
        }
      },
    },
  },
})
