# Implementation Plan — PonkoForm

> A flexible form creation tool (like Google Forms) with payment gateway integration.
> Built on TanStack React Start + Clerk Auth + Neon (PostgreSQL) + Drizzle ORM.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Dashboard │  │ Form Builder │  │ Public Form Submit   │  │
│  └──────────┘  └──────────────┘  └──────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    TanStack React Start (SSR)                │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Clerk    │  │ React Router │  │ React Query          │  │
│  │ Auth     │  │ (file-based) │  │ (server state)       │  │
│  └──────────┘  └──────────────┘  └──────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                   Server Layer                               │
│  ┌────────────────┐  ┌────────────────────────────────┐     │
│  │ Server Fns     │  │ clerkMiddleware                │     │
│  │ (form CRUD)    │  │ (auth on requests)             │     │
│  └────────────────┘  └────────────────────────────────┘     │
├─────────────────────────────────────────────────────────────┤
│                   Data Layer                                 │
│  ┌────────────────┐  ┌────────────────────────────────┐     │
│  │ Drizzle ORM    │  │ Neon (PostgreSQL)              │     │
│  │ (schema/query) │  │ (serverless DB)                │     │
│  └────────────────┘  └────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘

Payment Gateways (extensible via registry pattern):
┌──────────────────────────────────────────────────────────┐
│            Payment Gateway Registry                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │ PayPal   │  │ Xendit   │  │ [Add Yours] │               │
│  │ gateway  │  │ gateway  │  │ New file   │               │
│  └──────────┘  └──────────┘  └──────────┘               │
└──────────────────────────────────────────────────────────┘
```

---

## File Structure

```
src/
├── db/
│   ├── schema.ts              # All DB tables (profiles, forms, fields, submissions, payments)
│   └── index.ts               # Drizzle client instance
├── integrations/
│   ├── clerk/
│   │   ├── provider.tsx
│   │   └── header-user.tsx
│   └── payments/              ★ Payment gateway abstraction layer
│       ├── registry.ts        # Registry (factory pattern) — register/get gateways
│       ├── base.ts            # Abstract base class / interface for all gateways
│       ├── types.ts           # Shared types (PaymentGateway, PaymentRequest, PaymentResult)
│       ├── paypal/
│       │   └── gateway.ts     # PayPal implementation
│       └── xendit/
│           └── gateway.ts     # Xendit implementation
├── components/
│   ├── ui/                    # Shared UI primitives (aligned with DESIGN.md)
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Toggle.tsx
│   │   ├── Badge.tsx
│   │   ├── Modal.tsx
│   │   └── Toast.tsx
│   ├── form-builder/
│   │   ├── FormBuilder.tsx    # Main builder canvas (drag-and-drop surface)
│   │   ├── FieldPalette.tsx   # Sidebar of available field types to add
│   │   ├── FieldEditor.tsx    # Properties panel for selected field
│   │   ├── FormPreview.tsx    # Live preview of the form
│   │   └── fields/            # Individual field renderers
│   │       ├── TextField.tsx
│   │       ├── EmailField.tsx
│   │       ├── NumberField.tsx
│   │       ├── TextAreaField.tsx
│   │       ├── SelectField.tsx
│   │       ├── CheckboxField.tsx
│   │       ├── RadioField.tsx
│   │       └── PaymentField.tsx
│   └── dashboard/
│       ├── FormCard.tsx       # Card for a form in the dashboard list
│       └── EmptyState.tsx     # Shown when user has no forms yet
├── lib/
│   ├── form-utils.ts          # Helpers: default field configs, validation, serialization
│   ├── payment-utils.ts       # Helpers: amount formatting, currency lists
│   └── server-fns/            ★ TanStack Start server functions
│       ├── forms.ts           # createForm, updateForm, deleteForm, publishForm, getForms
│       ├── fields.ts          # addField, updateField, reorderFields, deleteField
│       └── submissions.ts     # submitFormResponse, getSubmissions, getSubmission
├── routes/                    # File-based routing (auto-generated route tree)
│   ├── __root.tsx
│   ├── index.tsx              # Landing / dashboard redirect
│   ├── sign-in.$.tsx
│   ├── sign-up.$.tsx
│   ├── dashboard/
│   │   └── index.tsx          # My Forms list
│   ├── forms/
│   │   ├── new.tsx            # Create new form (name + description)
│   │   ├── $formId/
│   │   │   ├── edit.tsx       # Form builder page
│   │   │   ├── preview.tsx    # Full-page preview
│   │   │   ├── settings.tsx   # Form settings (payment config, notifications)
│   │   │   └── submissions.tsx# View submissions for this form
│   │   └── submit/
│   │       └── $formId.tsx    # Public form submission page
│   └── api/
│       └── payments/          # Payment processing endpoints
│           └── $gateway.ts
├── router.tsx
├── start.ts
└── styles.css
```

---

## Functional Requirements & Task Mapping

| FR# | Requirement | Sprint | Key Files |
|-----|-------------|--------|-----------|
| FR1 | User can sign up, sign in, and sign out | S1 | Already complete (Clerk) |
| FR2 | User has a personal dashboard showing their forms | S1 | `routes/dashboard/index.tsx`, `server-fns/forms.ts` |
| FR3 | User can create a new form with name + description | S1 | `routes/forms/new.tsx`, `db/schema.ts` |
| FR4 | User can add, edit, reorder, and delete form fields | S2 | `components/form-builder/*`, `server-fns/fields.ts` |
| FR5 | User can preview the form while building | S2 | `FormPreview.tsx` |
| FR6 | User can publish/unpublish forms | S2 | `server-fns/forms.ts` |
| FR7 | Public users can view and submit published forms | S3 | `routes/forms/submit/$formId.tsx` |
| FR8 | Form creator can view submissions and responses | S3 | `routes/forms/$formId/submissions.tsx` |
| FR9 | Payment gateways follow an extensible plugin pattern | S4 | `integrations/payments/*` |
| FR10 | PayPal gateway integration | S4 | `integrations/payments/paypal/gateway.ts` |
| FR11 | Xendit gateway integration | S4 | `integrations/payments/xendit/gateway.ts` |
| FR12 | Form creator can attach payment to a form | S5 | `PaymentField.tsx`, `routes/forms/$formId/settings.tsx` |
| FR13 | Public submitter can pay via gateway on form submission | S5 | `routes/api/payments/$gateway.ts`, `PaymentField.tsx` |
| FR14 | Design system matches DESIGN.md specification | Cross-cutting | `components/ui/*` |

---

## Phases (Sprints)

### Sprint 0 — Project Foundation (Estimated: 2-3 hours)

**Goal:** Extend the database schema and set up the data access layer.

**Dependencies:** None (project already scaffolded).

**Tasks:**

| # | Task | File(s) | Acceptance Criteria | Effort |
|---|------|---------|-------------------|--------|
| 0.1 | Add `profiles` table to schema | `src/db/schema.ts` | - Table links Clerk user ID (`text`, unique) to internal profile<br>- Columns: `id`, `clerk_id`, `display_name`, `avatar_url`, `created_at` | 20min |
| 0.2 | Add `forms` table | `src/db/schema.ts` | - Columns: `id`, `profile_id` (FK), `title`, `description`, `status` (draft/published), `created_at`, `updated_at`<br>- Index on `profile_id` | 20min |
| 0.3 | Add `form_fields` table | `src/db/schema.ts` | - Columns: `id`, `form_id` (FK), `type`, `label`, `placeholder`, `required` (bool), `options` (JSON, for select/radio), `order` (int), `created_at`<br>- Index on (`form_id`, `order`) | 20min |
| 0.4 | Add `form_submissions` table | `src/db/schema.ts` | - Columns: `id`, `form_id` (FK), `submitted_at`, `form_data` (JSONB)<br>- Index on `form_id` | 15min |
| 0.5 | Add `payment_gateways` table | `src/db/schema.ts` | - Seed table with 'paypal', 'xendit' rows<br>- Columns: `id`, `name`, `slug`, `is_active` | 15min |
| 0.6 | Add `form_payment_configs` table | `src/db/schema.ts` | - Columns: `id`, `form_id` (FK unique), `payment_gateway_id` (FK), `amount`, `currency`, `gateway_settings` (JSONB), `created_at` | 15min |
| 0.7 | Add `payments` table | `src/db/schema.ts` | - Columns: `id`, `form_submission_id` (FK nullable), `payment_gateway_id` (FK), `amount`, `currency`, `status`, `gateway_payment_id`, `gateway_response` (JSONB), `created_at` | 15min |
| 0.8 | Run DB migration | `drizzle.config.ts`, terminal | - `drizzle-kit generate` + `drizzle-kit migrate` succeed<br>- All tables exist in Neon | 15min |
| 0.9 | Create profile on user sign-up via Clerk webhook | `src/server-fns/webhooks/clerk.ts` | - On `user.created` event, insert row into `profiles` table<br>- Verify webhook signature | 30min |

**Risks:**
- Clerk webhook requires a public endpoint for events. Mitigation: Use Clerk webhook dashboard with ngrok during dev, or poll user on first dashboard visit.

---

### Sprint 1 — Dashboard & Form CRUD (Estimated: 4-5 hours)

**Goal:** User can see their forms and create new ones.

**Dependencies:** Sprint 0 complete (DB schema exists).

**Tasks:**

| # | Task | File(s) | Acceptance Criteria | Effort |
|---|------|---------|-------------------|--------|
| 1.1 | Create server functions for forms CRUD | `src/lib/server-fns/forms.ts` | - `getForms()`: returns forms for authenticated user<br>- `createForm(data)`: creates form, returns it<br>- `updateForm(id, data)`: updates title/description/status<br>- `deleteForm(id)`: deletes form and its fields<br>- All functions authenticate via `auth()` from Clerk | 1h |
| 1.2 | Build Dashboard page (My Forms list) | `src/routes/dashboard/index.tsx` | - Route guarded: redirects to sign-in if unauthenticated<br>- Loads and displays user's forms using `getForms()`<br>- Each form shows: title, status badge, field count, last updated<br>- "New Form" button prominently visible | 1h |
| 1.3 | Build FormCard and EmptyState components | `src/components/dashboard/FormCard.tsx`, `src/components/dashboard/EmptyState.tsx` | - FormCard: title, status badge (draft/published), field count, edit/delete actions<br>- EmptyState: illustration + message + "Create your first form" CTA | 30min |
| 1.4 | Build Create Form page | `src/routes/forms/new.tsx` | - Form with title (required), description (optional)<br>- On submit, calls `createForm()`, redirects to `/forms/$formId/edit` | 45min |
| 1.5 | Update root layout with nav bar | `src/routes/__root.tsx` | - Top navigation with: logo + "Dashboard" link + HeaderUser (existing)<br>- Matches DESIGN.md top-nav spec (cream, 64px) | 30min |
| 1.6 | Build UI primitives (Button, Card, Input) | `src/components/ui/Button.tsx`, `src/components/ui/Card.tsx`, `src/components/ui/Input.tsx` | - Match DESIGN.md spec: coral primary, cream secondary, proper border radii<br>- Button: primary, secondary, text-link variants<br>- Card: cream surface card variant | 1h |
| 1.7 | Add dashboard route to router | `src/routes/dashboard/index.tsx` (auto-detected) | - Route `/dashboard` is accessible and renders dashboard | 5min |

**Acceptance Criteria:**
- Logged-in user lands on dashboard showing "You have no forms yet"
- User can create a form by providing a title
- After creation, user is taken to the form builder page (Sprint 2)
- User can see form list with status indicators
- User can delete forms

**Risks:**
- Clerk auth in server functions: TanStack Start uses `auth()` from `@clerk/tanstack-react-start/server`. Need to ensure `clerkMiddleware()` is set up (already done in `src/start.ts`).

---

### Sprint 2 — Form Builder & Preview (Estimated: 8-10 hours)

**Goal:** Full drag-and-drop form builder with live preview.

**Dependencies:** Sprint 1 complete.

**Tasks:**

| # | Task | File(s) | Acceptance Criteria | Effort |
|---|------|---------|-------------------|--------|
| 2.1 | Create server functions for field CRUD | `src/lib/server-fns/fields.ts` | - `getFields(formId)`: returns fields ordered by `order`<br>- `addField(formId, fieldData)`: adds field at end, returns it<br>- `updateField(fieldId, data)`: updates label/type/options/required<br>- `deleteField(fieldId)`: removes field<br>- `reorderFields(formId, orderedIds)`: batch-updates `order` values | 1h |
| 2.2 | Build FormBuilder page layout | `src/routes/forms/$formId/edit.tsx` | - 3-column layout: Field Palette (left) → Builder Canvas (center) → Field Properties (right)<br>- Loads form metadata and fields on mount<br>- Saves auto-save every 30s | 1h |
| 2.3 | Build FieldPalette component | `src/components/form-builder/FieldPalette.tsx` | - Lists available field types: Text, Email, Number, TextArea, Select, Checkbox, Radio, Payment (disabled until Sprint 5)<br>- Draggable items that create a new field when dropped on canvas | 45min |
| 2.4 | Build FormBuilder canvas | `src/components/form-builder/FormBuilder.tsx` | - Displays current fields in order<br>- Drag-and-drop reordering via `@dnd-kit/core` or native HTML5 drag<br>- Click a field to select it (opens properties panel)<br>- Empty state: "Drag fields here to start building" | 2h |
| 2.5 | Build FieldEditor (properties panel) | `src/components/form-builder/FieldEditor.tsx` | - Shows properties for selected field: label, placeholder, required toggle<br>- For Select/Radio: add/remove options list<br>- Changes auto-save on blur | 1.5h |
| 2.6 | Build field renderers | `src/components/form-builder/fields/*.tsx` | - Each field component renders its input type<br>- Props: `field` (field config), `value`, `onChange`, `error`<br>- Fields: TextField, EmailField, NumberField, TextAreaField, SelectField, CheckboxField, RadioField | 2h |
| 2.7 | Build FormPreview component | `src/components/form-builder/FormPreview.tsx` | - Renders all fields in read-only/input mode inside a Card<br>- Mirrors the public submission page look<br>- Updates live as fields are added/changed in builder<br>- Toggle between "builder mode" and "preview mode" in the builder page | 1.5h |
| 2.8 | Add publish/unpublish toggle | `src/components/form-builder/FormBuilder.tsx` + server-fns | - Button in builder header to publish/unpublish<br>- Published forms get a shareable link<br>- Shows public URL after publishing (with copy button) | 30min |
| 2.9 | Build UI primitives (Select, Toggle, Badge, Modal) | `src/components/ui/*.tsx` | - Select: styled dropdown matching DESIGN.md<br>- Toggle: switch for required/publish toggles<br>- Badge: pill badge for status (draft/published)<br>- Modal: confirmation dialogs (delete field, delete form) | 1h |

**Acceptance Criteria:**
- User can add fields by dragging from palette to canvas
- User can reorder fields via drag-and-drop on canvas
- User can select a field and edit its properties in the side panel
- User can delete fields from the canvas
- Live preview updates as fields are added/edited
- All changes auto-save
- User can publish the form and get a shareable link

**Risks:**
- Drag-and-drop: `@dnd-kit/core` needs to be installed. It's not in package.json yet. Add: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`.
- Auto-save conflicts: use a debounced save (1s after last change) + unique mutation keys.

---

### Sprint 3 — Form Submission & Responses (Estimated: 4-5 hours)

**Goal:** Public users can submit forms; form creators can view responses.

**Dependencies:** Sprint 2 complete (fields are defined and forms can be published).

**Tasks:**

| # | Task | File(s) | Acceptance Criteria | Effort |
|---|------|---------|-------------------|--------|
| 3.1 | Create public form submission route | `src/routes/forms/submit/$formId.tsx` | - Loads published form by ID - renders form using field renderers<br>- Includes validation per field type<br>- On submit, calls `submitFormResponse()`<br>- Shows success/thank-you message after submission<br>- If form is draft/unpublished, shows 404 | 1.5h |
| 3.2 | Create server functions for submissions | `src/lib/server-fns/submissions.ts` | - `submitFormResponse(formId, data)`: validates required fields, stores submission<br>- `getSubmissions(formId)`: returns all submissions for a form (owner only)<br>- `getSubmission(id)`: returns single submission details<br>- All owner-only functions check `auth()` | 1h |
| 3.3 | Build submissions view page | `src/routes/forms/$formId/submissions.tsx` | - Table/list of submissions with timestamp and first few field values<br>- Click to expand full submission data<br>- Shows submission count<br>- Owner-only access check | 1.5h |
| 3.4 | Add form field validation | `src/lib/form-utils.ts` | - Validation rules per field type: email format, required check, number min/max<br>- Server-side validation in `submitFormResponse()`<br>- Client-side validation before submit | 45min |
| 3.5 | Build share form modal/dialog | `src/components/form-builder/ShareFormDialog.tsx` | - Shows public URL<br>- Copy-to-clipboard button<br>- QR code (optional)<br>- Only visible for published forms | 30min |

**Acceptance Criteria:**
- Public user can visit `/forms/submit/xyz` and see the form
- Public user fills in fields, submits, sees thank-you message
- Validation errors show inline on the form
- Form creator can visit `/forms/$formId/submissions` and see all responses
- Unpublished forms return 404 for public users

**Risks:**
- No CSRF protection needed — TanStack Start handles this via server functions.
- Large submissions: paginate the submissions list (limit 50 per page).

---

### Sprint 4 — Payment Gateway Architecture (Estimated: 5-6 hours)

**Goal:** Build an extensible payment gateway system where adding a new gateway = adding one file.

**Dependencies:** Sprint 0 complete (payment tables exist).

**Tasks:**

| # | Task | File(s) | Acceptance Criteria | Effort |
|---|------|---------|-------------------|--------|
| 4.1 | Design and implement abstract base class/interface | `src/integrations/payments/base.ts` | - Abstract class `PaymentGateway` with:<br>  - `getGatewaySlug()`: returns string slug<br>  - `getGatewayName()`: returns display name<br>  - `createPayment(amount, currency, metadata)`: returns `PaymentResult`<br>  - `verifyPayment(gatewayPaymentId)`: returns `PaymentStatus`<br>  - `getConfigSchema()`: returns JSON schema for form-level configuration | 45min |
| 4.2 | Define shared types | `src/integrations/payments/types.ts` | - `PaymentRequest`: amount, currency, metadata, returnUrl, cancelUrl<br>- `PaymentResult`: success, paymentUrl (redirect), gatewayPaymentId, error<br>- `PaymentStatus`: enum (pending, completed, failed, refunded)<br>- `GatewayConfig`: gateway-specific settings | 30min |
| 4.3 | Implement payment gateway registry | `src/integrations/payments/registry.ts` | - `registerGateway(gateway: PaymentGateway)`: adds to registry<br>- `getGateway(slug)`: returns gateway instance<br>- `getAllGateways()`: returns all registered gateways<br>- `getActiveGateways()`: returns gateways with `is_active` in DB<br>- Registry is populated at app startup from DB table | 45min |
| 4.4 | Implement PayPal gateway | `src/integrations/payments/paypal/gateway.ts` | - Implements `PaymentGateway`<br>- Uses PayPal REST API (Orders API v2)<br>- Sandbox/Live mode via env config<br>- `createPayment`: creates PayPal order, returns approval URL<br>- `verifyPayment`: captures order and verifies status | 1.5h |
| 4.5 | Implement Xendit gateway | `src/integrations/payments/xendit/gateway.ts` | - Implements `PaymentGateway`<br>- Uses Xendit Invoice API or Payment Request API<br>- `createPayment`: creates Xendit invoice, returns invoice URL<br>- `verifyPayment`: checks invoice status | 1.5h |
| 4.6 | Create API endpoints for payment processing | `src/routes/api/payments/$gateway.ts` | - POST `/api/payments/paypal`: creates payment, returns approval URL<br>- POST `/api/payments/paypal/verify`: verifies completed payment<br>- POST `/api/payments/xendit`: creates invoice<br>- POST `/api/payments/xendit/callback`: webhook handler (Xendit sends callbacks) | 1h |
| 4.7 | Add payment configuration schema to settings | `src/integrations/payments/base.ts` (configSchema), `registry.ts` | - Each gateway declares what config fields it needs (e.g., merchant ID, webhook secret)<br>- Config schema is used to render dynamic settings UI in Sprint 5 | 30min |
| 4.8 | Write developer documentation for adding new gateways | `docs/adding-payment-gateways.md` | - Step-by-step: create file, extend class, register<br>- Template code snippet for a new gateway stub | 30min |

**Acceptance Criteria:**
- Registry holds PayPal and Xendit gateways
- `getAllGateways()` returns 2 gateways
- PayPal gateway: can create order, return approval URL, verify capture
- Xendit gateway: can create invoice, verify status
- Adding a new gateway requires ONE new file in `integrations/payments/` + one-line registration
- Developer docs explain the pattern clearly

**Risks:**
- PayPal/Xendit require API keys. These go in `.env.local` as `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `XENDIT_SECRET_KEY`.
- Xendit webhooks need a public URL. Use Clerk webhook approach or configure in dashboard.
- Both gateways are external services — tests should mock them.

---

### Sprint 5 — Payment-Enabled Forms (Estimated: 6-7 hours)

**Goal:** Form creators can attach payments to forms; submitters can pay via a gateway.

**Dependencies:** Sprint 2 and Sprint 4 complete.

**Tasks:**

| # | Task | File(s) | Acceptance Criteria | Effort |
|---|------|---------|-------------------|--------|
| 5.1 | Build PaymentField component | `src/components/form-builder/fields/PaymentField.tsx` | - New field type "payment" in palette<br>- Configurable: amount, currency, gateway selector (if multiple active)<br>- Preview shows a price display + "Pay with [Gateway]" button | 1h |
| 5.2 | Build Form Settings page (payment config) | `src/routes/forms/$formId/settings.tsx` | - Tabbed settings: General (rename), Payment<br>- Payment tab: enable/disable payment for form<br>- If enabled: select gateway, set amount + currency<br>- Saves to `form_payment_configs` table | 1.5h |
| 5.3 | Integrate payment into form submission flow | `src/routes/forms/submit/$formId.tsx` | - If form has payment enabled, show PaymentField at end of form<br>- On submit: first create payment via gateway, redirect user to payment page<br>- After payment success: confirm submission<br>- Handle payment failure: show error, allow retry | 2h |
| 5.4 | Build payment callback/return handler | `src/routes/api/payments/$gateway.ts` | - PayPal: handle return URL after payer approval, capture payment, store in `payments` table, complete submission<br>- Xendit: handle webhook callback, verify status, store in `payments` table, complete submission | 1.5h |
| 5.5 | Show payment status in submissions view | `src/routes/forms/$formId/submissions.tsx` | - Each submission row shows payment status (paid/unpaid/failed/refunded)<br>- Amount column shows currency + amount<br>- Link to gateway transaction page | 30min |
| 5.6 | Add payment badge and indicators | `src/components/ui/Badge.tsx` | - Badge variants for payment status: paid (green), unpaid (amber), failed (red), refunded (gray) | 30min |

**Acceptance Criteria:**
- Form creator can enable payment on a form
- Creator can set amount, currency, and choose gateway
- Public submitter sees a payment section at the end of the form
- Submitter is redirected to PayPal/Xendit to complete payment
- After successful payment, submission is recorded with payment status "paid"
- Failed/cancelled payments show appropriate status
- Form creator can see payment status per submission in dashboard

**Risks:**
- Asynchronous payment flow is complex. Use a state machine pattern for submission status: `pending_payment` → `paid` or `failed`.
- Webhooks may be delayed. Implement a reconciliation job that checks pending payments periodically.

---

### Sprint 6 — Design Alignment & Polish (Estimated: 4-5 hours)

**Goal:** Make all UI components match the DESIGN.md specification and polish the UX.

**Dependencies:** All previous sprints.

**Tasks:**

| # | Task | File(s) | Acceptance Criteria | Effort |
|---|------|---------|-------------------|--------|
| 6.1 | Apply DESIGN.md colors to Tailwind theme | `src/styles.css` | - Define CSS variables or Tailwind v4 theme tokens for: canvas, surface-card, surface-dark, primary, ink, body, muted, hairline, etc.<br>- Ensure all components reference these tokens | 1h |
| 6.2 | Apply DESIGN.md typography | `src/styles.css` | - Configure Inter as body font (available via Google Fonts)<br>- Configure Copernicus/Tiempos Headline substitute (Cormorant Garamond) for headings<br>- Set up font sizes matching the hierarchy table | 1h |
| 6.3 | Apply DESIGN.md spacing and layout | All components | - Use spacing tokens: md(16), lg(24), xl(32), xxl(48), section(96)<br>- Card padding = xl(32px)<br>- Section gaps = section(96px) | 30min |
| 6.4 | Apply DESIGN.md border radius and elevation | All components | - Buttons/inputs: rounded-md(8px)<br>- Cards: rounded-lg(12px)<br>- No shadows on cream surfaces; only hairline borders | 30min |
| 6.5 | Add responsive behavior | All routes | - Mobile: hamburger nav, single-column layouts, stacked cards<br>- Tablet: 2-column grids<br>- Desktop: full layouts as designed<br>- Touch targets ≥ 40px | 1.5h |
| 6.6 | Add loading states and error handling | All routes | - Suspense boundaries per route<br>- Loading skeletons for form list, builder, submissions<br>- Error boundaries with retry buttons<br>- Toast notifications for save/delete/submit actions | 1h |

**Acceptance Criteria:**
- All pages match the DESIGN.md color palette (cream canvas, coral primary, dark surfaces)
- Typography uses the correct hierarchy (serif headings, sans body)
- Spacing follows the 4px base system with correct section/card padding
- Responsive layouts work on mobile, tablet, and desktop
- Loading states and errors are handled gracefully

---

## Dependency Graph

```
Sprint 0 (DB Schema)
    ↓
Sprint 1 (Dashboard & Form CRUD)
    ↓
Sprint 2 (Form Builder & Preview) ──→ Sprint 3 (Form Submission & Responses)
    ↓                                         ↓
Sprint 4 (Payment Gateway Architecture) ────→ Sprint 5 (Payment-Enabled Forms)
    ↓                                         ↓
    └────────── Sprint 6 (Design & Polish) ←──┘
```

**Critical Path:** Sprint 0 → Sprint 1 → Sprint 2 → Sprint 5 (longest chain)

**Parallelizable:**
- Sprint 4 can start after Sprint 0 (no dependency on Sprints 1-3)
- Sprint 3 starts after Sprint 2
- Sprint 6 is the final polish pass

---

## Effort Summary

| Sprint | Focus | Effort Estimate |
|--------|-------|----------------|
| Sprint 0 | Project Foundation | 2-3 hours |
| Sprint 1 | Dashboard & Form CRUD | 4-5 hours |
| Sprint 2 | Form Builder & Preview | 8-10 hours |
| Sprint 3 | Form Submission & Responses | 4-5 hours |
| Sprint 4 | Payment Gateway Architecture | 5-6 hours |
| Sprint 5 | Payment-Enabled Forms | 6-7 hours |
| Sprint 6 | Design Alignment & Polish | 4-5 hours |
| **Total** | | **33-41 hours** |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Drag-and-drop library compatibility | Medium | High | Test `@dnd-kit` with TanStack Start early; fall back to simple click-to-add pattern |
| Payment gateway API changes | Low | High | Abstract base class isolates gateway code; update one file per breaking change |
| Clerk webhook unreliability | Low | Medium | Poll for profile on first dashboard visit as fallback |
| Vite 8 / Vite plugin conflicts | Medium | High | Already encountered with `vite-plugin-neon-new`; use `--legacy-peer-deps` pattern |
| Paypal/Xendit sandbox credentials | Low | Medium | Document env vars needed; provide test mode instructions |
| Form builder performance with many fields (50+) | Low | Medium | Virtualize field list; debounce auto-save |

---

## Post-Completion

After the implementation plan is verified and approved:

1. Begin Sprint 0 — Database schema extension and migration
2. Proceed sequentially through sprints, using the dependency graph
3. After each sprint, verify acceptance criteria before moving to next
4. Sprint 6 can be partially parallelized with earlier sprints (apply design tokens as you build components)
