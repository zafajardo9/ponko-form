/**
 * Currencies a form creator can choose for a Payment node.
 *
 * This list is intentionally the FULL set we offer in the builder — even
 * currencies a given gateway can't process. Picking an unsupported currency is
 * allowed (the builder warns, and checkout simply won't offer the gateways that
 * can't take it); a future feature may auto-convert to a currency the gateway
 * accepts so the money still lands.
 *
 * Pure data only — no Node/`Buffer`/db imports — so this is safe to import from
 * client (builder) code as well as server code.
 */
export const SUPPORTED_CURRENCIES = [
  'USD',
  'PHP',
  'EUR',
  'GBP',
  'SGD',
  'AUD',
] as const

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]
