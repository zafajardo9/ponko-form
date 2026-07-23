# FT-015: Xendit Subscription Payments — Recurring Billing on Form Payment Pages

> **Feature Plan** — Extend the page builder's payment system so form creators can mark a payment page as a **subscription** instead of a one-time charge. When configured, the form submission initiates a recurring plan on Xendit rather than a one-off invoice. Respondents go through the same Xendit hosted checkout flow but are enrolled in a subscription that bills on the interval defined by the form creator (e.g., monthly, quarterly, annually). The core payment UX — amount computation, gateway redirect, return verification — stays identical; the only new concepts are **plan duration** and **subscription lifecycle tracking**.

**Status:** 🚧 **Planned** — not yet implemented

**Dependencies:**
- ✅ **FT-007 (Page Builder)** — The payment page system (`formPages.hasPayment`, `formPages.paymentComputation`, `initiatePagePayment`, `finalizePagePayment`) is fully implemented and is the foundation this feature extends.
- ✅ **Existing Xendit Gateway** (`src/integrations/payments/xendit/gateway.ts`) — The gateway already handles one-time invoices via Xendit's Invoices API. This feature adds subscription/plan APIs to the same gateway class.
- ✅ **Existing Payment Architecture** — The `PaymentGateway` abstract class, `paymentRegistry`, credential loading (`loadIntegrationConfigs`), and `payments` table are all in place. Subscriptions add columns but don't replace the existing flow.
- 🚧 **FT-013 (Invoice Builder)** — Subscription payments produce recurring invoices on Xendit's side. The email/invoice delivery after each billing cycle is handled natively by Xendit. PonkoForm's invoice builder may eventually want to send "subscription started" confirmations, but that's out of scope for the initial implementation.
- ⬜ **FT-006 (Table View / Submissions)** — The payments table view in the form dashboard (`src/routes/forms/$formId/payments.tsx`) should eventually show subscription status (active/past_due/cancelled) alongside one-time payment records.

---

## 1. User Story & Problem

### 1.1 Current State

Today, a form creator building a payment page has one option: **one-time payment**. The `formPages` table has these payment-related columns:

| Column | Purpose |
|---|---|
| `has_payment` | Whether this page collects payment |
| `payment_gateway_id` | Which gateway to use |
| `payment_amount_variable` | Variable binding for the amount |
| `payment_currency` | Currency code |
| `payment_computation` | JSON config for computing the amount (sum of options, fixed, formula) |

When the respondent submits the payment page, `initiatePagePayment` creates a one-time Xendit invoice via `POST https://api.xendit.co/v2/invoices` with a single amount. There's no concept of an ongoing billing cycle.

### 1.2 What the User Wants

> *"I created a form for my gym membership. When someone fills it out and pays, I want them to be billed monthly automatically — not just once. I want to set the subscription interval (monthly, quarterly, annually) and the price in the form builder, and Xendit should handle the recurring billing from there. The respondent experience should feel the same — fill form → pay → done — but behind the scenes, it's a subscription."*

### 1.3 The Scenario

1. A gym owner creates a "Membership Signup" form with a payment page
2. They toggle the payment mode to **Subscription**
3. They set the **billing interval** to "Monthly" and the **amount** to ₱2,500
4. They publish the form
5. A respondent fills out the form, reaches the payment page
6. They click "Pay ₱2,500/month" → redirected to Xendit checkout
7. They complete the payment using GCash, bank transfer, or card
8. From that point, Xendit automatically bills them ₱2,500 every month
9. The form submission is marked as completed (with a subscription reference)
10. The creator can see subscription status in the form's payments view

---

## 2. System Design — DB Schema & Architecture

### 2.1 Schema Changes

#### 2.1.1 Extend `formPages` — Subscription Config

Add a nullable JSONB column to `formPages` for subscription configuration:

```sql
ALTER TABLE form_pages
ADD COLUMN subscription_config jsonb;
```

```typescript
// In src/db/schema.ts — add to the formPages table definition:
subscriptionConfig: jsonb('subscription_config').$type<{
  enabled: boolean
  interval: 'weekly' | 'monthly' | 'quarterly' | 'biannually' | 'annually'
  intervalCount: number // e.g., 1 = every 1 month, 3 = every 3 months
  trialPeriodDays?: number | null
  maxCycles?: number | null // null = indefinite
}>(),
```

This column is `null` for one-time payment pages and populated only when the creator enables subscription mode.

#### 2.1.2 Extend `payments` — Subscription Tracking

Add columns to link a payment record back to its Xendit subscription:

```sql
ALTER TABLE payments
ADD COLUMN subscription_id text,
ADD COLUMN subscription_status text,
ADD COLUMN subscription_interval text,
ADD COLUMN subscription_interval_count integer,
ADD COLUMN subscription_trial_end timestamp,
ADD COLUMN subscription_current_period_start timestamp,
ADD COLUMN subscription_current_period_end timestamp;
```

```typescript
// In src/db/schema.ts — add to the payments table definition:
subscriptionId: text('subscription_id'),
subscriptionStatus: varchar('subscription_status', { length: 30 })
  .$type<'active' | 'past_due' | 'unpaid' | 'cancelled' | 'expired' | 'paused'>(),
subscriptionInterval: varchar('subscription_interval', { length: 20 }),
subscriptionIntervalCount: integer('subscription_interval_count'),
subscriptionTrialEnd: timestamp('subscription_trial_end'),
subscriptionCurrentPeriodStart: timestamp('subscription_current_period_start'),
subscriptionCurrentPeriodEnd: timestamp('subscription_current_period_end'),
```

#### 2.1.3 New Enum Extension (Optional)

The `payment_status` enum already covers `pending | completed | failed | refunded`. Subscription payments can reuse these statuses — the initial payment is `pending` → `completed`, and subsequent rebills are tracked via webhook events (not new payment rows unless we choose to create them; see [2.2.2]).

### 2.2 Architecture / Data Flow

#### 2.2.1 Subscription Creation Flow

```
Form creator configures payment page
  └─ Sets mode: "Subscription"
  └─ Sets interval: "Monthly"
  └─ Sets amount: ₱2,500
       │
       ▼
Respondent fills form → reaches payment page
       │
       ▼
initiatePagePayment() called
  └─ Detects subscriptionConfig.enabled === true
  └─ Calls Xendit: POST /v2/plans (create plan)
       └─ name: "Form: [form title]"
       └─ amount: ₱2,500
       └─ currency: PHP
       └─ interval: MONTH
       └─ interval_count: 1
       └─ success_return_url: ponkoform payment-return URL
       └─ failure_return_url: ponkoform cancel URL
  └─ Calls Xendit: POST /v2/plans/{plan_id}/activate
  └─ Stores plan_id → creates or references a reusable plan
  └─ Returns hosted checkout URL (same UX as one-time)
       │
       ▼
Respondent redirected to Xendit checkout
  └─ Completes payment (first invoice is paid immediately)
       │
       ▼
Xendit redirects back to /forms/payment-return
       │
       ▼
finalizePagePayment() called
  └─ Calls Xendit: GET /v2/invoices/{invoice_id}
  └─ Marks payment as 'completed'
  └─ Stores subscription_id, subscription_status = 'active'
  └─ Marks form submission as completed
       │
       ▼
Xendit handles subsequent rebills automatically
  └─ Webhook events: invoice.paid, invoice.expired, subscription.updated
  └─ PonkoForm webhook handler updates payments.subscription_status
  └─ Webhook handler records payment_events for each rebill
```

#### 2.2.2 Plan Management Strategy

Xendit's subscription model works with **Plans** → **Subscriptions** → **Invoices**:

1. **Plan**: A template defining the amount, interval, currency. Created once per form payment page configuration (or reused if the same plan already exists).
2. **Subscription**: Created for each respondent who signs up. Links a customer to a plan.
3. **Invoice**: Generated each billing cycle. First invoice is created immediately upon subscription creation.

**Optimization**: PonkoForm can create **one plan per form payment page config** and reuse it for all respondents who submit that form. The plan ID can be cached in `formPages.subscriptionConfig.planId`. A new plan is created only when the payment page config changes (amount, interval, currency).

```
formPages.subscriptionConfig:
  {
    enabled: true,
    interval: "monthly",
    intervalCount: 1,
    planId: "pln_xxxx",  // cached after first creation
    planCreatedAt: "2026-07-23T..."
  }
```

#### 2.2.3 Customer Identification

Xendit requires a customer reference for subscriptions. PonkoForm can use the form's public submission identifier or generate one:

```
customer: {
  reference_id: `ponkoform-resp-${formSubmissionId}`,
  email: respondentEmail, // if an email field is collected on previous pages
  given_names: respondentName, // if available
}
```

The respondent's email is resolved from the form data if an email-type field exists, otherwise Xendit allows anonymous subscriptions (guest checkout).

### 2.3 Xendit API Endpoints Used

| Endpoint | Method | Purpose |
|---|---|---|
| `/v2/plans` | `POST` | Create a subscription plan |
| `/v2/plans/{id}/activate` | `POST` | Activate the plan so it can accept subscriptions |
| `/v2/plans/{id}` | `PATCH` | Update plan details if form config changes |
| `/subscriptions/v1` | `POST` | Create a subscription for a respondent |
| `/v2/invoices/{id}` | `GET` | Verify payment status (already used for one-time) |

---

## 3. UI Design — Where It Lives, Component Tree

### 3.1 Route / Tab Placement

The subscription toggle lives in the **Page Payment Config** section within the form editor. The existing file is `src/routes/forms/$formId/edit.tsx`, which renders the page builder. The payment config for a page is currently shown when a page has `hasPayment = true`.

**Existing flow** (what happens today when editing a payment page):
```
src/routes/forms/$formId/edit.tsx
  └─ PageBuilder component
       └─ PageConfigPanel (right sidebar, page-level tab)
            └─ Payment section: toggle hasPayment, gateway selector, amount config
```

**New subscription toggle** — added directly into the Payment section:
```
PageConfigPanel → Payment section
  ├─ [x] This page collects payment  (existing toggle)
  ├─ Payment Gateway: [Xendit ▼]     (existing dropdown)
  ├─ Amount computation: [...]        (existing config)
  └─ Payment Mode: [One-time ▼]      ← NEW toggle
       └─ When "Subscription" is selected:
            ├─ Billing Interval: [Monthly ▼]
            │   Options: Weekly, Monthly, Quarterly, Semi-Annual, Annual
            ├─ Interval Count: [1]
            │   e.g., 3 = every 3 months
            ├─ Trial Period: [0] days (optional)
            └─ Max Cycles: [indefinite] (optional, e.g., "12" for yearly cap)
```

### 3.2 Component Tree

```
src/components/page-builder/PaymentConfigSection.tsx  (existing — modify)
  └─ PaymentModeSelector.tsx                            ← NEW
       ├─ Select: one-time | subscription
       ├─ When subscription:
       │    ├─ Select: interval (weekly/monthly/quarterly/biannually/annually)
       │    ├─ NumberInput: intervalCount (default 1)
       │    ├─ NumberInput: trialPeriodDays (optional)
       │    └─ NumberInput: maxCycles (optional, null = indefinite)
       └─ When one-time: no additional fields
```

### 3.3 Mockup — Payment Config with Subscription

```
┌─────────────────────────────────────────────────────┐
│  Payment Configuration                    Page 2/4   │
│─────────────────────────────────────────────────────│
│                                                      │
│  [x] This page collects payment                      │
│                                                      │
│  Payment Gateway                                     │
│  ┌──────────────────────────────────────────────┐    │
│  │ Xendit                                  [▼]  │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  Amount Computation                                  │
│  ┌──────────────────────────────────────────────┐    │
│  │ Sum of priced options                    [▼]  │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  Payment Mode                           ← NEW        │
│  ┌──────────────────────────────────────────────┐    │
│  │ Subscription                             [▼] │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  Billing Interval                        ← NEW       │
│  ┌──────────────────────────────────────────────┐    │
│  │ Monthly                                  [▼] │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  Interval Count                          ← NEW       │
│  ┌────────┐                                          │
│  │   1    │  (e.g., 1 = every month, 3 = quarterly)  │
│  └────────┘                                          │
│                                                      │
│  ── Optional ──                                      │
│  Trial Period                     ┌────────┐         │
│  (days before first charge)       │   0    │         │
│                                   └────────┘         │
│  Max Billing Cycles               ┌────────┐         │
│  (empty = indefinite)             │        │         │
│                                   └────────┘         │
└─────────────────────────────────────────────────────┘
```

### 3.4 Respondent-Facing Changes

The respondent-facing payment step (`src/components/public-form/PublicFormView.tsx`) already handles one-time payments. **The subscription payment step looks identical to the respondent** — they see the amount, click "Pay", and get redirected to Xendit's hosted checkout. The only difference is the payment intent sent to Xendit (invoice vs. subscription creation).

**One small addition**: The payment button label could optionally say "Subscribe" instead of "Pay" when the page is a subscription. This can be a computed label in the payment step UI:

```tsx
// In the payment step component
const actionLabel = subscriptionConfig?.enabled
  ? `Subscribe — ${formatCurrency(amount)}/${interval}`
  : `Pay ${formatCurrency(amount)}`
```

---

## 4. Server Functions / Logic

### 4.1 New: `createSubscriptionPlan` (in `src/lib/server-fns/payments.ts` or new file)

```typescript
/**
 * Creates (or reuses) a Xendit subscription plan for a form's payment page.
 * Called when the form creator saves a payment page with subscriptionConfig.
 * Returns the plan ID to cache in formPages.subscriptionConfig.planId.
 */
export const syncSubscriptionPlan = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    formId: number
    pageId: number
    name: string
    amount: number        // in major units (e.g., 2500)
    currency: string
    interval: 'WEEK' | 'MONTH' | 'QUARTER' | 'BIANNUAL' | 'ANNUAL'
    intervalCount: number
  }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    // ... verify form ownership, load Xendit credentials
    // ... call Xendit POST /v2/plans
    // ... activate plan via POST /v2/plans/{id}/activate
    // ... return { planId: string }
  })
```

**Note**: This could also be server-side only — when `savePageForm` processes a page with `subscriptionConfig.enabled`, it auto-creates/updates the plan. The creator doesn't need to explicitly "sync" the plan; it happens as part of saving the form.

### 4.2 Modified: `initiatePagePayment` (in `src/lib/server-fns/page-forms.ts`)

The core change is in the handler body of `initiatePagePayment` (lines 970-1099). When `page.subscriptionConfig?.enabled === true`, instead of calling `gateway.createPayment()` (which creates a one-time invoice), it calls a new gateway method:

```typescript
// In initiatePagePayment handler, after amount calculation:

const subConfig = page.subscriptionConfig as SubscriptionConfig | undefined

if (subConfig?.enabled) {
  // Create subscription instead of one-time payment
  const subscriptionResult = await gateway.createSubscription({
    planId: subConfig.planId,
    amount: Math.round(amountMajor * 100),
    currency: page.paymentCurrency,
    interval: mapInterval(subConfig.interval),
    intervalCount: subConfig.intervalCount ?? 1,
    trialPeriodDays: subConfig.trialPeriodDays,
    maxCycles: subConfig.maxCycles,
    customerRef: `ponkoform-resp-${sessionId}`,
    successReturnUrl: base,
    failureReturnUrl: `${base}&cancelled=1`,
    metadata: { pageSessionId: String(session.id), pageId: String(page.id), paymentId: String(payment.id) },
  }, credentials)

  // Store subscription details on the payment record
  await db.update(payments).set({
    gatewayPaymentId: subscriptionResult.invoiceId,
    subscriptionId: subscriptionResult.subscriptionId,
    subscriptionStatus: 'active',
    subscriptionInterval: subConfig.interval,
    subscriptionIntervalCount: subConfig.intervalCount ?? 1,
    paymentUrl: subscriptionResult.paymentUrl,
    // ... rest of payment fields
  }).where(eq(payments.id, payment.id))

  return { paymentUrl: subscriptionResult.paymentUrl, issue: null }
}

// Existing one-time flow continues below...
```

### 4.3 New Gateway Method: `createSubscription` (in `PaymentGateway` base + Xendit)

```typescript
// New type in src/integrations/payments/types.ts
export interface SubscriptionRequest {
  planId?: string              // reuse existing plan if provided
  planName: string
  amount: number               // in minor units (centavos)
  currency: string
  interval: 'WEEK' | 'MONTH' | 'QUARTER' | 'BIANNUAL' | 'ANNUAL'
  intervalCount: number
  trialPeriodDays?: number
  maxCycles?: number
  customerRef: string
  customerEmail?: string
  customerName?: string
  successReturnUrl: string
  failureReturnUrl: string
  metadata: Record<string, string>
}

export interface SubscriptionResult {
  success: boolean
  subscriptionId: string | null
  planId: string | null
  invoiceId: string | null   // first invoice created immediately
  paymentUrl: string | null  // hosted checkout for first payment
  error: string | null
}
```

```typescript
// In src/integrations/payments/base.ts — add to PaymentGateway:
async createSubscription(
  request: SubscriptionRequest,
  credentials?: GatewayCredentials,
): Promise<SubscriptionResult> {
  // Default: throw — only gateways that support subscriptions override this
  throw new Error(`${this.getGatewayName()} does not support subscriptions`)
}

// In src/integrations/payments/xendit/gateway.ts — override:
async createSubscription(
  request: SubscriptionRequest,
  credentials?: GatewayCredentials,
): Promise<SubscriptionResult> {
  // 1. Create plan (or reuse if planId provided)
  // 2. Activate plan
  // 3. Create subscription under the plan
  // 4. Return the checkout URL from the first invoice
}
```

### 4.4 Webhook Handler Updates (in `src/routes/api/webhooks/xendit/`)

The existing Xendit webhook handler processes one-time invoice events (`invoice.paid`, `invoice.expired`). Subscription events from Xendit include:

| Event | What Happens | Action |
|---|---|---|
| `invoice.paid` | A recurring invoice was paid | Update `payments.paidAmount`, record `payment_events`, update `subscriptionCurrentPeriod` |
| `invoice.payment_failed` | A recurring charge failed | Set `subscriptionStatus = 'past_due'` |
| `invoice.expired` | Invoice expired unpaid | Set `subscriptionStatus = 'unpaid'` |
| `subscription.activated` | Subscription started | Set `subscriptionStatus = 'active'` |
| `subscription.cancelled` | Subscription cancelled (by creator or auto) | Set `subscriptionStatus = 'cancelled'` |
| `subscription.updated` | Plan/cycle changed | Sync `subscriptionCurrentPeriodStart/End` |

The webhook handler resolves the PonkoForm payment record via `payments.subscriptionId`:

```typescript
// In the webhook handler:
if (eventType === 'invoice.paid' || eventType === 'subscription.activated') {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.subscriptionId, subscriptionId))
    .limit(1)
  if (payment) {
    await db.update(payments).set({
      subscriptionStatus: 'active',
      lastVerifiedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(payments.id, payment.id))
  }
}
```

---

## 5. How It Connects to Existing Systems

### 5.1 Page Builder Save Flow

When `savePageForm` (in `src/lib/server-fns/page-forms.ts`, line 502) processes a page with subscription config:

1. It validates that `subscriptionConfig.interval` and `subscriptionConfig.intervalCount` are valid
2. If `subscriptionConfig.enabled && !subscriptionConfig.planId`, it creates the plan on Xendit (server-side, during save) and stores the plan ID
3. If the amount, currency, or interval has changed since the plan was last created, it updates the existing plan on Xendit via `PATCH /v2/plans/{id}`
4. The plan ID is cached in `formPages.subscriptionConfig.planId` so subsequent form submissions reuse the same plan

### 5.2 Payment Completion Flow

`finalizePagePayment` (line 1101) currently calls `completePaidPageSubmission` on success. For subscriptions, when the first invoice is paid:

1. The respondent redirects back from Xendit to `/forms/payment-return?pageSessionId=X&pageId=Y`
2. `finalizePagePayment` verifies the invoice status via Xendit
3. On `completed`, it marks the payment as `completed`, stores `subscriptionId` and `subscriptionStatus = 'active'`
4. `completePaidPageSubmission` proceeds as normal — marks session as completed, dispatches emails
5. Future billing cycles are handled by Xendit webhooks

### 5.3 Payments Dashboard

The existing payments view at `src/routes/forms/$formId/payments.tsx` shows payment records in a table. For subscription payments:

- The `subscriptionStatus` column should be displayed (active/past_due/cancelled/etc.)
- A subscription indicator badge can differentiate subscription payments from one-time payments
- Clicking a subscription payment could show the subscription lifecycle (current period, next billing date)

---

## 6. File Change Summary

| File | Purpose |
|---|---|
| `src/db/schema.ts` | Add `subscriptionConfig` JSONB to `formPages`; add `subscriptionId`, `subscriptionStatus`, `subscriptionInterval*` columns to `payments` |
| `drizzle/0026_subscription_payment.sql` | Generated migration for the schema changes |
| `src/integrations/payments/types.ts` | Add `SubscriptionRequest`, `SubscriptionResult` interfaces |
| `src/integrations/payments/base.ts` | Add `createSubscription()` abstract method (default throws) |
| `src/integrations/payments/xendit/gateway.ts` | Implement `createSubscription()` — create plan, activate, create subscription, return checkout URL |
| `src/lib/server-fns/page-forms.ts` | Modify `savePageForm` to validate/sync subscription plan; modify `initiatePagePayment` to branch on subscription mode; modify `getPagePaymentOptions` to include subscription metadata |
| `src/lib/server-fns/payments.ts` | Modify `initiatePayment` (flow-based) to support subscription mode (if flow builder also gets this feature) |
| `src/routes/api/webhooks/xendit/index.ts` (or route handler) | Handle subscription-related Xendit webhook events |
| `src/components/page-builder/` (new or existing) | Add `PaymentModeSelector` component for the one-time vs. subscription toggle + interval picker |
| `src/components/public-form/PublicFormView.tsx` | Optionally show "Subscribe" label vs. "Pay" label based on subscription mode |
| `src/routes/forms/$formId/payments.tsx` | Show subscription status column/badge in the payments table |
| `src/routes/forms/payment-return.tsx` | No changes needed — already handles page session payment returns |

---

## 7. Step-by-Step Tasks

### Task 1: DB Migration — Add subscription columns
- Add `subscription_config` JSONB to `form_pages` in `src/db/schema.ts`
- Add `subscription_id`, `subscription_status`, `subscription_interval`, `subscription_interval_count`, `subscription_trial_end`, `subscription_current_period_start`, `subscription_current_period_end` to `payments` in `src/db/schema.ts`
- Run `pnpm db:generate` to create the migration file
- Run `pnpm db:migrate` to apply locally

### Task 2: Extend gateway types + Xendit subscription API
- Add `SubscriptionRequest` and `SubscriptionResult` interfaces to `src/integrations/payments/types.ts`
- Add `createSubscription()` method to `PaymentGateway` abstract class (default throws "not supported")
- Implement `createSubscription()` in `XenditGateway` (`src/integrations/payments/xendit/gateway.ts`)
  - Create plan via `POST /v2/plans`
  - Activate plan via `POST /v2/plans/{id}/activate`
  - Create subscription under plan (customer uses `reference_id` + optional email)
  - Return the first invoice's checkout URL + subscription ID

### Task 3: Plan sync during form save
- In `savePageForm` (`src/lib/server-fns/page-forms.ts`, ~line 502), after processing payment config, detect `subscriptionConfig.enabled`
- If enabled and no cached `planId`, call Xendit to create the plan and store the plan ID
- If enabled and config has changed (amount/interval/currency differ from cached plan), update the plan via `PATCH /v2/plans/{id}`
- Validate that the gateway supports subscriptions (only Xendit for now)
- Store the updated `subscriptionConfig` (with `planId`, `planCreatedAt`) in the page save payload

### Task 4: Subscription branch in `initiatePagePayment`
- In `initiatePagePayment` (~line 970), after calculating the amount, check `page.subscriptionConfig?.enabled`
- If true, call `gateway.createSubscription()` instead of `gateway.createPayment()`
- Store the resulting `subscriptionId`, `subscriptionStatus`, `subscriptionInterval`, `subscriptionIntervalCount` on the payments row
- The rest of the flow (payment URL return, session status update) stays the same

### Task 5: Subscription branch in `initiatePayment` (flow-based builder)
- Apply the same subscription-vs-one-time branching in `src/lib/server-fns/payments.ts` `initiatePayment` (~line 146)
- The flow-based payment node config doesn't have `subscriptionConfig` directly — this may require a flow-level or form-level subscription flag. If the page-based builder is the primary target, this can be deferred.

### Task 6: Webhook handler — subscription events
- In `src/routes/api/webhooks/xendit/`, extend the handler to recognize subscription lifecycle events
- Map `subscription.activated`, `subscription.cancelled`, `subscription.updated`, `invoice.paid` (recurring), and `invoice.payment_failed` events
- Look up payments by `subscriptionId` and update `subscriptionStatus` and period timestamps
- Record each event in `paymentEvents` for audit

### Task 7: UI — Payment Mode toggle in page builder
- Create `src/components/page-builder/PaymentModeSelector.tsx`
  - Toggle between "One-time" and "Subscription"
  - When "Subscription": show interval picker, interval count, optional trial days, optional max cycles
- Wire into the existing payment config section in the page builder panel
- Add form state management for the subscription config fields

### Task 8: UI — Respondent-facing label + payment view
- In `PublicFormView.tsx`, conditionally show "Subscribe — ₱X/month" vs. "Pay ₱X" based on subscription mode
- In `src/routes/forms/$formId/payments.tsx`, add a subscription status badge column
- If time permits, add a simple subscription detail view (current period, next billing, status)

---

## 8. Risks & Open Questions

| Risk / Question | Mitigation / Answer |
|---|---|
| **Xendit subscription API differences by region** | Xendit's Plans/Subscriptions API is available for Philippines accounts. Verify API key region before proceeding. If unavailable in some regions, gate the feature behind a `xenditConfig.mode === 'live'` check with a region flag. |
| **Plan duplication across form saves** | Cache the `planId` in `formPages.subscriptionConfig`. Only create a new plan if one doesn't exist. When config changes, update the existing plan via PATCH rather than creating a new one. |
| **Customer identification without email** | If the form doesn't collect an email before the payment page, use the session ID as the Xendit customer `reference_id`. Xendit allows subscriptions with only a reference ID. The customer name can be omitted. |
| **Webhook reliability for recurring billing status** | Xendit webhooks are the source of truth for subsequent billing cycles. If a webhook is missed, the subscription status becomes stale. Add a daily reconciliation cron (extending `scripts/reconcile-payments.ts`) to sync subscription statuses from Xendit for all active subscriptions. |
| **Subscription cancellation UX** | Form creators will need the ability to cancel a respondent's subscription from the dashboard. This is not in scope for the initial implementation but should be considered. For now, creators cancel directly in their Xendit dashboard. |
| **PayPal subscription support** | PayPal also has a Subscriptions API, but the initial implementation focuses on Xendit only. The `createSubscription()` method is designed on the abstract class so PayPal can be added later with the same interface. |
| **Multiple payment gateways on a subscription page** | A page with `subscriptionConfig.enabled` should only allow gateways that support subscriptions (Xendit only for now). The gateway selector UI should filter or show a warning when subscription mode is on and an unsupported gateway is selected. |

---

## 9. Validation / Testing

- [ ] **Unit test**: `XenditGateway.createSubscription()` with mock HTTP — verifies plan creation, activation, subscription creation, and invoice URL return
- [ ] **Unit test**: `savePageForm` with `subscriptionConfig` — verifies plan ID is created and cached
- [ ] **Integration test**: Full subscription flow — create form with subscription payment page → initiate payment → verify Xendit subscription is created → simulate webhook `invoice.paid` → verify payment status updates
- [ ] **Manual test**: Local form with subscription → pay via Xendit sandbox → verify webhook is received and status updates
- [ ] **Edge case**: Respondent abandons subscription checkout → verify payment record shows `pending`/`failed` appropriately
- [ ] **Edge case**: Subscription with trial period → verify first invoice is not charged immediately
- [ ] **Edge case**: Form with no email field → verify subscription is created with `reference_id` fallback
- [ ] **Edge case**: Changing subscription config on a published form → verify existing plan is updated, not duplicated
- [ ] **UI test**: Payment mode toggle renders correctly, switches between one-time and subscription fields
- [ ] **UI test**: Respondent payment step shows "Subscribe" label for subscription pages
