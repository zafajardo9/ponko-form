export interface PaymentRequest {
  amount: number
  currency: string
  metadata: Record<string, string>
  externalId?: string
  returnUrl: string
  cancelUrl: string
}

export interface PaymentResult {
  success: boolean
  paymentUrl: string | null
  gatewayPaymentId: string | null
  expiresAt?: string | null
  error: string | null
}

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded'

export interface PaymentDetails {
  status: PaymentStatus
  providerStatus: string
  amount?: number
  paidAmount?: number
  currency?: string
  paidAt?: string
  paymentMethod?: string
  paymentChannel?: string
  failureReason?: string
  raw?: Record<string, unknown>
}

export type SubscriptionEnrollmentStatus = 'pending' | 'active' | 'failed' | 'expired' | 'cancelled'
export type SubscriptionPlanStatus =
  | 'pending'
  | 'active'
  | 'paused'
  | 'past_due'
  | 'completed'
  | 'cancelled'
  | 'deactivated'
  | 'failed'
export type SubscriptionCycleStatus = 'scheduled' | 'pending' | 'retrying' | 'paid' | 'failed' | 'cancelled' | 'skipped'

export interface SubscriptionRequest {
  amount: number
  currency: string
  referenceId: string
  customerReferenceId: string
  customerName: string
  customerEmail: string
  description: string
  interval: 'WEEK' | 'MONTH'
  intervalCount: number
  anchorDate: string
  totalRecurrence?: number | null
  immediatePayment: boolean
  metadata: Record<string, string>
  returnUrl: string
  cancelUrl: string
}

export interface SubscriptionResult {
  success: boolean
  paymentUrl: string | null
  paymentSessionId: string | null
  subscriptionPlanId: string | null
  providerStatus: string | null
  expiresAt?: string | null
  error: string | null
}

export interface SubscriptionSessionDetails {
  status: SubscriptionEnrollmentStatus
  providerStatus: string
  paymentSessionId: string
  subscriptionPlanId?: string
  expiresAt?: string
  raw?: Record<string, unknown>
}

export interface SubscriptionPlanDetails {
  status: SubscriptionPlanStatus
  providerStatus: string
  subscriptionPlanId: string
  nextChargeAt?: string
  endedAt?: string
  interval?: 'WEEK' | 'MONTH'
  intervalCount?: number
  raw?: Record<string, unknown>
}

export interface SubscriptionCycleDetails {
  gatewayCycleId: string
  cycleNumber?: number
  status: SubscriptionCycleStatus
  providerStatus: string
  amount: number
  currency: string
  scheduledAt?: string
  paidAt?: string
  failedAt?: string
  failureCode?: string
  raw?: Record<string, unknown>
}

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
