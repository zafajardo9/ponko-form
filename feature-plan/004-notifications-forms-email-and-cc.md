# FT-004: Form Notifications — Email & Recipients

> **Feature Plan** — Per-form email notification settings. Form creators configure up to two notification channels: a **respondent confirmation** sent to the person who submitted the form, and **admin alerts** sent to the form owner and any additional recipients (with CC support). Both channels have independent toggles, subject lines, and message body templates that can interpolate submitted form values.

**Status:** ✅ **Implemented** — respondent confirmation emails (subject/body templates, CC, test send) via `form_confirmation_configs` + `src/lib/email/`; dispatched on every submission path (page, flow, linear)

**Dependencies:**
- ✅ **FT-002 (Integrations Hub)** — email credentials (SMTP or Resend) must be configured before emails can send
- 🚧 **FT-003 (Services Integration)** — the email service module + dispatcher are what actually send the emails; FT-004 feeds them the recipient list, subject, and body

---

## 1. User Story

> *"I have a registration form. When someone submits it, I want them to get a confirmation email that says 'Thanks, {{name}}! We received your registration.' At the same time, I want my admin team (me, my co-organizer, and our shared inbox) to get a notification that says 'New registration from {{name}} ({{email}}).' I want to CC our finance person on the admin notification too."*

---

## 2. Notification Channels

| Channel | Recipients | Purpose | Example |
|---|---|---|---|
| **Respondent Confirmation** | The person who submitted the form (email extracted from a form field) | Receipt, thank-you, next steps | "Thanks for signing up! We'll be in touch." |
| **Admin Alert** | Form owner + manually entered email addresses + CC list | Real-time notification of new submissions | "New submission: John Doe (john@email.com) just registered." |

### Why Two Separate Channels

They serve different audiences with different message content:
- The **respondent** needs a friendly confirmation — their own submitted data, a reference number, next steps.
- The **admin** needs an at-a-glance notification — who submitted, link to view full submission, payment status (if applicable).

Both are optional and independently toggled. A form can have neither, one, or both.

---

## 3. DB Schema

### 3.1 New Table: `form_notification_configs`

One row per form (1:1 relationship). Both channels live on the same row for simplicity — they're always loaded together.

```sql
CREATE TABLE form_notification_configs (
  id                        SERIAL PRIMARY KEY,
  form_id                   INTEGER NOT NULL UNIQUE
                              REFERENCES forms(id) ON DELETE CASCADE,

  -- Respondent confirmation
  respondent_enabled        BOOLEAN NOT NULL DEFAULT FALSE,
  respondent_email_field    VARCHAR(255),        -- form field key/variable that holds responder's email
  respondent_subject        VARCHAR(255),        -- "Thanks for your submission, {{name}}!"
  respondent_body           TEXT,                -- HTML or plain text body template

  -- Admin alerts
  admin_enabled             BOOLEAN NOT NULL DEFAULT FALSE,
  admin_emails              TEXT[],              -- ['admin@company.com', 'boss@company.com']
  admin_cc_emails           TEXT[],              -- CC recipients
  admin_subject             VARCHAR(255),        -- "New submission from {{name}}"
  admin_body                TEXT,

  created_at                TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 3.2 Template Variables

Both subject and body support `{{variable_name}}` interpolation using the submitted form data. Example template:

```
Subject: Registration confirmed — {{name}}
Body:
  <h1>Thanks, {{name}}!</h1>
  <p>We received your registration for {{event_name}} on {{event_date}}.</p>
  <p>Reference: #{{submission_id}}</p>
```

**Available variables:**
- Any form field's variable name (flow mode) or field label (linear mode)
- `{{submission_id}}` — the database ID of the submission
- `{{form_title}}` — the name of the form
- `{{submitted_at}}` — ISO 8601 timestamp
- `{{payment_status}}` — if applicable: "paid", "pending", "failed"
- `{{payment_amount}}` — formatted amount with currency

### 3.3 Drizzle Schema

```ts
export const formNotificationConfigs = pgTable('form_notification_configs', {
  id: serial().primaryKey(),
  formId: integer('form_id').notNull().unique().references(() => forms.id, { onDelete: 'cascade' }),
  
  // Respondent
  respondentEnabled: boolean('respondent_enabled').notNull().default(false),
  respondentEmailField: varchar('respondent_email_field', { length: 255 }),
  respondentSubject: varchar('respondent_subject', { length: 255 }),
  respondentBody: text('respondent_body'),
  
  // Admin
  adminEnabled: boolean('admin_enabled').notNull().default(false),
  adminEmails: jsonb('admin_emails').$type<string[]>().default([]),
  adminCcEmails: jsonb('admin_cc_emails').$type<string[]>().default([]),
  adminSubject: varchar('admin_subject', { length: 255 }),
  adminBody: text('admin_body'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
```

---

## 4. Where It Fires — Integration Points

### 4.1 Linear Form Submission

After `submitFormResponse()` inserts the submission row in `src/lib/server-fns/submissions.ts`, the FT-003 dispatcher runs. It will read the form's `form_notification_configs` and, if enabled, send emails via the configured email service (SMTP or Resend).

```
respondent fills form → submitFormResponse() → INSERT form_submissions
  → dispatchServices()        ← FT-003
      → emailService()        ← Cali's email module (SMTP/Resend)
          reads form_notification_configs  ← FT-004
          sends respondent email (if enabled)
          sends admin email (if enabled)
```

**Injection point:** At the end of `submitFormResponse` handler, after the INSERT:
```ts
// After line 118 in submissions.ts
await dispatchServices({ formId: data.formId, submissionId: submission.id, ... })
```

### 4.2 Flow Mode Submission

Same hook — after `completeExecution()` persists the submission:

```
flow completes → completeExecution() → INSERT form_submissions
  → dispatchServices()
      → reads form_notification_configs
      → sends emails
```

**Injection point:** After line 155 in `flow-executions.ts`, in the `completeExecution` handler:
```ts
// After the submission is created
await dispatchServices({ formId: flow.formId, submissionId: submission.id, ... })
```

### 4.3 No Interruption Guarantee

Email sending is **non-blocking**. The respondent always sees the success/thank-you page immediately. If the email service is down or misconfigured, the submission is still recorded, and the failure is logged to `service_execution_logs` (FT-003).

---

## 5. UI — "Notifications" Tab

### 5.1 Tab Placement

The form editor header currently has three tabs:

```
┌──────────────────────────────────────────────────────┐
│  ← Forms / My Registration Form  ┌──────────────┐   │
│  [draft]                          │ ◆ Build      │   │
│                                   │   Responses  │   │
│                                   │   Payments   │   │
│                                   │ ✉ Notifications │ ← NEW
│                                   └──────────────┘   │
└──────────────────────────────────────────────────────┘
```

Add a fourth tab **"Notifications"** linking to a new route: `/forms/$formId/notifications`.

### 5.2 Route

New file: `src/routes/forms/$formId/notifications.tsx`

```ts
export const Route = createFileRoute("/forms/$formId/notifications")({
  beforeLoad: () => requireAuth(),
  component: NotificationSettingsPage,
})
```

### 5.3 Page Layout

```
┌──────────────────────────────────────────────────────────────┐
│  Notifications                                               │
│  Configure emails sent when someone submits this form.       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 📨 RESPONDENT CONFIRMATION                  [ON ● ]  │    │
│  │ A confirmation email sent to the person who         │    │
│  │ submitted the form.                                 │    │
│  │                                                     │    │
│  │ Recipient email field  [email ▼]  ← pick from fields│    │
│  │ Subject  [Thanks for submitting! ____]              │    │
│  │ Body                                                │    │
│  │ ┌──────────────────────────────────────────────┐    │    │
│  │ │ Hi {{name}},                                 │    │    │
│  │ │                                              │    │    │
│  │ │ Thanks for your submission! We'll review it  │    │    │
│  │ │ and get back to you soon.                    │    │    │
│  │ │                                              │    │    │
│  │ │ Reference: #{{submission_id}}                │    │    │
│  │ └──────────────────────────────────────────────┘    │    │
│  │                          Available: {{name}} ...    │    │
│  │                          [Send Test Email]          │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 🔔 ADMIN ALERTS                            [ON ● ]  │    │
│  │ Notify your team when a new submission arrives.     │    │
│  │                                                     │    │
│  │ Primary recipients                                   │    │
│  │ ┌──────────────────────────────────────────────┐    │    │
│  │ │ admin@company.com                       [✕]  │    │    │
│  │ │ boss@company.com                        [✕]  │    │    │
│  │ │ + Add email                               │    │    │
│  │ └──────────────────────────────────────────────┘    │    │
│  │                                                     │    │
│  │ CC recipients                                       │    │
│  │ ┌──────────────────────────────────────────────┐    │    │
│  │ │ finance@company.com                      [✕]  │    │    │
│  │ │ + Add email                               │    │    │
│  │ └──────────────────────────────────────────────┘    │    │
│  │                                                     │    │
│  │ Subject  [New submission from {{name}} ____]         │    │
│  │ Body                                                │    │
│  │ ┌──────────────────────────────────────────────┐    │    │
│  │ │ {{name}} ({{email}}) submitted a response  │    │    │
│  │ │ to {{form_title}}.                          │    │    │
│  │ │ View submission: [link]                     │    │    │
│  │ └──────────────────────────────────────────────┘    │    │
│  │                          [Send Test Email]          │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│                                    [Save Notification Settings] │
└──────────────────────────────────────────────────────────────┘
```

### 5.4 Template Variable Picker

Below each body textarea, show available variables as clickable chips:

```
Insert variable: [{{name}}] [{{email}}] [{{phone}}] [{{submission_id}}] [{{form_title}}] [{{submitted_at}}]
```

Clicking a chip inserts `{{variable_name}}` at the cursor position in the textarea.

### 5.5 "Send Test Email" Button

Each channel has a test button. Clicking it:
1. Saves the current draft (so the latest template is used)
2. Sends a test email to the form owner's own email (for admin alerts) or a manually entered test address (for respondent confirmation)
3. Uses sample/dummy form data so variables render meaningfully

---

## 6. Server Functions

All in a new file: `src/lib/server-fns/notifications.ts`

```ts
// Get notification config for a form (returns null if not configured)
export const getNotificationConfig = createServerFn({ method: 'GET' })
  .inputValidator((data: { formId: number }) => data)
  .handler(async ({ data }) => {...})
// → returns FormNotificationConfig | null

// Save/update notification config
export const saveNotificationConfig = createServerFn({ method: 'POST' })
  .inputValidator((data: { formId: number; config: NotificationConfigInput }) => data)
  .handler(async ({ data }) => {...})
// → upserts form_notification_configs

// Send a test email for a channel
export const sendTestNotification = createServerFn({ method: 'POST' })
  .inputValidator((data: { 
    formId: number; 
    channel: 'respondent' | 'admin'; 
    testEmail?: string 
  }) => data)
  .handler(async ({ data }) => {...})
// → sends to the authenticated user's email using the form's template + sample data
```

---

## 7. How It Feeds FT-003's Dispatcher

The dispatcher (from FT-003) gets a new email-specific handler:

```ts
// Inside src/integrations/services/dispatcher.ts

async function dispatchEmailNotification(ctx: ServiceContext): Promise<ServiceExecutionResult> {
  // 1. Load form_notification_configs WHERE form_id = ctx.formId
  // 2. If respondent_enabled:
  //    a. Extract respondent email from ctx.formData using respondent_email_field
  //    b. Interpolate subject + body with ctx.formData
  //    c. Call emailService.send({ to, subject, body })
  // 3. If admin_enabled:
  //    a. Interpolate admin subject + body
  //    b. Call emailService.send({ to: admin_emails, cc: admin_cc_emails, subject, body })
  // 4. Log results to service_execution_logs
}
```

### Email Resolution for Respondent

The `respondent_email_field` config points to a field key. The dispatcher resolves it from `ctx.formData`:

```ts
const emailField = config.respondentEmailField // e.g., "email" or "contact_email"
const respondentEmail = ctx.formData[emailField] as string | undefined
if (!respondentEmail) {
  // log error: could not resolve respondent email
  return { success: false, error: 'Respondent email field not found in submission' }
}
```

### Email Resolution for Admin

The admin emails are literal addresses entered by the form creator. The form owner's email comes from Clerk's user profile:

```ts
const owner = await getProfileEmail(ctx.profileId) // from Clerk
const adminRecipients = [owner.email, ...config.adminEmails]
```

---

## 8. Variable Interpolation Engine

A shared utility that both FT-004 and other template-based features (like FT-003's summary node) can use.

```ts
// src/lib/template-engine.ts

export interface TemplateContext {
  formData: Record<string, unknown>
  submissionId: number
  formTitle: string
  submittedAt: Date
  paymentStatus?: string
  paymentAmount?: string
}

export function interpolate(template: string, ctx: TemplateContext): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    switch (key) {
      case 'submission_id': return String(ctx.submissionId)
      case 'form_title': return ctx.formTitle
      case 'submitted_at': return ctx.submittedAt.toISOString()
      case 'payment_status': return ctx.paymentStatus ?? 'N/A'
      case 'payment_amount': return ctx.paymentAmount ?? 'N/A'
      default: return String(ctx.formData[key] ?? `{{${key}}}`)
    }
  })
}
```

---

## 9. Templating — Rich Text Support

Both body templates support **Markdown** (converted to HTML for email). This lets form creators use bold, links, lists without needing HTML knowledge:

```markdown
Hi **{{name}}**,

Thanks for submitting! Here's a summary:

- Event: **{{event_name}}**
- Date: {{event_date}}
- Reference: #{{submission_id}}

[View your submission](https://ponkoform.com/submissions/{{submission_id}})
```

The email service converts Markdown → HTML before sending. The textarea editor can include a live preview toggle.

---

## 10. Edge Cases & Validations

| Scenario | Behavior |
|---|---|
| **Respondent email field is empty in submission** | Skip respondent email, log warning to `service_execution_logs` |
| **No email field selected for respondent** | Respondent toggle shows warning: "Select an email field first" |
| **Admin emails list is empty** | Only the form owner gets notified. Toggle stays on. |
| **Email credentials not configured (no SMTP/Resend)** | Notifications tab shows banner: "⚠ Set up email in Integrations Hub first →". Save button disabled. |
| **Template contains unknown variable** | Leave `{{unknown}}` in the output as-is (fail visibly so the creator notices) |
| **Form has no email-type fields** | Respondent channel shows: "⚠ No email fields in this form. Add one in the Build tab." |
| **Duplicate email addresses** (admin + CC) | Deduplicate server-side before sending |

---

## 11. File Change Summary

| File | Purpose |
|---|---|
| `src/db/schema.ts` | Add `form_notification_configs` table |
| `src/lib/template-engine.ts` | `interpolate()` — shared template variable engine |
| `src/lib/server-fns/notifications.ts` | CRUD server functions for notification configs + test send |
| `src/integrations/services/dispatcher.ts` | Add `dispatchEmailNotification()` handler that reads FT-004 config |
| `src/routes/forms/$formId/notifications.tsx` | New route: notifications settings page |
| `src/components/form-builder/NotificationSettingsPanel.tsx` | Main panel component (2 channels) |
| `src/components/form-builder/NotificationChannelCard.tsx` | Per-channel card (respondent or admin) |
| `src/components/form-builder/EmailChipInput.tsx` | Multi-email input with chips + validation |
| `src/components/form-builder/TemplateEditor.tsx` | Textarea with variable chip picker + Markdown preview |
| `src/routes/forms/$formId/edit.tsx` | Add "Notifications" tab link in header nav (line ~607-625) |
| `src/lib/server-fns/submissions.ts` | Wire `dispatchServices()` call after form submission (FT-003 hook) |
| `src/lib/server-fns/flow-executions.ts` | Wire `dispatchServices()` after flow completion (FT-003 hook) |

---

## 12. DB Migration

```bash
pnpm run db:generate  # generates the migration for form_notification_configs
pnpm run db:migrate   # applies it
```

---

## 13. Step-by-Step Tasks

### Task 1: DB Migration — `form_notification_configs` table
- Add table to `src/db/schema.ts`
- Run drizzle generate + migrate

### Task 2: Template Engine
- Build `src/lib/template-engine.ts` with `interpolate()`
- Unit tests for variable resolution, unknown variables, special keys

### Task 3: Server Functions — Notification CRUD
- Build `src/lib/server-fns/notifications.ts`
- `getNotificationConfig`, `saveNotificationConfig`, `sendTestNotification`

### Task 4: Dispatcher Email Handler (FT-003 coordination)
- Add `dispatchEmailNotification()` to the dispatcher
- Wire into `submitFormResponse()` and `completeExecution()`
- Ensure non-blocking, error-logged

### Task 5: NotificationSettingsPanel UI
- Build `NotificationSettingsPanel.tsx` with both channel cards
- Build `NotificationChannelCard.tsx` — toggle, field picker, subject, body editor
- Build `EmailChipInput.tsx` — multi-email input with add/remove
- Build `TemplateEditor.tsx` — textarea + variable chip picker + Markdown preview

### Task 6: New Route — Notifications Tab
- Create `src/routes/forms/$formId/notifications.tsx`
- Add "✉ Notifications" tab link in `edit.tsx` header nav

### Task 7: Availability Gating
- Check FT-002 credential status before enabling save/test buttons
- Show warnings for missing email fields, missing credentials

### Task 8: End-to-End Testing
- Configure SMTP in Integrations Hub
- Set up respondent + admin notifications on a form
- Submit form → verify both emails arrive with correct content
- Verify variable interpolation works for all supported variables
- Verify test send button works

---

## 14. Risks & Open Questions

| Risk | Mitigation |
|---|---|
| **Spam/abuse** — form submissions could be used to spam arbitrary emails | Admin emails are set by the form owner (who is authenticated). Respondent emails go only to the respondent. Rate limit: max 1 email per submission. |
| **Deliverability** — emails land in spam | Use the configured SMTP/Resend with proper DKIM/SPF. From address must match the domain. Document this in the UI. |
| **HTML injection** — user input in template variables | Sanitize interpolated form values before inserting into email body. Strip `<script>`, `onerror=`, etc. |
| **Large submissions** — email body could be huge if all fields are dumped | Provide a "summary mode" template that links to the full submission. Default template should be concise. |
| **What if the creator deletes an email field that's selected for respondent?** | On load, validate `respondent_email_field` still exists. If not, show a warning and clear the selection. |

---

## 15. Validation / Testing

- [ ] Unit test: `interpolate()` with all supported variables
- [ ] Unit test: `interpolate()` leaves unknown variables as-is
- [ ] Unit test: HTML sanitization on interpolated values
- [ ] Unit test: email address deduplication
- [ ] Integration test: SMTP send with test template
- [ ] Integration test: Resend send with test template
- [ ] E2E test: configure notifications → submit form → receive both emails
- [ ] E2E test: respond with missing email field → admin gets notified, respondent skipped
- [ ] UI test: Notifications tab shows/hides based on credential state
- [ ] UI test: Template variable chips insert correctly
- [ ] UI test: Test send button works for both channels
