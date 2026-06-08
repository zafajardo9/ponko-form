export interface PaymentRequest {
  amount: number
  currency: string
  metadata: Record<string, string>
  returnUrl: string
  cancelUrl: string
}

export interface PaymentResult {
  success: boolean
  paymentUrl: string | null
  gatewayPaymentId: string | null
  error: string | null
}

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded'

/**
 * Per-merchant credentials passed to a gateway at call time. These come from the
 * form owner's encrypted `integration_settings` row (see
 * `loadIntegrationConfigs`). When omitted, gateways fall back to the
 * platform-wide `process.env` keys for backward compatibility.
 */
export interface GatewayCredentials {
  // Xendit
  secretKey?: string
  publicKey?: string
  // PayPal
  clientId?: string
  clientSecret?: string
  mode?: 'sandbox' | 'live'
}

export interface GatewayConfigField {
  key: string
  label: string
  type: 'text' | 'password' | 'select'
  required: boolean
  options?: { label: string; value: string }[]
}

export interface GatewayConfigSchema {
  fields: GatewayConfigField[]
}
