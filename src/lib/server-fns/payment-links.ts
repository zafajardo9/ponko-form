import { createServerFn } from '@tanstack/react-start'
import { randomBytes } from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index'
import { paymentGateways, paymentLinks, payments } from '../../db/schema'
import { loadIntegrationConfigs, requireProfile } from '../integrations/credentials'
import { paymentRegistry } from '../../integrations/payments'
import { claimPaymentCheckout } from '../payments/checkout-claim'
import { publicRequestOrigin } from './request-origin'
import { withTimeout } from '../../db/with-timeout'
import {
  createPaymentLinkInputSchema,
  finalizePaymentLinkSchema,
  initiatePaymentLinkSchema,
  paymentLinkCheckoutKey,
  paymentLinkReturnUrl,
  publicPaymentLinkIdSchema,
  type PaymentLinkGatewaySlug,
} from '../payment-links/model'

type GatewaySlug = PaymentLinkGatewaySlug

// ── Helpers ──

function generatePublicId(): string {
  return randomBytes(8).toString('base64url').slice(0, 16)
}

function generateAttemptToken(): string {
  return randomBytes(24).toString('base64url')
}

function amountMinor(amountMajor: number): number {
  return Math.round(amountMajor * 100)
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

async function gatewayRowId(slug: GatewaySlug, name: string): Promise<number> {
  const [created] = await db
    .insert(paymentGateways)
    .values({ name, slug, isActive: true })
    .onConflictDoUpdate({ target: paymentGateways.slug, set: { name, isActive: true } })
    .returning({ id: paymentGateways.id })
  return created.id
}

function credentialsForSlug(
  slug: GatewaySlug,
  configs: Awaited<ReturnType<typeof loadIntegrationConfigs>>,
): Record<string, unknown> | null {
  if (slug === 'xendit' && configs.xendit) {
    return { secretKey: configs.xendit.secretKey, publicKey: configs.xendit.publicKey, mode: configs.xendit.mode }
  }
  if (slug === 'paypal' && configs.paypal) {
    return { clientId: configs.paypal.clientId, clientSecret: configs.paypal.clientSecret, mode: configs.paypal.mode }
  }
  return null
}

// ── Creator-facing (authenticated) ──

export const createPaymentLink = createServerFn({ method: 'POST' })
  .validator(createPaymentLinkInputSchema)
  .handler(async ({ data }) => {
    const profile = await requireProfile()

    const gateway = paymentRegistry.get(data.paymentGatewaySlug)
    if (!gateway) throw new Error(`Unknown gateway: ${data.paymentGatewaySlug}`)
    if (!gateway.getSupportedCurrencies().includes(data.currency)) {
      throw new Error(`${gateway.getGatewayName()} does not support ${data.currency}`)
    }
    const configs = await loadIntegrationConfigs(profile.id)
    if (!credentialsForSlug(data.paymentGatewaySlug, configs)) {
      throw new Error(`Connect ${gateway.getGatewayName()} in Integrations before creating a payment link`)
    }

    const gwId = await gatewayRowId(data.paymentGatewaySlug, gateway.getGatewayName())
    const publicId = generatePublicId()

    const [link] = await db.insert(paymentLinks).values({
      profileId: profile.id,
      publicId,
      title: data.title.trim(),
      description: data.description?.trim() ?? null,
      amount: amountMinor(data.amount),
      currency: data.currency.toUpperCase(),
      paymentGatewayId: gwId,
      allowCustomAmount: data.allowCustomAmount ?? false,
      minAmount: data.minAmount != null ? amountMinor(data.minAmount) : null,
      maxAmount: data.maxAmount != null ? amountMinor(data.maxAmount) : null,
      redirectUrl: data.redirectUrl?.trim() ?? null,
      successMessage: data.successMessage?.trim() ?? null,
    }).returning()

    return { ...link, publicUrl: `/pay/${link.publicId}` }
  })

export const getPaymentLinks = createServerFn({ method: 'GET' })
  .handler(async () => {
    const profile = await requireProfile()
    const rows = await db
      .select()
      .from(paymentLinks)
      .where(eq(paymentLinks.profileId, profile.id))
      .orderBy(desc(paymentLinks.createdAt))
    return rows
  })

export const togglePaymentLink = createServerFn({ method: 'POST' })
  .validator((data: { id: number; isActive: boolean }) => data)
  .handler(async ({ data }) => {
    const profile = await requireProfile()
    await db
      .update(paymentLinks)
      .set({ isActive: data.isActive, updatedAt: new Date() })
      .where(and(eq(paymentLinks.id, data.id), eq(paymentLinks.profileId, profile.id)))
    return { success: true }
  })

export const deletePaymentLink = createServerFn({ method: 'POST' })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const profile = await requireProfile()
    await db
      .delete(paymentLinks)
      .where(and(eq(paymentLinks.id, data.id), eq(paymentLinks.profileId, profile.id)))
    return { success: true }
  })

// ── Public-facing (no auth) ──

export const getPublicPaymentLink = createServerFn({ method: 'GET', strict: false })
  .validator(z.object({ publicId: publicPaymentLinkIdSchema }).strict())
  .handler(async ({ data }) => {
    const [link] = await db
      .select({
        title: paymentLinks.title,
        description: paymentLinks.description,
        amount: paymentLinks.amount,
        currency: paymentLinks.currency,
        allowCustomAmount: paymentLinks.allowCustomAmount,
        minAmount: paymentLinks.minAmount,
        maxAmount: paymentLinks.maxAmount,
        isActive: paymentLinks.isActive,
        providerName: paymentGateways.name,
        providerSlug: paymentGateways.slug,
      })
      .from(paymentLinks)
      .innerJoin(paymentGateways, eq(paymentLinks.paymentGatewayId, paymentGateways.id))
      .where(eq(paymentLinks.publicId, data.publicId))
      .limit(1)

    if (!link) throw new Error('Payment link not found')
    if (!link.isActive) throw new Error('This payment link is no longer active')

    return {
      title: link.title,
      description: link.description,
      amount: link.amount,
      currency: link.currency,
      allowCustomAmount: link.allowCustomAmount,
      minAmount: link.minAmount,
      maxAmount: link.maxAmount,
      providerName: link.providerName,
      providerSlug: link.providerSlug,
    }
  })

export const initiatePaymentLinkCheckout = createServerFn({ method: 'POST', strict: false })
  .validator(initiatePaymentLinkSchema)
  .handler(async ({ data }) => {
    const [link] = await db
      .select()
      .from(paymentLinks)
      .where(eq(paymentLinks.publicId, data.publicId))
      .limit(1)

    if (!link) throw new Error('Payment link not found')
    if (!link.isActive) throw new Error('This payment link is no longer active')

    // Resolve amount
    let finalAmountMinor = link.amount
    if (link.allowCustomAmount && data.customAmount != null) {
      const customMinor = amountMinor(data.customAmount)
      if (link.minAmount != null && customMinor < link.minAmount) {
        throw new Error(`Minimum amount is ${formatMoney(link.minAmount / 100, link.currency)}`)
      }
      if (link.maxAmount != null && customMinor > link.maxAmount) {
        throw new Error(`Maximum amount is ${formatMoney(link.maxAmount / 100, link.currency)}`)
      }
      finalAmountMinor = customMinor
    }

    if (finalAmountMinor <= 0) throw new Error('Nothing to pay')

    // Resolve gateway
    const [gw] = await db
      .select({ slug: paymentGateways.slug, name: paymentGateways.name })
      .from(paymentGateways)
      .where(eq(paymentGateways.id, link.paymentGatewayId))
      .limit(1)
    if (!gw) throw new Error('Payment gateway not found')

    const gateway = paymentRegistry.get(gw.slug as GatewaySlug)
    if (!gateway) throw new Error(`Unknown gateway: ${gw.slug}`)

    const configs = await loadIntegrationConfigs(link.profileId)
    const credentials = credentialsForSlug(gw.slug as GatewaySlug, configs)
    if (!credentials) throw new Error(`Payment provider ${gw.name} is not connected`)

    const origin = publicRequestOrigin()
    const attemptToken = generateAttemptToken()
    const returnUrl = paymentLinkReturnUrl(origin, link.publicId, attemptToken)
    const cancelUrl = `${origin}/pay/${link.publicId}`

    const gwId = await gatewayRowId(gw.slug as GatewaySlug, gw.name)
    const checkoutKey = paymentLinkCheckoutKey(link.id, attemptToken)

    const checkout = await claimPaymentCheckout(checkoutKey, {
      paymentGatewayId: gwId,
      amount: finalAmountMinor,
      currency: link.currency,
      paymentLinkId: link.id,
      status: 'pending',
      gatewayResponse: { environment: (credentials as Record<string, unknown>).mode ?? 'sandbox' },
    })

    if (checkout.disposition === 'reuse' && checkout.payment.paymentUrl) {
      return { paymentUrl: checkout.payment.paymentUrl }
    }
    if (checkout.disposition === 'wait') {
      throw new Error('Checkout is already being prepared. Try again in a moment.')
    }
    if (checkout.disposition === 'completed') {
      throw new Error('This payment has already been completed.')
    }

    const payment = checkout.payment
    const externalId = `ponkoform-paylink-${payment.id}`
    await db.update(payments).set({ externalId }).where(eq(payments.id, payment.id))

    const result = await withTimeout(
      gateway.createPayment({
        amount: finalAmountMinor,
        currency: link.currency,
        externalId,
        metadata: { paymentLinkId: String(link.id), paymentId: String(payment.id) },
        returnUrl,
        cancelUrl,
      }, credentials as Record<string, unknown>),
      15_000,
      'initiatePaymentLinkCheckout.gatewayCreate',
    )

    if (!result.success || !result.paymentUrl) {
      await db.update(payments).set({
        status: 'failed',
        failureReason: result.error ?? 'Gateway creation failed',
        failedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(payments.id, payment.id))
      throw new Error(result.error ?? 'Could not start the payment')
    }

    await db.update(payments).set({
      gatewayPaymentId: result.gatewayPaymentId,
      paymentUrl: result.paymentUrl,
      expiresAt: result.expiresAt ? new Date(result.expiresAt) : null,
      updatedAt: new Date(),
    }).where(eq(payments.id, payment.id))

    return { paymentUrl: result.paymentUrl }
  })

export const finalizePaymentLinkPayment = createServerFn({ method: 'POST', strict: false })
  .validator(finalizePaymentLinkSchema)
  .handler(async ({ data }) => {
    const [link] = await db
      .select({
        id: paymentLinks.id,
        successMessage: paymentLinks.successMessage,
        redirectUrl: paymentLinks.redirectUrl,
      })
      .from(paymentLinks)
      .where(eq(paymentLinks.publicId, data.publicId))
      .limit(1)
    if (!link) throw new Error('Payment link not found')

    const [payment] = await db
      .select({ id: payments.id, status: payments.status, gatewayPaymentId: payments.gatewayPaymentId, amount: payments.amount })
      .from(payments)
      .where(and(
        eq(payments.paymentLinkId, link.id),
        eq(payments.checkoutKey, paymentLinkCheckoutKey(link.id, data.attemptToken)),
      ))
      .limit(1)

    if (!payment) return { paid: false, message: null }

    // Already completed
    if (payment.status === 'completed') {
      return {
        paid: true,
        message: link.successMessage ?? 'Payment successful!',
        redirectUrl: link.redirectUrl,
      }
    }

    // Try reconciliation if pending
    if (payment.status === 'pending' && payment.gatewayPaymentId) {
      const { reconcilePayment } = await import('../payments/reconciliation')
      const reconciliation = await reconcilePayment({
        paymentId: payment.id,
        source: 'return',
      })
      if (reconciliation.status === 'completed') {
        return {
          paid: true,
          message: link.successMessage ?? 'Payment successful!',
          redirectUrl: link.redirectUrl,
        }
      }
    }

    return { paid: false, message: null, redirectUrl: null }
  })
