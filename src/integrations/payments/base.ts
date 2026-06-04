import type { PaymentRequest, PaymentResult, PaymentStatus, GatewayConfigSchema } from './types'

export abstract class PaymentGateway {
  abstract getGatewaySlug(): string
  abstract getGatewayName(): string
  abstract createPayment(request: PaymentRequest): Promise<PaymentResult>
  abstract verifyPayment(gatewayPaymentId: string): Promise<PaymentStatus>
  abstract getConfigSchema(): GatewayConfigSchema
}
