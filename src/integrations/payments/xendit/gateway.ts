import { PaymentGateway } from '../base'
import type {
  PaymentRequest,
  PaymentResult,
  PaymentStatus,
  GatewayConfigSchema,
  GatewayCredentials,
  PaymentDetails,
  SubscriptionCycleDetails,
  SubscriptionCycleStatus,
  SubscriptionPlanDetails,
  SubscriptionPlanStatus,
  SubscriptionRequest,
  SubscriptionResult,
  SubscriptionSessionDetails,
} from '../types'

const XENDIT_SUBSCRIPTION_API_VERSION = '2026-01-01'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value ? value : undefined
}

function majorToMinor(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) : 0
}

function planStatus(value: unknown): SubscriptionPlanStatus {
  switch (String(value ?? '').toUpperCase()) {
    case 'ACTIVE': return 'active'
    case 'PAUSED': return 'paused'
    case 'PAST_DUE': return 'past_due'
    case 'COMPLETED': return 'completed'
    case 'CANCELLED':
    case 'CANCELED': return 'cancelled'
    case 'INACTIVE':
    case 'DEACTIVATED': return 'deactivated'
    case 'FAILED': return 'failed'
    default: return 'pending'
  }
}

function cycleStatus(value: unknown): SubscriptionCycleStatus {
  switch (String(value ?? '').toUpperCase()) {
    case 'SUCCEEDED':
    case 'PAID':
    case 'COMPLETED': return 'paid'
    case 'RETRYING':
    case 'ATTEMPTING': return 'retrying'
    case 'FAILED': return 'failed'
    case 'CANCELLED':
    case 'CANCELED': return 'cancelled'
    case 'SKIPPED': return 'skipped'
    case 'SCHEDULED': return 'scheduled'
    default: return 'pending'
  }
}

export class XenditGateway extends PaymentGateway {
  getGatewaySlug(): string {
    return 'xendit'
  }

  getGatewayName(): string {
    return 'Xendit'
  }

  // Xendit invoices are settled in the account's home currency. Our accounts are
  // provisioned for the Philippines, so only PHP is accepted here.
  getSupportedCurrencies(): string[] {
    return ['PHP']
  }

  supportsSubscriptions(): boolean {
    return true
  }

  // Prefer the form owner's own key; fall back to the platform env var.
  private apiKey(credentials?: GatewayCredentials): string {
    const key = credentials?.secretKey || process.env.XENDIT_SECRET_KEY
    if (!key) throw new Error('Xendit secret key not configured')
    return key
  }

  private authHeader(credentials?: GatewayCredentials): string {
    return `Basic ${Buffer.from(`${this.apiKey(credentials)}:`).toString('base64')}`
  }

  async createPayment(
    request: PaymentRequest,
    credentials?: GatewayCredentials,
  ): Promise<PaymentResult> {
    try {
      const externalId = request.externalId ?? `ponkoform-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const amount = request.amount / 100

      const response = await fetch('https://api.xendit.co/v2/invoices', {
        method: 'POST',
        headers: {
          Authorization: this.authHeader(credentials),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          external_id: externalId,
          amount,
          currency: request.currency,
          success_redirect_url: request.returnUrl,
          failure_redirect_url: request.cancelUrl,
          metadata: request.metadata,
        }),
      })

      if (!response.ok) {
        const err = await response.text()
        return { success: false, paymentUrl: null, gatewayPaymentId: null, error: err }
      }

      const invoice = await response.json() as { id: string; invoice_url: string; expiry_date?: string }
      return {
        success: true,
        paymentUrl: invoice.invoice_url,
        gatewayPaymentId: invoice.id,
        expiresAt: invoice.expiry_date ?? null,
        error: null,
      }
    } catch (err) {
      return { success: false, paymentUrl: null, gatewayPaymentId: null, error: String(err) }
    }
  }

  async createSubscription(
    request: SubscriptionRequest,
    credentials?: GatewayCredentials,
  ): Promise<SubscriptionResult> {
    try {
      const response = await fetch('https://api.xendit.co/sessions', {
        method: 'POST',
        headers: {
          Authorization: this.authHeader(credentials),
          'Content-Type': 'application/json',
          'api-version': XENDIT_SUBSCRIPTION_API_VERSION,
        },
        body: JSON.stringify({
          reference_id: request.referenceId,
          session_type: 'SUBSCRIPTION',
          mode: 'PAYMENT_LINK',
          amount: request.amount / 100,
          currency: request.currency,
          country: 'PH',
          customer: {
            reference_id: request.customerReferenceId,
            type: 'INDIVIDUAL',
            email: request.customerEmail,
            individual_detail: { given_names: request.customerName },
          },
          locale: 'en',
          description: request.description,
          subscription: {
            schedule: {
              interval: request.interval,
              interval_count: request.intervalCount,
              anchor_date: request.anchorDate,
              ...(request.totalRecurrence ? { total_recurrence: request.totalRecurrence } : {}),
              retry_interval: 'DAY',
              retry_interval_count: 1,
              total_retry: 3,
              failed_attempt_notifications: [1, 2, 3],
            },
            immediate_payment: request.immediatePayment,
            failed_cycle_action: 'RESUME',
          },
          notification_channels: ['EMAIL'],
          metadata: request.metadata,
          success_return_url: request.returnUrl,
          cancel_return_url: request.cancelUrl,
        }),
      })
      if (!response.ok) {
        return {
          success: false,
          paymentUrl: null,
          paymentSessionId: null,
          subscriptionPlanId: null,
          providerStatus: null,
          error: `Xendit subscription checkout failed (${response.status})`,
        }
      }
      const session = asRecord(await response.json())
      return {
        success: true,
        paymentUrl: optionalString(session.payment_link_url) ?? null,
        paymentSessionId: optionalString(session.payment_session_id) ?? optionalString(session.id) ?? null,
        subscriptionPlanId: optionalString(session.recurring_plan_id) ?? null,
        providerStatus: optionalString(session.status) ?? null,
        expiresAt: optionalString(session.expires_at) ?? null,
        error: null,
      }
    } catch (error) {
      return {
        success: false,
        paymentUrl: null,
        paymentSessionId: null,
        subscriptionPlanId: null,
        providerStatus: null,
        error: error instanceof Error ? error.message : 'Xendit subscription checkout failed',
      }
    }
  }

  async getSubscriptionSession(
    paymentSessionId: string,
    credentials?: GatewayCredentials,
  ): Promise<SubscriptionSessionDetails> {
    const response = await fetch(`https://api.xendit.co/sessions/${encodeURIComponent(paymentSessionId)}`, {
      headers: {
        Authorization: this.authHeader(credentials),
        'api-version': XENDIT_SUBSCRIPTION_API_VERSION,
      },
    })
    if (!response.ok) throw new Error(`Xendit subscription session verification failed (${response.status})`)
    const session = asRecord(await response.json())
    const providerStatus = String(session.status ?? 'UNKNOWN').toUpperCase()
    const status = providerStatus === 'COMPLETED'
      ? 'active'
      : ['EXPIRED'].includes(providerStatus)
        ? 'expired'
        : ['CANCELLED', 'CANCELED'].includes(providerStatus)
          ? 'cancelled'
          : ['FAILED'].includes(providerStatus)
            ? 'failed'
            : 'pending'
    return {
      status,
      providerStatus,
      paymentSessionId: optionalString(session.payment_session_id) ?? optionalString(session.id) ?? paymentSessionId,
      subscriptionPlanId: optionalString(session.recurring_plan_id),
      expiresAt: optionalString(session.expires_at),
      raw: session,
    }
  }

  async getSubscriptionPlan(
    subscriptionPlanId: string,
    credentials?: GatewayCredentials,
  ): Promise<SubscriptionPlanDetails> {
    const response = await fetch(`https://api.xendit.co/recurring/plans/${encodeURIComponent(subscriptionPlanId)}`, {
      headers: {
        Authorization: this.authHeader(credentials),
        'api-version': XENDIT_SUBSCRIPTION_API_VERSION,
      },
    })
    if (!response.ok) throw new Error(`Xendit subscription plan verification failed (${response.status})`)
    const plan = asRecord(await response.json())
    const schedule = asRecord(plan.schedule)
    const providerStatus = String(plan.status ?? 'UNKNOWN').toUpperCase()
    return {
      status: planStatus(providerStatus),
      providerStatus,
      subscriptionPlanId: optionalString(plan.id) ?? subscriptionPlanId,
      nextChargeAt: optionalString(schedule.next_scheduled_at) ?? optionalString(plan.next_scheduled_at),
      endedAt: optionalString(plan.ended_at) ?? optionalString(plan.deactivated_at),
      interval: schedule.interval === 'WEEK' || schedule.interval === 'MONTH' ? schedule.interval : undefined,
      intervalCount: typeof schedule.interval_count === 'number' ? schedule.interval_count : undefined,
      raw: plan,
    }
  }

  async listSubscriptionCycles(
    subscriptionPlanId: string,
    credentials?: GatewayCredentials,
  ): Promise<SubscriptionCycleDetails[]> {
    const response = await fetch(
      `https://api.xendit.co/recurring/plans/${encodeURIComponent(subscriptionPlanId)}/cycles`,
      { headers: { Authorization: this.authHeader(credentials), 'api-version': XENDIT_SUBSCRIPTION_API_VERSION } },
    )
    if (!response.ok) throw new Error(`Xendit subscription cycle verification failed (${response.status})`)
    const payload = await response.json() as unknown
    const rows = Array.isArray(payload) ? payload : Array.isArray(asRecord(payload).data) ? asRecord(payload).data as unknown[] : []
    return rows.map((value) => {
      const cycle = asRecord(value)
      const attempts = Array.isArray(cycle.attempt_details) ? cycle.attempt_details.map(asRecord) : []
      const lastAttempt = attempts[attempts.length - 1] ?? {}
      const providerStatus = String(cycle.status ?? 'UNKNOWN').toUpperCase()
      const status = cycleStatus(providerStatus)
      return {
        gatewayCycleId: String(cycle.id ?? cycle.cycle_id ?? ''),
        cycleNumber: typeof cycle.cycle_number === 'number'
          ? cycle.cycle_number
          : typeof cycle.recurring_cycle_count === 'number' ? cycle.recurring_cycle_count : undefined,
        status,
        providerStatus,
        amount: majorToMinor(cycle.amount),
        currency: String(cycle.currency ?? 'PHP'),
        scheduledAt: optionalString(cycle.scheduled_timestamp) ?? optionalString(cycle.scheduled_at),
        paidAt: status === 'paid' ? optionalString(cycle.succeeded_at) ?? optionalString(cycle.paid_at) ?? optionalString(cycle.updated) : undefined,
        failedAt: status === 'failed' ? optionalString(cycle.failed_at) ?? optionalString(cycle.updated) : undefined,
        failureCode: optionalString(lastAttempt.failure_code) ?? optionalString(cycle.failure_code),
        raw: cycle,
      }
    }).filter((cycle) => cycle.gatewayCycleId)
  }

  async verifyPayment(
    gatewayPaymentId: string,
    credentials?: GatewayCredentials,
  ): Promise<PaymentStatus> {
    return (await this.getPaymentDetails(gatewayPaymentId, credentials)).status
  }

  async getPaymentDetails(
    gatewayPaymentId: string,
    credentials?: GatewayCredentials,
  ): Promise<PaymentDetails> {
    try {
      const response = await fetch(`https://api.xendit.co/v2/invoices/${gatewayPaymentId}`, {
        headers: { Authorization: this.authHeader(credentials) },
      })

      if (!response.ok) throw new Error(`Xendit verification failed (${response.status})`)
      const invoice = await response.json() as Record<string, unknown> & { status: string }

      let status: PaymentStatus
      switch (invoice.status) {
        case 'PAID':
        case 'SETTLED':
          status = 'completed'
          break
        case 'EXPIRED':
          status = 'failed'
          break
        default:
          status = 'pending'
      }
      const majorToMinor = (value: unknown) =>
        typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) : undefined
      return {
        status,
        providerStatus: invoice.status,
        amount: majorToMinor(invoice.amount),
        paidAmount: majorToMinor(invoice.paid_amount),
        currency: typeof invoice.currency === 'string' ? invoice.currency : undefined,
        paidAt: typeof invoice.paid_at === 'string' ? invoice.paid_at : undefined,
        paymentMethod: typeof invoice.payment_method === 'string' ? invoice.payment_method : undefined,
        paymentChannel: typeof invoice.payment_channel === 'string' ? invoice.payment_channel : undefined,
        failureReason: typeof invoice.failure_reason === 'string' ? invoice.failure_reason : undefined,
        raw: invoice,
      }
    } catch (error) {
      throw error instanceof Error ? error : new Error('Xendit verification failed')
    }
  }

  getConfigSchema(): GatewayConfigSchema {
    return {
      fields: [
        {
          key: 'webhookSecret',
          label: 'Xendit Webhook Verification Token',
          type: 'password',
          required: false,
        },
      ],
    }
  }
}
