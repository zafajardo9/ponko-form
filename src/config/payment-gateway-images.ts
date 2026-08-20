/**
 * Payment gateway logo images.
 *
 * This is the single place to set the image for each payment gateway. Paste the
 * URL below — either a file served from `public` (drop it in `public/logos/`
 * and reference it as `/logos/paypal.svg`) or a full HTTPS URL.
 *
 * Leave a value empty (`''`) to fall back to the built-in wordmark logo.
 *
 * These images drive the payment-method buttons on published forms
 * (see `PagePaymentStep`).
 */
export const paymentGatewayImages: Record<string, string> = {
  paypal: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/PayPal.svg/1280px-PayPal.svg.png?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=thumbnail',
  xendit: 'https://www.xendit.co/wp-content/uploads/2020/03/XENDIT-LOGOArtboard-1@2x-1024x441.png',
  maya: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Maya_logo.svg/3840px-Maya_logo.svg.png?utm_source=commons.wikimedia.org&utm_campaign=index&utm_content=thumbnail',
}
