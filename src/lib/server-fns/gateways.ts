import { createServerFn } from '@tanstack/react-start'
import { db } from '../../db/index'
import { paymentGateways } from '../../db/schema'
import { paymentRegistry } from '../../integrations/payments/index'
import { getAllIntegrationStatuses, requireProfile } from '../integrations/credentials'

/**
 * getActiveGateways()
 * Every registered payment gateway, for the page builder's gateway picker.
 * Each entry carries a stable `id` — the `payment_gateways` row is upserted on
 * demand so a gateway is referenceable before it has ever processed a payment —
 * plus a `connected` flag reflecting whether the current user has wired up
 * credentials for it in the Integrations hub.
 */
export const getActiveGateways = createServerFn({ method: 'GET' }).handler(async () => {
  const profile = await requireProfile()
  const statuses = await getAllIntegrationStatuses(profile.id)
  const connected = new Set<string>(statuses.filter((s) => s.configured).map((s) => s.provider))

  const gateways: { id: number; name: string; slug: string; connected: boolean }[] = []
  for (const gateway of paymentRegistry.getAll()) {
    const slug = gateway.getGatewaySlug()
    const name = gateway.getGatewayName()
    const [row] = await db
      .insert(paymentGateways)
      .values({ name, slug, isActive: true })
      .onConflictDoUpdate({ target: paymentGateways.slug, set: { name, isActive: true } })
      .returning({ id: paymentGateways.id })
    gateways.push({ id: row.id, name, slug, connected: connected.has(slug) })
  }
  return gateways
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
