# FT-007: Form Builder Revision — Pages, Conditional Logic & Simplified Architecture

> **Feature Plan** — A fundamental simplification of the form builder. Replace the graph-based Flow Builder (8 node types, edges, canvas, `FlowEngine`) with a **pages-based model** where a form is a linear sequence of pages (like Google Sheets tabs), each containing fields. Fields get per-field conditional visibility rules instead of a global Decision node graph. The result: simpler to build, simpler to understand, simpler to maintain.

**Status:** 🚧 **Planned** — major architectural revision

**Dependencies:**
- ✅ **FT-001 (Onboarding)** — onboarding overlays will need updating for the new builder UX
- 🚧 **FT-005 (Precreated Field Groups)** — field group templates map directly to reusable pages
- 🚧 **FT-006 (DataTable)** — submissions table columns come from page fields
- ✅ **Existing Flow Builder** — this is what we're revising/simplifying

---

## 1. User Story

> *"When I build a registration form, I want pages like Google Sheets tabs — 'Personal Info', 'Payment', 'Confirmation'. I want to drag fields between pages. I want to say 'show the dietary restrictions field only if they selected Vegetarian.' I don't want to learn a flow graph with 8 node types, edges, decision nodes, and variables just to make a simple multi-page form."*

---

## 2. What's Wrong — The Overengineering

The current Flow Builder was designed as a general-purpose workflow engine. It's powerful but excessive for 95% of form use cases:

| Current Complexity | Real Need |
|---|---|
| 8 node types (`start`, `form_field`, `group`, `decision`, `calculator`, `payment`, `summary`, `redirect`) | 4 concepts: **Pages**, **Fields**, **Conditions**, **Final Page settings** |
| Graph with arbitrary edges between nodes | **Linear page order** — Page 1 → Page 2 → Page 3 (always sequential) |
| `FlowEngine` — 435 lines of graph traversal, snapshots, restore, edge matching, auto-advance | A simple **page iterator** with conditional field visibility |
| `FlowExecutionContainer` — 244 lines managing fresh-start vs. resume, execution persistence, navigation ticks | A simpler multi-page form component |
| Canvas (React Flow) for visual graph editing | **Page tabs + drag-and-drop** field list (like the existing List view, enhanced) |
| Variables declared separately, bound to fields | Fields **are** the data model — no separate variable declaration needed |
| Decision nodes with branches and edge `matchValue` metadata | **Per-field conditional logic** — "if field X equals Y, show/hide field Z" |

### 2.1 What Stays

| Concept | How It Changes |
|---|---|
| **Pages (formerly Groups)** | Becomes the primary organizing unit — a form is a list of pages. Pages still contain fields, but they no longer sit in a graph. They're linear tabs. |
| **Fields** | Same field types (text, email, number, select, etc.). Fields live inside pages. Fields can be dragged between pages. |
| **Payment** | Moves from a node type to a **page-level setting**. Any page can have a payment step. |
| **Summary/Thank You** | Becomes the final page's settings — a "Thank You" template + optional redirect URL. |
| **Template interpolation** | Same `{{variable}}` syntax, but variable names come from field bindings, not a separate variable table. |
| **Linear form (no pages)** | Still supported. A form with no pages = single-page form (current linear mode). |
| **Expression support** | Fields can have computed default values (e.g., `{{subtotal}} * 0.12`) but no separate Calculator node. |

### 2.2 What Gets Removed

| Removed | Replacement |
|---|---|
| **Flow graph** (`flows`, `flow_nodes`, `flow_edges` tables) | `form_pages` table — ordered list of pages per form |
| **`FlowEngine`** (435 lines) | Simple page iterator — `pages[currentIndex]`, `goNext()`, `goBack()` |
| **Canvas (React Flow)** | Page tab bar + field list view (the existing List view, enhanced) |
| **Decision nodes** | Per-field conditional visibility rules |
| **Calculator nodes** | Field-level computed values |
| **`start` node** | Not needed — form always starts at Page 1 |
| **`flowExecutions`** table | Simplified `form_page_progress` for resumable multi-page forms |
| **`flowVariables`** table | Field `bindToVariable` names serve as the variable namespace |
| **Variable Manager UI** | Not needed — variables are inferred from field bindings |

---

## 3. New Data Model

### 3.1 Core Concept

```
Form
 ├── Title, Description, Theme
 ├── Pages (ordered)
 │    ├── Page 1: "Personal Info"
 │    │    ├── Field: full_name (text, required)
 │    │    ├── Field: email (email, required)
 │    │    └── Field: phone (text)
 │    ├── Page 2: "Preferences"
 │    │    ├── Field: meal_preference (select: Meat/Veg/Vegan)
 │    │    ├── Field: dietary_restrictions (textarea)
 │    │    │    └── Condition: show only IF meal_preference ≠ "Meat"
 │    │    └── Field: tshirt_size (select: S/M/L/XL)
 │    ├── Page 3: "Payment"
 │    │    ├── Payment: enabled, amount = {{tshirt_price}}
 │    │    └── Field: billing_address (text)
 │    └── Page 4: "Thank You" (final page)
 │         ├── Summary template: "Thanks {{full_name}}!"
 │         └── Redirect URL (optional)
 └── Settings: notifications, theme, etc.
```

### 3.2 DB Schema — New Tables

```sql
-- Replaces flows table
CREATE TABLE form_pages (
  id            SERIAL PRIMARY KEY,
  form_id       INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  title         VARCHAR(255),                      -- "Personal Info", "Payment"
  description   TEXT,                              -- Optional page description shown to respondent
  position      INTEGER NOT NULL DEFAULT 0,        -- Order in the form (0, 1, 2, ...)
  is_final      BOOLEAN NOT NULL DEFAULT FALSE,    -- TRUE = thank-you page (terminal)
  final_template TEXT,                             -- Interpolated template for the final page
  final_redirect_url VARCHAR(500),                 -- Optional redirect after final page
  has_payment   BOOLEAN NOT NULL DEFAULT FALSE,    -- This page collects payment
  payment_gateway_id INTEGER REFERENCES payment_gateways(id),
  payment_amount_variable VARCHAR(100),            -- Which field binding holds the amount
  payment_currency VARCHAR(3) DEFAULT 'USD',
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX form_pages_form_id_position_idx ON form_pages(form_id, position);

-- Fields live on pages, not as standalone flow nodes
CREATE TABLE form_page_fields (
  id            SERIAL PRIMARY KEY,
  page_id       INTEGER NOT NULL REFERENCES form_pages(id) ON DELETE CASCADE,
  field_type    VARCHAR(20) NOT NULL,               -- text, email, number, textarea, select, checkbox, radio, date, time, datetime
  label         VARCHAR(255) NOT NULL,
  placeholder   VARCHAR(255),
  required      BOOLEAN NOT NULL DEFAULT FALSE,
  options       JSONB,                             -- [{ label, value }] for select/checkbox/radio
  bind_variable VARCHAR(100),                      -- snake_case variable name for data binding
  position      INTEGER NOT NULL DEFAULT 0,        -- Field order within the page
  default_value TEXT,                              -- Optional default / computed expression (e.g., "{{subtotal}} * 0.12")
  width         VARCHAR(20) DEFAULT 'full',        -- 'full' or 'half' (for 2-column layout on page)
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX form_page_fields_page_id_position_idx ON form_page_fields(page_id, position);

-- Per-field conditional visibility rules
CREATE TABLE field_conditions (
  id                  SERIAL PRIMARY KEY,
  field_id            INTEGER NOT NULL REFERENCES form_page_fields(id) ON DELETE CASCADE,
  source_field_binding VARCHAR(100) NOT NULL,       -- Which field's value to check
  operator            VARCHAR(20) NOT NULL,         -- equals, not_equals, contains, greater_than, less_than, is_empty, is_not_empty
  value               TEXT,                         -- The value to compare against (null for is_empty/is_not_empty)
  action              VARCHAR(20) NOT NULL DEFAULT 'show', -- 'show' or 'hide'
  created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX field_conditions_field_id_idx ON field_conditions(field_id);

-- Simplified execution tracking (replaces flowExecutions)
CREATE TABLE form_submission_sessions (
  id                  SERIAL PRIMARY KEY,
  form_id             INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  form_submission_id  INTEGER REFERENCES form_submissions(id) ON DELETE SET NULL,
  current_page_index  INTEGER NOT NULL DEFAULT 0,   -- Which page the respondent is on
  collected_data      JSONB NOT NULL DEFAULT '{}',  -- All field values collected so far ({ binding: value })
  status              VARCHAR(20) NOT NULL DEFAULT 'in_progress',
  completed_at        TIMESTAMP,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 3.3 Drizzle Schema

```ts
export const formPages = pgTable('form_pages', {
  id: serial().primaryKey(),
  formId: integer('form_id').notNull().references(() => forms.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }),
  description: text('description'),
  position: integer('position').notNull().default(0),
  isFinal: boolean('is_final').notNull().default(false),
  finalTemplate: text('final_template'),
  finalRedirectUrl: varchar('final_redirect_url', { length: 500 }),
  hasPayment: boolean('has_payment').notNull().default(false),
  paymentGatewayId: integer('payment_gateway_id').references(() => paymentGateways.id),
  paymentAmountVariable: varchar('payment_amount_variable', { length: 100 }),
  paymentCurrency: varchar('payment_currency', { length: 3 }).default('USD'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [index('form_pages_form_id_position_idx').on(table.formId, table.position)])

export const formPageFields = pgTable('form_page_fields', {
  id: serial().primaryKey(),
  pageId: integer('page_id').notNull().references(() => formPages.id, { onDelete: 'cascade' }),
  fieldType: varchar('field_type', { length: 20 }).notNull(),
  label: varchar('label', { length: 255 }).notNull(),
  placeholder: varchar('placeholder', { length: 255 }),
  required: boolean('required').notNull().default(false),
  options: jsonb('options').$type<{ label: string; value: string }[]>(),
  bindVariable: varchar('bind_variable', { length: 100 }),
  position: integer('position').notNull().default(0),
  defaultValue: text('default_value'),
  width: varchar('width', { length: 20 }).default('full'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [index('form_page_fields_page_id_position_idx').on(table.pageId, table.position)])

export const fieldConditions = pgTable('field_conditions', {
  id: serial().primaryKey(),
  fieldId: integer('field_id').notNull().references(() => formPageFields.id, { onDelete: 'cascade' }),
  sourceFieldBinding: varchar('source_field_binding', { length: 100 }).notNull(),
  operator: varchar('operator', { length: 20 }).notNull(),
  value: text('value'),
  action: varchar('action', { length: 20 }).notNull().default('show'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [index('field_conditions_field_id_idx').on(table.fieldId)])

export const formSubmissionSessions = pgTable('form_submission_sessions', {
  id: serial().primaryKey(),
  formId: integer('form_id').notNull().references(() => forms.id, { onDelete: 'cascade' }),
  formSubmissionId: integer('form_submission_id').references(() => formSubmissions.id, { onDelete: 'set null' }),
  currentPageIndex: integer('current_page_index').notNull().default(0),
  collectedData: jsonb('collected_data').$type<Record<string, unknown>>().notNull().default({}),
  status: varchar('status', { length: 20 }).notNull().default('in_progress'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
```

### 3.4 Migration from Old Schema

Existing flow data must be migrated:

| Old Table | → | New Table | Migration Logic |
|---|---|---|---|
| `flows` | → | `form_pages` | Each flow becomes a set of ordered pages. `form_field` and `group` nodes become pages with fields. |
| `flow_nodes` (type=`group`) | → | `form_pages` + `form_page_fields` | Group node → one page. Group's `config.fields[]` → `form_page_fields` rows. |
| `flow_nodes` (type=`form_field`) | → | `form_pages` + `form_page_fields` | Each standalone form field node → its own page with one field. |
| `flow_nodes` (type=`payment`) | → | `form_pages` (has_payment=true) | Payment node → page with `has_payment = true`. |
| `flow_nodes` (type=`summary`) | → | `form_pages` (is_final=true) | Summary node → final page with `final_template`. |
| `flow_nodes` (type=`redirect`) | → | `form_pages` (is_final=true) | Redirect node → final page with `final_redirect_url`. |
| `flow_nodes` (type=`decision`) | → | `field_conditions` | Each branch edge → condition on the following field. |
| `flow_nodes` (type=`calculator`) | → | `form_page_fields.default_value` | Calculator expression → computed `default_value` on the field it targets. |
| `flow_edges` | → | (removed) | Page order is strictly linear — edges are no longer needed. |
| `flow_variables` | → | (removed) | Variable names come from field `bind_variable` values. |
| `flow_executions` | → | `form_submission_sessions` | Execution history → simplified session with `current_page_index` and `collected_data`. |

A migration script (`scripts/migrate-flow-to-pages.ts`) handles this transformation.

---

## 4. Builder UI — Page Tabs Model

### 4.1 New Editor Layout

```
┌──────────────────────────────────────────────────────────────┐
│  ← Forms / Registration Form          [Preview] [Publish]    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ [Personal Info] [Preferences] [Payment] [Thank You] │ +│ │  ← Page Tabs
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────┬─────────────────────────────────────┐│
│  │ FIELD PALETTE      │ PAGE CONTENT                        ││
│  │                    │                                     ││
│  │ [Text]             │ Personal Info                       ││
│  │ [Email]            │                                     ││
│  │ [Number]           │ ┌── Full Width ──────────────────┐  ││
│  │ [Long Text]        │ │ Full Name *           [text  ▾]│  ││
│  │ [Dropdown]         │ │ Placeholder...                 │  ││
│  │ [Checkboxes]       │ │ ☑ Required                    │  ││
│  │ [Radio]            │ │ ⚡ Conditions (0)              │  ││
│  │ [Date]             │ └────────────────────────────────┘  ││
│  │ [Time]             │                                     ││
│  │ [Date & Time]      │ ┌── Full Width ──────────────────┐  ││
│  │                    │ │ Email Address *        [email ▾]│  ││
│  │ ───────────────    │ │ your@email.com                 │  ││
│  │ TEMPLATES (FT-005) │ │ ☑ Required                    │  ││
│  │ [Personal Details] │ └────────────────────────────────┘  ││
│  │ [Address]          │                                     ││
│  │ [Contact Info]     │ ┌── Half Width ────┐┌── Half ────┐  ││
│  │                    │ │ Phone      [text]││ DOB  [date]│  ││
│  │                    │ └──────────────────┘└────────────┘  ││
│  │                    │                                     ││
│  │                    │ [+ Add Field] [Save as Template]    ││
│  └────────────────────┴─────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Page Tabs

Pages display as tabs at the top, like Google Sheets:

- Each tab shows the page title (editable on double-click)
- Drag tabs to reorder pages
- `+` button at the end to add a new page
- Right-click tab → rename, duplicate, delete
- The last page has a "Final Page" indicator (🏁 icon)

### 4.3 Field Palette (Left Sidebar)

The field palette lists available field types. Clicking adds a field to the currently selected page. Dragging a field from one page to a tab moves it between pages.

Templates section (FT-005) at the bottom — inserting a template adds all its fields to the current page.

### 4.4 Field Configuration Panel

Clicking a field in the page opens its config in the right panel:

```
┌────────────────────────────────┐
│  Field: Email Address    [✕]  │
│                                │
│  Type   [email ▾]             │
│  Label  [Email Address ______] │
│  Placeholder [your@email.com]  │
│  ☑ Required                    │
│  Width  [full ▾]               │
│                                │
│  ── Conditions ─────────────── │  ← NEW: per-field conditional logic
│  ┌────────────────────────┐    │
│  │ IF [meal_preference ▾] │    │
│  │    [equals ▾]          │    │
│  │    [Vegan ▾]           │    │
│  │ THEN [show ▾] this field│   │
│  │                    [✕]  │    │
│  │                         │    │
│  │ [+ Add Condition]       │    │
│  └────────────────────────┘    │
│                                │
│  ── Binding ────────────────   │
│  Variable name [email]         │
│  Used as {{email}} in templates│
│                                │
│  [Delete Field]                │
└────────────────────────────────┘
```

### 4.5 Condition Builder

Each field can have multiple conditions:

```
┌─────────────────────────────────────┐
│  ⚡ Conditions for "Dietary Notes"  │
│                                     │
│  This field is ALWAYS visible       │
│                                     │
│  But add rules:                     │
│                                     │
│  Rule 1:                            │
│  IF [meal_preference    ▾]         │
│     [not_equals         ▾]         │
│     [Meat               ▾]         │
│  THEN [show ▾] this field           │
│                              [✕]   │
│                                     │
│  [+ Add Rule]                       │
│                                     │
│  [Done]                             │
└─────────────────────────────────────┘
```

**Supported operators:**
| Operator | Description | Example |
|---|---|---|
| `equals` | Value matches exactly | `meal_preference` equals `"Vegan"` |
| `not_equals` | Value does not match | `meal_preference` not_equals `"Meat"` |
| `contains` | Text contains substring | `email` contains `"@gmail.com"` |
| `greater_than` | Number/date is greater | `age` greater_than `18` |
| `less_than` | Number/date is less | `quantity` less_than `10` |
| `is_empty` | Field is blank | `phone` is_empty |
| `is_not_empty` | Field has a value | `referral_code` is_not_empty |

**Multiple conditions:** All rules must pass for the action to trigger (AND logic).

---

## 5. Page Settings

### 5.1 Regular Page Settings

```
┌────────────────────────────────────┐
│  Page: Preferences          [✕]   │
│                                    │
│  Title  [Preferences __________]   │
│  Description (shown to respondent) │
│  [Tell us about your preferences]  │
│                                    │
│  ☐ This is a payment page          │
│    Gateway: [PayPal ▾]            │
│    Amount from: [total_cost ▾]    │
│    Currency: [USD ▾]              │
│                                    │
│  [Delete Page]                     │
└────────────────────────────────────┘
```

### 5.2 Final Page Settings

The last page is always the final/thank-you page (`is_final = true`):

```
┌────────────────────────────────────┐
│  Final Page: Thank You      [✕]   │
│                                    │
│  Title  [Thank You ____________]   │
│                                    │
│  Template:                         │
│  ┌────────────────────────────┐   │
│  │ Thanks {{full_name}}!       │   │
│  │                            │   │
│  │ Your {{meal_preference}}   │   │
│  │ meal will be ready soon.   │   │
│  │                            │   │
│  │ Total: {{total_cost}}      │   │
│  └────────────────────────────┘   │
│  Insert: {{full_name}} ...        │
│                                    │
│  Redirect after 3s:               │
│  [https://mysite.com/thanks ___]   │
│                                    │
│  🏁 This is the final page         │
└────────────────────────────────────┘
```

---

## 6. Runtime — Simplified Page Iterator

The new respondent-facing form component replaces `FlowExecutionContainer`:

```ts
// src/components/form-execution/PageFormView.tsx

function PageFormView({ formId, pages, theme, embed }: Props) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [collectedData, setCollectedData] = useState<Record<string, unknown>>({})
  const [sessionId, setSessionId] = useState<number | null>(null)
  
  const currentPage = pages[currentPageIndex]
  const isLastPage = currentPageIndex === pages.length - 1
  
  // For resuming after payment redirect
  useEffect(() => {
    if (resumeSessionId) {
      // Fetch session, restore currentPageIndex + collectedData
    }
  }, [])
  
  function goNext(pageData: Record<string, unknown>) {
    const next = { ...collectedData, ...pageData }
    setCollectedData(next)
    
    if (isLastPage) {
      // Submit everything
      submitMutation.mutate(next)
    } else {
      setCurrentPageIndex(i => i + 1)
      // Persist session for resume
      persistSession(sessionId, currentPageIndex + 1, next)
    }
  }
  
  function goBack() {
    setCurrentPageIndex(i => Math.max(0, i - 1))
  }
  
  return (
    <div>
      <PageProgressBar current={currentPageIndex + 1} total={pages.length} />
      
      <PageRenderer
        page={currentPage}
        collectedData={collectedData}
        onSubmit={goNext}
        onBack={goBack}
        canGoBack={currentPageIndex > 0}
        isFinal={isLastPage}
      />
    </div>
  )
}
```

### 6.1 PageRenderer

```tsx
function PageRenderer({ page, collectedData, onSubmit, onBack, canGoBack, isFinal }: Props) {
  // 1. If this is the final page, render the template
  if (isFinal && page.isFinal) {
    return (
      <div className="text-center">
        <div className="text-5xl">✓</div>
        <h1>{page.title}</h1>
        <p>{interpolate(page.finalTemplate, collectedData)}</p>
        {page.finalRedirectUrl && <RedirectAfterDelay url={page.finalRedirectUrl} />}
      </div>
    )
  }
  
  // 2. If this page has payment, render PaymentStep
  if (page.hasPayment) {
    const amount = resolveVariable(page.paymentAmountVariable, collectedData)
    return (
      <>
        <PaymentStep amount={amount} currency={page.paymentCurrency} />
        {canGoBack && <Button onClick={onBack}>← Back</Button>}
      </>
    )
  }
  
  // 3. Otherwise, render fields with conditional visibility
  const visibleFields = page.fields.filter(field => {
    if (!field.conditions || field.conditions.length === 0) return true
    return evaluateConditions(field.conditions, collectedData)
  })
  
  return (
    <div>
      {visibleFields.map(field => (
        <FieldRenderer key={field.id} field={field} ... />
      ))}
      <StepNav onBack={onBack} canGoBack={canGoBack} onNext={handleSubmit} />
    </div>
  )
}
```

### 6.2 Condition Evaluator

```ts
// src/lib/condition-evaluator.ts

export function evaluateConditions(
  conditions: FieldCondition[],
  collectedData: Record<string, unknown>,
): boolean {
  return conditions.every(cond => {
    const sourceValue = collectedData[cond.sourceFieldBinding]
    const targetValue = cond.value
    
    switch (cond.operator) {
      case 'equals':        return String(sourceValue) === String(targetValue)
      case 'not_equals':    return String(sourceValue) !== String(targetValue)
      case 'contains':      return String(sourceValue).toLowerCase().includes(String(targetValue).toLowerCase())
      case 'greater_than':  return Number(sourceValue) > Number(targetValue)
      case 'less_than':     return Number(sourceValue) < Number(targetValue)
      case 'is_empty':      return !sourceValue || String(sourceValue).trim() === ''
      case 'is_not_empty':  return !!sourceValue && String(sourceValue).trim() !== ''
      default:              return true
    }
  })
  // All conditions must pass (AND) → field is visible (when action = 'show')
  // OR → field is hidden (when action = 'hide')
}
```

---

## 7. What Happens to the Existing Code

### 7.1 Kept and Adapted

| File | What Changes |
|---|---|
| `src/components/form-builder/fields/FieldRenderer.tsx` | Unchanged — fields render the same way |
| `src/lib/template-engine.ts` / `TemplateInterpolator.ts` | Unchanged — template interpolation still works |
| `src/components/flow-execution/GroupStepView.tsx` | Renamed to `PageStepView.tsx` — same component, adapted for pages |
| `src/components/flow-execution/PaymentStep.tsx` | Unchanged — payment step still works |
| `src/components/flow-execution/FlowProgressBar.tsx` | Renamed to `PageProgressBar.tsx` — shows page progress |
| `src/integrations/payments/` | Unchanged — gateways work the same way |
| `src/components/public-form/PublicFormView.tsx` | Updated — uses `PageFormView` instead of `FlowExecutionContainer` |
| `src/lib/form-utils.ts` | Unchanged — validation still works |
| `src/routes/forms/$formId/edit.tsx` | **Major rewrite** — new page-tab editor replacing the flow editor |
| `src/components/flow-builder/config-forms/` | Adapted — keep `FormFieldConfig`, `GroupFieldsEditor` (becomes field list editor); remove Decision, Calculator configs |
| `src/components/flow-execution/FlowStepRenderer.tsx` | Replaced by `PageRenderer.tsx` |

### 7.2 Removed Entirely

| File | Reason |
|---|---|
| `src/lib/flow-engine/FlowEngine.ts` | Replaced by simple page iterator |
| `src/lib/flow-engine/FlowValidator.ts` | Replaced by simpler page/field validation |
| `src/lib/flow-engine/ExpressionEvaluator.ts` | Move expression evaluation to `defaultValue` computation (simpler scope) |
| `src/lib/flow-engine/path-utils.ts` | No graph paths needed |
| `src/components/flow-builder/FlowCanvas.tsx` | No React Flow canvas |
| `src/components/flow-builder/FlowListBuilder.tsx` | Replaced by page tab + field list |
| `src/components/flow-builder/NodeConfigPanel.tsx` | Replaced by page-level config + field config panel |
| `src/components/flow-builder/VariablesManager.tsx` | Variables inferred from fields |
| `src/components/flow-execution/FlowExecutionContainer.tsx` | Replaced by `PageFormView.tsx` |
| `src/lib/server-fns/flow-executions.ts` | Replaced by simpler `form-sessions.ts` |
| `src/lib/server-fns/flows.ts`, `flow-nodes.ts`, `flow-variables.ts`, `flow-helpers.ts` | Consolidated into `form-pages.ts` |
| `src/db/schema.ts` — `flows`, `flow_nodes`, `flow_edges`, `flow_variables`, `flow_executions` tables | Replaced by `form_pages`, `form_page_fields`, `field_conditions`, `form_submission_sessions` |

---

## 8. File Change Summary

### New Files

| File | Purpose |
|---|---|
| `src/components/form-builder/PageEditor.tsx` | **New** — main page-tab editor (replaces flow editor) |
| `src/components/form-builder/PageTabs.tsx` | **New** — draggable tab bar for pages |
| `src/components/form-builder/PageContent.tsx` | **New** — field list within a page |
| `src/components/form-builder/FieldConfigPanel.tsx` | **New** — right panel for field settings + conditions |
| `src/components/form-builder/ConditionBuilder.tsx` | **New** — per-field condition rule builder |
| `src/components/form-builder/PageSettingsModal.tsx` | **New** — page-level settings (title, payment, final page) |
| `src/components/form-execution/PageFormView.tsx` | **New** — respondent-facing multi-page form view |
| `src/components/form-execution/PageRenderer.tsx` | **New** — renders a single page's fields + conditions |
| `src/components/form-execution/PageProgressBar.tsx` | **New** — page progress indicator |
| `src/lib/condition-evaluator.ts` | **New** — condition evaluation logic |
| `src/lib/server-fns/form-pages.ts` | **New** — CRUD for pages, fields, conditions |
| `src/lib/server-fns/form-sessions.ts` | **New** — simplified session tracking |
| `scripts/migrate-flow-to-pages.ts` | **New** — migration from old flow schema |

### Modified Files

| File | Purpose |
|---|---|
| `src/db/schema.ts` | Add `form_pages`, `form_page_fields`, `field_conditions`, `form_submission_sessions`; deprecate old flow tables |
| `src/routes/forms/$formId/edit.tsx` | Replace flow editor with page-tab editor |
| `src/components/public-form/PublicFormView.tsx` | Use `PageFormView` instead of `FlowExecutionContainer` |
| `src/lib/server-fns/submissions.ts` | Update `getResponseColumns` to read from `form_page_fields` instead of `flow_nodes` |

### Removed Files

| File | Reason |
|---|---|
| `src/lib/flow-engine/FlowEngine.ts` | Replaced |
| `src/lib/flow-engine/FlowValidator.ts` | Simpler validation |
| `src/lib/flow-engine/path-utils.ts` | No paths needed |
| `src/components/flow-builder/FlowCanvas.tsx` | No canvas |
| `src/components/flow-builder/FlowListBuilder.tsx` | Replaced |
| `src/components/flow-builder/NodeConfigPanel.tsx` | Replaced |
| `src/components/flow-builder/VariablesManager.tsx` | Not needed |
| `src/components/flow-execution/FlowExecutionContainer.tsx` | Replaced |
| `src/components/flow-execution/FlowStepRenderer.tsx` | Replaced |
| `src/lib/server-fns/flows.ts` | Consolidated |
| `src/lib/server-fns/flow-nodes.ts` | Consolidated |
| `src/lib/server-fns/flow-variables.ts` | Not needed |
| `src/lib/server-fns/flow-executions.ts` | Replaced |
| `src/lib/server-fns/flow-helpers.ts` | Consolidated |

---

## 9. Step-by-Step Tasks

### Task 1: DB Schema — New Tables
- Add `form_pages`, `form_page_fields`, `field_conditions`, `form_submission_sessions` to `src/db/schema.ts`
- Run `npm run db:generate` + `db:migrate`

### Task 2: Server Functions — Pages, Fields, Conditions CRUD
- Build `src/lib/server-fns/form-pages.ts` — create/update/delete/reorder pages, add/update/remove/reorder fields, manage conditions
- Build `src/lib/server-fns/form-sessions.ts` — create/update/resume sessions for multi-page form progress

### Task 3: Data Migration Script
- Build `scripts/migrate-flow-to-pages.ts`
- Map flow nodes to pages, fields, conditions
- Handle all 8 node types
- Run on existing data

### Task 4: Page Editor UI — Tabs + Field List
- Build `PageEditor.tsx` — main editor component
- Build `PageTabs.tsx` — draggable tab bar (dnd-kit) with add/rename/delete
- Build `PageContent.tsx` — field list within a page, drag to reorder, drag between pages
- Wire into `edit.tsx` — replace flow editor

### Task 5: Field Configuration Panel
- Build `FieldConfigPanel.tsx` — right panel: type, label, placeholder, required, width, binding
- Build `ConditionBuilder.tsx` — rule builder with source field picker, operator select, value input
- Integrate with page editor

### Task 6: Page Settings
- Build `PageSettingsModal.tsx` — page title, description, payment toggle, gateway, amount variable, final page template
- Payment settings per page
- Final page: template + redirect URL

### Task 7: Runtime — Multi-Page Form View
- Build `PageFormView.tsx` — page iterator with session persistence
- Build `PageRenderer.tsx` — render fields with conditional visibility + payment + final page
- Build `PageProgressBar.tsx` — step indicator
- Update `PublicFormView.tsx` to use the new page-based system

### Task 8: Condition Evaluator
- Build `src/lib/condition-evaluator.ts` — evaluate all 7 operators
- Integrate with runtime `PageRenderer` for show/hide logic
- Unit tests for all operators and edge cases

### Task 9: Clean Up — Remove Old Flow Code
- Remove deprecated files (see "Removed Files" above)
- Remove deprecated tables from schema (keep as deprecated for 30-day cooldown)
- Update imports across the codebase
- Fix any tests that reference old flow structures

### Task 10: Regression Testing
- Verify linear forms (no pages) still work
- Verify all field types render and submit correctly
- Verify conditional show/hide works at runtime
- Verify payment pages work with all gateways
- Verify final page template interpolation
- Verify data migration produces correct pages from existing flows

---

## 10. Risks & Open Questions

| Risk | Mitigation |
|---|---|
| **Data loss during migration** — existing flows must map correctly to the new model | Comprehensive migration script with dry-run mode. Run on a backup first. Keep old tables for 30 days. |
| **Users with complex flows** — some flows use advanced branching (multiple decision paths) | The new model supports linear pages only. Flows with complex branching may not migrate cleanly — flag these and offer manual migration. This is the tradeoff of simplification. |
| **Payment resume** — current system resumes flows after payment redirect | `form_submission_sessions` stores `currentPageIndex` + `collectedData` — the resume logic is simpler: just restore the session and jump to the payment page. |
| **Backward compatibility** — published forms with flows | Published forms keep their flow until the creator edits them. On edit, the migration runs. Published forms with flows still render via the old `FlowExecutionContainer` during a cooldown period. |
| **Variable naming** — without a variables table, variable names come from field bindings | Auto-generate `bind_variable` from field label (e.g., "Full Name" → `full_name`). Allow manual override. Validate uniqueness within the form. |
| **Expression evaluation** — calculators become `defaultValue` expressions | Keep `ExpressionEvaluator` for computed defaults but simplify (no separate Calculator node). Fields with expressions like `{{subtotal}} * 0.12` compute on page advance. |

---

## 11. Validation / Testing

- [ ] DB migration runs cleanly on fresh database
- [ ] Data migration: existing flow-backed forms convert to pages correctly
- [ ] Page CRUD: create, rename, reorder, delete pages
- [ ] Field CRUD: add, edit, reorder, delete fields within a page
- [ ] Drag-and-drop: move fields between pages
- [ ] Conditions: create, edit, delete rules per field
- [ ] Runtime: fields conditionally show/hide based on prior field values
- [ ] Runtime: multi-page form advances correctly (page 1 → 2 → 3 → final)
- [ ] Runtime: back navigation returns to previous page with data preserved
- [ ] Payment: payment page processes via gateway and advances on success
- [ ] Final page: template renders with interpolated values
- [ ] Final page: redirect fires after delay
- [ ] Session: progress persists across page refresh
- [ ] Linear form (no pages): single-page form still works
- [ ] Published forms with old flows: still render during cooldown
- [ ] Template insertion (FT-005): adding a template creates all fields on the current page
