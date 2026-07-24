import { PaymentGateway } from '../base'
import type {
  PaymentRequest,
  PaymentResult,
  PaymentStatus,
  PaymentDetails,
  GatewayConfigSchema,
  GatewayCredentials,
} from '../types'

export class PayPalGateway extends PaymentGateway {
  getGatewaySlug(): string {
    return 'paypal'
  }

  getGatewayName(): string {
    return 'PayPal'
  }

  // Prefer the form owner's own mode/keys; fall back to platform env vars.
  private baseUrl(credentials?: GatewayCredentials): string {
    const mode = credentials?.mode ?? process.env.PAYPAL_MODE ?? 'sandbox'
    return mode === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com'
  }

  private async getAccessToken(credentials?: GatewayCredentials): Promise<string> {
    const clientId = credentials?.clientId || process.env.PAYPAL_CLIENT_ID
    const clientSecret = credentials?.clientSecret || process.env.PAYPAL_CLIENT_SECRET
    if (!clientId || !clientSecret) throw new Error('PayPal credentials not configured')

    const response = await fetch(`${this.baseUrl(credentials)}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })

    if (!response.ok) throw new Error('Failed to get PayPal access token')
    const data = await response.json() as { access_token: string }
    return data.access_token
  }

  async createPayment(
    request: PaymentRequest,
    credentials?: GatewayCredentials,
  ): Promise<PaymentResult> {
    try {
      const accessToken = await this.getAccessToken(credentials)
      const value = (request.amount / 100).toFixed(2)

      const response = await fetch(`${this.baseUrl(credentials)}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [
            {
              amount: {
                currency_code: request.currency,
                value,
              },
              custom_id: JSON.stringify(request.metadata),
            },
          ],
          application_context: {
            return_url: request.returnUrl,
            cancel_url: request.cancelUrl,
          },
        }),
      })

      if (!response.ok) {
        const err = await response.text()
        return { success: false, paymentUrl: null, gatewayPaymentId: null, error: err }
      }

      const order = await response.json() as {
        id: string
        links: { rel: string; href: string }[]
      }
      // PayPal currently documents `payer-action`, while some Orders v2
      // responses and older account configurations still return `approve`.
      // Both are buyer checkout links; accepting either prevents a valid order
      // from being recorded as failed without redirecting the respondent.
      const approvalLink = order.links.find(
        (link) => link.rel === 'payer-action' || link.rel === 'approve',
      )

      if (!approvalLink?.href) {
        return {
          success: false,
          paymentUrl: null,
          gatewayPaymentId: order.id,
          error: 'PayPal order did not include a checkout URL',
        }
      }

      return {
        success: true,
        paymentUrl: approvalLink.href,
        gatewayPaymentId: order.id,
        error: null,
      }
    } catch (err) {
      return { success: false, paymentUrl: null, gatewayPaymentId: null, error: String(err) }
    }
  }

  async verifyPayment(
    gatewayPaymentId: string,
    credentials?: GatewayCredentials,
  ): Promise<PaymentStatus> {
    return (await this.getPaymentDetails(gatewayPaymentId, credentials)).status
  }

  async getPaymentDetails(
    gatewayPaymentId: string,
    credentials?: GatewayCredentials,
  ): Promise<PaymentDetails> {
    const accessToken = await this.getAccessToken(credentials)
    const orderUrl = `${this.baseUrl(credentials)}/v2/checkout/orders/${encodeURIComponent(gatewayPaymentId)}`
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }

    const readOrder = async () => {
      const response = await fetch(orderUrl, { headers })
      if (!response.ok) {
        throw new Error(`PayPal order verification failed (${response.status})`)
      }
      return response.json() as Promise<PayPalOrder>
    }

    let order = await readOrder()
    if (order.status === 'APPROVED') {
      const capture = await fetch(`${orderUrl}/capture`, {
        method: 'POST',
        headers,
        body: '{}',
      })
      if (capture.ok) {
        order = await capture.json() as PayPalOrder
      } else {
        // The capture may have succeeded even if its response was lost. Read
        // the order once more before deciding, so a retry cannot turn a paid
        // order into a local failure.
        order = await readOrder()
        if (order.status === 'APPROVED') {
          throw new Error(`PayPal capture could not be confirmed (${capture.status})`)
        }
      }
    }

    return paypalOrderDetails(order)
  }

  getConfigSchema(): GatewayConfigSchema {
    return {
      fields: [
        { key: 'merchantEmail', label: 'PayPal Merchant Email', type: 'text', required: true },
      ],
    }
  }
}

type PayPalOrder = {
  status?: string
  purchase_units?: Array<{
    amount?: { currency_code?: string; value?: string }
    payments?: {
      captures?: Array<{
        status?: string
        amount?: { currency_code?: string; value?: string }
        create_time?: string
        status_details?: { reason?: string }
      }>
    }
  }>
}

function paypalMinorAmount(value: string | undefined) {
  if (!value) return undefined
  const amount = Number(value)
  return Number.isFinite(amount) ? Math.round(amount * 100) : undefined
}

function paypalOrderDetails(order: PayPalOrder): PaymentDetails {
  const purchase = order.purchase_units?.[0]
  const captures = purchase?.payments?.captures ?? []
  const completed = captures.find((capture) => capture.status === 'COMPLETED')
  const failed = captures.find((capture) =>
    ['DECLINED', 'DENIED', 'FAILED', 'VOIDED'].includes(capture.status ?? ''),
  )
  const pending = captures.find((capture) => capture.status === 'PENDING')
  const capture = completed ?? failed ?? pending
  const providerStatus = capture?.status ?? order.status ?? 'UNKNOWN'
  const status: PaymentStatus = completed
    ? 'completed'
    : failed || order.status === 'VOIDED'
      ? 'failed'
      : 'pending'
  const amount = capture?.amount ?? purchase?.amount

  return {
    status,
    providerStatus,
    amount: paypalMinorAmount(purchase?.amount?.value),
    paidAmount: completed ? paypalMinorAmount(amount?.value) : undefined,
    currency: amount?.currency_code ?? purchase?.amount?.currency_code,
    paidAt: completed?.create_time,
    paymentMethod: 'paypal',
    paymentChannel: 'PayPal',
    failureReason: failed?.status_details?.reason,
    raw: order as Record<string, unknown>,
  }
}
