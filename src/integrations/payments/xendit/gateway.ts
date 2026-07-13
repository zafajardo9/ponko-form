import { PaymentGateway } from '../base'
import type {
  PaymentRequest,
  PaymentResult,
  PaymentStatus,
  GatewayConfigSchema,
  GatewayCredentials,
  PaymentDetails,
} from '../types'

export class XenditGateway extends PaymentGateway {
  getGatewaySlug(): string {
    return 'xendit'
  }

  getGatewayName(): string {
    return 'Xendit'
  }

  // Xendit invoices are settled in the account's home currency. Our accounts are
  // provisioned for the Philippines, so only PHP is accepted here.
  getSupportedCurrencies(): string[] {
    return ['PHP']
  }

  // Prefer the form owner's own key; fall back to the platform env var.
  private apiKey(credentials?: GatewayCredentials): string {
    const key = credentials?.secretKey || process.env.XENDIT_SECRET_KEY
    if (!key) throw new Error('Xendit secret key not configured')
    return key
  }

  private authHeader(credentials?: GatewayCredentials): string {
    return `Basic ${Buffer.from(`${this.apiKey(credentials)}:`).toString('base64')}`
  }

  async createPayment(
    request: PaymentRequest,
    credentials?: GatewayCredentials,
  ): Promise<PaymentResult> {
    try {
      const externalId = request.externalId ?? `ponkoform-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const amount = request.amount / 100

      const response = await fetch('https://api.xendit.co/v2/invoices', {
        method: 'POST',
        headers: {
          Authorization: this.authHeader(credentials),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          external_id: externalId,
          amount,
          currency: request.currency,
          success_redirect_url: request.returnUrl,
          failure_redirect_url: request.cancelUrl,
          metadata: request.metadata,
        }),
      })

      if (!response.ok) {
        const err = await response.text()
        return { success: false, paymentUrl: null, gatewayPaymentId: null, error: err }
      }

      const invoice = await response.json() as { id: string; invoice_url: string; expiry_date?: string }
      return {
        success: true,
        paymentUrl: invoice.invoice_url,
        gatewayPaymentId: invoice.id,
        expiresAt: invoice.expiry_date ?? null,
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
    try {
      const response = await fetch(`https://api.xendit.co/v2/invoices/${gatewayPaymentId}`, {
        headers: { Authorization: this.authHeader(credentials) },
      })

      if (!response.ok) throw new Error(`Xendit verification failed (${response.status})`)
      const invoice = await response.json() as Record<string, unknown> & { status: string }

      let status: PaymentStatus
      switch (invoice.status) {
        case 'PAID':
        case 'SETTLED':
          status = 'completed'
          break
        case 'EXPIRED':
          status = 'failed'
          break
        default:
          status = 'pending'
      }
      const majorToMinor = (value: unknown) =>
        typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) : undefined
      return {
        status,
        providerStatus: invoice.status,
        amount: majorToMinor(invoice.amount),
        paidAmount: majorToMinor(invoice.paid_amount),
        currency: typeof invoice.currency === 'string' ? invoice.currency : undefined,
        paidAt: typeof invoice.paid_at === 'string' ? invoice.paid_at : undefined,
        paymentMethod: typeof invoice.payment_method === 'string' ? invoice.payment_method : undefined,
        paymentChannel: typeof invoice.payment_channel === 'string' ? invoice.payment_channel : undefined,
        failureReason: typeof invoice.failure_reason === 'string' ? invoice.failure_reason : undefined,
        raw: invoice,
      }
    } catch (error) {
      throw error instanceof Error ? error : new Error('Xendit verification failed')
    }
  }

  getConfigSchema(): GatewayConfigSchema {
    return {
      fields: [
        {
          key: 'webhookSecret',
          label: 'Xendit Webhook Verification Token',
          type: 'password',
          required: false,
        },
      ],
    }
  }
}
