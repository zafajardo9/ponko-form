# PonkoForm — Feature Map & UI Ideology

> **System Analysis** — Plans/025: Comprehensive feature inventory, dependency map, design system documentation, and data flow diagram.
> **Generated:** 2026-07-28 from `main` at `7d2cbe3`.

---

## 1. Complete Feature Inventory

### 1.1 Form Builder Paradigms

| Paradigm | Persistence Tables | Editor Component | Public Renderer | Best For |
|---|---|---|---|---|
| **Page Form** | `form_pages`, `form_page_fields`, `field_conditions`, `form_references` | `PageBuilderWorkspace` | `PageFormView` | Linear multi-page forms, conditions, priced options, subscriptions |
| **Flow Form** | `flows`, `flow_nodes`, `flow_edges`, `flow_variables` | `FlowListBuilder` / `FlowCanvasWorkspace` | `FlowExecutionContainer` | Branching journeys, graph decisions, calculators, redirects |

A form has at most one flow. When no flow exists, the form defaults to page-form behavior. The unified editor at `/forms/$formId/edit` auto-selects mode based on data presence.

### 1.2 Field Types (18 total)

| # | Type | DB Enum | Flow Support | Page Support | Description |
|---|---|---|---|---|---|
| 1 | `text` | ✅ | ✅ (form_field) | ✅ | Single-line text input |
| 2 | `email` | ✅ | ✅ (form_field) | ✅ | Email input with validation |
| 3 | `number` | ✅ | ✅ (form_field) | ✅ | Numeric input |
| 4 | `textarea` | ✅ | ✅ (form_field) | ✅ | Multi-line text |
| 5 | `select` | ✅ | ✅ (form_field) | ✅ | Dropdown selection |
| 6 | `checkbox` | ✅ | ✅ (form_field) | ✅ | Multi-select checkboxes |
| 7 | `radio` | ✅ | ✅ (form_field) | ✅ | Single-select radio buttons |
| 8 | `payment` | ✅ | ✅ (Payment node) | ✅ (payment page) | Payment trigger |
| 9 | `date` | ✅ | ✅ (form_field) | ✅ | Date picker |
| 10 | `time` | ✅ | ✅ (form_field) | ✅ | Time picker |
| 11 | `datetime` | ✅ | ✅ (form_field) | ✅ | Date + time picker |
| 12 | `content` | ✅ | ❌ | ✅ | Rich text display (not an input) |
| 13 | `media` | ✅ | ❌ | ✅ | Image/video embed (not an input) |
| 14 | `address` | ✅ | ❌ | ✅ | Structured address form |
| 15 | `computation` | ✅ | ❌ (use Calculator node) | ✅ | Display-only computed value |
| 16 | `file_upload` | ✅ | ❌ | ✅ | File upload (stored as data URL) |
| 17 | `satisfaction` | ✅ | ❌ | ✅ | Star/emoji rating |
| 18 | `recaptcha` | ✅ | ❌ | ✅ | Google reCAPTCHA widget |

**Renderer location:** `src/components/form-builder/fields/renderers/` — one file per field type.

### 1.3 Page Builder System

**Location:** `src/components/page-builder/`, `src/lib/page-builder/`

| Feature | Components | Description |
|---|---|---|
| **Page management** | `PageBuilderWorkspace`, `SortableComponents` (tabs) | Create, reorder (dnd-kit), delete pages. Each page has title, description, position |
| **Field palette** | `PageBuilderConfig` (`FIELD_CATEGORIES`, `FIELD_ITEMS`) | Drag-and-drop fields from categorized palette into pages |
| **Field management** | `SortableFieldCard`, `FieldSettings` | Per-field config: label, placeholder, required, options, validation rules, width (full/half), bindVariable |
| **Options editor** | `OptionsDialog` | Emoji, price, priceReference, additionalPrice per option |
| **Field conditions** | `LogicDialog`, `field_conditions` table | Show/hide fields based on other field values. Operators: equals, not_equals, contains, greater_than, less_than, is_empty, is_not_empty |
| **Form references** | `ReferencesPanel` (in `PageSettings`), `form_references` table | Global variables scoped to form: number, percentage, text, boolean. Used in computations and payment adjustments |
| **Field computation** | `ComputationDialog`, `ComputationField` renderer | Five modes: sum_priced_options, sum_number_fields, formula, expression. Formula operators: set, add, subtract, multiply, divide, percent, concat |
| **Validation rules** | `RulesDialog` | Per-field: allowedCharacters (any/letters/numbers/alphanumeric/custom+pattern), min/max length, min/max value, address required sub-fields, file upload accept/multiple |
| **Payment on page** | `PageSettings` payment section | Payment computation mode: field, sum_priced_options, sum_number_fields, fixed, formula. Adjustments with references. Subscription config (cycles, interval, trial) |
| **Final page** | `form_pages.is_final` | Final template (HTML), final redirect URL |
| **Satisfaction surveys** | Satisfaction field, email survey invitations | Star/emoji rating field type. Email survey invitations with expiring tokens |

### 1.4 Flow Builder System

**Location:** `src/components/flow-builder/`, `src/lib/flow-engine/`

#### 1.4.1 Node Types (8)

| Node | Shape | Color | Purpose | Visible to Respondent? |
|---|---|---|---|---|
| **Start** | Circle | Green | Entry point — exactly one per flow | No |
| **Form Field** | Rectangle | Blue | Collects input (text, email, number, textarea, select, checkbox, radio, date, time, datetime) | Yes |
| **Field Group** | Rectangle | Purple | Multiple fields on one step | Yes |
| **Decision** | Diamond | Amber | Branches based on a variable's value | Yes (radio buttons) |
| **Calculator** | Rectangle | Purple | Evaluates expression automatically | No (auto-advances) |
| **Payment** | Rectangle | Green | Shows amount + gateway payment button | Yes |
| **Summary** | Rectangle | Gray | Final receipt — terminal node | Yes |
| **Redirect** | Rectangle | Gray | External URL redirect — terminal node | Briefly |

#### 1.4.2 Editor Views

| View | Component | Library | Description |
|---|---|---|---|
| **Canvas** | `FlowCanvasWorkspace` + `FlowCanvas` | `@xyflow/react` | Full graph editor with custom node renderers, minimap, zoom controls, auto-layout, drag from palette |
| **List** | `FlowListBuilder` | `dnd-kit` | Sortable vertical list along primary path (BFS from Start). For simple linear/lightly-branching flows |

#### 1.4.3 Editor Panels

| Panel | Component | Description |
|---|---|---|
| **Node palette** | `FlowPalette` (canvas), `BuilderPalette` (list) | Draggable node types to add to flow |
| **Node config** | `NodeConfigPanel` → per-type config forms | Right panel: field config, decision branches, expression, payment amount, summary/redirect template |
| **Variables** | `VariablesManager` / `VariableDialog` | Declare, edit, delete typed variables |
| **Settings** | `SettingsDialog` | Form metadata, theme settings |
| **Toolbar** | `FlowToolbar` | View toggle, validate, preview, settings, variables, undo/redo |
| **Validation** | `FlowValidationBadge` | Real-time validation errors display |
| **Preview** | `PreviewDialog` → `FlowPreviewModal` | Client-side flow preview with simulated payments |

#### 1.4.4 Variable System

**7 Types:** `string`, `number`, `boolean`, `money`, `date`, `time`, `datetime`

**Lifecycle:** Declaration → Binding (FormField output) → Transformation (Calculator) → Reading (Decision/Payment/Summary) → Persistence (formData on completion)

**Safety:** Cannot delete variable while any node references it. UI shows "Used by N nodes" and disables delete button.

#### 1.4.5 Expression Engine

**Location:** `src/lib/flow-engine/safe-expression.ts`

**Grammar:** Custom tokenizer → parser → AST evaluator. No `eval()` or `Function()`. No property access, assignment, constructors, or global access.

**Syntax:**
- Variable references: `{{variable_name}}`
- Operators: `+ - * / % ^ ** > >= < <= == != && || and or ! not`
- Ternary: `condition ? true_value : false_value`

**Built-in Functions:**
| Function | Purpose |
|---|---|
| `if(cond, yes, no)` | Conditional value |
| `contains(value, expected)` | String substring or array membership |
| `round(x, decimals?)` | Round number |
| `sum(a, b, ...)` | Sum values |
| `min(a, b, ...)`, `max(a, b, ...)` | Min/max |
| `abs(x)` | Absolute value |
| `equalText(a, b)` | String comparison (`==` only compares numbers) |

**Safety limits:** 10,000 source chars, 1,000 tokens, parse depth 100, 500 AST nodes. Calculator must produce a finite number.

#### 1.4.6 Validation

**Location:** `src/lib/flow-engine/FlowValidator.ts`

| Rule | Description |
|---|---|
| Exact one Start node | `"Flow must have exactly one Start node."` |
| All nodes reachable from Start | Per-node unreachable errors |
| Graph must be acyclic | `"Flow contains a cycle..."` |
| Node configuration present | Per-node field/config errors |
| Referenced variables declared | Undeclared-variable errors |
| Correct outgoing edge counts | Per-type connection-count errors |

### 1.5 Flow Engine (Runtime)

**Location:** `src/lib/flow-engine/`

| File | Purpose |
|---|---|
| `FlowEngine.ts` | Deterministic in-memory graph runner. Methods: `getCurrentStep()`, `advance(input?)`, `goBack()`, `getCurrentStepNumber()`, `getTotalSteps()`, `getVariableValues()`, `getSnapshot()`, `isComplete()`, `FlowEngine.restore()` |
| `FlowValidator.ts` | Flow graph correctness checks |
| `safe-expression.ts` | Tokenizer, parser, AST evaluator |
| `ExpressionEvaluator.ts` | Math expression evaluation |
| `path-utils.ts` | `linearizePrimaryPath()`, `isPureLinear()`, `findBranchNodes()` |
| `TemplateInterpolator.ts` | `{{var}}` template replacement |
| `submission-draft.ts` | Draft submission save/restore |
| `server-data.ts` | Server-side data helpers |

**Execution Algorithm:**
```
advance(input?):
  1. Record current node in history
  2. If FormField → store input in bound variable
  3. If Decision → follow matching edge (or first as default)
  4. If Calculator → evaluate expression, store result in target
  5. If Payment → record result (simulated in preview)
  6. If Summary/Redirect → mark as terminal
  7. Follow outgoing edge to next node
  8. Auto-advance through Calculator nodes
```

### 1.6 Payments

**Location:** `src/integrations/payments/`, `src/lib/server-fns/payments.ts`, `src/lib/server-fns/payments-view.ts`

#### 1.6.1 Operational Gateways

| Gateway | Status | Currencies | Features |
|---|---|---|---|
| **Xendit** | ✅ Fully implemented | PHP (primary) | One-time checkout, subscriptions (cycles), webhook reconciliation, sandbox/live |
| **PayPal** | ✅ Fully implemented | Multi-currency | One-time hosted checkout, sandbox/live credentials |

#### 1.6.2 UI-Only Gateways (configuration stored, no runtime code)

| Gateway | Config UI |
|---|---|
| **Stripe** | ✅ — `gateway.ts` NOT implemented |
| **PayMongo** | ✅ — `gateway.ts` NOT implemented |
| **Maya** | ✅ — `gateway.ts` NOT implemented |

#### 1.6.3 Payment Infrastructure

| Component | Description |
|---|---|
| **Payment gateway class** | Abstract `PaymentGateway` base in `src/integrations/payments/`. Each gateway extends it. |
| **Gateway registry** | `src/integrations/payments/index.ts` — authoritative list of registered gateways |
| **Payment computation** | Field/sum_priced_options/sum_number_fields/fixed/formula modes + reference adjustments |
| **Payment events** | `payment_events` table — idempotent audit history with eventKey dedup |
| **Subscription cycles** | `subscription_cycles` table — per-cycle tracking for Xendit subscriptions |
| **Checkout flow** | Redirect → verify → resume architecture. `checkoutKey` for anonymous resume |
| **Payment return** | `/forms/payment-return` — verifies gateway state, resumes session/execution |
| **Creator dashboard** | `/forms/$formId/payments` — queryable, sortable, filterable table with verify/bulk-verify, recovery link generation |
| **Reconciliation** | `/api/internal/reconcile-payments` — CRON_SECRET protected, idempotent |

**Payment statuses:** `pending`, `completed`, `failed`, `refunded`
**Verification sources:** `webhook`, `return`, `reconciliation`, `manual`

### 1.7 Integrations Hub

**Location:** `src/components/integrations/`, `src/lib/integrations/`

| Category | Providers | Status |
|---|---|---|
| **Payments** | Xendit, PayPal, Stripe, PayMongo, Maya | ✅ Xendit+PayPal operational; 🟡 Stripe/PayMongo/Maya config-only |
| **Email** | SMTP, Resend | ✅ Fully implemented (Resend preferred, SMTP fallback) |
| **Data Export** | Google Sheets | 🟡 OAuth flow works; auto-sync NOT implemented |
| **AI** | Gemini | 🟡 Config storage only; no AI logic |
| **Scheduling** | Google Calendar, Calendly | 🟡 Config storage only; no event creation |
| **File Storage** | ImageKit, Cloudinary | 🟡 Config storage only; no runtime upload |
| **Security** | reCAPTCHA | ✅ Fully implemented |

**Architecture:**
- Generic CRUD over `integrations` table (per-profile, per-provider)
- AES-256-GCM encrypted configs (`CREDENTIALS_ENCRYPTION_KEY`)
- `webhookEndpointKey` per integration for Xendit-like providers
- `ProviderForms.ts` defines credential shape per provider
- Legacy `integration_settings` table as migration fallback

### 1.8 Email System

**Location:** `src/lib/email/transactional.ts`, `src/components/invoicing/`

| Feature | Description |
|---|---|
| **Confirmation emails** | Sent to respondents on form submission. Configurable subject/body (HTML + plain), fromName. Stored in `form_confirmation_configs` |
| **Invoice emails** | Sent to respondents on payment. Configurable subject/body, fromName, logo, accent color, invoice prefix/start number, line items. Stored in `form_invoice_configs` |
| **Delivery** | `email_delivery_logs` table — snapshots template at send time, tracks attempts/status/provider/messageId |
| **Providers** | Resend HTTP API (preferred), Nodemailer SMTP (fallback) |
| **Test send** | Invoicing page supports test send to any email |
| **Retry** | Failed deliveries can be retried from invoicing page |
| **Template snapshots** | `templateSnapshot` JSONB captures exact template at send time for audit trail |

**Delivery statuses:** `queued`, `sending`, `sent`, `failed`

### 1.9 Submissions & Analytics

**Location:** `src/lib/server-fns/submissions.ts`, `src/lib/dashboard-analytics.ts`, `src/components/dashboard/`

| Feature | Description |
|---|---|
| **Submissions query** | Server-side query engine over `form_submissions`. JSONB `formData` column. Sortable, filterable, searchable |
| **CSV export** | `submissionCsvDownloadUrl` — downloads all responses as CSV. `/api/forms/$formId/submissions-export` endpoint |
| **Data table** | Full DataTable component with pagination, column visibility toggle, sort, filter panel |
| **Bulk operations** | Archive, delete submissions in bulk |
| **Archiving** | Soft archive with `archived_at` — active/archived view toggle |
| **Response detail** | `ResponseActionDialog` shows full submission JSON + payment info |
| **Dashboard analytics** | 4 stat cards (submissions, completed, rate, revenue), completion overview bar, 30-day submission time series (area), 30-day revenue time series (bar), per-form performance table, AI-generated insights |
| **Currency** | Multi-currency display with dashboard currency preference. Reference rates from Frankfurter API |
| **PDF report** | `downloadDashboardReport` — overview and per-form PDF reports |
| **Completion rate** | `completionRate()` helper |

**Tracking tables:** `form_submissions` (final), `form_submission_sessions` (page-form in-flight), `flow_executions` (flow in-flight)

### 1.10 Invoicing

**Location:** `src/routes/forms/$formId/invoicing.tsx`, `src/components/invoicing/`

| Feature | Description |
|---|---|
| **Invoice template builder** | WYSIWYG editor for HTML templates. Subject/body templates with `{{variable}}` interpolation |
| **Confirmation template builder** | Same editor for confirmation email template |
| **Line items** | Configurable line item fields from submission variables |
| **Invoice numbering** | Auto-incrementing (prefix + start number). `nextInvoiceNumber` in `form_invoice_configs` |
| **Delivery history** | Log viewer showing all sent emails with status, timestamps, provider |
| **Dirty-state protection** | `beforeunload` warning when unsaved changes |
| **Invoice PDF** | `InvoicePDF.ts` / `InvoiceDownloadButton.tsx` — client-side invoice PDF generation via jsPDF |

### 1.11 Form Templates

**Location:** `src/lib/form-templates/`, `src/components/forms/TemplateCard.tsx`

| Feature | Description |
|---|---|
| **Built-in templates** | Seeded in database (`isBuiltin: true`). Categories: contact, support, sales, survey, general |
| **User templates** | Creators can save forms as reusable templates (`profileId` linked) |
| **Template catalog** | `/forms/new` shows grid of template cards with category icons, page/field counts |
| **Scratch creation** | "Start from scratch" option creates blank page form |
| **Template preview** | `TemplatePreview` component shows template before creating |

### 1.12 Share & Embed

| Feature | Description |
|---|---|
| **Share dialog** | `ShareDialog.tsx` — copy public URL, copy iframe embed markup |
| **Public URL** | `/forms/submit/$publicId` — opaque 32-char public ID |
| **Embed** | `/forms/embed/$publicId` — transparent background, fluid width, no app chrome |
| **Publish/draft** | Forms toggle between `draft` (preview only) and `published` (public + embed) |

### 1.13 Form Theming

**Location:** `src/lib/theme.ts`

| Feature | Description |
|---|---|
| **Per-form theme** | Stored in `forms.theme` JSONB: `primaryColor`, `backgroundColor`, `radius` |
| **Accent presets** | 8 curated swatches (terracotta, blue, teal, violet, pink, orange, green, near-black) |
| **Background presets** | 6 light swatches |
| **Radius options** | Sharp (2px/4px), Rounded (8px/16px), Pill (9999px/24px) |
| **Derived colors** | `primary-active` (darken 18%), `primary-soft` (16% alpha), `surface` (darken bg 5%) |
| **CSS custom properties** | `--ponko-primary`, `--ponko-bg`, `--ponko-surface`, `--ponko-radius`, `--ponko-radius-card` |
| **Fallback** | Un-themed forms use house defaults — zero visual change |

### 1.14 reCAPTCHA

**Location:** `src/lib/integrations/recaptcha.ts`

- Google reCAPTCHA v2 checkbox widget
- Configured per creator in Integrations Hub
- Site key passed to public form runtime
- Validated server-side on page advancement

### 1.15 Docs Viewer

**Location:** `src/routes/docs/`, `src/components/docs/`

| Feature | Description |
|---|---|
| **Markdown rendering** | `docs/*.md` files rendered in-app with sidebar navigation |
| **Sidebar** | `DocSidebar.tsx` — navigable doc index |
| **Card layout** | `DocCard.tsx` — index page with doc cards |
| **Public access** | `/docs` and `/docs/$slug` are public routes |

### 1.16 Dashboard Homepage

**Location:** `src/routes/dashboard/index.tsx`, `src/components/dashboard/`, `src/components/homepage/`

| Feature | Description |
|---|---|
| **Landing page** | `/` — `HomePage` with hero animation, product mockups, "Get started free" CTA |
| **Dashboard** | `/dashboard` — authenticated analytics overview with stat cards, completion rate, 30-day trends, per-form breakdown, insights |
| **Empty state** | Graceful empty states when no data exists |
| **Currency selector** | Dashboard currency saved to profile preference |
| **PDF export** | Overview and per-form PDF download |

### 1.17 MCP SDK

**Location:** `src/routes/mcp.ts`

Model Context Protocol SDK endpoint for AI agent integration.

---

## 2. Feature Dependency Graph

```
                          ┌──────────────────────────────────────────┐
                          │              FORM ENGINE                 │
                          │  (core data model shared by all)         │
                          │  forms, profiles, Clerk auth             │
                          └──────────┬───────────────────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
    ┌─────────────────┐   ┌──────────────────┐   ┌──────────────────┐
    │   PAGE BUILDER   │   │   FLOW BUILDER    │   │ INTEGRATIONS     │
    │  form_pages      │   │  flow_nodes       │   │  HUB             │
    │  form_page_fields│   │  flow_edges       │   │  15 providers    │
    │  field_conditions│   │  flow_variables   │   │  encrypted creds │
    │  form_references │   │  flows            │   │  provider forms  │
    └────────┬─────────┘   └────────┬──────────┘   └────────┬─────────┘
             │                      │                       │
             ▼                      ▼                       │
    ┌─────────────────┐   ┌──────────────────┐              │
    │  PAGE RUNTIME   │   │  FLOW ENGINE      │              │
    │  PageFormView   │   │  FlowEngine       │              │
    │  form_submission│   │  FlowValidator    │              │
    │  _sessions      │   │  safe-expression  │              │
    │  page-by-page   │   │  path-utils       │              │
    └────────┬─────────┘   └────────┬──────────┘              │
             │                      │                          │
             └──────────────────────┼──────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
          ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
          │  SUBMISSIONS  │ │  PAYMENTS    │ │   EMAIL      │
          │  formData     │ │  gateways    │ │  Resend/SMTP │
          │  CSV export   │ │   checkout   │ │  conf + inv  │
          │  archival     │ │  reconcile   │ │  delivery    │
          └──────┬────────┘ └──────┬───────┘ │  logs        │
                 │                 │         └──────┬───────┘
                 │                 │                │
                 └─────────┬───────┘                │
                           │                        │
                           ▼                        │
                 ┌──────────────────┐               │
                 │    ANALYTICS     │◄──────────────┘
                 │  dashboard stats │
                 │  time series     │
                 │  insights        │
                 │  PDF reports     │
                 └──────────────────┘
```

### Direct Dependencies

| Feature | Depends On |
|---|---|
| **PageFormView** | Page Builder (pages, fields, conditions, references), reCAPTCHA, Form Theming |
| **FlowExecutionContainer** | Flow Engine, Flow Builder (nodes, edges, variables), Payments (gateway choice), Form Theming |
| **Payments** | Flow Engine (payment nodes), Page Builder (payment pages), Integration Hub (gateway credentials), form_submissions |
| **Email** | Submissions (triggers on completion), Payments (invoice trigger), Integration Hub (Resend/SMTP creds) |
| **Invoicing** | Email (delivery), Payments (invoice PDF data), Submissions (formData for template), Form Theming (accent color) |
| **Analytics** | Submissions (counts, statuses), Payments (amounts, statuses), Email (delivery stats) |
| **Share/Embed** | Forms (publicId, status), PublicFormView |
| **Form Templates** | Page Builder (template data structure), Forms (creation from template) |
| **reCAPTCHA** | Integration Hub (site key config), PublicFormView (respondent verification) |
| **Form Theming** | PublicFormView, PageFormView, FlowExecutionContainer (CSS custom properties) |
| **Docs Viewer** | None — standalone |

---

## 3. UI Design System & Ideology

### 3.1 Color System

```
┌─ CANVAS & SURFACES ───────────────────────────────────────┐
│  canvas:        #faf9f5    (page background)               │
│  surface-card:  #efe9de    (card/chip backgrounds)         │
│  surface-soft:  #f5f0e8    (hover/inactive states)         │
│  surface-cream: #e8e0d2    (stronger cream)                │
│  surface-dark:  #181715    (dark BG for insights)          │
│  surface-dark-elevated: #252320                            │
│  surface-dark-soft:     #1f1e1b                            │
│                                                            │
├─ BRAND ───────────────────────────────────────────────────┤
│  primary:        #cc785c    (terracotta accent)            │
│  primary-active: #a9583e    (hover/pressed)                │
│  primary-disabled: #e6dfd8  (disabled state)               │
│                                                            │
├─ TEXT ────────────────────────────────────────────────────┤
│  ink:            #141413    (headings, strong text)        │
│  body:           #3d3d3a    (body copy)                    │
│  body-strong:    #252523    (emphasized body)              │
│  muted:          #6c6a64    (secondary text)               │
│  muted-soft:     #8e8b82    (tertiary, labels)             │
│  on-primary:     #ffffff    (text on accent BG)            │
│  on-dark:        #faf9f5    (text on dark BG)              │
│  on-dark-soft:   #a09d96    (secondary on dark BG)         │
│                                                            │
├─ BORDERS ─────────────────────────────────────────────────┤
│  hairline:       #e6dfd8    (card/input borders)           │
│  hairline-soft:  #ebe6df    (subtle separators)            │
│                                                            │
├─ SEMANTIC ────────────────────────────────────────────────┤
│  success:        #5db872    (green)                        │
│  warning:        #d4a017    (amber)                        │
│  error:          #c64545    (red)                          │
└────────────────────────────────────────────────────────────┘
```

**Philosophy:** Warm, paper-like palette. The terracotta (`#cc785c`) accent provides warmth without being aggressive. Muted grays keep UI quiet and content-focused. No pure black — `#141413` (near-black) is the darkest tone.

### 3.2 Typography

| Role | Font Stack | Usage |
|---|---|---|
| **Display** | `Cormorant Garamond`, Times New Roman, serif | Hero headings (homepage only) |
| **Body** | `Inter`, -apple-system, BlinkMacSystemFont, sans-serif | Everything else |
| **Mono** | `JetBrains Mono`, monospace | Code, expressions, variable names |

**Scale:** Root font size set to `15px` (slightly smaller than browser default). Everything scales with `rem`.

**Weight convention:** `font-semibold` for headings, `font-medium` for labels/buttons, `font-normal` for body.

**Leading:** `leading-6` (24px at 15px root) for body text provides generous readability.

### 3.3 Border Radius System

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | 6px | Small chips, badges |
| `--radius-md` | 8px | Inputs, buttons, small cards |
| `--radius-lg` | 12px | Cards, dialogs |
| `--radius-xl` | 16px | Large cards |
| `--radius-pill` | 9999px | Pills, tags |

**Themeable radius:** `sharp` (2px/4px), `rounded` (8px/16px), `pill` (9999px/24px) — applied to form controls and cards for respondent-facing forms.

### 3.4 Layout Patterns

#### Card-Driven Layout
Everything lives in cards. Cards have:
- `border border-[#e6dfd8]`
- `bg-white`
- `rounded-2xl` (16px) for major containers, `rounded-xl` (12px) for interior elements
- Subtle shadow: `shadow-[0_1px_0_rgba(20,20,19,0.02)]`
- Generous padding (p-5 or p-6)

#### Section Headers
```css
/* Section title */
<h2 class="text-lg font-semibold text-[#141413]">Title</h2>
/* Section deck */
<p class="mt-1 text-sm text-[#6c6a64]">Description</p>
```

#### Page Max-Width
- Dashboard content: `max-w-7xl`
- Form editor (flow): `max-w-[1600px]` (wide for canvas)
- Form editor (page): `max-w-7xl`
- Standalone form: `max-w-5xl`
- Embed form: fluid, no max-width

#### Grid Patterns
- Stat cards: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`
- Template cards: 3-column grid
- Form list: card-based list

### 3.5 Navigation Patterns

#### Top Navigation (AuthenticatedAppShell)
- **Sticky header:** `sticky top-0 z-50 h-16`
- **Background:** `bg-[#faf9f5]/95 backdrop-blur-sm`
- **Border bottom:** `border-b border-[#e6dfd8]`
- **Logo:** "P" in terracotta square + "PonkoForm" in ink
- **Nav links:** Dashboard, Forms, Integrations, Docs — `text-sm text-[#6c6a64]` → `hover:text-[#141413]`
- **Active state:** `font-medium text-[#141413]`
- **CTA button:** `bg-[#cc785c] text-white rounded-md` → `hover:bg-[#a9583e]`
- **Mobile:** Hamburger → dropdown panel with backdrop blur shadow

#### Workspace Navigation (Form Editor)
- **Section tabs:** Build | Responses | Payments | Invoicing
- **Breadcrumb:** Forms → Form Title → Current Section
- **Back button:** Arrow left icon with "Forms" link
- **Actions toolbar:** Save, Preview, Share, Settings, Publish

#### Public Respondent View
- **No app chrome:** No top nav, no Clerk, no sidebar
- **Centered card** on `bg-[var(--ponko-bg,#faf9f5)]` page
- **Embed mode:** Transparent background, fills container

### 3.6 Form Builder UX Philosophy

#### Page Builder
- **Drag-and-drop:** dnd-kit with `PointerSensor` + `KeyboardSensor`
- **Visual tabs:** Horizontally scrollable page tabs at top
- **Field palette:** Categorized (Text, Choice, Date & Time, Content & Media, Payments, Advanced) with search
- **Inline editing:** Click field to open settings panel (right side)
- **Live feedback:** Color-coded field types, required indicators, validation highlights
- **Unsaved changes:** "Unsaved changes" indicator + auto-save pattern
- **Dark mode builder:** The builder workspace uses dark theme (`bg-[#1a1a18]`) to separate editing from respondent preview

#### Flow Builder (Canvas)
- **React Flow canvas** with custom node renderers
- **Draggable palette** (left) — drop node types onto canvas
- **Config panel** (right) — per-node-type config forms
- **Auto-layout:** BFS-based positioning algorithm
- **Minimap + zoom controls**
- **Validation badge** — live error count
- **Preview modal** — inline flow testing with variable inspector

#### Flow Builder (List)
- **Sortable vertical list** along primary path (BFS)
- **Unified palette** — field + logic nodes together
- Same config panel as canvas
- Better for simple/linear flows

### 3.7 Loading States

**Pattern:** Skeleton cards (animated pulse, rounded-2xl, `bg-[#eee8df]`) replace stat grids while loading.

**Slow loading:** After 3 seconds, a gentle message appears: "This form is taking a little longer than usual to load."

**Retry pattern:** Error state with "Try again" button and `refetch()`.

### 3.8 Animation Philosophy

- **Hero animations:** Staggered enter (40ms–320ms delays), SVG scribble draw, floating badges, gentle drift — all `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quint)
- **Step transitions:** Direction-aware (forward slides right→left, back slides left→right), 260ms
- **Reduced motion:** All animations disabled when `prefers-reduced-motion: reduce`

### 3.9 Consistency Patterns

| Pattern | Implementation |
|---|---|
| **Buttons** | `Button` component with variants: `primary` (terracotta), `secondary` (bordered), `ghost`. Sizes: `sm`, `md`, `lg` |
| **Inputs** | `Input` component — label, placeholder, error state |
| **Badges** | `Badge` component — status, payment status, field type |
| **Data Table** | `DataTable` component family — header, row, pagination, filter panel, column toggle, skeleton, empty |
| **Cards** | `Card` component — white BG, rounded-xl, hairline border |
| **Modals** | Overlay + centered dialog pattern |
| **Error alerts** | Warning variant (`#d7a84c` border, `#fff8e7` BG), Error variant (`#e8b9aa` border, `#fff3ef` BG) |
| **Spacing** | Generous `py-8` to `py-14` page padding. Card padding: `p-5` to `p-6` |

---

## 4. Component Hierarchy Tree

```
<RootDocument>
  <HeadContent />
  <ApplicationShell>
    ├─ [authenticated routes]
    │  <AuthenticatedAppShell>
    │    ├─ <TopNav>                         // sticky header
    │    │   ├─ Logo + "PonkoForm"
    │    │   ├─ Nav links (Dashboard, Forms, Integrations, Docs)
    │    │   ├─ CTA / UserButton
    │    │   └─ <MobileNavigation>           // hamburger dropdown
    │    └─ Page Content
    │       ├─ HomePage                      // "/"
    │       │   └─ <ProductMockups>          // hero visuals
    │       │
    │       ├─ DashboardPage                 // "/dashboard"
    │       │   ├─ <StatCard> ×4
    │       │   ├─ <CompletionOverview>
    │       │   ├─ <TimeSeriesChart> ×2
    │       │   ├─ Insights panel
    │       │   ├─ Per-form performance table
    │       │   └─ <PerformanceReportDialog>
    │       │
    │       ├─ FormsPage                     // "/forms"
    │       │   ├─ <FormCard> ×N
    │       │   ├─ <EmptyState>
    │       │   ├─ <ShareDialog>
    │       │   └─ Bulk action bar
    │       │
    │       ├─ NewFormPage                   // "/forms/new"
    │       │   ├─ <ScratchTemplateCard>
    │       │   ├─ <TemplateCard> ×N
    │       │   └─ <TemplatePreview>
    │       │
    │       ├─ EditPage                      // "/forms/$formId/edit"
    │       │   ├─ <FlowToolbar>
    │       │   ├─ <FormSectionNav>          // Build|Responses|Payments|Invoicing
    │       │   │
    │       │   ├─ [Page Mode]
    │       │   │  └─ <PageBuilderWorkspace>
    │       │   │      ├─ <SortablePageTab> ×N          // page tabs
    │       │   │      ├─ Field palette (searchable)
    │       │   │      ├─ <SortableFieldCard> ×N          // field list
    │       │   │      ├─ <FieldSettings>                  // right panel
    │       │   │      ├─ <OptionsDialog>
    │       │   │      ├─ <LogicDialog>                    // conditions
    │       │   │      ├─ <RulesDialog>                    // validation
    │       │   │      ├─ <ComputationDialog>
    │       │   │      ├─ <ReferencesPanel>                // form references
    │       │   │      └─ <PageSettings>                   // payment, final page
    │       │   │
    │       │   └─ [Flow Mode]
    │       │      ├─ [Canvas View]
    │       │      │   <FlowCanvasWorkspace>
    │       │      │     ├─ <FlowPalette>                  // left sidebar
    │       │      │     ├─ <FlowCanvas>                   // @xyflow/react center
    │       │      │     │   └─ <NodeShell> ×N              // custom node renderers
    │       │      │     └─ <NodeConfigPanel>              // right panel
    │       │      │        ├─ <FormFieldConfig>
    │       │      │        ├─ <GroupConfig>
    │       │      │        │   └─ <GroupFieldsEditor>
    │       │      │        ├─ <DecisionConfig>
    │       │      │        │   └─ <OptionsEditor>
    │       │      │        ├─ <CalculatorConfig>
    │       │      │        ├─ <PaymentConfig>
    │       │      │        ├─ <SummaryConfig>
    │       │      │        └─ <RedirectConfig>
    │       │      │
    │       │      ├─ [List View]
    │       │      │   <FlowListBuilder>
    │       │      │     ├─ <BuilderPalette>               // left sidebar
    │       │      │     ├─ Sortable node list             // dnd-kit center
    │       │      │     └─ <NodeConfigPanel>              // same right panel
    │       │      │
    │       │      ├─ <VariablesManager>
    │       │      │   └─ <VariableDialog>
    │       │      ├─ <SettingsDialog>
    │       │      ├─ <FlowValidationBadge>
    │       │      └─ <PreviewDialog>
    │       │         └─ <FlowPreviewModal>
    │       │
    │       ├─ SubmissionsPage               // "/forms/$formId/submissions"
    │       │  └─ <FormWorkspaceLayout>
    │       │     └─ <DataTable>
    │       │        ├─ <DataTableToolbar> (search, filter, column toggle)
    │       │        ├─ <DataTableHeader>
    │       │        ├─ <DataTableRow> ×N
    │       │        ├─ <DataTablePagination>
    │       │        └─ <ResponseActionDialog>
    │       │
    │       ├─ PaymentsPage                  // "/forms/$formId/payments"
    │       │  └─ <FormWorkspaceLayout>
    │       │     └─ <DataTable>
    │       │        ├─ Sortable, filterable columns
    │       │        ├─ Verify/bulk-verify actions
    │       │        └─ Recovery link generation
    │       │
    │       ├─ InvoicingPage                 // "/forms/$formId/invoicing"
    │       │  └─ <FormWorkspaceLayout>
    │       │     ├─ <InvoiceTemplateBuilder>
    │       │     └─ <DeliveryHistory>
    │       │
    │       ├─ IntegrationsPage              // "/settings/integrations"
    │       │  └─ <IntegrationsHub>
    │       │     ├─ <CategorySection> ×7
    │       │     │  └─ <ProviderCard> ×N
    │       │     └─ <IntegrationModal>
    │       │        └─ Provider-specific config form
    │       │
    │       └─ DocsPage                      // "/docs", "/docs/$slug"
    │          ├─ <DocSidebar>
    │          └─ <DocCard> ×N
    │
    └─ [public routes — bare, no AuthenticatedAppShell]
       ├─ PublicFormView                    // "/forms/submit/$formId", "/forms/embed/$formId"
       │  ├─ <FormLoadingIndicator>
       │  ├─ [Success state] "✓ Thank you!"
       │  ├─ [Page branch] → <PageFormView>
       │  │   ├─ Page-by-page field rendering
       │  │   ├─ Progress indicator
       │  │   └─ reCAPTCHA integration
       │  └─ [Flow branch] → <FlowExecutionContainer>
       │     ├─ <FlowStepRenderer>
       │     │  ├─ <GroupStepView>
       │     │  └─ <PaymentStep>
       │     └─ <InvoiceDownloadButton>
       │
       ├─ PaymentReturn                     // "/forms/payment-return"
       ├─ FlowComplete                      // "/flow/$executionId/complete"
       └─ Docs (public)

  <TanStackDevtools /> (dev only)
  <Scripts />
```

---

## 5. Route Map

### 5.1 Public Routes (no auth required)

| Route | Method | Purpose | Auth |
|---|---|---|---|
| `/` | GET | Homepage (landing) | No |
| `/docs` | GET | Documentation index | No |
| `/docs/$slug` | GET | Individual doc page | No |
| `/forms/submit/$formId` | GET | Respondent form (standalone) | No |
| `/forms/embed/$formId` | GET | Respondent form (iframe embed) | No |
| `/forms/payment-return` | GET | Payment gateway return handler | No |
| `/flow/$executionId/complete` | GET | Flow execution completion redirect | No |
| `/sign-in/$` | GET | Clerk sign-in | No |
| `/sign-up/$` | GET | Clerk sign-up | No |
| `/api/health` | GET | Health check endpoint | No |
| `/api/webhooks/xendit/$endpointKey` | POST | Xendit webhook receiver | No (endpointKey auth) |
| `/api/internal/reconcile-payments` | GET | Payment reconciliation job | CRON_SECRET |
| `/mcp` | GET | MCP SDK endpoint | No |

### 5.2 Authenticated Routes (Clerk auth required)

| Route | Method | Purpose | Auth |
|---|---|---|---|
| `/dashboard` | GET | Creator analytics dashboard | `requireAuth` |
| `/forms` | GET | Form list with bulk actions | `requireAuth` |
| `/forms/new` | GET | Form creation (scratch/template) | `requireAuth` |
| `/forms/$formId/edit` | GET | Unified editor (page or flow) | `requireAuth` |
| `/forms/$formId/flow` | GET | Redirect to unified editor | `requireAuth` |
| `/forms/$formId/submissions` | GET | Responses viewer + actions | `requireAuth` |
| `/forms/$formId/payments` | GET | Payment records viewer | `requireAuth` |
| `/forms/$formId/invoicing` | GET | Email template builder + logs | `requireAuth` |
| `/settings/integrations` | GET | Integration hub configuration | `requireAuth` |
| `/integrations/google/callback` | GET | Google OAuth callback | `requireAuth` |
| `/api/forms/$formId/submissions-export` | GET | CSV export download | `requireAuth` |

---

## 6. Data Flow Diagram

### 6.1 Creator → Database Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CREATOR JOURNEY                             │
│                                                                     │
│  [Clerk Auth]                                                       │
│       │                                                             │
│       ▼                                                             │
│  Dashboard ──► /forms/new ──► Create (scratch/template)             │
│                                    │                                │
│                                    ▼                                │
│                           ┌──────────────────┐                      │
│                           │  UNIFIED EDITOR   │                     │
│                           │  /forms/$id/edit  │                     │
│                           └────────┬─────────┘                      │
│                                    │                                │
│              ┌─────────────────────┼─────────────────────┐          │
│              ▼                     ▼                     ▼          │
│     ┌──────────────┐     ┌──────────────┐      ┌──────────────┐    │
│     │ PAGE BUILDER │     │ FLOW BUILDER │      │   SETTINGS   │    │
│     │              │     │              │      │   (theme,    │    │
│     │ Pages,fields │     │ Nodes, edges,│      │    metadata) │    │
│     │ conditions,  │     │ variables    │      │              │    │
│     │ references   │     │              │      │              │    │
│     └──────┬───────┘     └──────┬───────┘      └──────┬───────┘    │
│            │                    │                      │            │
│            ▼                    ▼                      ▼            │
│     ┌──────────────────────────────────────────────────────────┐    │
│     │                    DATABASE LAYER                         │    │
│     │                                                          │    │
│     │  ┌─────────┐  ┌───────────────┐  ┌──────────────────┐    │    │
│     │  │  forms   │  │  form_pages   │  │     flows        │    │    │
│     │  │ (theme,  │  │  form_page_   │  │  flow_nodes     │    │    │
│     │  │  status, │  │  fields       │  │  flow_edges     │    │    │
│     │  │  publicId)│  │  field_cond.  │  │  flow_variables │    │    │
│     │  └─────────┘  │  form_refs    │  └──────────────────┘    │    │
│     │               └───────────────┘                          │    │
│     │  ┌──────────────┐  ┌────────────────────────────────┐     │    │
│     │  │integrations  │  │  form_invoice_configs          │     │    │
│     │  │(encrypted    │  │  form_confirmation_configs     │     │    │
│     │  │ credentials) │  └────────────────────────────────┘     │    │
│     │  └──────────────┘                                         │    │
│     └──────────────────────────────────────────────────────────┘    │
│                                                                     │
│            [Publish] ──► forms.status = 'published'                 │
│            [Share]   ──► Get public URL + embed code                │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Respondent → Database Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                       RESPONDENT JOURNEY                            │
│                                                                     │
│  [No Auth Required — anonymous access]                              │
│                                                                     │
│  URL Entry                                                          │
│  ├── /forms/submit/$publicId  (standalone)                          │
│  └── /forms/embed/$publicId   (iframe embed)                        │
│              │                                                      │
│              ▼                                                      │
│     ┌─────────────────────┐                                         │
│     │   PublicFormView    │  ← mode selection logic                 │
│     │                     │                                         │
│     │   if pageForm:      │──► PageFormView                         │
│     │   if flow:          │──► FlowExecutionContainer               │
│     │   if legacy:        │──► FieldRenderer (one-page form)         │
│     └─────────┬───────────┘                                         │
│               │                                                     │
│    ┌──────────┴──────────┐                                          │
│    ▼                     ▼                                          │
│  ┌────────────────┐  ┌──────────────────┐                           │
│  │  PAGE FORM     │  │   FLOW FORM      │                           │
│  │                │  │                  │                           │
│  │ 1.Create/      │  │ 1.Create/        │                           │
│  │   restore      │  │   restore        │                           │
│  │   session      │  │   execution      │                           │
│  │                │  │                  │                           │
│  │ 2.Validate     │  │ 2.Step render    │                           │
│  │   field per    │  │   (FlowEngine    │                           │
│  │   page         │  │    .getCurStep)  │                           │
│  │                │  │                  │                           │
│  │ 3.Check        │  │ 3.Process input  │                           │
│  │   conditions   │  │   (bind variable)│                           │
│  │                │  │                  │                           │
│  │ 4.reCAPTCHA    │  │ 4.Run calculator │                           │
│  │   verify       │  │   if applicable  │                           │
│  │                │  │                  │                           │
│  │ 5.Advance      │  │ 5.Advance to     │                           │
│  │   page         │  │   next node      │                           │
│  │                │  │                  │                           │
│  │      ┌───────┐ │  │      ┌────────┐  │                           │
│  │      │PAYMENT│ │  │      │PAYMENT │  │                           │
│  │      │ PAGE? │ │  │      │ NODE?  │  │                           │
│  │      └───┬───┘ │  │      └───┬────┘  │                           │
│  │          │     │  │          │       │                           │
│  └──────────┼─────┘  └──────────┼───────┘                           │
│             │                   │                                   │
│             ▼                   ▼                                   │
│     ┌──────────────────────────────────────┐                        │
│     │         PAYMENT GATEWAY              │                        │
│     │                                      │                        │
│     │  1. Create checkout (Xendit/PayPal)  │                        │
│     │  2. Redirect to hosted page          │                        │
│     │  3. Gateway returns to               │                        │
│     │     /forms/payment-return            │                        │
│     │  4. Verify payment server-side       │                        │
│     │  5. Resume session/execution          │                        │
│     └──────────────────┬───────────────────┘                        │
│                        │                                            │
│                        ▼                                            │
│     ┌──────────────────────────────────────┐                        │
│     │         COMPLETION                   │                        │
│     │                                      │                        │
│     │  1. Create/update form_submissions   │                        │
│     │  2. Link payment to submission       │                        │
│     │  3. Mark session/execution complete  │                        │
│     │  4. Dispatch confirmation email      │                        │
│     │  5. Dispatch invoice email           │                        │
│     │     (if payment completed)           │                        │
│     │  6. Render summary / redirect        │                        │
│     └──────────────────┬───────────────────┘                        │
│                        │                                            │
│                        ▼                                            │
│     ┌──────────────────────────────────────────────────────────┐    │
│     │                    DATABASE LAYER                         │    │
│     │                                                          │    │
│     │  ┌─────────────────────┐  ┌──────────────────┐           │    │
│     │  │ form_submissions    │  │    payments      │           │    │
│     │  │ (formData JSONB,    │  │  (amount, status,│           │    │
│     │  │  status, clientToken│  │   gatewayPaymentId│          │    │
│     │  │  submittedAt)       │  │   externalId...) │           │    │
│     │  └─────────────────────┘  └──────────────────┘           │    │
│     │                                                          │    │
│     │  ┌─────────────────────┐  ┌──────────────────┐           │    │
│     │  │ form_submission     │  │ flow_executions  │           │    │
│     │  │ _sessions           │  │ (variables,      │           │    │
│     │  │ (collectedData,     │  │  history,        │           │    │
│     │  │  currentPageIndex)  │  │  currentNodeId)  │           │    │
│     │  └─────────────────────┘  └──────────────────┘           │    │
│     │                                                          │    │
│     │  ┌─────────────────────┐  ┌──────────────────┐           │    │
│     │  │ payment_events      │  │ email_delivery   │           │    │
│     │  │ (audit trail)       │  │ _logs            │           │    │
│     │  └─────────────────────┘  │ (snapshots)      │           │    │
│     │                           └──────────────────┘           │    │
│     └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.3 Creator Analytics Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│  DATABASE                                                           │
│  form_submissions + payments + form_submission_sessions               │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────────────────┐                                             │
│  │ dashboard-analytics │  ← aggregation queries                      │
│  │ .ts                 │    - totalSubmissions                       │
│  │                     │    - completedSubmissions                   │
│  │                     │    - completionRate                         │
│  │                     │    - totalRevenue (multi-currency)           │
│  │                     │    - 30-day time series                     │
│  │                     │    - per-form stats                         │
│  └────────┬────────────┘                                             │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────┐                                             │
│  │ currency-conversion  │  ← Frankfurter API daily rates              │
│  │ .ts                 │                                             │
│  └────────┬────────────┘                                             │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────┐                                             │
│  │ dashboard-report.ts │  ← insights generation + PDF                │
│  └────────┬────────────┘                                             │
│           │                                                          │
│           ▼                                                          │
│  ┌─────────────────────────────┐                                     │
│  │    DASHBOARD UI             │                                     │
│  │                             │                                     │
│  │  ┌───────────────────────┐  │                                     │
│  │  │ 4 stat cards          │  │                                     │
│  │  │ (submissions,         │  │                                     │
│  │  │  completed, rate,     │  │                                     │
│  │  │  revenue)             │  │                                     │
│  │  └───────────────────────┘  │                                     │
│  │                             │                                     │
│  │  ┌───────────────────────┐  │                                     │
│  │  │ Completion overview   │  │                                     │
│  │  │ bar                   │  │                                     │
│  │  │ Insights panel        │  │                                     │
│  │  └───────────────────────┘  │                                     │
│  │                             │                                     │
│  │  ┌───────────────────────┐  │                                     │
│  │  │ 30-day time series    │  │                                     │
│  │  │ (submissions area,    │  │                                     │
│  │  │  revenue bars)        │  │                                     │
│  │  └───────────────────────┘  │                                     │
│  │                             │                                     │
│  │  ┌───────────────────────┐  │                                     │
│  │  │ Per-form performance  │  │                                     │
│  │  │ table                 │  │                                     │
│  │  └───────────────────────┘  │                                     │
│  │                             │                                     │
│  │  ┌───────────────────────┐  │                                     │
│  │  │ PDF report download   │  │  ← jsPDF client-side               │
│  │  └───────────────────────┘  │                                     │
│  └─────────────────────────────┘                                     │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 7. System Philosophy

### Design Principles

1. **Warm, quiet, content-first.** The UI deliberately avoids loud colors and aggressive patterns. The canvas (`#faf9f5`) is a warm off-white that feels like paper. The terracotta accent (`#cc785c`) provides warmth without aggression. Text is generously spaced with comfortable leading.

2. **Two paradigms, one experience.** Page forms (linear, page-by-page) and flow forms (branching, node-graph) coexist under a unified editor. The system auto-selects the appropriate editor based on data presence. Creators don't need to choose upfront — they can start simple (page) and graduate to complex (flow).

3. **Card-based visual language.** Every functional unit lives in a card with a hairline border and subtle shadow. This creates visual consistency across Dashboard, Forms list, Editor, Settings, and respondent views.

4. **Progressive disclosure.** The builder hides complexity behind panels and dialogs. Field settings, conditions, validation rules, and payment computations are collapsed until needed. The flow builder offers both list (simple) and canvas (advanced) views.

5. **Safe by default.** The expression engine is purposefully limited — no `eval()`, no property access, no constructors. Credentials are encrypted at rest with AES-256-GCM. Anonymous resume uses opaque client tokens, never numeric IDs.

6. **Resilient loading.** Forms show skeleton cards during load. After 3 seconds, a gentle message appears. Errors display recovery buttons. The system retries with exponential backoff.

7. **Themeable without complexity.** Three knobs (accent color, background color, corner radius) give maximum visual impact with minimum cognitive load. CSS custom properties cascade naturally through the respondent experience.

8. **API-first architecture.** All server interactions go through TanStack Start server functions. The client never talks directly to PostgreSQL. This keeps the data layer secure and the client focused on presentation.

9. **Integration hub as a platform play.** The generic CRUD + encrypted config pattern makes adding new providers straightforward. The architecture separates credential storage from runtime behavior — a provider can be "configured" without being "operational," enabling progressive rollout.

---

## 8. Feature Plan Index

22 feature plans from `001` to `023`, with implementation status:

### Implemented (~10)
| Plan | Status | Description |
|---|---|---|
| 001 | ✅ | Interactive onboarding |
| 002 | ✅ | Integrations hub |
| 003 | ✅ | Services integration |
| 004 | ✅ | Email notifications (respondent confirmations) |
| 005 | ✅ | Pre-created field groups |
| 006 | ✅ | Table view component (submissions) |
| 007 | ✅ | Form builder revision enhancement (page builder) |
| 008 | ✅ | Form references (variables) |
| 009 | ✅ | Production reliability (DB + form rendering) |
| 010 | ✅ | Server error handling |
| 011 | ✅ | Plans system / form templates |
| 012 | ✅ | Homepage style redesign |
| 013 | ✅ | Invoicing builder template |
| 014 | ✅ | Email campaign survey mail |
| 015 | ✅ | Subscription (Xendit) payment |
| 016 | ✅ | SVG stars (satisfaction field) |

### Spec-Only (~11)
| Plan | Status | Description |
|---|---|---|
| 017 | 📋 | Analytics dashboard (per-form funnel) |
| 018 | 📋 | Payment links / standalone checkout |
| 020 | 📋 | Webhooks / external notifications |
| 021 | 📋 | Discount codes / coupons |
| 022 | 📋 | Conditional email automation |
| 023 | 📋 | Feature gap analysis (meta-plan) |

---

## 9. Key Source File Index

| File | Lines (approx) | Purpose |
|---|---|---|
| `src/db/schema.ts` | 880 | All database table definitions, enums, indexes |
| `src/lib/flow-engine/types.ts` | 151 | Flow-related TypeScript types |
| `src/lib/flow-engine/FlowEngine.ts` | 350 | Core execution engine |
| `src/lib/flow-engine/safe-expression.ts` | 420 | Expression tokenizer, parser, evaluator |
| `src/lib/page-builder/types.ts` | 200 | Page builder types |
| `src/lib/theme.ts` | 117 | Per-form theming system |
| `src/styles.css` | 307 | Global design tokens, hero animations |
| `src/routes/forms/$formId/edit.tsx` | 1107 | Unified editor route |
| `src/components/page-builder/PageBuilderWorkspace.tsx` | 869 | Page editor main component |
| `src/components/flow-builder/FlowCanvasWorkspace.tsx` | 256 | Canvas flow editor |
| `src/components/flow-builder/FlowListBuilder.tsx` | 400 | List flow editor |
| `src/components/flow-builder/NodeConfigPanel.tsx` | 500 | Node configuration panel |
| `src/components/public-form/PublicFormView.tsx` | 356 | Public mode selection + loading |
| `src/components/page-form/PageFormView.tsx` | ~500 | Page form respondent experience |
| `src/components/flow-execution/FlowExecutionContainer.tsx` | 282 | Flow respondent experience |
| `src/components/dashboard/PerformanceReportDialog.tsx` | ~400 | Dashboard report modal |
| `src/components/layout/AuthenticatedAppShell.tsx` | 189 | Top navigation component |
