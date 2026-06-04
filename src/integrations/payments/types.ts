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
