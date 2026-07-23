# FT-021: Discount Codes & Coupons — Price Adjustment at Checkout

> **Feature Plan** — Form creators can generate discount codes (e.g., `EARLYBIRD` for 20% off, `STAFF2026` for ₱500 off) that respondents enter on the payment page to reduce the amount charged. Supports percentage-based and fixed-amount discounts, usage limits, expiration dates, and per-code analytics. Directly increases payment conversion by enabling promotions.

**Status:** 🚧 **Planned** — not yet implemented

**Dependencies:**
- ✅ **FT-007 (Page Builder)** — The payment page system (`formPages.hasPayment`, `paymentComputation`, `PagePaymentStep`) is the integration point. Discounts are applied during the amount computation in `getPagePaymentOptions`.
- ✅ **Existing payment computation** — `calculatePagePayment` in `src/lib/page-builder/server-data.ts` already computes the final amount from options/fields/references. Discounts are an additional step in this pipeline.
- ✅ **FT-018 (Payment Links)** — Standalone payment links should also support discount codes. If FT-018 is built first, discounts apply there too.
- 🚧 **FT-017 (Analytics Dashboard)** — Discount code usage (how many times used, total discount amount given) should surface in the analytics page.
- ⬜ **FT-020 (Webhooks)** — Discount code usage events (`discount.applied`, `discount.depleted`) could fire webhooks.

---

## 1. User Story & Problem

### 1.1 Current State

To offer a discount on a PonkoForm payment page today, a creator must:
1. Create a **separate form** with a lower price
2. Share the separate form link only with discount-eligible people
3. Manually track who used the discount

Or:
1. Add a select field "Do you have a discount code?" with "Yes/No" options
2. Use conditional logic to show different payment fields
3. Manually verify discount validity (no server-side enforcement)

Both approaches are fragile, error-prone, and don't scale.

### 1.2 What Creators Want

> *"I'm running an early bird promotion for my workshop — 20% off if you register before August 1st. I want to create a discount code `EARLYBIRD` that automatically applies 20% off on the payment page. It should stop working after August 1st or after 50 uses, whichever comes first."*

> *"Our staff get a flat ₱500 discount on any training registration. They should be able to enter `STAFF2026` on the payment page and see the price drop from ₱2,500 to ₱2,000 before they pay."*

### 1.3 Discount Types

| Type | Example | Behavior |
|---|---|---|
| **Percentage** | `EARLYBIRD` → 20% off | `finalAmount = computedAmount * (1 - 0.20)` |
| **Fixed amount** | `STAFF500` → ₱500 off | `finalAmount = computedAmount - 50000` (in minor units) |
| **Free shipping / fee waiver** | Future enhancement | N/A |

---

## 2. System Design — DB Schema & Architecture

### 2.1 New Table: `discount_codes`

```sql
CREATE TABLE discount_codes (
  id SERIAL PRIMARY KEY,
  form_id INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'percentage',   -- 'percentage' | 'fixed'
  value INTEGER NOT NULL,           -- percentage (20 = 20%) or fixed amount in minor units
  max_uses INTEGER,                 -- NULL = unlimited
  current_uses INTEGER NOT NULL DEFAULT 0,
  min_amount INTEGER,               -- minimum order amount to apply (minor units)
  max_discount INTEGER,             -- max discount cap (for percentage codes, minor units)
  starts_at TIMESTAMP,
  expires_at TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT true,
  usage_limit_per_respondent INTEGER DEFAULT 1,   -- NULL = unlimited per person
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX discount_codes_form_id_code_idx ON discount_codes(form_id, code);
CREATE INDEX discount_codes_form_id_active_idx ON discount_codes(form_id, is_active);
CREATE INDEX discount_codes_code_active_idx ON discount_codes(code, is_active);
```

```typescript
// In src/db/schema.ts
export const discountCodes = pgTable(
  'discount_codes',
  {
    id: serial().primaryKey(),
    formId: integer('form_id').notNull().references(() => forms.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 50 }).notNull(),
    type: varchar('type', { length: 20 }).notNull().default('percentage'),
    value: integer('value').notNull(),
    maxUses: integer('max_uses'),
    currentUses: integer('current_uses').notNull().default(0),
    minAmount: integer('min_amount'),
    maxDiscount: integer('max_discount'),
    startsAt: timestamp('starts_at'),
    expiresAt: timestamp('expires_at'),
    isActive: boolean('is_active').notNull().default(true),
    usageLimitPerRespondent: integer('usage_limit_per_respondent').default(1),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('discount_codes_form_id_code_idx').on(table.formId, table.code),
    index('discount_codes_form_id_active_idx').on(table.formId, table.isActive),
    index('discount_codes_code_active_idx').on(table.code, table.isActive),
  ],
)
```

### 2.2 New Table: `discount_redemptions`

Tracks each use of a discount code for analytics and usage limits.

```sql
CREATE TABLE discount_redemptions (
  id SERIAL PRIMARY KEY,
  discount_code_id INTEGER NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
  form_submission_id INTEGER NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
  payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
  original_amount INTEGER NOT NULL,
  discount_amount INTEGER NOT NULL,
  final_amount INTEGER NOT NULL,
  redeemed_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE INDEX discount_redemptions_code_id_idx ON discount_redemptions(discount_code_id);
```

```typescript
export const discountRedemptions = pgTable(
  'discount_redemptions',
  {
    id: serial().primaryKey(),
    discountCodeId: integer('discount_code_id').notNull().references(() => discountCodes.id, { onDelete: 'cascade' }),
    formSubmissionId: integer('form_submission_id').notNull().references(() => formSubmissions.id, { onDelete: 'cascade' }),
    paymentId: integer('payment_id').references(() => payments.id, { onDelete: 'set null' }),
    originalAmount: integer('original_amount').notNull(),
    discountAmount: integer('discount_amount').notNull(),
    finalAmount: integer('final_amount').notNull(),
    redeemedAt: timestamp('redeemed_at').defaultNow().notNull(),
  },
  (table) => [index('discount_redemptions_code_id_idx').on(table.discountCodeId)],
)
```

### 2.3 Architecture — Discount Application Flow

```
Respondent reaches payment page
         │
         ▼
PagePaymentStep renders
  ├─ Shows computed amount: ₱2,500
  ├─ "Have a discount code?" input field    ← NEW
  └─ [Apply] button                          ← NEW
         │
         ▼
Respondent enters "EARLYBIRD" → clicks Apply
         │
         ▼
POST /api/discounts/validate { formId, code }
  └─ Server: query discount_codes WHERE code = 'EARLYBIRD' AND form_id = :formId
  └─ Validate: isActive, not expired, not before start date, currentUses < maxUses
  └─ Compute: originalAmount = ₱2,500, discountAmount = ₱500 (20%), finalAmount = ₱2,000
  └─ Return: { valid: true, type: 'percentage', value: 20, discountAmount: 50000, finalAmount: 200000 }
         │
         ▼
PagePaymentStep updates:
  ├─ Shows original price struck through: ~~₱2,500~~
  ├─ Shows discounted price: ₱2,000
  └─ "EARLYBIRD applied — 20% off" badge
         │
         ▼
Respondent clicks [Pay ₱2,000]
  └─ initiatePagePayment called with discountCode
  └─ Server re-validates discount atomically (UPDATE current_uses WHERE current_uses < max_uses)
  └─ Creates payment with finalAmount, records discount_redemptions row
  └─ Returns checkout URL for ₱2,000
```

### 2.4 Atomic Redemption (Race Condition Protection)

When `initiatePagePayment` processes a discount code, it must atomically increment `current_uses` to prevent overselling:

```sql
UPDATE discount_codes
SET current_uses = current_uses + 1, updated_at = NOW()
WHERE id = :discountCodeId
  AND is_active = true
  AND (max_uses IS NULL OR current_uses < max_uses)
  AND (expires_at IS NULL OR expires_at > NOW())
  AND (starts_at IS NULL OR starts_at <= NOW())
RETURNING id
```

If no row is returned, the discount has been exhausted between validation and payment initiation — reject the payment with "This discount code has reached its usage limit."

---

## 3. UI Design — Where It Lives, Component Tree

### 3.1 Creator — Discounts Management

New tab in the form editor: **"Discounts"**:

```
src/routes/forms/$formId/discounts.tsx          ← NEW route
  └─ DiscountsPage
       ├─ DiscountCodesList                      ← Table of created codes
       │    └─ DiscountCodeRow (code, type, value, uses, status, actions)
       ├─ CreateDiscountButton → CreateDiscountDialog
       └─ DiscountUsageStats                      ← Summary of redemptions
```

### 3.2 Create Discount Dialog

```
┌──────────────────────────────────────────────────┐
│  Create Discount Code                             │
│──────────────────────────────────────────────────│
│                                                    │
│  Code                                              │
│  ┌────────────────────────────────────────────┐    │
│  │ EARLYBIRD                           [🎲]   │    │
│  └────────────────────────────────────────────┘    │
│                                                    │
│  Discount Type                                     │
│  ┌────────────────────────────────────────────┐    │
│  │ Percentage (20% off)                   [▼] │    │
│  └────────────────────────────────────────────┘    │
│                                                    │
│  Value                                             │
│  ┌────────┐                                        │
│  │   20   │  %                                    │
│  └────────┘                                        │
│                                                    │
│  ── Limits (optional) ──                           │
│  Max Uses          ┌────────┐                      │
│  (empty = unlimited)│   50   │                      │
│                    └────────┘                      │
│  Min Order Amount  ┌────────┐                      │
│                    │        │                      │
│                    └────────┘                      │
│  Max Discount Cap  ┌────────┐                      │
│  (for % codes)     │  1000  │                      │
│                    └────────┘                      │
│                                                    │
│  Valid From        [2026-07-01]                    │
│  Expires At        [2026-08-01]                    │
│                                                    │
│                              [Cancel]  [Create]    │
└──────────────────────────────────────────────────┘
```

### 3.3 Respondent — Payment Step with Discount

The `PagePaymentStep` component in `src/components/page-form/PagePaymentStep.tsx` gains a discount code section:

```
┌──────────────────────────────────────────────────┐
│  Payment                                          │
│──────────────────────────────────────────────────│
│                                                    │
│  Workshop Registration                             │
│                                                    │
│  Original Price:  ~~₱2,500.00~~                    │
│  Discount (EARLYBIRD): -₱500.00 (20%)             │
│  ──────────────────────────────                    │
│  You Pay:  ₱2,000.00                               │
│                                                    │
│  ┌──────────────────────────────────────┐          │
│  │ EARLYBIRD                  [Remove]  │          │
│  └──────────────────────────────────────┘          │
│                                                    │
│  ┌────────────────────────────────────────────┐    │
│  │              Pay ₱2,000.00                  │    │
│  └────────────────────────────────────────────┘    │
│                                                    │
│  ── OR ──                                          │
│                                                    │
│  Have a discount code?                              │
│  ┌──────────────────────────┐ ┌────────┐          │
│  │                          │ │ Apply  │          │
│  └──────────────────────────┘ └────────┘          │
│  [Invalid code message]                           │
└──────────────────────────────────────────────────┘
```

---

## 4. Server Functions

```typescript
// src/lib/server-fns/discounts.ts (NEW)

export const getDiscountCodes = createServerFn({ method: 'GET' })
  .inputValidator((data: { formId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    // ...verify form ownership
    return db.select().from(discountCodes)
      .where(eq(discountCodes.formId, data.formId))
      .orderBy(desc(discountCodes.createdAt))
  })

export const createDiscountCode = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    formId: number; code: string; type: 'percentage' | 'fixed';
    value: number; maxUses?: number; minAmount?: number; maxDiscount?: number;
    startsAt?: string; expiresAt?: string;
  }) => data)
  .handler(async ({ data }) => {
    // Validate: code must be unique per form
    const [existing] = await db.select().from(discountCodes)
      .where(and(eq(discountCodes.formId, data.formId), eq(discountCodes.code, data.code)))
      .limit(1)
    if (existing) throw new Error('A discount code with this name already exists')
    const [code] = await db.insert(discountCodes).values({
      ...data,
      startsAt: data.startsAt ? new Date(data.startsAt) : null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    }).returning()
    return code
  })

export const toggleDiscountCode = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: number; isActive: boolean }) => data)
  .handler(async ({ data }) => {
    await db.update(discountCodes).set({ isActive: data.isActive, updatedAt: new Date() })
      .where(eq(discountCodes.id, data.id))
  })

// ── Public-facing (no auth — called from the payment page) ──

export const validateDiscountCode = createServerFn({ method: 'GET', strict: false })
  .inputValidator((data: { formId: number; code: string; amount: number }) => data)
  .handler(async ({ data }) => {
    const [discount] = await db.select().from(discountCodes)
      .where(and(
        eq(discountCodes.formId, data.formId),
        eq(discountCodes.code, data.code.toUpperCase()),
        eq(discountCodes.isActive, true),
      ))
      .limit(1)

    if (!discount) return { valid: false, reason: 'Invalid discount code' }
    if (discount.expiresAt && discount.expiresAt < new Date())
      return { valid: false, reason: 'This discount code has expired' }
    if (discount.startsAt && discount.startsAt > new Date())
      return { valid: false, reason: 'This discount code is not yet active' }
    if (discount.maxUses !== null && discount.currentUses >= discount.maxUses)
      return { valid: false, reason: 'This discount code has reached its usage limit' }
    if (discount.minAmount && data.amount < discount.minAmount)
      return { valid: false, reason: `Minimum order of ₱${(discount.minAmount / 100).toFixed(2)} required` }

    let discountAmount = discount.type === 'percentage'
      ? Math.round(data.amount * (discount.value / 100))
      : discount.value
    if (discount.maxDiscount && discountAmount > discount.maxDiscount)
      discountAmount = discount.maxDiscount

    const finalAmount = Math.max(0, data.amount - discountAmount)
    return {
      valid: true,
      discountId: discount.id,
      type: discount.type,
      value: discount.value,
      discountAmount,
      finalAmount,
      code: discount.code,
    }
  })
```

### 4.1 Injection in `initiatePagePayment`

Modify `src/lib/server-fns/page-forms.ts` `initiatePagePayment` (line 970) to accept an optional `discountCode` parameter and apply it atomically:

```typescript
export const initiatePagePayment = createServerFn({ method: 'POST', strict: false })
  .inputValidator((data: {
    sessionId: number; pageId: number; gatewaySlug: GatewaySlug;
    discountCode?: string; discountId?: number;
  }) => data)
  .handler(async ({ data }) => {
    // ... existing amount calculation ...
    let finalAmount = amountMajor

    if (data.discountCode && data.discountId) {
      // Re-validate + atomically increment usage
      const [updated] = await db.update(discountCodes)
        .set({ currentUses: sql`current_uses + 1`, updatedAt: new Date() })
        .where(and(
          eq(discountCodes.id, data.discountId),
          eq(discountCodes.isActive, true),
          or(eq(discountCodes.maxUses, null), lt(discountCodes.currentUses, discountCodes.maxUses)),
        ))
        .returning()
      if (!updated) throw new Error('Discount code is no longer available')

      const discountAmount = updated.type === 'percentage'
        ? Math.round(finalAmount * (updated.value / 100))
        : updated.value
      finalAmount = Math.max(0, finalAmount - discountAmount)
    }

    // ... initiate payment with finalAmount ...
  })
```

---

## 5. File Change Summary

| File | Purpose |
|---|---|
| `src/db/schema.ts` | Add `discountCodes` + `discountRedemptions` tables |
| `drizzle/0030_discount_codes.sql` | Generated migration |
| `src/lib/server-fns/discounts.ts` (new) | CRUD for discount codes + public validation |
| `src/routes/forms/$formId/discounts.tsx` (new) | Discount management page route |
| `src/components/forms/DiscountCodeRow.tsx` (new) | Row in the discount codes list |
| `src/components/forms/CreateDiscountDialog.tsx` (new) | Modal for creating a discount code |
| `src/components/page-form/DiscountCodeInput.tsx` (new) | Discount code input + apply button on payment step |
| `src/components/page-form/PagePaymentStep.tsx` (modify) | Add discount code input section, show adjusted price |
| `src/components/forms/FormSectionNav.tsx` (modify) | Add "Discounts" tab to navigation |
| `src/lib/server-fns/page-forms.ts` (modify) | Accept `discountCode` in `initiatePagePayment` + `getPagePaymentOptions` |

---

## 7. Step-by-Step Tasks

### Task 1: DB Migration
- Add `discountCodes` + `discountRedemptions` to `src/db/schema.ts`
- Run `pnpm db:generate` + `pnpm db:migrate`

### Task 2: Server Functions
- Create `src/lib/server-fns/discounts.ts`
- Implement `getDiscountCodes`, `createDiscountCode`, `toggleDiscountCode`, `deleteDiscountCode`
- Implement `validateDiscountCode` (public, no auth) with all validation rules

### Task 3: Discount Management UI
- Create `src/routes/forms/$formId/discounts.tsx`
- List all discount codes with usage stats
- Create discount dialog with all config fields

### Task 4: Discount Code Input on Payment Step
- Create `src/components/page-form/DiscountCodeInput.tsx`
- Input + Apply button, calls `validateDiscountCode`
- Shows applied discount with original/strikethrough price
- Shows error for invalid/expired codes

### Task 5: Modify PagePaymentStep
- Integrate `DiscountCodeInput` into `src/components/page-form/PagePaymentStep.tsx`
- Pass `discountCode` to `initiatePagePayment` when paying

### Task 6: Server-Side Discount in initiatePagePayment
- Modify `initiatePagePayment` to accept `discountId` + `discountCode`
- Atomically increment `current_uses` before creating payment
- Store `discountRedemptions` row after successful payment

### Task 7: Navigation Update
- Add "Discounts" tab in `FormSectionNav.tsx`
- Icon: `Percent` from lucide-react

### Task 8: Test End-to-End
- Create discount code, submit form with code → verify discount applied
- Try using code past max_uses → rejected
- Try using expired code → rejected
- Try concurrent usage (two respondents using last remaining use) → one succeeds, one rejected

---

## 8. Risks & Open Questions

| Risk / Question | Mitigation / Answer |
|---|---|
| **Race condition — two respondents use the last discount simultaneously** | Atomic `UPDATE ... WHERE current_uses < max_uses` in the `initiatePagePayment` handler. PostgreSQL row-level locking guarantees only one succeeds. |
| **Discount code guessing / brute force** | `validateDiscountCode` is rate-limited implicitly by being called per-page-load. If abuse is a concern, add a 3-attempt cooldown per session. |
| **Negative total after discount** | `finalAmount = Math.max(0, amountMajor - discountAmount)` ensures the amount never goes below 0. ₱0 payments are not allowed by gateways anyway — `initiatePagePayment` already throws for amounts ≤ 0. |
| **Stacking multiple discounts** | For simplicity, only one discount code per transaction. Multiple codes (stacking) can be added later. |
| **Discount codes visible in URL** | The discount code is sent via POST body to server functions, never in the URL or client-visible state beyond the payment step UI. |

---

## 9. Validation / Testing

- [ ] Create a percentage discount (20%) → validate returns correct final amount
- [ ] Create a fixed discount (₱500) → validate returns correct final amount
- [ ] Apply discount on payment page → original price struck through, discounted price shown
- [ ] Complete payment with discount → charged correct amount, redemption recorded
- [ ] Max uses limit: create code with max_uses=2 → use twice successfully, third fails
- [ ] Expiration: create code expiring yesterday → validate returns "expired"
- [ ] Min amount: create code with min_order=₱1,000 → apply to ₱500 order → rejected
- [ ] Deactivate code → validate returns "invalid"
- [ ] Codes are case-insensitive (`earlybird` = `EARLYBIRD`)
