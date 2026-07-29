import { z } from 'zod'

export type PaymentLinkGatewaySlug = 'paypal' | 'xendit'

const gatewaySlugSchema = z.enum(['paypal', 'xendit'])
const currencySchema = z.string().trim().transform((value) => value.toUpperCase())
  .pipe(z.string().regex(/^[A-Z]{3}$/, 'Choose a valid three-letter currency'))
const optionalText = (max: number) => z.string().trim().max(max).optional()
const optionalHttpUrl = z.string().trim().max(2048).optional().refine(
  (value) => {
    if (!value) return true
    try {
      const url = new URL(value)
      return url.protocol === 'https:' || url.protocol === 'http:'
    } catch {
      return false
    }
  },
  'Redirect URL must be a valid HTTP or HTTPS URL',
)

export const createPaymentLinkInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(255),
  description: optionalText(5_000),
  amount: z.number().finite().positive().max(9_999_999.99),
  currency: currencySchema,
  paymentGatewaySlug: gatewaySlugSchema,
  allowCustomAmount: z.boolean().optional(),
  minAmount: z.number().finite().positive().max(9_999_999.99).optional(),
  maxAmount: z.number().finite().positive().max(9_999_999.99).optional(),
  redirectUrl: optionalHttpUrl,
  successMessage: optionalText(2_000),
}).strict().superRefine((data, context) => {
  if (data.minAmount != null && data.maxAmount != null && data.minAmount > data.maxAmount) {
    context.addIssue({
      code: 'custom',
      path: ['maxAmount'],
      message: 'Maximum amount must be greater than or equal to the minimum amount',
    })
  }
})

export const publicPaymentLinkIdSchema = z.string().regex(/^[A-Za-z0-9_-]{8,16}$/)
export const initiatePaymentLinkSchema = z.object({
  publicId: publicPaymentLinkIdSchema,
  customAmount: z.number().finite().positive().max(9_999_999.99).optional(),
}).strict()
export const finalizePaymentLinkSchema = z.object({
  publicId: publicPaymentLinkIdSchema,
  attemptToken: z.string().regex(/^[A-Za-z0-9_-]{32}$/),
}).strict()

export function paymentLinkCheckoutKey(paymentLinkId: number, attemptToken: string): string {
  return `paylink:${paymentLinkId}:${attemptToken}`
}

export function paymentLinkReturnUrl(origin: string, publicId: string, attemptToken: string): string {
  return `${origin}/pay/${publicId}/success?attempt=${encodeURIComponent(attemptToken)}`
}
