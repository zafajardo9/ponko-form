# FT-018: Payment Links — Standalone Checkout Without a Form

> **Feature Plan** — Let creators generate standalone payment links (no form fields, just an amount + description) that open directly to the payment gateway checkout. A "Buy Now" button without building a full form. Creates a new use case: simple product sales, donations, invoice payments, and one-off charges.

**Status:** ✅ **Implemented and verified** — 2026-07-29

**Dependencies:**
- ✅ **Existing Payment Architecture** — The `initiatePagePayment` / `initiatePayment` server functions and the `PaymentGateway` abstract class (PayPal + Xendit) are fully built. Payment links reuse the same gateway layer — they just skip the form fields wrapper.
- ✅ **FT-002 (Integrations Hub)** — Payment gateway credentials (Xendit secret key, PayPal client ID/secret) must be configured before payment links work. The Integrations Hub already handles credential storage and loading.
- ✅ **Existing `payments` + `formSubmissions` tables** — Payment link transactions are recorded in the same `payments` table with a new `payment_link_id` FK for tracking.
- 🚧 **FT-017 (Analytics Dashboard)** — Payment link performance (visits, conversions, revenue) should report into the same analytics dashboard as forms.
- ⬜ **FT-020 (Webhooks)** — Payment link events (`payment_link.paid`, `payment_link.expired`) should fire webhooks just like form payment events.

---

## 1. User Story & Problem

### 1.1 Current State

To collect a payment on PonkoForm today, a creator must:

1. Create a new form
2. Add at least one page
3. Mark the page as a payment page
4. Configure payment amount, currency, gateway
5. Add a dummy text field just so the form doesn't look empty
6. Publish the form
7. Share the form link

For a simple ₱500 "Workshop Ticket" or a ₱2,000 "Donation," this is enormous overhead. The creator doesn't *want* a form — they want a payment button.

### 1.2 What Creators Want

> *"I sell digital art commissions. I just want to send a client a link that says 'Pay ₱3,500 for Character Illustration' and have them pay via GCash or card. I don't need name, email, or any fields — I already know my client."*

> *"Our church collects donations online. I want to put a 'Donate ₱500' button on our Facebook page that goes straight to Xendit checkout. No form, no friction."*

### 1.3 The Gap

The payment infrastructure is already there — `initiatePagePayment` creates a gateway checkout session, `finalizePagePayment` verifies it, `payments` records track everything. What's missing is the **lightweight wrapper** that presents an amount → checkout without a form in between.

---

## 2. System Design — DB Schema & Architecture

### 2.1 New Table: `payment_links`

```sql
CREATE TABLE payment_links (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  public_id VARCHAR(16) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  amount INTEGER NOT NULL,               -- in minor units (centavos)
  currency VARCHAR(3) NOT NULL DEFAULT 'PHP',
  payment_gateway_id INTEGER NOT NULL REFERENCES payment_gateways(id),
  allow_custom_amount BOOLEAN NOT NULL DEFAULT false,
  min_amount INTEGER,                     -- for custom amount mode
  max_amount INTEGER,                     -- for custom amount mode
  redirect_url TEXT,                      -- where to send after successful payment
  success_message TEXT,                   -- shown on the thank-you page
  is_active BOOLEAN NOT NULL DEFAULT true,
  total_payments INTEGER NOT NULL DEFAULT 0,
  total_revenue INTEGER NOT NULL DEFAULT 0, -- in minor units
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX payment_links_public_id_idx ON payment_links(public_id);
CREATE INDEX payment_links_profile_id_idx ON payment_links(profile_id);
```

```typescript
// In src/db/schema.ts
export const paymentLinks = pgTable(
  'payment_links',
  {
    id: serial().primaryKey(),
    profileId: integer('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    publicId: varchar('public_id', { length: 16 }).notNull().unique(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    amount: integer('amount').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('PHP'),
    paymentGatewayId: integer('payment_gateway_id').notNull().references(() => paymentGateways.id),
    allowCustomAmount: boolean('allow_custom_amount').notNull().default(false),
    minAmount: integer('min_amount'),
    maxAmount: integer('max_amount'),
    redirectUrl: text('redirect_url'),
    successMessage: text('success_message'),
    isActive: boolean('is_active').notNull().default(true),
    totalPayments: integer('total_payments').notNull().default(0),
    totalRevenue: integer('total_revenue').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('payment_links_public_id_idx').on(table.publicId),
    index('payment_links_profile_id_idx').on(table.profileId),
  ],
)
```

### 2.2 Modify `payments` Table — Link to Payment Links

```sql
ALTER TABLE payments
ADD COLUMN payment_link_id INTEGER REFERENCES payment_links(id) ON DELETE SET NULL;

CREATE INDEX payments_payment_link_id_idx ON payments(payment_link_id);
```

```typescript
// In src/db/schema.ts — add to payments table:
paymentLinkId: integer('payment_link_id').references(() => paymentLinks.id, { onDelete: 'set null' }),
```

### 2.3 Data Flow — Payment Link Purchase

```
Creator creates payment link
  └─ Title: "Character Illustration"
  └─ Amount: ₱3,500
  └─ Gateway: Xendit
  └─ Gets shareable URL: ponkoform.com/pay/abc123def456
         │
         ▼
Customer opens /pay/abc123def456
  └─ Minimal page renders:
       "Character Illustration"
       "₱3,500"
       [Pay with Xendit] button
         │
         ▼
Customer clicks Pay
  └─ POST /api/payment-links/initiate { publicId: "abc123def456" }
  └─ Server: creates payment record, calls gateway.createPayment()
  └─ Returns: { paymentUrl: "https://checkout.xendit.co/..." }
  └─ Client redirects to Xendit checkout
         │
         ▼
Customer completes payment on Xendit
  └─ Xendit redirects to /pay/abc123def456/success
  └─ Server: verifies payment, updates payment_links.total_revenue
  └─ Shows success page: "Thank you! ₱3,500 paid."
```

---

## 3. UI Design — Where It Lives, Component Tree

### 3.1 Dashboard Section

A new **"Payment Links"** card/section on the dashboard, alongside the existing Forms list:

```
src/routes/dashboard/index.tsx
  └─ Dashboard
       ├─ Forms section (existing)
       └─ Payment Links section (NEW)
            └─ PaymentLinkCard (title, amount, total revenue, copy link button)
```

### 3.2 Full Management Page

```
src/routes/dashboard/payment-links.tsx          ← NEW route
  └─ PaymentLinksPage
       ├─ CreatePaymentLinkButton               ← Opens create modal
       ├─ PaymentLinksList                       ← Grid of payment link cards
       │    └─ PaymentLinkCard                   ← Shows title, amount, revenue, status
       │         ├─ Copy Link button
       │         ├─ Toggle Active/Inactive
       │         └─ Delete button
       └─ CreatePaymentLinkDialog (modal)
            ├─ Title input
            ├─ Description textarea
            ├─ Amount input (₱)
            ├─ Currency selector
            ├─ Gateway selector
            ├─ Custom amount toggle
            ├─ Redirect URL (optional)
            └─ Success message (optional)
```

### 3.3 Public Payment Page

```
src/routes/pay/$publicId.tsx                    ← NEW route (no auth required)
  └─ PaymentLinkPage (public)
       ├─ PaymentLinkHeader (title, description, amount)
       ├─ CustomAmountInput (if allow_custom_amount)
       └─ PayButton → redirects to gateway
```

### 3.4 Success Page

```
src/routes/pay/$publicId.success.tsx            ← NEW route
  └─ PaymentLinkSuccess
       ├─ Green checkmark icon
       ├─ "Payment Successful — ₱X,XXX paid"
       └─ Success message from payment link config
```

### 3.5 Mockup — Payment Link Page (Public)

```
┌──────────────────────────────────────────────────────┐
│                                                        │
│                    [PonkoForm Logo]                    │
│                                                        │
│           ┌──────────────────────────────┐             │
│           │                              │             │
│           │   Character Illustration     │             │
│           │   Digital art commission —   │             │
│           │   full-body, colored, 300dpi  │             │
│           │                              │             │
│           │        ₱ 3,500.00            │             │
│           │                              │             │
│           │   ┌──────────────────────┐   │             │
│           │   │  Pay with Xendit     │   │             │
│           │   └──────────────────────┘   │             │
│           │                              │             │
│           │   Powered by PonkoForm       │             │
│           └──────────────────────────────┘             │
│                                                        │
└──────────────────────────────────────────────────────┘
```

---

## 4. Server Functions

```typescript
// src/lib/server-fns/payment-links.ts (NEW)

// ── Creator-facing (authenticated) ──

export const createPaymentLink = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    title: string; description?: string; amount: number; currency: string;
    paymentGatewayId: number; allowCustomAmount?: boolean;
    minAmount?: number; maxAmount?: number; redirectUrl?: string; successMessage?: string;
  }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    const publicId = generatePublicId() // 16-char random string
    const [link] = await db.insert(paymentLinks).values({
      ...data, publicId, profileId: profile.id,
    }).returning()
    return link
  })

export const getPaymentLinks = createServerFn({ method: 'GET' })
  .handler(async () => {
    const { userId } = await auth()
    // Return all payment links for the authenticated user
    return db.select().from(paymentLinks).where(eq(paymentLinks.profileId, profile.id))
      .orderBy(desc(paymentLinks.createdAt))
  })

export const togglePaymentLink = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: number; isActive: boolean }) => data)
  .handler(async ({ data }) => {
    await db.update(paymentLinks).set({ isActive: data.isActive, updatedAt: new Date() })
      .where(eq(paymentLinks.id, data.id))
  })

// ── Public-facing (no auth) ──

export const getPublicPaymentLink = createServerFn({ method: 'GET', strict: false })
  .inputValidator((data: { publicId: string }) => data)
  .handler(async ({ data }) => {
    const [link] = await db.select().from(paymentLinks)
      .where(and(eq(paymentLinks.publicId, data.publicId), eq(paymentLinks.isActive, true)))
      .limit(1)
    if (!link) throw new Error('Payment link not found or inactive')
    return { title: link.title, description: link.description, amount: link.amount,
      currency: link.currency, allowCustomAmount: link.allowCustomAmount,
      minAmount: link.minAmount, maxAmount: link.maxAmount }
  })

export const initiatePaymentLinkCheckout = createServerFn({ method: 'POST', strict: false })
  .inputValidator((data: { publicId: string; customAmount?: number }) => data)
  .handler(async ({ data }) => {
    const [link] = await db.select().from(paymentLinks)
      .where(eq(paymentLinks.publicId, data.publicId)).limit(1)
    if (!link || !link.isActive) throw new Error('Payment link is not active')

    const finalAmount = link.allowCustomAmount && data.customAmount
      ? Math.max(link.minAmount ?? 0, Math.min(data.customAmount, link.maxAmount ?? Infinity))
      : link.amount

    // Reuse existing payment gateway infrastructure
    const configs = await loadIntegrationConfigs(link.profileId)
    // ... resolve gateway, credentials, create payment, store in payments table
    // ... return { paymentUrl }
  })
```

---

## 5. File Change Summary

| File | Purpose |
|---|---|
| `src/db/schema.ts` | Add `paymentLinks` table; add `paymentLinkId` FK to `payments` |
| `drizzle/0026_hard_stepford_cuckoos.sql` | Generated full-history migration |
| `drizzle/0033_payment_links.sql` | Idempotent compatibility migration used by existing/production databases |
| `src/lib/server-fns/payment-links.ts` (new) | CRUD server functions for payment links |
| `src/lib/payment-links/model.ts` (new) | Side-effect-free validation and per-checkout attempt identity |
| `src/lib/payments/reconciliation.ts` | Resolve payment-link owners and synchronize aggregate totals after verification |
| `src/routes/pay/$publicId.tsx` (new) | Public payment link page |
| `src/routes/pay/$publicId/success.tsx` (new) | Attempt-bound success/thank-you page with polling and optional redirect |
| `src/routes/dashboard/payment-links.tsx` (new) | Creator dashboard — manage payment links |
| `src/components/dashboard/PaymentLinkCard.tsx` (new) | Card component for the payment links list |
| `src/routes/dashboard/index.tsx` (modify) | Add "Payment Links" section or link to the payment links page |
| `src/components/layout/AuthenticatedAppShell.tsx` | Add authenticated desktop/mobile navigation entry |
| `src/lib/server-fns/payment-links.test.ts` | Validation and checkout-isolation tests |
| `src/components/dashboard/CreatePaymentLinkDialog.test.tsx` | Dialog accessibility tests |
| `src/lib/page-builder/complete-submission.ts` (modify, optional) | If payment link payments should also fire confirmation emails |

---

## 7. Step-by-Step Tasks

### Task 1: DB Migration
- Add `paymentLinks` table to `src/db/schema.ts`
- Add `paymentLinkId` column to `payments` table
- Run `pnpm db:generate` + `pnpm db:migrate`

### Task 2: Server Functions
- Create `src/lib/server-fns/payment-links.ts`
- Implement `createPaymentLink`, `getPaymentLinks`, `togglePaymentLink`, `deletePaymentLink`
- Implement `getPublicPaymentLink` (no auth) and `initiatePaymentLinkCheckout` (no auth)
- Reuse existing `gateway.createPayment()` from `src/integrations/payments/`

### Task 3: Public Payment Page
- Create `src/routes/pay/$publicId.tsx` — minimal payment page
- Auto-redirect to gateway checkout on button click
- Handle loading/error states

### Task 4: Success Page
- Create `src/routes/pay/$publicId.success.tsx`
- Verify payment on mount via query params
- Show thank-you message with amount and success message

### Task 5: Creator Dashboard — Payment Links List
- Create `src/routes/dashboard/payment-links.tsx`
- List all payment links with status, revenue, copy-link button
- Toggle active/inactive, delete

### Task 6: Create Payment Link Modal
- Build `CreatePaymentLinkDialog` component
- Title, description, amount, currency, gateway selector
- Custom amount toggle with min/max
- Redirect URL and success message (optional)

### Task 7: Wire into Dashboard
- Add "Payment Links" section to `src/routes/dashboard/index.tsx`
- Or add a nav link to `/dashboard/payment-links`

### Task 8: Test End-to-End
- Create a payment link, copy the URL, open in incognito
- Pay via Xendit sandbox, verify success page
- Verify payment appears in the payments table with `payment_link_id` set
- Verify dashboard shows correct total revenue

---

## 8. Risks & Open Questions

| Risk / Question | Mitigation / Answer |
|---|---|
| **Payment link abuse (spam payments)** | Payment links require a connected gateway (Xendit/PayPal). Abusive payments cost the abuser real money. No anonymous free-tier abuse path. |
| **Link expiration / stale links** | Payment links are active until toggled off. If a creator wants expiration, they manually deactivate. Auto-expiration can be added later. |
| **Custom amount mode — underpayments** | `minAmount` and `maxAmount` constraints are enforced server-side in `initiatePaymentLinkCheckout`. |
| **No customer data collection** | Payment links are intentionally minimal. If a creator needs customer data, they should use a form with a payment page. The payments table still records gateway metadata (payer name, payment method from Xendit). |
| **Branding — does the public page look like PonkoForm?** | Yes — the payment link page uses a minimal branded header ("Powered by PonkoForm") similar to Typeform's payment links. No navigation chrome, just the payment card. |

---

## 9. Validation / Testing

- [x] Creator management route loads against the migrated development database
- [x] Authenticated desktop/mobile navigation exposes `/dashboard/payment-links`
- [x] Create dialog is keyboard reachable and every field has an accessible label
- [x] Create input is normalized and rejects invalid amounts, redirect protocols, and min/max ranges
- [x] Public links use a unique opaque checkout attempt for every buyer
- [x] Success verification is restricted to the exact public link + checkout attempt
- [x] Payment reconciliation resolves the owning payment-link profile
- [x] Completed/refunded reconciliation recalculates payment count and revenue idempotently
- [x] Custom amounts are enforced server-side and shown on the Pay button
- [x] Success verification polls while the provider is pending and honors the optional redirect URL
- [x] Database compatibility check requires the table, FK column, and payment-link index
- [x] Full automated test suite, TypeScript compilation, and production client/SSR build pass

> Gateway-hosted checkout still requires the creator's own connected Xendit or PayPal
> sandbox/live credentials. The implementation reuses the already-tested gateway layer;
> no real charge was created as part of repository verification.

---

## 10. Implementation Verification (2026-07-29)

Artifacts and runtime behavior verified:

| # | Artifact | Path | Status |
|---|---|---|---|
| 1 | Schema: `paymentLinks` table (18 columns) | `src/db/schema.ts:886-916` | ✅ Present |
| 1b | Schema: `paymentLinkId` FK on `payments` | `src/db/schema.ts:527` | ✅ Present |
| 2 | Migrations: full history + compatibility | `drizzle/0026_hard_stepford_cuckoos.sql`, `drizzle/0033_payment_links.sql` | ✅ Applied to the configured development database; compatibility check passes |
| 3 | Server functions (7) | `src/lib/server-fns/payment-links.ts` | ✅ Present — `createPaymentLink`, `getPaymentLinks`, `togglePaymentLink`, `deletePaymentLink`, `getPublicPaymentLink`, `initiatePaymentLinkCheckout`, `finalizePaymentLinkPayment` |
| 4a | Public pay page | `src/routes/pay/$publicId.tsx` | ✅ Present — uses `getPublicPaymentLink` + `initiatePaymentLinkCheckout` |
| 4b | Public success page | `src/routes/pay/$publicId/success.tsx` | ✅ Present — uses `finalizePaymentLinkPayment` |
| 5 | Dashboard management page | `src/routes/dashboard/payment-links.tsx` | ✅ Present — full CRUD with `PaymentLinkCard` + `CreatePaymentLinkDialog` |
| 6a | Card component | `src/components/dashboard/PaymentLinkCard.tsx` | ✅ Present |
| 6b | Create dialog component | `src/components/dashboard/CreatePaymentLinkDialog.tsx` | ✅ Present |
| 7 | Dashboard integration | `src/routes/dashboard/index.tsx:568-586` | ✅ Present — "Payment Links" section linking to `/dashboard/payment-links` |
| 8 | Route tree | `src/routeTree.gen.ts` | ✅ Present — `/pay/$publicId`, `/pay/$publicId/success`, `/dashboard/payment-links` |
| 9 | TypeScript compilation | `pnpm tsc --noEmit` | ✅ Passed — zero errors |
| 10 | Automated tests | `pnpm test` | ✅ Passed — 74 files, 323 tests |
| 11 | Production build | `pnpm run build` | ✅ Passed — client, SSR, and Nitro server bundles |
| 12 | Live browser verification | `http://localhost:3000/dashboard/payment-links` | ✅ Authenticated route, navigation, empty state, and accessible create dialog verified |

### Corrections made during verification

- Replaced the shared-per-link checkout key with a unique 192-bit attempt token so
  different buyers never reuse the same gateway checkout.
- Bound the success route to that attempt token instead of selecting the latest
  payment made by any visitor.
- Added payment-link ownership resolution to the shared reconciliation layer.
- Replaced non-atomic counter increments with idempotent totals derived from
  completed payment records.
- Added server-side schema validation and supported-currency/connected-provider checks.
- Completed redirect URL behavior, pending verification polling, dynamic custom-amount
  button text, SSR-safe public URLs, navigation access, and form-label accessibility.
