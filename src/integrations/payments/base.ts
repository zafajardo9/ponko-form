import type {
  PaymentRequest,
  PaymentResult,
  PaymentStatus,
  GatewayConfigSchema,
  GatewayCredentials,
} from './types'

export abstract class PaymentGateway {
  abstract getGatewaySlug(): string
  abstract getGatewayName(): string
  // `credentials` are the form owner's own keys (decrypted from
  // integration_settings). When omitted, implementations fall back to env vars.
  abstract createPayment(
    request: PaymentRequest,
    credentials?: GatewayCredentials,
  ): Promise<PaymentResult>
  abstract verifyPayment(
    gatewayPaymentId: string,
    credentials?: GatewayCredentials,
  ): Promise<PaymentStatus>
  abstract getConfigSchema(): GatewayConfigSchema
}
