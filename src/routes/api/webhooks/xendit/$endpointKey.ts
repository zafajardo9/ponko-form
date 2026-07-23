import { createFileRoute } from '@tanstack/react-router'
import { getIntegrationByWebhookEndpoint, normalizeXenditConfig } from '../../../../lib/integrations/credentials'
import type { XenditConfig } from '../../../../lib/integrations/types'
import {
  paymentByGatewayReference,
  reconcilePayment,
  reconcileSubscriptionWebhook,
} from '../../../../lib/payments/reconciliation'
import { validXenditWebhookToken, xenditWebhookIdentity } from '../../../../lib/payments/xendit-webhook'
import { completePaidPageSubmission } from '../../../../lib/page-builder/complete-submission'

const MAX_BODY_BYTES = 256_000

export const Route = createFileRoute('/api/webhooks/xendit/$endpointKey')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const integration = await getIntegrationByWebhookEndpoint<XenditConfig>(params.endpointKey)
        if (!integration) return Response.json({ error: 'Unknown webhook endpoint' }, { status: 404 })

        const suppliedToken = request.headers.get('x-callback-token') ?? ''
        const config = normalizeXenditConfig(integration.config)
        const validToken = [config.sandbox?.webhookToken, config.live?.webhookToken]
          .some((token) => validXenditWebhookToken(token, suppliedToken))
        if (!validToken) {
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

        const {
          eventType,
          isRefund,
          reference,
          providerTimestamp,
          eventId,
          subscriptionKind,
          cycleId,
        } = xenditWebhookIdentity(payload)
        if (subscriptionKind === 'cycle' && !cycleId) {
          console.info('[xendit-webhook-ignored]', { eventType, reason: 'cycle-reference-unavailable' })
          return Response.json({ received: true, ignored: true }, { status: 202 })
        }
        if (!reference) {
          console.info('[xendit-webhook-ignored]', { eventType, reason: 'reference-unavailable' })
          return Response.json({ received: true, ignored: true }, { status: 202 })
        }

        const payment = await paymentByGatewayReference(reference)
        if (!payment) {
          console.info('[xendit-webhook-ignored]', { eventType, reason: 'payment-not-found' })
          return Response.json({ received: true, ignored: true }, { status: 202 })
        }

        try {
          const gatewayEventId = request.headers.get('webhook-id') ?? eventId
          const result = subscriptionKind && payment.paymentKind === 'subscription'
            ? await reconcileSubscriptionWebhook({
                paymentId: payment.id,
                eventType,
                gatewayEventId,
                providerTimestamp,
                payload,
                expectedProfileId: integration.profileId,
                kind: subscriptionKind,
              })
            : await reconcilePayment({
                paymentId: payment.id,
                source: 'webhook',
                eventType,
                gatewayEventId,
                providerTimestamp,
                payload,
                forcedStatus: isRefund && /succeed|paid|completed/i.test(eventType) ? 'refunded' : undefined,
                expectedProfileId: integration.profileId,
              })
          const shouldComplete = payment.paymentKind === 'subscription'
            ? 'subscriptionActivated' in result && result.subscriptionActivated
            : result.status === 'completed'
          if (payment.pageSessionId && shouldComplete) {
            await completePaidPageSubmission(payment.pageSessionId)
          }
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
