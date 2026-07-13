import { createFileRoute } from '@tanstack/react-router'
import { getIntegrationByWebhookEndpoint } from '../../../../lib/integrations/credentials'
import type { XenditConfig } from '../../../../lib/integrations/types'
import { paymentByGatewayReference, reconcilePayment } from '../../../../lib/payments/reconciliation'
import { validXenditWebhookToken, xenditWebhookIdentity } from '../../../../lib/payments/xendit-webhook'

const MAX_BODY_BYTES = 256_000

export const Route = createFileRoute('/api/webhooks/xendit/$endpointKey')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const integration = await getIntegrationByWebhookEndpoint<XenditConfig>(params.endpointKey)
        if (!integration) return Response.json({ error: 'Unknown webhook endpoint' }, { status: 404 })

        const suppliedToken = request.headers.get('x-callback-token') ?? ''
        if (!validXenditWebhookToken(integration.config.webhookToken, suppliedToken)) {
          return Response.json({ error: 'Invalid webhook token' }, { status: 401 })
        }
        const contentLength = Number(request.headers.get('content-length') ?? 0)
        if (contentLength > MAX_BODY_BYTES) return Response.json({ error: 'Payload too large' }, { status: 413 })

        let payload: Record<string, unknown>
        try {
          const text = await request.text()
          if (text.length > MAX_BODY_BYTES) return Response.json({ error: 'Payload too large' }, { status: 413 })
          payload = JSON.parse(text) as Record<string, unknown>
        } catch {
          return Response.json({ error: 'Invalid JSON payload' }, { status: 400 })
        }

        const { eventType, isRefund, reference, providerTimestamp, eventId } = xenditWebhookIdentity(payload)
        if (!reference) return Response.json({ error: 'Payment reference is required' }, { status: 400 })

        const payment = await paymentByGatewayReference(reference)
        if (!payment) return Response.json({ error: 'Payment not found' }, { status: 404 })

        try {
          const result = await reconcilePayment({
            paymentId: payment.id,
            source: 'webhook',
            eventType,
            gatewayEventId: request.headers.get('webhook-id') ?? eventId,
            providerTimestamp,
            payload,
            forcedStatus: isRefund && /succeed|paid|completed/i.test(eventType) ? 'refunded' : undefined,
            expectedProfileId: integration.profileId,
          })
          return Response.json({ received: true, duplicate: result.duplicate })
        } catch (error) {
          console.error('[xendit-webhook-failed]', {
            paymentId: payment.id,
            eventType,
            category: error instanceof Error ? error.name : 'UnknownError',
          })
          return Response.json({ error: 'Webhook processing failed' }, { status: 500 })
        }
      },
    },
  },
})
