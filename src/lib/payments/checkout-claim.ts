import { and, eq } from 'drizzle-orm'
import { db } from '../../db/index'
import { payments } from '../../db/schema'
import {
  checkoutDisposition,
  type CheckoutDisposition,
} from './checkout-state'

type CheckoutPayment = typeof payments.$inferSelect

export async function claimPaymentCheckout(
  checkoutKey: string,
  values: Omit<typeof payments.$inferInsert, 'checkoutKey'>,
): Promise<{
  disposition: CheckoutDisposition
  payment: CheckoutPayment
}> {
  const now = new Date()
  const [created] = await db
    .insert(payments)
    .values({ ...values, checkoutKey, updatedAt: now })
    .onConflictDoNothing({ target: payments.checkoutKey })
    .returning()
  if (created) return { disposition: 'claimed', payment: created }

  const [existing] = await db
    .select()
    .from(payments)
    .where(eq(payments.checkoutKey, checkoutKey))
    .limit(1)
  if (!existing) throw new Error('Could not initialize payment')
  const disposition = checkoutDisposition(existing, now)
  if (disposition !== 'claim') {
    return { disposition, payment: existing }
  }

  const [claimed] = await db
    .update(payments)
    .set({
      ...values,
      status: 'pending',
      paymentUrl: null,
      gatewayPaymentId: null,
      failureReason: null,
      failedAt: null,
      expiresAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(payments.id, existing.id),
        eq(payments.updatedAt, existing.updatedAt),
      ),
    )
    .returning()
  if (!claimed) {
    const [current] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, existing.id))
      .limit(1)
    if (!current) throw new Error('Payment was removed')
    return { disposition: 'wait', payment: current }
  }
  return { disposition: 'claimed', payment: claimed }
}
