import { createServerFn } from '@tanstack/react-start'
import { db } from '../../db/index'
import { paymentGateways } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { paymentRegistry } from '../../integrations/payments/index'

/**
 * getActiveGateways()
 * List active payment gateways for the Payment node config picker.
 */
export const getActiveGateways = createServerFn({ method: 'GET' }).handler(async () => {
  return db.select().from(paymentGateways).where(eq(paymentGateways.isActive, true))
})

/**
 * getGatewayCurrencySupport()
 * Which currencies each registered gateway can process. Pure metadata (no
 * secrets) so it's safe to send to the builder, where it powers the currency
 * compatibility warning on the Payment node. Auto-includes any future gateway.
 */
export const getGatewayCurrencySupport = createServerFn({ method: 'GET' }).handler(
  async () =>
    paymentRegistry.getAll().map((g) => ({
      slug: g.getGatewaySlug(),
      name: g.getGatewayName(),
      currencies: g.getSupportedCurrencies(),
    })),
)
