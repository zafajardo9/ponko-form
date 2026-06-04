import { PaymentGateway } from './base'
import { db } from '../../db/index'
import { paymentGateways } from '../../db/schema'
import { eq } from 'drizzle-orm'

class PaymentGatewayRegistry {
  private gateways = new Map<string, PaymentGateway>()

  register(gateway: PaymentGateway): void {
    this.gateways.set(gateway.getGatewaySlug(), gateway)
  }

  get(slug: string): PaymentGateway | undefined {
    return this.gateways.get(slug)
  }

  getAll(): PaymentGateway[] {
    return Array.from(this.gateways.values())
  }

  async getActive(): Promise<PaymentGateway[]> {
    const active = await db
      .select()
      .from(paymentGateways)
      .where(eq(paymentGateways.isActive, true))
    const activeSlugs = new Set(active.map((g) => g.slug))
    return this.getAll().filter((g: PaymentGateway) => activeSlugs.has(g.getGatewaySlug()))
  }
}

export const paymentRegistry = new PaymentGatewayRegistry()
