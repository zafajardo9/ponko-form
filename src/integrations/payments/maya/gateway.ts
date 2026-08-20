import { PaymentGateway } from '../base'
import type {
  PaymentRequest,
  PaymentResult,
  PaymentStatus,
  PaymentDetails,
  GatewayConfigSchema,
  GatewayCredentials,
} from '../types'

/**
 * Maya Checkout API (v1) gateway.
 *
 * Checkout creation authenticates with Basic Auth using the merchant's PUBLIC
 * key as the username and an empty password. Status is read back from the
 * checkout endpoint and confirmed via webhook (see
 * `routes/api/webhooks/maya/$endpointKey.ts`).
 */
export class MayaGateway extends PaymentGateway {
  getGatewaySlug(): string {
    return 'maya'
  }

  getGatewayName(): string {
    return 'Maya'
  }

  // Maya Checkout settles in PHP (Philippine peso).
  getSupportedCurrencies(): string[] {
    return ['PHP']
  }

  private baseUrl(credentials?: GatewayCredentials): string {
    const mode = credentials?.mode ?? process.env.MAYA_MODE ?? 'sandbox'
    return mode === 'live'
      ? 'https://pg.paymaya.com'
      : 'https://pg-sandbox.paymaya.com'
  }

  private publicKey(credentials?: GatewayCredentials): string {
    const key = credentials?.publicKey || process.env.MAYA_PUBLIC_KEY
    if (!key) throw new Error('Maya public key not configured')
    return key
  }

  private authHeader(credentials?: GatewayCredentials): string {
    return `Basic ${Buffer.from(`${this.publicKey(credentials)}:`).toString('base64')}`
  }

  async createPayment(
    request: PaymentRequest,
    credentials?: GatewayCredentials,
  ): Promise<PaymentResult> {
    try {
      const value = Number((request.amount / 100).toFixed(2))
      const reference = request.externalId ?? `ponkoform-${Date.now()}-${Math.random().toString(36).slice(2)}`

      const response = await fetch(`${this.baseUrl(credentials)}/checkout/v1/checkouts`, {
        method: 'POST',
        headers: {
          Authorization: this.authHeader(credentials),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          totalAmount: { value, currency: request.currency },
          requestReferenceNumber: reference,
          redirectUrl: {
            success: request.returnUrl,
            failure: request.cancelUrl,
            cancel: request.cancelUrl,
          },
        }),
      })

      if (!response.ok) {
        const err = await response.text()
        return { success: false, paymentUrl: null, gatewayPaymentId: null, error: err }
      }

      const checkout = await response.json() as { checkoutId?: string; redirectUrl?: string }
      if (!checkout.checkoutId || !checkout.redirectUrl) {
        return {
          success: false,
          paymentUrl: null,
          gatewayPaymentId: checkout.checkoutId ?? null,
          error: 'Maya did not return a checkout ID or redirect URL',
        }
      }

      return {
        success: true,
        paymentUrl: checkout.redirectUrl,
        gatewayPaymentId: checkout.checkoutId,
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
    const response = await fetch(
      `${this.baseUrl(credentials)}/checkout/v1/checkouts/${encodeURIComponent(gatewayPaymentId)}`,
      { headers: { Authorization: this.authHeader(credentials) } },
    )
    if (!response.ok) {
      throw new Error(`Maya checkout verification failed (${response.status})`)
    }

    const checkout = await response.json() as Record<string, unknown>
    const providerStatus = String(checkout.status ?? 'UNKNOWN').toUpperCase()
    const isPaid = checkout.isPaid === true
    let status: PaymentStatus
    if (providerStatus === 'PAYMENT_SUCCESS' && isPaid) {
      status = 'completed'
    } else if (providerStatus === 'PAYMENT_FAILED' || providerStatus === 'PAYMENT_EXPIRED') {
      status = 'failed'
    } else {
      status = 'pending'
    }

    const totalAmount = (checkout.totalAmount ?? {}) as Record<string, unknown>
    const majorToMinor = (value: unknown) => {
      const amount = typeof value === 'number' ? value : Number(value)
      return Number.isFinite(amount) ? Math.round(amount * 100) : undefined
    }

    return {
      status,
      providerStatus,
      amount: majorToMinor(totalAmount.value),
      paidAmount: status === 'completed' ? majorToMinor(totalAmount.value) : undefined,
      currency: typeof totalAmount.currency === 'string' ? totalAmount.currency : undefined,
      paymentMethod: typeof checkout.paymentScheme === 'string' ? checkout.paymentScheme : undefined,
      paymentChannel: 'Maya',
      failureReason: status === 'failed' ? providerStatus : undefined,
      raw: checkout,
    }
  }

  getConfigSchema(): GatewayConfigSchema {
    return { fields: [] }
  }
}
