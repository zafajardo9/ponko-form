import { createServerFn } from '@tanstack/react-start'
import { db } from '../../db/index'
import { paymentGateways } from '../../db/schema'
import { eq } from 'drizzle-orm'

/**
 * getActiveGateways()
 * List active payment gateways for the Payment node config picker.
 */
export const getActiveGateways = createServerFn({ method: 'GET' }).handler(async () => {
  return db.select().from(paymentGateways).where(eq(paymentGateways.isActive, true))
})
