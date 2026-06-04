import { PaymentGateway } from '../base'
import type {
  PaymentRequest,
  PaymentResult,
  PaymentStatus,
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
      const approvalLink = order.links.find((l) => l.rel === 'payer-action')

      return {
        success: true,
        paymentUrl: approvalLink?.href ?? null,
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
    try {
      const accessToken = await this.getAccessToken(credentials)
      const response = await fetch(
        `${this.baseUrl(credentials)}/v2/checkout/orders/${gatewayPaymentId}/capture`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      )

      if (!response.ok) return 'failed'
      const data = await response.json() as { status: string }
      return data.status === 'COMPLETED' ? 'completed' : 'failed'
    } catch {
      return 'failed'
    }
  }

  getConfigSchema(): GatewayConfigSchema {
    return {
      fields: [
        { key: 'merchantEmail', label: 'PayPal Merchant Email', type: 'text', required: true },
      ],
    }
  }
}
