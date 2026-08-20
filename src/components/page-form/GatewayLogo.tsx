import { paymentGatewayImages } from '../../config/payment-gateway-images'

/**
 * Brand "logo" for each supported payment gateway.
 *
 * If an image URL is configured in `src/config/payment-gateway-images.ts` it is
 * used directly. Otherwise it falls back to the built-in wordmark (PayPal,
 * Xendit, and Maya are wordmark brands, so the word in brand colors reads as
 * the logo). Rendered `aria-hidden` because the host button carries its own
 * `aria-label` (e.g. "Pay with PayPal").
 */
export function GatewayLogo({ slug, className = '' }: { slug: string; className?: string }) {
  const imageUrl = paymentGatewayImages[slug]
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        aria-hidden="true"
        className={`h-7 w-auto max-w-[160px] object-contain ${className}`}
      />
    )
  }

  if (slug === 'paypal') {
    return (
      <span aria-hidden="true" className={`inline-flex items-baseline leading-none ${className}`}>
        <span className="font-extrabold italic tracking-tight text-[#003087]">Pay</span>
        <span className="font-extrabold italic tracking-tight text-[#009cde]">Pal</span>
      </span>
    )
  }

  if (slug === 'xendit') {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex items-baseline font-extrabold leading-none tracking-tight text-[#6646ff] ${className}`}
      >
        Xendit
      </span>
    )
  }

  if (slug === 'maya') {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex items-baseline font-extrabold lowercase leading-none tracking-tight text-[#00b14f] ${className}`}
      >
        maya
      </span>
    )
  }

  return null
}
