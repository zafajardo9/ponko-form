import { PaymentGateway } from '../base'
import type { PaymentRequest, PaymentResult, PaymentStatus, GatewayConfigSchema } from '../types'

export class XenditGateway extends PaymentGateway {
  getGatewaySlug(): string {
    return 'xendit'
  }

  getGatewayName(): string {
    return 'Xendit'
  }

  private get apiKey(): string {
    const key = process.env.XENDIT_SECRET_KEY
    if (!key) throw new Error('Xendit secret key not configured')
    return key
  }

  private get authHeader(): string {
    return `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`
  }

  async createPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      const externalId = `ponkoform-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const amount = request.amount / 100

      const response = await fetch('https://api.xendit.co/v2/invoices', {
        method: 'POST',
        headers: {
          Authorization: this.authHeader,
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

      const invoice = await response.json() as { id: string; invoice_url: string }
      return {
        success: true,
        paymentUrl: invoice.invoice_url,
        gatewayPaymentId: invoice.id,
        error: null,
      }
    } catch (err) {
      return { success: false, paymentUrl: null, gatewayPaymentId: null, error: String(err) }
    }
  }

  async verifyPayment(gatewayPaymentId: string): Promise<PaymentStatus> {
    try {
      const response = await fetch(`https://api.xendit.co/v2/invoices/${gatewayPaymentId}`, {
        headers: { Authorization: this.authHeader },
      })

      if (!response.ok) return 'failed'
      const invoice = await response.json() as { status: string }

      switch (invoice.status) {
        case 'PAID':
        case 'SETTLED':
          return 'completed'
        case 'EXPIRED':
          return 'failed'
        default:
          return 'pending'
      }
    } catch {
      return 'failed'
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
