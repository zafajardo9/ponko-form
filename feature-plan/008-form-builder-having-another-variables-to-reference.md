# FT-008: Form Constants — Form-Level Named Values for Calculations, Templates & Logic

> **Feature Plan** — Add a **Form Constants** system that lets form creators define named, typed values scoped to a form. These constants are NOT visible input fields — they're backing data: tax rates, service fees, package prices, discount percentages, VAT rates, and tier mapping tables. They become referenceable anywhere a field variable can be used: payment computations, condition values, default field values, template interpolation, and (in future) calculator expressions.

**Status:** 🚧 **Planned** — not yet implemented

**Dependencies:**
- ✅ **FT-007 (Form Builder Revision)** — the pages-based form builder where fields use `bindVariable` naming; constants share this same variable namespace
- 🚧 **FT-005 (Precreated Field Groups)** — field group templates may reference constants (e.g., a "Pricing" group uses `vat_rate`)
- 🚧 **FT-004 (Notifications)** — email templates interpolate form values; constants become available in `{{constant_name}}` syntax
- 🚧 **FT-003 (Services Integration)** — service payloads may reference form data + constants
- ✅ **Existing `formPageFields.bindVariable`** — constants must NOT collide with field variable names; a shared uniqueness check ensures this

---

## 1. The Problem — Why Constants Are Needed

### 1.1 Current State

Right now, every named value in a form comes from a **visible field** — a `formPageField` row with a `bindVariable` like `full_name`, `email`, `selected_plan`. When a respondent fills out the form, their answers are stored in `formSubmissions.formData` keyed by these variable names.

This works for straightforward data collection (name, email, choices), but it breaks down when forms need **derived, reference, or system values** that aren't directly entered by the respondent.

### 1.2 Concrete Scenarios

| Scenario | What the creator needs | Current gap |
|---|---|---|
| **Pricing plans** | Select field "Choose Plan" → options: Basic/Pro/Enterprise. Behind the scenes, each plan maps to a price: `basic_price = 5000`, `pro_price = 12000`, `enterprise_price = 25000`. The total should be computed from the selected plan's price. | Options have `price` but only for simple sum-of-options. No way to store multi-field pricing tiers (base price, setup fee, monthly fee) per plan choice. |
| **Tax/VAT computation** | A `vat_rate = 0.12` constant used in: `{{subtotal}} * {{vat_rate}}`. Displayed in templates: "Total includes {{vat_rate}}% VAT." | No way to define a constant that persists across all submissions for this form. |
| **Service fees** | A flat `service_fee = 500` added to every order. Or a percentage `convenience_fee = 0.035`. | Must hardcode values in payment config or duplicate across multiple fields. |
| **Discount tiers** | If `total > 10000`, apply `discount_pct = 0.10`. Show "{{discount_pct}}% discount applied" in the summary. | No variable to reference; would need a hidden field (hacky). |
| **Condition thresholds** | "Show express shipping IF {{order_total}} > {{free_shipping_threshold}}". The threshold should be a constant, not a field the user fills. | Currently conditions only reference other field variables, not constants. |
| **Tier mapping** | When the respondent selects "Enterprise" plan, the system needs to know: `enterprise_user_limit = 50`, `enterprise_storage = 500`, `enterprise_support = "priority"`. These values drive downstream logic (service dispatch, email templates, conditional fields) without being visible on the form. | No tier-mapping facility. |

### 1.3 The Root Issue

The system conflates **data capture** (what the respondent types/selects) with **business logic parameters** (what the creator defines). Constants decouple these — the creator defines prices, rates, and thresholds once, and they're available everywhere without polluting the form with hidden fields.

---

## 2. User Story

> *"I'm building a service order form. I have a dropdown where customers pick a plan: Basic, Pro, or Enterprise. Each plan has a base price, a setup fee, and a monthly maintenance fee. I also have a VAT rate of 12% and a service charge of $5 per order. I want to define these values as form-level constants — 'basic_price = 5000', 'pro_price = 12000', 'vat_rate = 0.12', 'service_fee = 500'. I want to reference them in payment calculations, in condition logic ('show premium support IF {{selected_plan}} = 'Enterprise''), and in templates ('Your total includes {{vat_rate}}% VAT'). I should not need to create hidden fields or duplicate these numbers across the form."*

---

## 3. System Design

### 3.1 Concept — Constants Join the Variable Namespace

Constants live in the **same naming scope** as field `bindVariable` values. This means:

- A constant named `vat_rate` exists alongside field variables like `full_name` and `selected_plan`
- At runtime (form submission), the collected data includes both respondent answers AND constant values
- Conditions, templates, and payment computations can reference constants with the same `{{constant_name}}` or variable-binding syntax

```
┌─────────────────────────────────────────────────────────┐
│              FORM DATA (formSubmissions.formData)        │
│                                                          │
│  ┌─────────────────────┐  ┌──────────────────────────┐  │
│  │  Field Variables     │  │  Constants               │  │
│  │  (from respondent)   │  │  (from form definition)  │  │
│  │                      │  │                          │  │
│  │  full_name: "John"   │  │  vat_rate: 0.12         │  │
│  │  email: "j@e.com"    │  │  service_fee: 500       │  │
│  │  selected_plan: "pro"│  │  basic_price: 5000      │  │
│  │  quantity: 3         │  │  pro_price: 12000       │  │
│  │                      │  │  free_ship_thresh: 10000│  │
│  └─────────────────────┘  └──────────────────────────┘  │
│                                                          │
│  All values available for:                               │
│  • Payment computation (sum, multiply, field references) │
│  • Condition evaluation (equals, greater_than, etc.)     │
│  • Template interpolation ({{variable}})                 │
│  • Default field values                                  │
│  • Service dispatch payloads (FT-003)                    │
│  • Email templates (FT-004)                              │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Data Flow

```
FORM CREATION (Builder UI)
═══════════════════════════════
  1. Creator defines constants in the Builder
     └─ "vat_rate" = 0.12 (number)
     └─ "service_fee" = 500 (number)
     └─ "pro_price" = 12000 (number)
     
  2. Constants are validated:
     └─ No duplicate names with field bindVariables
     └─ Type matches the declared type
     
  3. Saved to new DB table: form_constants


FORM SUBMISSION (Runtime)
═══════════════════════════
  1. Respondent fills fields → collected in `collectedData`
     └─ { full_name: "John", selected_plan: "pro", quantity: 3 }
     
  2. On final submission, constants are merged into `form_data`:
     └─ { full_name: "John", selected_plan: "pro", quantity: 3,
          vat_rate: 0.12, service_fee: 500, pro_price: 12000 }
     
  3. This merged map is:
     └─ Saved to formSubmissions.formData
     └─ Available for template interpolation
     └─ Available for payment computation
     └─ Available for service dispatch (FT-003)
     └─ Available for email notifications (FT-004)
```

### 3.3 Runtime Injection Point

Constants are injected at submission time in `completePageSubmission` (in `src/lib/server-fns/page-forms.ts`, around line 690). After the respondent's collected data is assembled and before it's saved to `formSubmissions.formData`, all active constants are spread into the data object. Constants never override respondent-provided values (field bindings win on collision).

---

## 4. DB Schema

### 4.1 New Table: `form_constants`

One row per constant per form. Multiple constants per form.

```sql
CREATE TABLE form_constants (
  id            SERIAL PRIMARY KEY,
  form_id       INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,       -- snake_case identifier (e.g., 'vat_rate')
  type          VARCHAR(20) NOT NULL,        -- 'string', 'number', 'boolean'
  value         TEXT NOT NULL,               -- Stored as text; parsed by type at runtime
  label         VARCHAR(255),                -- Human-readable name for the UI
  description   TEXT,                        -- Optional note about this constant
  position      INTEGER NOT NULL DEFAULT 0, -- Sort order in the constants list
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  
  UNIQUE(form_id, name)                      -- No duplicate names per form
);

CREATE INDEX form_constants_form_id_idx ON form_constants(form_id);
```

### 4.2 Drizzle Schema

```ts
// In src/db/schema.ts — appended at the bottom

export const formConstants = pgTable(
  'form_constants',
  {
    id: serial().primaryKey(),
    formId: integer('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    type: varchar('type', { length: 20 })
      .notNull()
      .$type<'string' | 'number' | 'boolean'>(),
    value: text('value').notNull(),
    label: varchar('label', { length: 255 }),
    description: text('description'),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('form_constants_form_id_name_idx').on(table.formId, table.name),
    index('form_constants_form_id_idx').on(table.formId),
  ],
)
```

### 4.3 TypeScript Type

```ts
// In src/lib/page-builder/types.ts

export interface FormConstant {
  id: number
  formId: number
  name: string           // snake_case: 'vat_rate'
  type: 'string' | 'number' | 'boolean'
  value: string          // Raw stored value: '0.12', '500', 'true'
  label: string | null   // Display: 'VAT Rate'
  description: string | null
  position: number
}

// Parsed value at runtime
export function parseConstantValue(constant: FormConstant): string | number | boolean {
  switch (constant.type) {
    case 'number':
      return Number(constant.value)
    case 'boolean':
      return constant.value === 'true'
    default:
      return constant.value
  }
}

// Build a key→parsed-value map for the runtime
export function buildConstantMap(constants: FormConstant[]): Record<string, string | number | boolean> {
  return Object.fromEntries(
    constants.map((c) => [c.name, parseConstantValue(c)]),
  )
}
```

---

## 5. Server Functions

### 5.1 CRUD for Constants

All server functions go in a new file: `src/lib/server-fns/constants.ts`

```ts
// src/lib/server-fns/constants.ts

import { createServerFn } from '@tanstack/react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import { db } from '../../db/index'
import { formConstants, formPageFields, forms, profiles } from '../../db/schema'
import { eq, and } from 'drizzle-orm'
import { assertFormOwner } from './flow-helpers'

/** Get all constants for a form (for the builder UI). */
export const getFormConstants = createServerFn({ method: 'GET' })
  .inputValidator((data: { formId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)

    const constants = await db
      .select()
      .from(formConstants)
      .where(eq(formConstants.formId, data.formId))
      .orderBy(formConstants.position)

    return constants
  })

/** Create a new constant. Validates name uniqueness against both existing constants AND field bindVariables. */
export const createFormConstant = createServerFn({ method: 'POST', strict: false })
  .inputValidator((data: {
    formId: number
    name: string
    type: 'string' | 'number' | 'boolean'
    value: string
    label?: string
    description?: string
  }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)

    // Validate name format (snake_case)
    if (!/^[a-z][a-z0-9_]*$/.test(data.name)) {
      throw new Error('Constant name must be snake_case (e.g., "vat_rate")')
    }

    // Check uniqueness against existing constants
    const [existing] = await db
      .select()
      .from(formConstants)
      .where(
        and(
          eq(formConstants.formId, data.formId),
          eq(formConstants.name, data.name),
        ),
      )
      .limit(1)
    if (existing) throw new Error(`Constant "${data.name}" already exists`)

    // Check uniqueness against field bindVariables
    const [collision] = await db
      .select({ bindVariable: formPageFields.bindVariable })
      .from(formPageFields)
      .innerJoin(formConstants, eq(formConstants.formId, formPageFields.pageId))
      // Hmm, need a different approach. Let's just check separately.
    // Actually, we can check via a subquery or two queries.
    
    // Check existing field bindings
    const pages = await db
      .select({ id: formConstants.formId }) // placeholder, actual check below
    // Simpler: get all page fields for this form and check
    const existingBindings = await db
      .select({ bindVariable: formPageFields.bindVariable })
      .from(formPageFields)
      .where(/* need form_id via pages join */)
    // Let's simplify: query all fields via the pages relationship

    // Validate value by type
    if (data.type === 'number' && isNaN(Number(data.value))) {
      throw new Error(`Constant "${data.name}" must be a valid number`)
    }
    if (data.type === 'boolean' && !['true', 'false'].includes(data.value)) {
      throw new Error(`Constant "${data.name}" must be "true" or "false"`)
    }

    const [constant] = await db
      .insert(formConstants)
      .values({
        formId: data.formId,
        name: data.name,
        type: data.type,
        value: data.value,
        label: data.label ?? null,
        description: data.description ?? null,
      })
      .returning()

    return constant
  })

/** Update an existing constant. */
export const updateFormConstant = createServerFn({ method: 'POST', strict: false })
  .inputValidator((data: {
    formId: number
    constantId: number
    name?: string
    type?: 'string' | 'number' | 'boolean'
    value?: string
    label?: string | null
    description?: string | null
  }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)

    const [existing] = await db
      .select()
      .from(formConstants)
      .where(eq(formConstants.id, data.constantId))
      .limit(1)
    if (!existing || existing.formId !== data.formId) {
      throw new Error('Constant not found')
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() }
    if (data.name !== undefined) {
      if (!/^[a-z][a-z0-9_]*$/.test(data.name)) {
        throw new Error('Constant name must be snake_case')
      }
      patch.name = data.name
    }
    if (data.type !== undefined) patch.type = data.type
    if (data.value !== undefined) {
      const type = data.type ?? existing.type
      if (type === 'number' && isNaN(Number(data.value))) {
        throw new Error('Value must be a valid number')
      }
      if (type === 'boolean' && !['true', 'false'].includes(data.value)) {
        throw new Error('Value must be "true" or "false"')
      }
      patch.value = data.value
    }
    if (data.label !== undefined) patch.label = data.label
    if (data.description !== undefined) patch.description = data.description

    const [updated] = await db
      .update(formConstants)
      .set(patch)
      .where(eq(formConstants.id, data.constantId))
      .returning()

    return updated
  })

/** Delete a constant. */
export const deleteFormConstant = createServerFn({ method: 'POST', strict: false })
  .inputValidator((data: { formId: number; constantId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)

    const [existing] = await db
      .select()
      .from(formConstants)
      .where(eq(formConstants.id, data.constantId))
      .limit(1)
    if (!existing || existing.formId !== data.formId) {
      throw new Error('Constant not found')
    }

    await db.delete(formConstants).where(eq(formConstants.id, data.constantId))
    return { success: true }
  })

/** Reorder constants. */
export const reorderFormConstants = createServerFn({ method: 'POST', strict: false })
  .inputValidator((data: { formId: number; constantIds: number[] }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(data.formId, userId)

    for (let i = 0; i < data.constantIds.length; i++) {
      await db
        .update(formConstants)
        .set({ position: i })
        .where(eq(formConstants.id, data.constantIds[i]))
    }
    return { success: true }
  })
```

### 5.2 Injection Into Form Submission

Modify `completePageSubmission` in `src/lib/server-fns/page-forms.ts` (around line 690):

```ts
// Before saving formSubmissions.formData, merge in constants
const constants = await db
  .select()
  .from(formConstants)
  .where(eq(formConstants.formId, data.formId))

const constantValues = buildConstantMap(constants)

// Merge: field values win over constants on collision
const mergedData = { ...constantValues, ...prunedData }

// Use mergedData instead of prunedData for form_data
```

### 5.3 Expose Constants to Hydration

Modify `hydratePages` in `src/lib/server-fns/page-forms.ts` to include constants alongside the page/field data:

```ts
// In the PageForm type or as a separate return value
export async function getPageFormWithConstants(formId: number) {
  const [pageForm, constants] = await Promise.all([
    getPageForm({ data: { formId } }),
    db
      .select()
      .from(formConstants)
      .where(eq(formConstants.formId, formId))
      .orderBy(formConstants.position),
  ])
  return { ...pageForm, constants }
}
```

---

## 6. UI Design

### 6.1 Where It Lives — Constants Tab in Form Editor

The Constants panel appears as a **tab in the right-side config area** of the form editor, alongside the existing Variables/Field Settings panels.

```
┌─────────────────────────────────────────────────────────┐
│  [Builder]  [Preview]                     [Publish] [⚙] │
├────────────┬────────────────────────┬───────────────────┤
│            │                        │  Tabs:            │
│  PAGE TABS │    FIELD LIST          │  [Field] [Page]   │
│  ┌──────┐  │  ┌──────────────────┐  │  [Constants]      │
│  │Page 1│  │  │ Full Name    ✎  │  │                   │
│  │Page 2│  │  │ Email        ✎  │  │  ┌─────────────┐  │
│  │Page 3│  │  │ Plan ▼       ✎  │  │  │ CONSTANTS   │  │
│  └──────┘  │  │ Quantity     ✎  │  │  │             │  │
│            │  └──────────────────┘  │  │ [+ Add]     │  │
│ [+ Page]  │                        │  │             │  │
│ [Palette] │  [+ Add Field]         │  │ ┌─────────┐ │  │
│            │                        │  ││vat_rate  │ │  │
│            │                        │  ││number   │ │  │
│            │                        │  ││0.12     │ │  │
│            │                        │  ││    ✎ 🗑 │ │  │
│            │                        │  │└─────────┘ │  │
│            │                        │  │ ┌─────────┐ │  │
│            │                        │  ││pro_price │ │  │
│            │                        │  ││number   │ │  │
│            │                        │  ││12000    │ │  │
│            │                        │  ││    ✎ 🗑 │ │  │
│            │                        │  │└─────────┘ │  │
│            │                        │  └─────────────┘  │
├────────────┴────────────────────────┴───────────────────┤
│  [← Back to Dashboard]                     Responsive   │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Component Tree

```
PageBuilderWorkspace (existing)
├── Left: BuilderPalette
├── Center: PageFieldList
└── Right: ConfigPanel (tabbed)
    ├── FieldSettings (existing)     — when a field is selected
    ├── PageSettings (existing)      — when a page tab is active
    └── ConstantsPanel (NEW)         — new tab
        ├── ConstantsList            — list of all constants with inline preview
        │   └── ConstantCard         — shows name, type, value, edit/delete buttons
        └── ConstantEditor           — modal or inline form for add/edit
            ├── NameInput            — snake_case, validated
            ├── TypeSelect           — string | number | boolean
            ├── ValueInput           — type-aware (number input, toggle, text)
            ├── LabelInput           — optional human name
            └── DescriptionInput     — optional note
```

### 6.3 Constant Card Layout

```
┌────────────────────────────────────────┐
│  vat_rate                    [✎] [🗑] │
│  number · VAT Rate                     │
│  = 0.12                                │
│  Used in payment calculation for VAT   │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│  welcome_message             [✎] [🗑] │
│  string                                │
│  = "Welcome to our registration!"      │
│  Shown in confirmation template        │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│  require_signature          [✎] [🗑] │
│  boolean · Require Signature           │
│  = false                               │
└────────────────────────────────────────┘
```

### 6.4 Add/Edit Constant Modal

```
┌──────────────────────────────────────┐
│  Add Constant                    [✕] │
│                                      │
│  Name                                │
│  ┌──────────────────────────────┐    │
│  │ vat_rate                     │    │
│  └──────────────────────────────┘    │
│  snake_case, no spaces               │
│                                      │
│  Type                                │
│  ┌──────────────────────────────┐    │
│  │ number                    ▾  │    │
│  └──────────────────────────────┘    │
│                                      │
│  Value                               │
│  ┌──────────────────────────────┐    │
│  │ 0.12                         │    │
│  └──────────────────────────────┘    │
│                                      │
│  Label (optional)                    │
│  ┌──────────────────────────────┐    │
│  │ VAT Rate                     │    │
│  └──────────────────────────────┘    │
│                                      │
│  Description (optional)              │
│  ┌──────────────────────────────┐    │
│  │ Applied to all order totals  │    │
│  └──────────────────────────────┘    │
│                                      │
│  [Cancel]              [Save]        │
└──────────────────────────────────────┘
```

---

## 7. Integration Points — Where Constants Are Usable

### 7.1 Payment Computations

Constants become selectable as payment computation sources. In `PageSettings` (within `PageBuilderWorkspace.tsx`), the "Use one amount field" dropdown for `paymentAmountVariable` shows both field bindings AND constants.

```tsx
// In PageSettings — payment source dropdown
<select value={paymentComputation.mode}>
  <option value="field">Use one amount field</option>
  <option value="constant">Use a constant</option>
  <option value="sum_priced_options">Sum selected option prices</option>
  <option value="sum_number_fields">Sum number fields</option>
</select>

{paymentComputation.mode === 'constant' && (
  <select
    value={...}
    onChange={...}
  >
    <optgroup label="Form Fields">
      {numberFields.map(f => <option key={f.bindVariable} value={f.bindVariable}>{f.label}</option>)}
    </optgroup>
    <optgroup label="Constants">
      {numberConstants.map(c => <option key={c.name} value={c.name}>{c.label || c.name}</option>)}
    </optgroup>
  </select>
)}
```

### 7.2 Condition Values

When setting up a field condition, the "value to compare" field can reference a constant via `{{constant_name}}` syntax:

```tsx
// In condition editor:
// Source field: "order_total" (number field)
// Operator: "greater_than"
// Compare value: ┌──────────────────────┐
//                │ {{free_ship_thresh}} │  ← references a constant
//                └──────────────────────┘
```

The condition evaluator in `src/lib/page-builder/conditions.ts` is extended to resolve `{{constant}}` templates against the constant map.

### 7.3 Default Field Values

Fields can have their `defaultValue` set to a constant:

```tsx
// FieldSettings in PageBuilderWorkspace
<select
  value={field.defaultValue ?? ''}
  onChange={(e) => onUpdate({ defaultValue: e.target.value || null })}
>
  <option value="">None</option>
  <optgroup label="Constants">
    {constants.map(c => (
      <option key={c.name} value={`{{${c.name}}}`}>
        {c.label || c.name} = {c.value}
      </option>
    ))}
  </optgroup>
</select>
```

### 7.4 Template Interpolation

Summary/final page templates (`finalTemplate`) already support `{{variable}}` interpolation via `src/lib/flow-engine/TemplateInterpolator.ts`. Constants are injected into the data scope before interpolation, so they work out of the box.

### 7.5 Email Templates (FT-004)

When FT-004 is implemented, notification templates will have access to the same interpolated data scope including constants. `{{subtotal}} * {{vat_rate}} = {{total}}` works in email bodies.

### 7.6 Services Dispatch (FT-003)

When services dispatch, the payload includes all form data including constants. A Google Sheets sync can include a "VAT Rate" column that pulls from the constant.

---

## 8. Variable Name Collision Prevention

### 8.1 At Constant Creation

When creating a constant, the server function validates:
1. Name matches `snake_case` pattern (`/^[a-z][a-z0-9_]*$/`)
2. Name does not collide with any existing constant for this form
3. Name does not collide with any `bindVariable` across all page fields for this form

```ts
// In createFormConstant handler:
const pages = await db
  .select({ id: formPages.id })
  .from(formPages)
  .where(eq(formPages.formId, data.formId))

const pageIds = pages.map((p) => p.id)
const existingBindings = pageIds.length > 0
  ? await db
      .select({ bindVariable: formPageFields.bindVariable })
      .from(formPageFields)
      .where(inArray(formPageFields.pageId, pageIds))
  : []

const usedNames = new Set(existingBindings.map((f) => f.bindVariable))
if (usedNames.has(data.name)) {
  throw new Error(`"${data.name}" is already used as a field variable`)
}
```

### 8.2 At Field Creation

The existing `createPageField` server function's `uniqueVarName` only checks against other field bindVariables. This should ALSO check against constant names:

```ts
// In createPageField handler, after the uniqueVarName call:
const existingConstants = await db
  .select({ name: formConstants.name })
  .from(formConstants)
  .where(eq(formConstants.formId, data.formId))

const constantNames = new Set(existingConstants.map((c) => c.name))
if (constantNames.has(bindVariable)) {
  // Append _field suffix or regenerate
  bindVariable = uniqueVarName(bindVariable + '_field', new Set([...used, ...constantNames]), fallback)
}
```

### 8.3 At Field Rename

When a field's `bindVariable` is updated via `updatePageField`, validate against constants too.

---

## 9. Public Form Runtime Changes

### 9.1 Pre-fetch Constants

The page form hydration (`getPageForm` → `hydratePages`) returns constants alongside pages/fields so the client has them for preview and runtime.

### 9.2 Merge at Submission

In `completePageSubmission` (or the equivalent final-submit handler), constants are merged into `formData` before the INSERT:

```ts
const constants = await db
  .select()
  .from(formConstants)
  .where(eq(formConstants.formId, data.formId))

const constantMap: Record<string, unknown> = {}
for (const c of constants) {
  constantMap[c.name] = c.type === 'number' ? Number(c.value)
    : c.type === 'boolean' ? c.value === 'true'
    : c.value
}

// Merge constants first, then field data (field data wins)
const finalData = { ...constantMap, ...prunedData }

const [submission] = await db
  .insert(formSubmissions)
  .values({
    formId: data.formId,
    formData: finalData,
    status: 'completed',
  })
  .returning()
```

### 9.3 Template Interpolation at Runtime

When interpolating templates (summary page `finalTemplate`, redirect URLs), the interpolation scope includes both respondent answers and constants. No code change needed — it's a data change.

---

## 10. File Change Summary

| File | Purpose |
|---|---|
| `src/db/schema.ts` | **Add** `formConstants` table definition (+ import of `uniqueIndex` from drizzle-orm if not already imported) |
| `src/lib/page-builder/types.ts` | **Add** `FormConstant` interface and `parseConstantValue`/`buildConstantMap` utility functions |
| `src/lib/server-fns/constants.ts` | **New** — CRUD server functions: `getFormConstants`, `createFormConstant`, `updateFormConstant`, `deleteFormConstant`, `reorderFormConstants` |
| `src/lib/server-fns/page-forms.ts` | **Modify** — `hydratePages` returns constants; `createPageField` checks constants for name collision; `completePageSubmission` merges constants into formData; add `getPageFormWithConstants` |
| `src/lib/server-fns/page-forms.ts` | **Modify** — `updatePageField` validates bindVariable rename against constants |
| `src/components/page-builder/PageBuilderWorkspace.tsx` | **Modify** — Add `ConstantsPanel` tab to right config panel; add constant CRUD mutations; wire constants into payment computation dropdowns and field default value selections |
| `src/lib/page-builder/conditions.ts` | **Modify** — `evaluateConditions` resolves `{{constant}}` references in comparison values against the constant map |
| `src/components/page-form/PageFormView.tsx` | **Modify** — Pre-fetch constants for template interpolation context during form fill |
| `src/lib/flow-engine/TemplateInterpolator.ts` | **Verify** — Already supports `{{var}}` syntax; no changes needed but verify constant values interpolate correctly |
| `feature-plan/008-form-builder-having-another-variables-to-reference.md` | **This file** — expanded from sparse notes to comprehensive plan |

---

## 11. Step-by-Step Tasks

### Task 1: DB Migration — `form_constants` Table
- Add `formConstants` table definition to `src/db/schema.ts`
- Update the schema exports (add to the barrel export)
- Run `pnpm exec drizzle-kit generate` to create migration
- Run `pnpm exec drizzle-kit migrate` to apply
- Add `FormConstant` TypeScript type to `src/lib/page-builder/types.ts` + utility functions

### Task 2: Server Functions — Constants CRUD
- Create `src/lib/server-fns/constants.ts`
- Implement `getFormConstants` — returns all constants for a form, ordered by position
- Implement `createFormConstant` — validates name (snake_case, uniqueness vs both field bindVariables and existing constants), validates value by type, inserts
- Implement `updateFormConstant` — validates new name/value/type, updates
- Implement `deleteFormConstant` — verifies ownership, deletes
- Implement `reorderFormConstants` — updates positions in batch

### Task 3: Name Collision Guards
- Modify `createPageField` in `src/lib/server-fns/page-forms.ts` to check constant names
- Modify `updatePageField` to prevent renaming a field's `bindVariable` to a constant name
- Add similar guard to `createFormConstant` for field bindVariables

### Task 4: ConstantsPanel UI Component
- Create the `ConstantsPanel` component (inline in `PageBuilderWorkspace.tsx` or as a separate file)
- Build `ConstantCard` — displays name, type chip, value, label, description; edit/delete buttons
- Build add/edit modal or inline form — name input (snake_case enforced), type dropdown (string/number/boolean), type-aware value input, optional label/description
- Wire into the right-side config panel as a new tab ("Constants" alongside "Field" and "Page")

### Task 5: Wire Constants Into Payment Computations
- In `PageSettings`, add constants to payment source dropdowns (field mode, sum mode)
- Allow selecting a constant as `paymentAmountVariable`
- Handle `sum_number_fields` mode to include number-type constants

### Task 6: Wire Constants Into Submissions
- Modify `completePageSubmission` to fetch and merge constants into `formData` before INSERT
- Modify `hydratePages` (or add `getPageFormWithConstants`) to return constants alongside pages
- Ensure the public form runtime has access to constants for template interpolation

### Task 7: Condition Support for Constants
- Modify `evaluateConditions` in `src/lib/page-builder/conditions.ts` to resolve `{{constant_name}}` syntax in comparison values
- Update the condition editor UI to show autocomplete for constant names when typing comparison values

### Task 8: Default Field Values from Constants
- Add a "Use constant" option in the field default value selector
- Show list of type-compatible constants (e.g., number constants for number fields)
- When selected, the default value field shows `{{constant_name}}` and is read-only

### Task 9: Validation & Polish
- Verify that deleting a constant does not break existing submissions (constants are stored by value in `formData`, not by reference)
- Add warning when editing a constant: "Changing this value affects future submissions, not past ones"
- Ensure the submission CSV export (FT-006) includes constant columns
- Test with 0 constants, 1 constant, 20+ constants
- Verify type coercion works correctly (number strings → actual numbers, boolean strings → actual booleans)

---

## 12. Risks & Open Questions

| Risk | Mitigation |
|---|---|
| **Name collision race condition** — field and constant created simultaneously with the same name | DB-level `UNIQUE(form_id, name)` only applies within `form_constants`. Add a runtime check in both create handlers that queries both tables. For ultimate safety, add a composite unique index via a trigger or a materialized view — but the runtime double-check is sufficient for MVP. |
| **Breaking existing forms** — adding constants to `formData` changes the shape of stored submission data | Constants are merged with field data first, so existing field values are not overwritten. Submissions CSV export (FT-006) will show constant columns — this is desirable. Existing submissions continue to work as before (no constants in their data). |
| **Type mismatch** — a string constant used where a number is expected (e.g., payment computation) | Validate at constant creation time (number values must parse). The payment computation and condition evaluator should coerce types: if a constant is `"500"` but the computation expects a number, `Number("500")` is safe. |
| **Hundreds of constants** — a form with many constants could bloat the submission payload | Constants are small (a few dozen bytes each). Even 100 constants × 50 bytes = ~5KB per submission — negligible. No pagination needed for constants in the builder. |
| **Constants as escape hatch** — creators might use constants instead of fields to avoid the builder's constraints | This is fine. Constants are for derived/system values. The UI distinguishes them clearly from respondent-facing fields. |
| **Security** — constant values are stored as plaintext in `form_constants` | Constants are creator-defined business logic values (prices, rates, thresholds), not secrets. They're not customer PII. If a creator puts sensitive data in a constant, it's their choice (same as putting it in a field label). |

---

## 13. Validation / Testing

- [ ] `form_constants` migration creates the table with correct columns, indexes, and foreign key
- [ ] `createFormConstant` rejects duplicate names within the same form
- [ ] `createFormConstant` rejects names that collide with existing field `bindVariable` names
- [ ] `createPageField` auto-generates a unique name that avoids constant names
- [ ] `updatePageField` refuses to rename a field's `bindVariable` to a constant name
- [ ] Constants appear in the ConstantsPanel tab of the form builder
- [ ] Adding a number constant like `vat_rate = 0.12` shows it in the list with correct type chip
- [ ] Editing a constant updates the value and reflects in the UI immediately
- [ ] Deleting a constant removes it from the list and does not affect existing submissions
- [ ] A number constant named `pro_price = 12000` appears in the payment amount variable dropdown
- [ ] Submitting a form merges constants into `formSubmissions.formData` alongside respondent answers
- [ ] A condition `order_total > {{free_shipping_threshold}}` evaluates correctly when `free_shipping_threshold` is a constant
- [ ] Template `"Total includes {{vat_rate}}% VAT"` interpolates to `"Total includes 0.12% VAT"` (or multiplied by 100 if we format it)
- [ ] Field with default value `{{vat_rate}}` pre-fills correctly on the public form
- [ ] CSV export includes constant columns in the exported data
- [ ] Reordering constants updates positions and reflects in the UI
