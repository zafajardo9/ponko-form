# FT-003: Services Integration

> **Feature Plan** — Runtime service execution layer. This plan details how configured integrations (from FT-002) are *used* during form submission, flow execution, and post-submission lifecycle events. FT-002 stores credentials; FT-003 makes them *do things*.

**Status:** 🚧 **Planned** — not yet implemented

**Dependencies:**
- ✅ **FT-002 (Integrations Hub)** — credential storage in `integrations` table + UI for configuration
- ⬜ **FT-004 (Notifications/Email)** — per-form notification recipients, CC options
- ⬜ **FT-006 (Table View / Submissions)** — submission viewer integrates with export/view services

**Cali will have the services and I will have the integration to show in here.**

| Who | Scope |
|---|---|
| **Cali (Services)** | Implement the actual SDK/API calls for each provider — the `src/integrations/services/` layer. Each service module takes a decrypted config + context and performs the external action (send email, create sheet row, etc.) |
| **Me (Integration)** | Wire services into the system at the right lifecycle hooks — form submission, flow execution, payment processing. Build the UI surfaces that let users *select* which services to attach to a form, view service execution status, and handle errors. Expose availability checks so the UI knows when a service is ready to use. |

---

## 1. System Context — Where Services Plug In

The PonkoForm app has three main lifecycle hooks where services execute:

```
┌──────────────────────────────────────────────────────────────┐
│                     FORM LIFECYCLE                           │
│                                                              │
│  1. BUILD  ──►  2. PUBLISH  ──►  3. SUBMIT  ──►  4. POST   │
│  (dashboard)    (dashboard)     (respondent)    (background) │
│                                                              │
│  Services configured per-form by the creator in step 1-2.   │
│  Services execute in step 3-4 when a respondent submits.    │
└──────────────────────────────────────────────────────────────┘
```

### Execution Points

| Hook | When | Services That Fire | Notes |
|---|---|---|---|
| **Flow Node: Payment** | Respondent reaches a Payment node in the flow | Payment gateways (Stripe, PayPal, Xendit, PayMongo, Maya) | Already exists via `PaymentGateway` abstract class + registry. Credentials come from `loadIntegrationConfigs()` which now reads the new `integrations` table. |
| **Flow Node: Summary / End** | Flow execution completes | Email notifications, Google Sheets sync, Google Calendar event, Calendly booking confirmation | This is the primary new work. |
| **Form Submit (Linear)** | Traditional linear form submission | Same as Summary/End above | Linear forms without a flow still need email + export services. |
| **Post-Submit Poll / Webhook** | Payment confirmation arrives asynchronously | Email receipts, sheet row updates | After payment status changes from pending → completed/failed. |
| **Admin Trigger** | Form creator clicks "Export to Sheets" or "Send Test Email" | Google Sheets sync, test email send | Manual triggers from the dashboard. |

---

## 2. Service Catalog — What We're Building

Each service listed below is a module that Cali implements as `src/integrations/services/<provider>.ts`. My job is to wire each one into the correct lifecycle hook and build the UI for per-form service configuration.

### 2.1 📬 Email Services

Both SMTP and Resend share a common interface — given a recipient, subject, and body, send an email.

| # | Provider | Config Source | Service Module | Integration Surface |
|---|---|---|---|---|
| E1 | **SMTP** | `integrations` row (`provider='smtp'`) → decrypt → `SmtpConfig` | `src/integrations/services/smtp.ts` | Email notification when form is submitted (per FT-004). "Test send" button in settings. |
| E2 | **Resend** | `integrations` row (`provider='resend'`) → decrypt → `ResendConfig` | `src/integrations/services/resend.ts` | Same as SMTP. Also used for branded transactional emails via React Email templates. |

**Interface (Cali implements):**
```ts
// src/integrations/services/email.ts — shared interface
export interface EmailMessage {
  to: string | string[]
  subject: string
  body: string // HTML or plain text
  from?: string
  cc?: string[]
}

export interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
}

export type EmailSender = (config: unknown, message: EmailMessage) => Promise<EmailResult>
```

### 2.2 📊 Data Export — Google Sheets

Sync each form submission as a new row in a Google Sheet.

| # | Provider | Config Source | Service Module | Integration Surface |
|---|---|---|---|---|
| D1 | **Google Sheets** | `integrations` row (`provider='google-sheets'`) → decrypt → `GoogleSheetsConfig` (OAuth tokens + spreadsheetId) | `src/integrations/services/google-sheets.ts` | Per-form toggle: "Sync submissions to Google Sheets". Mapping of form fields → sheet columns. "Export now" button on submissions page (FT-006). |

**Interface:**
```ts
export interface SheetRowData {
  values: (string | number | boolean | null)[]
}

export interface SheetsService {
  appendRow(spreadsheetId: string, range: string, data: SheetRowData): Promise<string> // returns updated range
  getHeaders(spreadsheetId: string, range: string): Promise<string[]>
}
```

### 2.3 🧠 AI — Google Gemini

AI-powered features within the form builder and flow builder.

| # | Provider | Config Source | Service Module | Integration Surface |
|---|---|---|---|---|
| A1 | **Google Gemini** | `integrations` row (`provider='gemini'`) → decrypt → `GeminiConfig` | `src/integrations/services/gemini.ts` | "Suggest fields" button in form builder — generates field ideas from a prompt. "Smart auto-fill" suggestions during form filling. "Generate flow from description" — prompt to flow nodes. |

**Interface:**
```ts
export interface GeminiPrompt {
  systemPrompt?: string
  userPrompt: string
  temperature?: number
  maxTokens?: number
}

export interface GeminiResult {
  text: string
  usage?: { promptTokens: number; completionTokens: number }
}
```

### 2.4 📅 Scheduling — Google Calendar & Calendly

Create calendar events automatically on form submission, or embed scheduling.

| # | Provider | Config Source | Service Module | Integration Surface |
|---|---|---|---|---|
| S1 | **Google Calendar** | `integrations` row (`provider='google-calendar'`) → decrypt → `GoogleCalendarConfig` (OAuth tokens + calendarId) | `src/integrations/services/google-calendar.ts` | Per-form: "Create calendar event on submission". Map form fields → event title, description, start/end time, attendees. |
| S2 | **Calendly** | `integrations` row (`provider='calendly'`) → decrypt → `CalendlyConfig` | `src/integrations/services/calendly.ts` | Embed a Calendly booking link in a Flow Builder step (Flow Node type: `calendly` or a custom redirect). Auto-populate invitee details from form fields. |

**Interface for Google Calendar:**
```ts
export interface CalendarEvent {
  summary: string
  description?: string
  startDateTime: string // ISO 8601
  endDateTime: string
  attendees?: string[] // emails
  location?: string
}

export interface CalendarResult {
  success: boolean
  eventId?: string
  htmlLink?: string
  error?: string
}
```

### 2.5 ☁️ File Storage — ImageKit & Cloudinary

Handle file uploads from form fields (future: `file` field type).

| # | Provider | Config Source | Service Module | Integration Surface |
|---|---|---|---|---|
| F1 | **ImageKit** | `integrations` row (`provider='imagekit'`) → decrypt → `ImageKitConfig` | `src/integrations/services/imagekit.ts` | Per-form file uploads for a new `file` field type in the form builder. Transforms (resize, crop) configurable per field. |
| F2 | **Cloudinary** | `integrations` row (`provider='cloudinary'`) → decrypt → `CloudinaryConfig` | `src/integrations/services/cloudinary.ts` | Same as ImageKit — alternative provider. |

**Interface:**
```ts
export interface FileUpload {
  fileName: string
  fileData: Blob | Buffer
  mimeType: string
  folder?: string
}

export interface UploadResult {
  success: boolean
  url?: string
  publicId?: string
  error?: string
}
```

### 2.6 💳 Payment Services (Existing — Extend)

Payments already have a `PaymentGateway` abstract class with `PayPal` and `Xendit` implementations. The FT-003 work here is:

| # | Provider | Status | Work |
|---|---|---|---|
| P1 | **PayPal** | ✅ Implemented | No change needed. Already reads credentials from `loadIntegrationConfigs()`. |
| P2 | **Xendit** | ✅ Implemented | No change needed. |
| P3 | **Stripe** | 🚧 Cali to build | New `StripeGateway` extending `PaymentGateway`. Registration in `paymentRegistry`. |
| P4 | **PayMongo** | 🚧 Cali to build | New `PayMongoGateway`. |
| P5 | **Maya** | 🚧 Cali to build | New `MayaGateway`. |

---

## 3. Per-Form Service Configuration (DB Schema)

Users need to select *which* services fire for *which* forms. The credentials are global (per-profile), but the activation is per-form.

### 3.1 New Table: `form_service_configs`

```sql
CREATE TABLE form_service_configs (
  id            SERIAL PRIMARY KEY,
  form_id       INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  provider      VARCHAR(50) NOT NULL,  -- matches integrations.provider
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  config        JSONB NOT NULL DEFAULT '{}',
  -- config shape depends on provider:
  --   email:     { recipients: string[], cc?: string[], subject?: string, bodyTemplate?: string }
  --   sheets:    { spreadsheetId: string, sheetName: string, fieldMapping: Record<string, string> }
  --   calendar:  { titleTemplate: string, descriptionTemplate?: string, attendeeField?: string }
  --   calendly:  { bookingUrl: string, prefillFields: Record<string, string> }
  --   ai:        { features: string[] }  -- which AI features are enabled
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE(form_id, provider)
);
```

### 3.2 New Enum: `service_execution_status`

```sql
CREATE TYPE service_execution_status AS ENUM (
  'pending',
  'running',
  'completed',
  'failed',
  'skipped'
);
```

### 3.3 New Table: `service_execution_logs`

Tracks every service execution for observability and debugging.

```sql
CREATE TABLE service_execution_logs (
  id                  SERIAL PRIMARY KEY,
  form_submission_id  INTEGER NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
  provider            VARCHAR(50) NOT NULL,
  status              service_execution_status NOT NULL DEFAULT 'pending',
  request_summary     JSONB,          -- non-sensitive: recipient list, spreadsheet ID, etc.
  result_summary      JSONB,          -- non-sensitive: messageId, event link, rows appended
  error_message       TEXT,
  started_at          TIMESTAMP,
  completed_at        TIMESTAMP,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

## 4. Service Execution Engine

The heart of FT-003 is a **post-submission hook** that fans out to all configured services for a form. This runs *after* a form submission is persisted and *after* any payment is confirmed.

### 4.1 Architecture

```
Form Submission Complete
         │
         ▼
┌─────────────────────────────────────┐
│   SERVICE DISPATCHER                │
│   (src/integrations/services/       │
│    dispatcher.ts)                   │
│                                     │
│   1. Query form_service_configs     │
│      WHERE form_id = $1 AND        │
│            enabled = TRUE           │
│                                     │
│   2. For each config:              │
│      a. Load credentials from      │
│         integrations table          │
│      b. Decrypt credentials         │
│      c. Call service module         │
│      d. Log result to               │
│         service_execution_logs      │
│                                     │
│   All services run in parallel      │
│   (failure of one doesn't block     │
│    others — fire-and-forget fanout) │
└─────────────────────────────────────┘
```

### 4.2 Dispatcher Interface (Cali implements the modules, I wire them)

```ts
// src/integrations/services/dispatcher.ts

import type { ProviderSlug } from '../../lib/integrations/types'

export interface ServiceContext {
  formId: number
  submissionId: number
  formData: Record<string, unknown>  // the submitted form values
  profileId: number                    // the form owner
  formTitle: string
  submittedAt: Date
}

export interface ServiceExecutionResult {
  provider: ProviderSlug
  success: boolean
  summary?: Record<string, unknown>
  error?: string
}

/**
 * Called after a form submission is persisted. Runs all enabled services
 * for the form in parallel. Non-blocking — failures are logged, not thrown.
 */
export async function dispatchServices(
  ctx: ServiceContext
): Promise<ServiceExecutionResult[]>
```

### 4.3 Wiring Into Existing Flow

**Flow Mode (Flow Builder):**

The flow execution engine currently stops at the Summary/End node. After the flow execution completes and the `formSubmissions` row is created, inject:

```
flowExecution.status → 'completed'
formSubmission row created
     │
     ▼
dispatchServices(ctx)
     │
     ▼
Show "Thank You" / Summary to respondent
```

This is non-blocking — the respondent sees the success page immediately while services dispatch in the background.

File to modify: `src/lib/server-fns/flow-executions.ts` — the `completeExecution` function.

**Linear Form Mode:**

Traditional linear forms call `createFormSubmission()` already. Add `dispatchServices()` after the insert.

File to modify: `src/lib/server-fns/submissions.ts` — the `submitForm` server function.

---

## 5. UI Surfaces — Per-Form Service Settings

### 5.1 Where It Lives

Each form's **Settings** tab or a new **Integrations** sub-tab within the form editor.

Currently the form editor has tabs like Fields, Flow, Preview, Settings. Add an **"Automations"** tab (or "Services") that lists all configured integrations and lets the creator toggle + configure them per form.

### 5.2 Component Tree

```
Form Editor
  └── Tabs: [Fields] [Flow] [Automations] [Preview] [Settings]
       └── FormServicesPanel.tsx        ← NEW
            ├── ServiceToggleCard.tsx   ← per-service toggle (email, sheets, etc.)
            │    ├── Toggle switch (enabled/disabled)
            │    ├── "Configure" button → opens modal
            │    └── Status badge (configured / needs credentials / error)
            └── ServiceConfigModal.tsx  ← per-service detailed config
                 ├── Email: recipient field mapping (which form field = email address)
                 ├── Sheets: column → field mapping
                 ├── Calendar: event template with variable interpolation
                 └── etc.
```

### 5.3 Availability Gating

Services are only available if the user has credentials configured in FT-002:

```
formServicesPanel reads → getIntegrations()  (from FT-002 server fns)
  → shows only providers where configured === true
  → shows "Set up in Integrations Hub ↗" link for unconfigured ones
```

### 5.4 Mockup — FormServicesPanel

```
┌─────────────────────────────────────────────────────────┐
│  Automations                      [Integrations Hub ↗]  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ 📬 Email Notifications                   [ON ●] │    │
│  │ Send emails when this form is submitted.        │    │
│  │ Recipients: creator@email.com, admin@email.com  │    │
│  │                               [Configure]       │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ 📊 Google Sheets Sync                   [OFF ○] │    │
│  │ Auto-append submissions to a spreadsheet.       │    │
│  │                               [Configure]       │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ 📅 Google Calendar                    [OFF ○] │    │
│  │ Create calendar events on submission.           │    │
│  │ ⚠ Not configured — set up in Integrations Hub   │    │
│  │                         [Set Up in Hub ↗]       │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │ 🧠 Gemini AI Suggestions                [ON ●] │    │
│  │ AI-powered field suggestions for form builder.  │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## 6. Execution Logs UI — Submission Detail

When viewing a submission (FT-006 — submissions table), show what services ran and their status:

```
Submission #42 — Jane Doe — 2026-01-15 14:30

Form Data:
  Name: Jane Doe
  Email: jane@example.com
  ...

Service Executions:
  ✅ Email Notification   → Sent to jane@example.com (msg_abc123)
  ✅ Google Sheets Sync   → Row 142 appended to "Submissions" sheet
  ❌ Google Calendar      → Failed: invalid date format in field "start_time"
```

This reads from `service_execution_logs` joined with the submission.

---

## 7. Connection to Other Feature Plans

| FT | Relationship |
|---|---|
| **FT-002 (Integrations Hub)** | FT-003 *uses* credentials stored by FT-002. The Integrations Hub is the "settings" layer; Services Integration is the "action" layer. |
| **FT-004 (Notifications/Email/CC)** | Email service config (recipients, CC, subject template) comes from FT-004's per-form notification settings. FT-003's email service module is the *sender*; FT-004 defines *who gets what*. |
| **FT-005 (Precreated Field Groups)** | Gemini AI can suggest field groups based on a description ("personal details" → name + email + phone fields). The AI service module generates the suggestion; FT-005's UI renders the precreated group. |
| **FT-006 (Table View / Submissions)** | The submissions table shows service execution status per submission. The "Export to Sheets" button triggers the Google Sheets service on demand. |
| **FT-001 (Onboarding)** | Onboarding Step 6 (Payments) shows the payment gateway config. Step 7 (Preview & Publish) could mention automations. |

---

## 8. File Change Summary

### Cali's Scope (Service Modules)

| File | Purpose |
|---|---|
| `src/integrations/services/email.ts` | Shared email service interface |
| `src/integrations/services/smtp.ts` | `smtpSender(config: SmtpConfig, msg: EmailMessage) → EmailResult` |
| `src/integrations/services/resend.ts` | `resendSender(config: ResendConfig, msg: EmailMessage) → EmailResult` |
| `src/integrations/services/google-sheets.ts` | `sheetsService` — append rows, get headers |
| `src/integrations/services/gemini.ts` | `geminiGenerate(prompt: GeminiPrompt) → GeminiResult` |
| `src/integrations/services/google-calendar.ts` | `calendarService` — create events |
| `src/integrations/services/calendly.ts` | `calendlyService` — embed, prefill |
| `src/integrations/services/imagekit.ts` | `imagekitService` — upload, transform |
| `src/integrations/services/cloudinary.ts` | `cloudinaryService` — upload, transform |
| `src/integrations/services/index.ts` | Barrel export of all service modules |
| `src/integrations/payments/stripe/gateway.ts` | `StripeGateway extends PaymentGateway` |
| `src/integrations/payments/paymongo/gateway.ts` | `PayMongoGateway extends PaymentGateway` |
| `src/integrations/payments/maya/gateway.ts` | `MayaGateway extends PaymentGateway` |

### My Scope (Integration + Wiring)

| File | Purpose |
|---|---|
| `src/db/schema.ts` | Add `form_service_configs`, `service_execution_status` enum, `service_execution_logs` tables |
| `src/integrations/services/dispatcher.ts` | `dispatchServices()` — fan-out execution engine |
| `src/lib/server-fns/submissions.ts` | Inject `dispatchServices()` after form submission |
| `src/lib/server-fns/flow-executions.ts` | Inject `dispatchServices()` after flow completion |
| `src/lib/server-fns/form-services.ts` | Server functions: CRUD for `form_service_configs`, read `service_execution_logs` |
| `src/components/form-builder/FormServicesPanel.tsx` | Per-form automations toggle panel |
| `src/components/form-builder/ServiceToggleCard.tsx` | Individual service toggle card |
| `src/components/form-builder/ServiceConfigModal.tsx` | Per-service configuration modal |
| `src/components/submissions/SubmissionServiceLog.tsx` | Service execution log row in submission detail |
| `src/routes/forms/$formId.tsx` | Add "Automations" tab to form editor |
| `src/routes/forms/$formId/submissions.tsx` | Show service execution logs per submission |

---

## 9. Database Migration Plan

```ts
// Migration 1: service_execution_status enum + form_service_configs + service_execution_logs
export const serviceExecutionStatusEnum = pgEnum('service_execution_status', [
  'pending', 'running', 'completed', 'failed', 'skipped',
])

export const formServiceConfigs = pgTable('form_service_configs', {
  id: serial().primaryKey(),
  formId: integer('form_id').notNull().references(() => forms.id, { onDelete: 'cascade' }),
  provider: varchar('provider', { length: 50 }).notNull(),
  enabled: boolean('enabled').notNull().default(true),
  config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [uniqueIndex('form_services_form_provider_idx').on(table.formId, table.provider)])

export const serviceExecutionLogs = pgTable('service_execution_logs', {
  id: serial().primaryKey(),
  formSubmissionId: integer('form_submission_id').notNull().references(() => formSubmissions.id, { onDelete: 'cascade' }),
  provider: varchar('provider', { length: 50 }).notNull(),
  status: serviceExecutionStatusEnum('status').notNull().default('pending'),
  requestSummary: jsonb('request_summary').$type<Record<string, unknown>>(),
  resultSummary: jsonb('result_summary').$type<Record<string, unknown>>(),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [index('service_logs_submission_idx').on(table.formSubmissionId)])
```

---

## 10. Step-by-Step Tasks

### Task 1: DB Migration — `form_service_configs` + `service_execution_logs`
- Add enums and tables to `src/db/schema.ts`
- Run `pnpm run db:generate` + `db:migrate`

### Task 2: Service Module Interfaces (with Cali coordination)
- Define shared interfaces in `src/integrations/services/` (email, sheets, calendar, ai, storage)
- Cali implements each module; I import and type-check against interfaces

### Task 3: Service Dispatcher Engine
- Build `dispatchServices()` in `src/integrations/services/dispatcher.ts`
- Parallel fan-out, error isolation, logging to `service_execution_logs`

### Task 4: Wire Dispatcher Into Submission Flow
- Modify `src/lib/server-fns/submissions.ts` — call dispatcher after linear form submission
- Modify `src/lib/server-fns/flow-executions.ts` — call dispatcher after flow completion
- Ensure non-blocking (respondent sees success page immediately)

### Task 5: Per-Form Service Config Server Functions
- Build `src/lib/server-fns/form-services.ts`
- CRUD for `form_service_configs`
- Read `service_execution_logs` by submission

### Task 6: FormServicesPanel UI
- Build `FormServicesPanel.tsx`, `ServiceToggleCard.tsx`, `ServiceConfigModal.tsx`
- Add "Automations" tab to form editor route
- Gating: only show services where credentials exist (from FT-002's `getIntegrations()`)

### Task 7: Submission Service Log UI
- Build `SubmissionServiceLog.tsx`
- Integrate into submission detail view (FT-006)

### Task 8: End-to-End Testing
- Configure all providers in Integrations Hub
- Enable services per form
- Submit a form → verify emails sent, sheets row appended, calendar events created
- Verify execution logs show correct statuses

---

## 11. Risks & Open Questions

| Risk | Mitigation |
|---|---|
| **Third-party API failures** shouldn't block form submission | Dispatcher is fire-and-forget; failures are logged. Respondent always sees success. |
| **Rate limits** (Resend free tier: 100/day, Gemini quotas) | Display rate limit warnings in UI. Queue/batch where possible. |
| **OAuth token expiry** (Google Sheets/Calendar) | Implement token refresh in Cali's service modules. Log refresh failures. |
| **Email template injection** | Sanitize form data before inserting into email body. Use template variables (`{{field_name}}`) not raw interpolation. |
| **Performance** — dispatching 5+ services per submission | Run them in parallel with `Promise.allSettled()`. Each service has a timeout (30s default). |
| **What if a user removes credentials while a form has services enabled?** | Before dispatching, check if credentials still exist. If missing → status = `skipped`, log reason. UI shows "⚠ Credentials removed" on the form's automations panel. |

---

## 12. Validation / Testing

- [ ] Unit test: dispatcher fans out to all configured services
- [ ] Unit test: dispatcher handles one service failing without blocking others
- [ ] Unit test: dispatcher logs every execution to `service_execution_logs`
- [ ] Integration test: SMTP send with test credentials (use ethereal.email)
- [ ] Integration test: Google Sheets append (use a test spreadsheet)
- [ ] E2E test: Form submit → email received, sheet row exists, calendar event created
- [ ] UI test: FormServicesPanel shows/hides based on credential state
- [ ] UI test: Submission detail shows service execution logs
