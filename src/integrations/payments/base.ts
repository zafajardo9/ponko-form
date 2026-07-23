import type {
  PaymentRequest,
  PaymentResult,
  PaymentStatus,
  PaymentDetails,
  GatewayConfigSchema,
  GatewayCredentials,
  SubscriptionCycleDetails,
  SubscriptionPlanDetails,
  SubscriptionRequest,
  SubscriptionResult,
  SubscriptionSessionDetails,
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
  supportsSubscriptions(): boolean {
    return false
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
  async getPaymentDetails(
    gatewayPaymentId: string,
    credentials?: GatewayCredentials,
  ): Promise<PaymentDetails> {
    const status = await this.verifyPayment(gatewayPaymentId, credentials)
    return { status, providerStatus: status }
  }
  async createSubscription(
    _request: SubscriptionRequest,
    _credentials?: GatewayCredentials,
  ): Promise<SubscriptionResult> {
    throw new Error(`${this.getGatewayName()} does not support subscriptions`)
  }
  async getSubscriptionSession(
    _paymentSessionId: string,
    _credentials?: GatewayCredentials,
  ): Promise<SubscriptionSessionDetails> {
    throw new Error(`${this.getGatewayName()} does not support subscriptions`)
  }
  async getSubscriptionPlan(
    _subscriptionPlanId: string,
    _credentials?: GatewayCredentials,
  ): Promise<SubscriptionPlanDetails> {
    throw new Error(`${this.getGatewayName()} does not support subscriptions`)
  }
  async listSubscriptionCycles(
    _subscriptionPlanId: string,
    _credentials?: GatewayCredentials,
  ): Promise<SubscriptionCycleDetails[]> {
    throw new Error(`${this.getGatewayName()} does not support subscriptions`)
  }
  abstract getConfigSchema(): GatewayConfigSchema
}
