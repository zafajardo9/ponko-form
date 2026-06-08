import type {
  PaymentRequest,
  PaymentResult,
  PaymentStatus,
  GatewayConfigSchema,
  GatewayCredentials,
} from './types'
import { SUPPORTED_CURRENCIES } from './currencies'

export abstract class PaymentGateway {
  abstract getGatewaySlug(): string
  abstract getGatewayName(): string

  /**
   * Currencies this gateway can actually process. Defaults to every currency we
   * offer, so multi-currency gateways work with zero config. Override in a
   * gateway subclass that only accepts a subset (e.g. Xendit → PHP).
   */
  getSupportedCurrencies(): string[] {
    return [...SUPPORTED_CURRENCIES]
  }
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
