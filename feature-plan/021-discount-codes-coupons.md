# FT-021: Discount Codes & Coupons — Full-Featured Price Adjustment System

> **Feature Plan** — Form creators create discount codes (percentage off or fixed amount off) with descriptions, usage limits, and date ranges. Codes appear as a **draggable form field** in the page builder — respondents enter a code on any page before the payment page to reduce their total. The system automatically validates codes server-side, adjusts the payment amount, tracks redemptions, and prevents overselling with atomic database operations.

**Status:** ✅ **Redesigned and implemented** — discounts are centrally managed, each code can be assigned to multiple forms, per-respondent limits have been removed, and the database migration, payment integration, focused tests, and production build are complete.

**References:**
- `src/db/schema.ts` — all tables, `fieldTypeEnum`
- `src/lib/page-builder/references.ts` — `calculatePagePayment()` at line 240
- `src/lib/server-fns/page-forms.ts` — `initiatePagePayment()` at line 1100
- `src/components/page-form/PagePaymentStep.tsx` — payment UI at line 131
- `src/components/forms/FormSectionNav.tsx` — form tabs
- `src/components/form-builder/fields/renderers/` — field renderer pattern

---

## 1. User Story & Problem

### 1.1 What Creators Can Do Today

To offer a discount, a creator must either:
1. Create a separate form with a lower price (fragile, manual tracking)
2. Add a select field "Discount code?" → conditional logic → different payment fields (no server-side enforcement)

Both are error-prone and don't scale beyond a handful of respondents.

### 1.2 What Creators Want

> *"I'm running an early bird promotion for my workshop — 20% off if you register before August 1st. I want to create the code `EARLYBIRD`, add a discount field to my registration form, and have the system automatically apply the discount when someone enters it. The code should stop working after August 1st or after 50 uses."*

> *"Our staff get a flat ₱500 discount. They enter `STAFF2026` in the discount field, the price drops from ₱2,500 to ₱2,000, and they pay the discounted amount."*

> *"I'm running a Black Friday sale: `BLACKFRIDAY` gives 30% off up to ₱1,000 max discount. I need to add a note explaining the terms."*

### 1.3 Discount Code as a Form Field — The Key Design Decision

The discount code input will be a **draggable form field** in the page builder, not just an addon bolted onto the payment step. Why:

| Approach | Creator UX | Respondent UX | System Complexity |
|---|---|---|---|
| **Payment-step addon only** | No control over placement | Discount only visible at payment | Simpler but inflexible |
| **Form field (this plan)** | Drag anywhere before payment | Sees discount field wherever creator placed it | Cleaner architecture — discount flows through existing `collectedData` pipeline |

As a form field, the discount code input:
- Appears in the **builder palette** under the "Logic" or "Special" section
- Can be placed on **any page** before the payment page
- Stores the validated discount in the session's `collectedData` as `__discount` (code + amount + type)
- The payment step and `calculatePagePayment` read it from collectedData — zero new coupling

---

## 2. Discount Code Properties — What Creators Configure

### 2.1 Complete Configuration

| Property | Type | Required | Description |
|---|---|---|---|
| **Code** | `string` (max 50, uppercase) | ✅ Yes | The code respondents enter (e.g., `EARLYBIRD`, `STAFF2026`) |
| **Description** | `string` (text, up to 500 chars) | ✅ Yes | Internal note explaining what this code is for |
| **Discount Type** | `'percentage'` or `'fixed'` | ✅ Yes | Percentage off or fixed amount off |
| **Value** | `integer` | ✅ Yes | For percentage: `20` = 20% off. For fixed: `50000` = ₱500 off (minor units) |
| **Max Uses** | `integer` or `null` | ❌ No | Total redemptions allowed. `null` = unlimited |
| **Min Order Amount** | `integer` or `null` | ❌ No | Minimum payment amount required to use this code (minor units). E.g., `100000` = ₱1,000 minimum |
| **Max Discount Cap** | `integer` or `null` | ❌ No | For percentage codes: max absolute discount. E.g., `100000` = cap discount at ₱1,000 even if 30% of ₱5,000 = ₱1,500 |
| **Starts At** | `timestamp` or `null` | ❌ No | When the code becomes active. `null` = immediately |
| **Expires At** | `timestamp` or `null` | ❌ No | When the code stops working. `null` = never |
| **Active** | `boolean` | ✅ Yes | Master on/off toggle |

### 2.2 Discount Calculation Logic

```
If type is 'percentage':
    rawDiscount = paymentAmount × (value / 100)
    if maxDiscount is set AND rawDiscount > maxDiscount:
        discountAmount = maxDiscount
    else:
        discountAmount = rawDiscount

If type is 'fixed':
    discountAmount = value  (already in minor units)

finalAmount = max(0, paymentAmount - discountAmount)
```

---

## 3. System Design — DB Schema & Architecture

### 3.1 New Table: `discount_codes`

```sql
CREATE TABLE discount_codes (
    id              SERIAL PRIMARY KEY,
    form_id         INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    code            VARCHAR(50) NOT NULL,              -- stored UPPERCASE
    description     TEXT NOT NULL DEFAULT '',           -- creator's internal note
    type            VARCHAR(20) NOT NULL DEFAULT 'percentage',
    value           INTEGER NOT NULL,                   -- percentage (20=20%) or minor units (50000=₱500)
    max_uses        INTEGER,                            -- NULL = unlimited
    current_uses    INTEGER NOT NULL DEFAULT 0,
    min_amount      INTEGER,                            -- minimum order amount in minor units
    max_discount    INTEGER,                            -- max discount cap in minor units
    starts_at       TIMESTAMP,
    expires_at      TIMESTAMP,
    usage_limit_per_respondent INTEGER DEFAULT 1,      -- NULL = unlimited per person
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at      TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX discount_codes_form_id_code_idx ON discount_codes(form_id, code);
CREATE INDEX discount_codes_form_id_active_idx ON discount_codes(form_id) WHERE is_active = TRUE;
```

```typescript
// In src/db/schema.ts
export const discountCodes = pgTable(
  'discount_codes',
  {
    id: serial().primaryKey(),
    formId: integer('form_id').notNull().references(() => forms.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 50 }).notNull(),
    description: text('description').notNull().default(''),
    type: varchar('type', { length: 20 }).notNull().default('percentage'),
    value: integer('value').notNull(),
    maxUses: integer('max_uses'),
    currentUses: integer('current_uses').notNull().default(0),
    minAmount: integer('min_amount'),
    maxDiscount: integer('max_discount'),
    startsAt: timestamp('starts_at'),
    expiresAt: timestamp('expires_at'),
    usageLimitPerRespondent: integer('usage_limit_per_respondent').default(1),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('discount_codes_form_id_code_idx').on(table.formId, table.code),
    index('discount_codes_form_id_active_idx').on(table.formId).where(eq(table.isActive, true)),
  ],
)
```

### 3.2 New Table: `discount_redemptions`

Tracks every code redemption for analytics and per-respondent limits.

```sql
CREATE TABLE discount_redemptions (
    id                  SERIAL PRIMARY KEY,
    discount_code_id    INTEGER NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
    form_submission_id  INTEGER NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
    payment_id          INTEGER REFERENCES payments(id) ON DELETE SET NULL,
    respondent_email    VARCHAR(255),                    -- from session or payment
    original_amount     INTEGER NOT NULL,                -- minor units
    discount_amount     INTEGER NOT NULL,                -- minor units
    final_amount        INTEGER NOT NULL,                -- minor units
    redeemed_at         TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX discount_redemptions_code_id_idx ON discount_redemptions(discount_code_id);
CREATE INDEX discount_redemptions_email_idx ON discount_redemptions(respondent_email);
```

### 3.3 Architecture — Full Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CREATOR — Discounts Management Tab                                     │
│  /forms/$formId/discounts                                               │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Active Codes (3)                         [+ Create Discount]   │   │
│  │                                                                  │   │
│  │  EARLYBIRD   20% off   45/50 uses   Aug 1, 2026   [⏸ Deactivate]│   │
│  │  Early bird registration promo — expires after event             │   │
│  │                                                                  │   │
│  │  STAFF2026   ₱500 off  12 uses      No limit      [⏸ Deactivate]│   │
│  │  Internal staff discount for all training programs               │   │
│  │                                                                  │   │
│  │  BLACKFRIDAY 30% off   3/200 uses  Nov 30, 2026  [⏸ Deactivate] │   │
│  │  Black Friday sale — max ₱1,000 discount, min ₱500 order        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  CREATOR — Page Builder (adding discount field to form)                 │
│                                                                         │
│  Builder Palette:                                                       │
│  ┌──────────────┐                                                       │
│  │ 📝 Text      │                                                       │
│  │ ✉️ Email     │                                                       │
│  │ ...          │                                                       │
│  │ 🏷️ Discount  │  ← NEW: draggable field type                         │
│  └──────────────┘                                                       │
│                                                                         │
│  Field Config (when selected):                                          │
│  ┌────────────────────────────────────────┐                            │
│  │  Label: "Have a discount code?"         │                           │
│  │  Placeholder: "Enter code"              │                           │
│  │  Helper text: "Apply a discount code    │                           │
│  │   to reduce your payment amount."       │                           │
│  │  [✓] Required                           │                           │
│  └────────────────────────────────────────┘                            │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  RESPONDENT — Form Page with Discount Field                             │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Page 2 of 3                                                     │   │
│  │                                                                  │   │
│  │  Workshop Registration                                           │   │
│  │                                                                  │   │
│  │  Full Name                                                       │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │ Juan Dela Cruz                                            │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  │                                                                  │   │
│  │  Email                                                          │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │ juan@example.com                                          │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  │                                                                  │   │
│  │  ── Have a discount code? ──                                    │   │
│  │  ┌──────────────────────────────┐  ┌──────────┐                │   │
│  │  │ EARLYBIRD                     │  │  Apply   │                │   │
│  │  └──────────────────────────────┘  └──────────┘                │   │
│  │                                                                  │   │
│  │  ✓ EARLYBIRD applied — 20% off!                                 │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │ ✓ Code applied: 20% discount will be deducted at payment │   │   │
│  │  │                                [Remove code]              │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  │                                                                  │   │
│  │                                        [Back]    [Continue]      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  RESPONDENT — Payment Page (discount already applied)                   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  Payment                                                         │   │
│  │                                                                  │   │
│  │  Price breakdown:                                                │   │
│  │    Workshop Registration ....................... ₱2,500.00       │   │
│  │    Discount (EARLYBIRD — 20% off) ............. -₱500.00        │   │
│  │    ─────────────────────────────────────────                     │   │
│  │    Total ....................................... ₱2,000.00       │   │
│  │                                                                  │   │
│  │                        [Pay ₱2,000.00 with PayPal]               │   │
│  │                        [Pay ₱2,000.00 with Xendit]               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  SYSTEM — What Happens Automatically                                    │
│                                                                         │
│  1. Respondent types "EARLYBIRD" → clicks Apply                        │
│     └─ POST /api/discounts/validate { formId, code, currentAmount }    │
│        ├─ Server queries discount_codes WHERE code = UPPER('earlybird')│
│        ├─ Validates: isActive, not expired, starts_at passed,          │
│        │   currentUses < maxUses, minAmount check                      │
│        ├─ Calculates: discountAmount, finalAmount                      │
│        └─ Returns: { valid, discountId, code, type, value,             │
│        │            discountAmount, finalAmount, description }         │
│                                                                         │
│  2. Discount stored in session collectedData                           │
│     └─ collectedData.__discount = {                                     │
│          code: "EARLYBIRD", discountId: 42, type: "percentage",        │
│          value: 20, discountAmount: 50000                              │
│        }                                                               │
│                                                                         │
│  3. Payment page reads __discount from collectedData                   │
│     └─ calculatePagePayment() applies discountAmount as an adjustment  │
│     └─ breakdown shows: original → discount → total                    │
│                                                                         │
│  4. Respondent clicks "Pay ₱2,000.00"                                  │
│     └─ initiatePagePayment receives discountId + discountCode          │
│     └─ Atomic UPDATE: increments current_uses WHERE current_uses <     │
│        max_uses AND is_active AND not expired                          │
│     └─ If UPDATE returns 0 rows → "This code just ran out"             │
│     └─ Creates payment with finalAmount (minor units)                  │
│     └─ Records discount_redemptions row after payment succeeds         │
│                                                                         │
│  5. Completion → redemption linked to submission                       │
│     └─ For analytics: how many times each code was used                 │
│     └─ For per-respondent limits: checks previous redemptions by email │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Field Type Integration — Discount Field in the Builder

### 4.1 Schema: No New `fieldTypeEnum` Value Needed

The discount code field uses the existing `text` field type with special rendering/behavior. This avoids a database migration for the enum and keeps things simple. The field is identified by a `fieldType: 'text'` with a config flag or simply by the `bindVariable` being `__discount_code`.

**Alternative (preferred — cleaner):** Add `'discount'` to `fieldTypeEnum` for explicit handling in the renderer. This is a `pgEnum` so it needs a migration:

```sql
ALTER TYPE field_type ADD VALUE 'discount';
```

Either approach works. The `'discount'` enum value is preferred because:
- Field renderer dispatches cleanly to `DiscountField` renderer
- Builder config form shows discount-specific options (not text field options)
- `FIELD_ICON` map gets a `Percent` icon

### 4.2 Builder Palette

In `src/components/flow-builder/BuilderPalette.tsx`, add:

```typescript
{ fieldType: 'discount', label: 'Discount Code', icon: <Percent size={14} /> },
```

And in `GroupFieldsEditor.tsx`:

```typescript
const FIELD_TYPES = [..., 'discount'] as const
const FIELD_ICON: Record<string, React.ReactNode> = {
  // ... existing icons ...
  discount: <Percent size={14} className="text-[#cc785c]" />,
}
```

### 4.3 Field Configuration (FormFieldConfig.tsx)

When the selected field type is `'discount'`, the config form shows:

| Setting | Default | Description |
|---|---|---|
| Label | "Discount Code" | Field label shown to respondent |
| Placeholder | "Enter code" | Input placeholder |
| Helper text | "Apply a discount code to reduce your payment amount." | Text below the input |
| Required | `false` | Whether respondent must enter a code |

### 4.4 Field Renderer

New file: `src/components/form-builder/fields/renderers/DiscountCodeField.tsx`

```tsx
import { useState, useCallback } from 'react'
import { validateDiscountCode } from '../../../lib/server-fns/discounts'
import type { FieldConfig } from '../../../lib/form-field-types'
import { inputBase } from './utils'

interface DiscountCodeFieldProps {
  field: FieldConfig
  value?: string            // entered code
  onChange: (val: string) => void
  onDiscountApplied?: (discount: DiscountResult) => void
  formId: number
  currentAmount?: number    // current computed payment amount
}

export function DiscountCodeField({
  field, value = '', onChange, onDiscountApplied,
  formId, currentAmount,
}: DiscountCodeFieldProps) {
  const [code, setCode] = useState(value)
  const [status, setStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid'>('idle')
  const [message, setMessage] = useState('')
  const [appliedDiscount, setAppliedDiscount] = useState<DiscountResult | null>(null)

  const handleApply = useCallback(async () => {
    if (!code.trim()) return
    setStatus('loading')
    try {
      const result = await validateDiscountCode({
        data: { formId, code: code.trim(), amount: currentAmount ?? 0 }
      })
      if (result.valid) {
        setStatus('valid')
        setAppliedDiscount(result)
        setMessage(`${result.code} applied — ${result.type === 'percentage'
          ? `${result.value}% off`
          : `₱${(result.discountAmount / 100).toFixed(2)} off`}`)
        onChange(code.trim()) // store code in collectedData
        onDiscountApplied?.(result) // notify parent with full discount info
      } else {
        setStatus('invalid')
        setMessage(result.reason ?? 'Invalid code')
        setAppliedDiscount(null)
      }
    } catch {
      setStatus('invalid')
      setMessage('Could not validate code. Try again.')
      setAppliedDiscount(null)
    }
  }, [code, formId, currentAmount, onChange, onDiscountApplied])

  const handleRemove = useCallback(() => {
    setCode('')
    setStatus('idle')
    setMessage('')
    setAppliedDiscount(null)
    onChange('')
    onDiscountApplied?.(null as unknown as DiscountResult)
  }, [onChange, onDiscountApplied])

  return (
    <div className="flex flex-col gap-2">
      {field.label && (
        <label className="text-sm font-medium text-[#141413]">{field.label}</label>
      )}
      {field.helperText && (
        <p className="text-xs text-[#8e8b82]">{field.helperText}</p>
      )}

      {appliedDiscount ? (
        // Applied state — show success banner
        <div className="rounded-lg border border-[#cfe3ca] bg-[#f3fbf1] p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[#356a39]">
              ✓ Code applied: {appliedDiscount.type === 'percentage'
                ? `${appliedDiscount.value}% discount`
                : `₱${(appliedDiscount.discountAmount / 100).toFixed(2)} off`}
              {appliedDiscount.description ? ` — ${appliedDiscount.description}` : ''}
            </p>
            <button
              type="button"
              onClick={handleRemove}
              className="text-xs text-[#6c6a64] underline hover:text-[#c64545]"
            >
              Remove code
            </button>
          </div>
        </div>
      ) : (
        // Idle/invalid state — show input + apply button
        <div className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase())
              setStatus('idle')
              setMessage('')
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleApply() }}
            placeholder={field.placeholder || 'Enter code'}
            className={`${inputBase} flex-1 ${status === 'invalid' ? 'border-[#c64545]' : ''}`}
            disabled={status === 'loading'}
          />
          <button
            type="button"
            onClick={handleApply}
            disabled={!code.trim() || status === 'loading'}
            className="rounded-md border border-[#e6dfd8] bg-[#faf9f5] px-4 py-2 text-sm font-medium text-[#141413] hover:bg-[#f5f0e8] disabled:opacity-50"
          >
            {status === 'loading' ? 'Checking...' : 'Apply'}
          </button>
        </div>
      )}

      {/* Validation messages */}
      {status === 'invalid' && message && (
        <p className="text-xs text-[#c64545]">{message}</p>
      )}
    </div>
  )
}
```

---

## 5. Server Functions

### 5.1 File: `src/lib/server-fns/discounts.ts`

```typescript
import { createServerFn } from '@tanstack/react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import { db } from '../../db/index'
import { discountCodes, discountRedemptions, forms } from '../../db/schema'
import { eq, and, desc, lt, or, sql } from 'drizzle-orm'

// ── Creator-facing (auth required) ──

export const listDiscountCodes = createServerFn({ method: 'GET' })
  .validator((data: { formId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    // Verify form ownership
    const [form] = await db.select().from(forms).where(
      and(eq(forms.id, data.formId))
      // TODO: add profile ownership check
    ).limit(1)
    if (!form) throw new Error('Form not found')

    const codes = await db.select().from(discountCodes)
      .where(eq(discountCodes.formId, data.formId))
      .orderBy(desc(discountCodes.createdAt))
    return codes
  })

export const createDiscountCode = createServerFn({ method: 'POST' })
  .validator((data: {
    formId: number
    code: string
    description: string
    type: 'percentage' | 'fixed'
    value: number
    maxUses?: number | null
    minAmount?: number | null
    maxDiscount?: number | null
    startsAt?: string | null
    expiresAt?: string | null
    usageLimitPerRespondent?: number | null
  }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')

    const normalizedCode = data.code.trim().toUpperCase()
    if (!normalizedCode || normalizedCode.length > 50) {
      throw new Error('Code must be 1-50 characters')
    }
    if (!data.description.trim()) {
      throw new Error('Description is required')
    }
    if (data.type === 'percentage' && (data.value < 0 || data.value > 100)) {
      throw new Error('Percentage must be between 0 and 100')
    }
    if (data.type === 'fixed' && data.value <= 0) {
      throw new Error('Fixed discount must be positive')
    }

    // Check uniqueness
    const [existing] = await db.select().from(discountCodes).where(
      and(eq(discountCodes.formId, data.formId), eq(discountCodes.code, normalizedCode))
    ).limit(1)
    if (existing) throw new Error(`A code named "${normalizedCode}" already exists for this form`)

    const [code] = await db.insert(discountCodes).values({
      formId: data.formId,
      code: normalizedCode,
      description: data.description.trim(),
      type: data.type,
      value: data.value,
      maxUses: data.maxUses ?? null,
      minAmount: data.minAmount ?? null,
      maxDiscount: data.maxDiscount ?? null,
      startsAt: data.startsAt ? new Date(data.startsAt) : null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      usageLimitPerRespondent: data.usageLimitPerRespondent ?? 1,
    }).returning()
    return code
  })

export const toggleDiscountCode = createServerFn({ method: 'POST' })
  .validator((data: { id: number; isActive: boolean }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await db.update(discountCodes)
      .set({ isActive: data.isActive, updatedAt: new Date() })
      .where(eq(discountCodes.id, data.id))
    return { success: true }
  })

export const deleteDiscountCode = createServerFn({ method: 'POST' })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await db.delete(discountCodes).where(eq(discountCodes.id, data.id))
    return { success: true }
  })

// ── Public-facing (no auth — called from respondent form) ──

export interface DiscountValidationResult {
  valid: boolean
  reason?: string
  discountId?: number
  code?: string
  description?: string
  type?: 'percentage' | 'fixed'
  value?: number
  discountAmount?: number
  finalAmount?: number
}

export const validateDiscountCode = createServerFn({ method: 'GET', strict: false })
  .validator((data: { formId: number; code: string; amount: number }) => data)
  .handler(async ({ data }): Promise<DiscountValidationResult> => {
    const normalizedCode = data.code.trim().toUpperCase()
    if (!normalizedCode) return { valid: false, reason: 'Enter a code' }

    const [discount] = await db.select().from(discountCodes).where(
      and(
        eq(discountCodes.formId, data.formId),
        eq(discountCodes.code, normalizedCode),
        eq(discountCodes.isActive, true),
      )
    ).limit(1)

    if (!discount) {
      return { valid: false, reason: 'Invalid discount code' }
    }
    if (discount.expiresAt && discount.expiresAt < new Date()) {
      return { valid: false, reason: 'This code has expired' }
    }
    if (discount.startsAt && discount.startsAt > new Date()) {
      return { valid: false, reason: `This code is valid starting ${discount.startsAt.toLocaleDateString()}` }
    }
    if (discount.maxUses !== null && discount.currentUses >= discount.maxUses) {
      return { valid: false, reason: 'This code has reached its usage limit' }
    }
    if (discount.minAmount && data.amount < discount.minAmount) {
      return {
        valid: false,
        reason: `Minimum order of ₱${(discount.minAmount / 100).toFixed(2)} required to use this code`
      }
    }

    let discountAmount: number
    if (discount.type === 'percentage') {
      discountAmount = Math.round(data.amount * (discount.value / 100))
      if (discount.maxDiscount && discountAmount > discount.maxDiscount) {
        discountAmount = discount.maxDiscount
      }
    } else {
      discountAmount = discount.value
    }

    const finalAmount = Math.max(0, data.amount - discountAmount)

    return {
      valid: true,
      discountId: discount.id,
      code: discount.code,
      description: discount.description,
      type: discount.type as 'percentage' | 'fixed',
      value: discount.value,
      discountAmount,
      finalAmount,
    }
  })
```

### 5.2 Integration with `initiatePagePayment` (line 1100, `page-forms.ts`)

Modify the validator to accept an optional discount:

```typescript
export const initiatePagePayment = createServerFn({ method: 'POST', strict: false })
  .validator((data: {
    sessionId: number
    clientToken: string
    pageId: number
    gatewaySlug: GatewaySlug
    discountCodeId?: number       // NEW
    discountCode?: string          // NEW
  }) => data)
  .handler(async ({ data }) => {
    // ... existing session lookup and amount calculation ...

    const amountMajor = calculatePagePayment(/* ... */).amount
    
    let discountAmountMinor = 0
    let finalAmountMajor = amountMajor

    // ── NEW: Atomic discount redemption ──
    if (data.discountCodeId && data.discountCode) {
      const [updated] = await db.update(discountCodes)
        .set({
          currentUses: sql`current_uses + 1`,
          updatedAt: new Date(),
        })
        .where(and(
          eq(discountCodes.id, data.discountCodeId),
          eq(discountCodes.isActive, true),
          eq(discountCodes.code, data.discountCode.trim().toUpperCase()),
          or(
            sql`${discountCodes.maxUses} IS NULL`,
            lt(discountCodes.currentUses, discountCodes.maxUses),
          ),
          or(
            sql`${discountCodes.expiresAt} IS NULL`,
            sql`${discountCodes.expiresAt} > NOW()`,
          ),
          or(
            sql`${discountCodes.startsAt} IS NULL`,
            sql`${discountCodes.startsAt} <= NOW()`,
          ),
        ))
        .returning()

      if (!updated || updated.length === 0) {
        throw new Error('This discount code is no longer available')
      }

      const redeemed = updated[0]
      discountAmountMinor = redeemed.type === 'percentage'
        ? Math.round((amountMajor * 100) * (redeemed.value / 100))
        : redeemed.value
      
      // Apply cap
      if (redeemed.maxDiscount && discountAmountMinor > redeemed.maxDiscount) {
        discountAmountMinor = redeemed.maxDiscount
      }

      finalAmountMajor = Math.max(0, (amountMajor * 100 - discountAmountMinor) / 100)
    }

    if (!Number.isFinite(finalAmountMajor) || finalAmountMajor <= 0) {
      throw new Error('Nothing to pay — the amount is zero or invalid')
    }

    // ... rest of payment initiation (unchanged) ...
    const amountMinor = Math.round(finalAmountMajor * 100) // uses discounted amount now

    // ... create payment with amountMinor ...
  })
```

### 5.3 Integration with `calculatePagePayment` (line 240, `references.ts`)

Add a discount deduction step after the main computation:

```typescript
// After the existing breakdown.push({ label: 'Subtotal', amount: subtotal, kind: 'subtotal' })
// and before the formula adjustments loop:

// ── NEW: Apply discount code if present in collectedData ──
const discountData = dataScope.__discount as {
  code: string; discountId: number; type: string;
  value: number; discountAmount: number;
} | undefined

if (discountData && discountData.discountAmount > 0) {
  const discountLabel = discountData.type === 'percentage'
    ? `Discount (${discountData.code} — ${discountData.value}% off)`
    : `Discount (${discountData.code} — ₱${(discountData.discountAmount / 100).toFixed(2)} off)`

  breakdown.push({
    label: discountLabel,
    amount: -(discountData.discountAmount / 100), // major units, negative
    kind: 'adjustment',
  })
  amount = Math.max(0, amount - discountData.discountAmount / 100)
}
```

---

## 6. UI — Creator Discount Management

### 6.1 Route: `src/routes/forms/$formId/discounts.tsx`

```
┌─────────────────────────────────────────────────────────────────┐
│  Build | Responses | Payments | Invoicing | 💰 Discounts        │
│─────────────────────────────────────────────────────────────────│
│                                                                  │
│  Discount Codes                                         [+ New] │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Code          Type        Usage        Expires    Status   │  │
│  │───────────────────────────────────────────────────────────│  │
│  │ EARLYBIRD     20% off     45 / 50      Aug 1     Active   │  │
│  │ Early bird registration promo — expires after event       │  │
│  │                                                           │  │
│  │ STAFF2026     ₱500 off    12           Never     Active   │  │
│  │ Internal staff discount for all training programs         │  │
│  │                                                           │  │
│  │ BLACKFRIDAY   30% off     3 / 200      Nov 30    Active   │  │
│  │ Black Friday sale — max ₱1,000, min ₱500 order           │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Create Discount Dialog

```
┌─────────────────────────────────────────────────────────────────┐
│  Create Discount Code                                    [✕]    │
│─────────────────────────────────────────────────────────────────│
│                                                                  │
│  Code *                                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ EARLYBIRD                                         [🎲]   │   │
│  └──────────────────────────────────────────────────────────┘   │
│  The code respondents will enter (case-insensitive)             │
│                                                                  │
│  Description *                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Early bird registration discount — 20% off for           │   │
│  │ participants who register before August 1, 2026.         │   │
│  │ Applies to the workshop registration fee only.           │   │
│  └──────────────────────────────────────────────────────────┘   │
│  Internal note to remember what this code is for               │
│                                                                  │
│  ── Discount ──                                                  │
│                                                                  │
│  Type                          Value                             │
│  ┌────────────────────┐       ┌──────────┐                      │
│  │ Percentage ▼       │       │    20    │  %                   │
│  └────────────────────┘       └──────────┘                      │
│                                                                  │
│  ── Limits (optional) ──                                         │
│                                                                  │
│  Max Uses                     Per Person Limit                   │
│  ┌──────────────┐            ┌──────────────┐                   │
│  │ 50           │   uses     │ 1            │   per person      │
│  └──────────────┘            └──────────────┘                   │
│  Leave empty for unlimited                                     │
│                                                                  │
│  Min Order Amount             Max Discount Cap                   │
│  ┌──────────────┐            ┌──────────────┐                   │
│  │              │   ₱        │              │   ₱               │
│  └──────────────┘            └──────────────┘                   │
│  E.g., "1,000" — code only works on orders ≥ ₱1,000           │
│  Cap: maximum discount for percentage codes                    │
│                                                                  │
│  ── Schedule ──                                                  │
│                                                                  │
│  Valid From                    Expires At                        │
│  ┌──────────────┐            ┌──────────────┐                   │
│  │ Jul 28, 2026 │            │ Aug 1, 2026  │                   │
│  └──────────────┘            └──────────────┘                   │
│  Leave empty for immediate / no expiration                     │
│                                                                  │
│                              [Cancel]        [Create Code]       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Automatic System Behaviors

### 7.1 What Happens When a Respondent Enters a Code

| Step | Trigger | System Action |
|---|---|---|
| 1 | Respondent types code + clicks Apply | `validateDiscountCode` server function called |
| 2 | Code is valid | Discount info stored in session's `collectedData.__discount` |
| 3 | Code is invalid | Error message shown below the input. Session data unchanged. |
| 4 | Respondent removes code | `__discount` cleared from session. Payment reverts to original. |
| 5 | Respondent advances to payment page | `calculatePagePayment` reads `__discount`, deducts from total |
| 6 | Respondent clicks Pay | `initiatePagePayment` atomically increments `currentUses` |
| 7 | Race condition: another user just used the last redemption | Atomic `UPDATE` returns 0 rows → payment rejected with "This code just ran out" |
| 8 | Payment succeeds | `discount_redemptions` row created. Payment recorded with discounted amount. |
| 9 | Payment fails | Redemption not recorded. `currentUses` NOT rolled back (intentional — the code was "claimed" when checkout was initiated; if they retry, they re-enter the code) |

**Design decision on rollback:** `currentUses` is incremented atomically at checkout initiation, not after payment success. This is safer because:
- If we wait until payment success, two people could use the last code simultaneously at checkout (both pass validation, both reach gateway) → oversold
- If a legitimate user's payment fails, they simply enter the code again — `currentUses` already accounts for their use
- For per-respondent limits, the system checks `discount_redemptions` by email

### 7.2 Validation Rules (Server-Side)

| Rule | Error Message |
|---|---|
| Code not found | "Invalid discount code" |
| Code is inactive (toggled off) | "Invalid discount code" |
| Code not yet active (`startsAt` in future) | "This code is valid starting [date]" |
| Code expired (`expiresAt` in past) | "This code has expired" |
| Max uses reached | "This code has reached its usage limit" |
| Order below `minAmount` | "Minimum order of ₱[amount] required to use this code" |
| Per-respondent limit exceeded | "You've already used this code" (checked at redemption time) |

### 7.3 What Shows in Submissions

Each submission that used a discount code will have:
- `collectedData.__discount` — the discount code and amount applied
- A linked `discount_redemptions` row with original/discounted/final amounts
- The `payments` row shows the discounted amount (not the original)

### 7.4 Analytics (Future FT-017)

When the analytics dashboard is built, discount data can surface:
- Total discount amount given per code
- Most-used discount codes
- Redemption rate (uses / max_uses)
- Average discount amount per redemption
- Revenue impact: total would-have-been vs actual collected

---

## 8. File Change Summary

| # | File | Action | Purpose |
|---|---|---|---|
| 1 | `src/db/schema.ts` | Modify | Add `discountCodes` + `discountRedemptions` tables |
| 2 | `drizzle/0030_discount_codes.sql` | New (auto) | Generated migration (`ALTER TYPE field_type ADD VALUE 'discount'` + CREATE TABLE) |
| 3 | `src/lib/server-fns/discounts.ts` | New | All discount CRUD + public validation |
| 4 | `src/routes/forms/$formId/discounts.tsx` | New | Discount management page route |
| 5 | `src/components/forms/CreateDiscountDialog.tsx` | New | Modal for creating/editing a discount code |
| 6 | `src/components/forms/DiscountCodeRow.tsx` | New | Row in the discount codes list |
| 7 | `src/components/forms/FormSectionNav.tsx` | Modify | Add "Discounts" tab with `Percent` icon |
| 8 | `src/components/form-builder/fields/renderers/DiscountCodeField.tsx` | New | Field renderer — input + apply + validation |
| 9 | `src/components/form-builder/fields/renderers/index.ts` | Modify | Export `DiscountCodeField` |
| 10 | `src/components/form-builder/fields/FieldRenderer.tsx` | Modify | Add `discount: DiscountCodeField` to renderer lookup |
| 11 | `src/components/form-builder/fields/FieldRendererUtils.ts` | Modify | Add `discount` to `FieldConfig.type` union |
| 12 | `src/components/flow-builder/BuilderPalette.tsx` | Modify | Add discount code to `FIELD_ITEMS` |
| 13 | `src/components/flow-builder/config-forms/GroupFieldsEditor.tsx` | Modify | Add to `FIELD_TYPES`, `FIELD_ICON` |
| 14 | `src/components/flow-builder/config-forms/FormFieldConfig.tsx` | Modify | Add discount config form section |
| 15 | `src/lib/page-builder/references.ts` | Modify | `calculatePagePayment` reads `__discount` from dataScope and adds deduction |
| 16 | `src/components/page-form/PagePaymentStep.tsx` | Modify | Show discount in breakdown if `__discount` present in session data |
| 17 | `src/lib/server-fns/page-forms.ts` | Modify | `initiatePagePayment` accepts `discountCodeId`/`discountCode`, atomically redeems |

---

## 9. Step-by-Step Tasks

### Task 1: DB Schema — complete locally
- Add `discountCodes` + `discountRedemptions` tables to `src/db/schema.ts`
- Add `'discount'` to `fieldTypeEnum` in `src/db/schema.ts`
- Run `pnpm db:generate`
- Run `pnpm db:migrate`

### Task 2: Server Functions — complete locally
- Create `src/lib/server-fns/discounts.ts`
- Implement `listDiscountCodes`, `createDiscountCode`, `toggleDiscountCode`, `deleteDiscountCode`
- Implement `validateDiscountCode` (public, no auth)
- Add comprehensive validation: code format, percentage range, positive fixed amounts, uniqueness

### Task 3: Discount Management UI — complete locally
- Add "Discounts" tab in `FormSectionNav.tsx` — icon: `Percent` from lucide-react
- Create `src/routes/forms/$formId/discounts.tsx` route
- Create `CreateDiscountDialog.tsx` with all config fields
- Create `DiscountCodeRow.tsx` showing code, type, usage, expiry, status

### Task 4: Field Type Registration — complete locally
- Add `'discount'` to all field type unions (FieldRenderer, GroupFieldsEditor, FormFieldConfig, BuilderPalette)
- Register `FIELD_ICON['discount']` in `GroupFieldsEditor.tsx`
- Add discount item to `FIELD_ITEMS` in `BuilderPalette.tsx`

### Task 5: Field Renderer — complete locally
- Create `src/components/form-builder/fields/renderers/DiscountCodeField.tsx`
- Input + Apply button, loading state, success banner, error messages
- Emits `onDiscountApplied` callback with full discount result
- Stores code in form's `collectedData` through standard `onChange`

### Task 6: Payment Amount Integration — complete locally
- Modify `calculatePagePayment` in `references.ts` to read `__discount` from dataScope
- Add discount line to breakdown (negative amount, `kind: 'adjustment'`)
- Cap final amount at 0 (never negative)
- Pass `formId` to `getPagePaymentOptions` so the payment page receives discount info

### Task 7: Payment Initiation Integration — complete locally
- Modify `initiatePagePayment` validator to accept optional `discountCodeId` + `discountCode`
- Add atomic redemption with `UPDATE ... RETURNING` before payment creation
- Handle "code just ran out" race condition gracefully
- After payment success, record `discount_redemptions` row

### Task 8: Payment Step UI — complete locally
- Modify `PagePaymentStep.tsx` to check session's `collectedData.__discount`
- If discount is present, show it in the price breakdown with original → discount → total
- The payment buttons show the discounted amount

### Task 9: Centralized Multi-Form Assignment — complete
- Manage discounts from `/discounts`
- Assign each code to one or multiple forms
- Validate the assignment server-side before saving

### Task 10: Test End-to-End — focused automated/database coverage complete
- Create a percentage discount (20%) → validate returns correct discounted amount
- Create a fixed discount (₱500) → validate returns correct discounted amount
- Apply code on form page → discount shows in session data
- Payment page shows discounted total
- Complete payment → redemption recorded, `current_uses` incremented
- Race condition: two respondents use last code simultaneously → one succeeds, one rejected
- Expired code → validation rejects
- Deactivated code → validation rejects
- Min order amount: code on ₱500 order with ₱1,000 min → rejected

---

## 10. Risks & Open Questions

| Risk | Mitigation |
|---|---|
| **Race condition on last redemption** | Atomic `UPDATE ... WHERE current_uses < max_uses RETURNING id`. PostgreSQL row-level locking guarantees only one succeeds. No application-level locking needed. |
| **Code brute force / guessing** | `validateDiscountCode` is called per-page-load. Rate limiting is implicit per session. If abuse is a concern, add exponential backoff after 3 failed attempts per session. |
| **Negative total after discount** | `finalAmount = Math.max(0, amount - discountAmount)`. However, gateways reject ₱0 payments — `initiatePagePayment` already throws for `amount <= 0`. |
| **Discount stacking** | Only one code per transaction by design. The `__discount` field in collectedData is a single object, not an array. Multiple codes can be added later with an array-based collection. |
| **Discount applied but payment cancelled** | `currentUses` is incremented at checkout initiation, not payment success. This prevents overselling but "wastes" a redemption if the user abandons checkout. Acceptable tradeoff — the code can be recreated if needed. |
| **Code visible in URL** | Never. Discount code is sent via POST body or server function call. The code itself is never in query params or client-visible state beyond the current page. |

---

## 11. Validation / Acceptance Checklist

- [ ] Creator can create a percentage discount code with description
- [ ] Creator can create a fixed-amount discount code with description
- [ ] Creator can set max uses, start date, expiry date, min order, max discount cap
- [ ] Creator can deactivate/reactivate a code
- [ ] Creator can delete a code (with confirmation)
- [ ] Discount code field appears in builder palette
- [ ] Creator can drag discount field onto any page
- [ ] Respondent sees discount code input on the correct page
- [ ] Respondent enters valid code → success banner with discount details
- [ ] Respondent enters invalid code → error message
- [ ] Respondent enters expired code → "expired" message
- [ ] Discount stored in session data and persists across page navigation
- [ ] Payment page shows original price, discount amount, and final price
- [ ] Payment initiated at discounted amount
- [ ] Redemption recorded after successful payment
- [ ] Code with max_uses=2 works twice, fails on third
- [ ] Per-respondent limit enforced (same email can't reuse)
- [ ] Codes are case-insensitive (`earlybird` = `EARLYBIRD`)
