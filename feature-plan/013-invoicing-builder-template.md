# FT-013: Invoice Builder & Post-Payment Email Construction

> **Feature Plan** — Form creators design a custom invoice/receipt template that is emailed to respondents after successful payment. The invoice includes payment details (amount, currency, date, gateway, invoice number) plus any form field data. Also covers post-submission confirmation emails where the creator builds the email content that respondents receive after successfully submitting.

**Status:** 🚧 **Planned** — not yet implemented

**Dependencies:**
- 🚧 **FT-004 (Form Notifications)** — FT-013 builds on FT-004's template variable interpolation engine (`src/lib/template-engine.ts`, `interpolate()`). FT-013 extends it with payment-specific variables (`{{payment_amount}}`, `{{payment_currency}}`, `{{payment_date}}`, `{{payment_gateway}}`, `{{payment_id}}`, `{{invoice_number}}`). If FT-004 is not yet implemented, the shared `interpolate()` function must be built here first.
- 🚧 **FT-003 (Services Integration)** — The actual email sending relies on the email service modules (Resend or SMTP) wired through FT-003's dispatcher. If FT-003 is not yet built, FT-013 can call the email service directly using FT-002 credentials as a stopgap.
- ✅ **FT-002 (Integrations Hub)** — Email credentials (Resend config or SMTP config) must be configured before invoices can send. The "Invoicing" tab should gate availability based on credential status.
- ✅ **FT-007 (Page Builder)** — Works with page-based forms. Invoice trigger hooks into `completePageSubmissionRecord()` and `finalizePagePayment()` in the page builder flow.

---

## 1. User Story & Problem

### 1.1 Current State

When a respondent completes a form with a payment:
- They are redirected back from the payment gateway to a success page
- They see a "Thank you" final page (configured in the form builder)
- **No email is sent to the respondent** — no receipt, no invoice, no confirmation

Form creators who collect payments need to send professional invoices/receipts to their respondents. Currently they must manually send these outside PonkoForm — defeating the purpose of an integrated payment flow.

### 1.2 What the User Wants

> *"I want to create my own invoicing template so that when a respondent pays, they get that email for the invoice. Plus, I want email construction — when a respondent successfully submits, they receive an email I created."*

Two scenarios:
1. **Paid form → Invoice email**: Respondent completes payment → receives a branded invoice with amount, date, line items, and a thank-you message
2. **Free form → Confirmation email**: Respondent submits successfully → receives a confirmation email with their submitted data recap

Both emails are **designed by the form creator** — custom subject line, custom body with template variables, and the creator's branding.

### 1.3 How This Differs from FT-004

| Aspect | FT-004 (Notifications) | FT-013 (Invoice Builder) |
|---|---|---|
| **Purpose** | Generic notifications: "thanks for submitting" + "new submission alert" | Payment-specific invoice/receipt emails |
| **Trigger** | Form submission (any status) | Payment completion (`status = 'completed'`) |
| **Template variables** | `{{name}}`, `{{email}}`, `{{submission_id}}` | Above + `{{payment_amount}}`, `{{payment_currency}}`, `{{payment_date}}`, `{{payment_gateway}}`, `{{payment_id}}`, `{{invoice_number}}` |
| **Template editor** | Simple subject + body textareas | Rich template builder with live preview and variable picker |
| **Recipient** | Respondent (via email field) or admin | Always the respondent (email extracted from form data or payment metadata) |
| **Branding** | Plain text/Markdown | Full HTML with creator's logo, colors, formatting |

FT-013 and FT-004 are complementary. A form could have both: FT-004 sends a simple "New submission" alert to the admin, while FT-013 sends a polished invoice to the respondent.

---

## 2. System Design — DB Schema & Architecture

### 2.1 New Table: `form_invoice_configs`

One row per form (1:1 relationship). Stores the invoice template and configuration.

```sql
CREATE TABLE form_invoice_configs (
  id                    SERIAL PRIMARY KEY,
  form_id               INTEGER NOT NULL UNIQUE
                          REFERENCES forms(id) ON DELETE CASCADE,

  -- Enable/disable invoice emails
  enabled               BOOLEAN NOT NULL DEFAULT FALSE,

  -- Which form field contains the respondent's email
  respondent_email_field VARCHAR(100),

  -- Invoice template
  subject_template      VARCHAR(255),           -- "Invoice #{{invoice_number}} from {{form_title}}"
  body_template         TEXT,                   -- HTML body with {{variable}} slots
  body_template_plain   TEXT,                   -- Plain-text fallback

  -- Branding
  from_name             VARCHAR(255),           -- "Acme Corp Billing"
  logo_url              TEXT,                   -- URL to a logo image for the invoice header
  accent_color          VARCHAR(7) DEFAULT '#cc785c',  -- Hex color for invoice accents

  -- Invoice numbering
  invoice_prefix        VARCHAR(20) DEFAULT 'INV-',   -- "INV-", "RECEIPT-", ""
  invoice_start_number  INTEGER NOT NULL DEFAULT 1000, -- Starting invoice number

  -- Payment-specific settings
  include_payment_details BOOLEAN NOT NULL DEFAULT TRUE,  -- Show amount, currency, gateway
  include_line_items      BOOLEAN NOT NULL DEFAULT FALSE,  -- Show form fields as line items
  line_item_fields        JSONB DEFAULT '[]',               -- Which fields to show as line items [{ label, variable }]

  created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 2.2 New Table: `invoice_sent_log`

Tracks every invoice email sent, for audit and debugging.

```sql
CREATE TABLE invoice_sent_log (
  id                    SERIAL PRIMARY KEY,
  form_id               INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  form_submission_id    INTEGER NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
  payment_id            INTEGER REFERENCES payments(id) ON DELETE SET NULL,

  recipient_email       VARCHAR(255) NOT NULL,
  invoice_number        VARCHAR(50) NOT NULL,
  subject               VARCHAR(255) NOT NULL,

  status                VARCHAR(20) NOT NULL DEFAULT 'sent',
                          -- 'sent', 'failed', 'bounced'

  message_id            VARCHAR(255),         -- Email provider's message ID
  error_message         TEXT,                 -- If status = 'failed'

  sent_at               TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX invoice_sent_log_form_id_idx ON invoice_sent_log(form_id);
CREATE INDEX invoice_sent_log_submission_id_idx ON invoice_sent_log(form_submission_id);
```

### 2.3 Drizzle Schema

```ts
// In src/db/schema.ts — add after form_notification_configs definition

export const formInvoiceConfigs = pgTable(
  'form_invoice_configs',
  {
    id: serial().primaryKey(),
    formId: integer('form_id').notNull().unique()
      .references(() => forms.id, { onDelete: 'cascade' }),
    enabled: boolean('enabled').notNull().default(false),
    respondentEmailField: varchar('respondent_email_field', { length: 100 }),
    subjectTemplate: varchar('subject_template', { length: 255 }),
    bodyTemplate: text('body_template'),
    bodyTemplatePlain: text('body_template_plain'),
    fromName: varchar('from_name', { length: 255 }),
    logoUrl: text('logo_url'),
    accentColor: varchar('accent_color', { length: 7 }).notNull().default('#cc785c'),
    invoicePrefix: varchar('invoice_prefix', { length: 20 }).notNull().default('INV-'),
    invoiceStartNumber: integer('invoice_start_number').notNull().default(1000),
    includePaymentDetails: boolean('include_payment_details').notNull().default(true),
    includeLineItems: boolean('include_line_items').notNull().default(false),
    lineItemFields: jsonb('line_item_fields')
      .$type<{ label: string; variable: string }[]>()
      .notNull()
      .default([]),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
)

export const invoiceSentLog = pgTable(
  'invoice_sent_log',
  {
    id: serial().primaryKey(),
    formId: integer('form_id').notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    formSubmissionId: integer('form_submission_id').notNull()
      .references(() => formSubmissions.id, { onDelete: 'cascade' }),
    paymentId: integer('payment_id')
      .references(() => payments.id, { onDelete: 'set null' }),
    recipientEmail: varchar('recipient_email', { length: 255 }).notNull(),
    invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
    subject: varchar('subject', { length: 255 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('sent'),
    messageId: varchar('message_id', { length: 255 }),
    errorMessage: text('error_message'),
    sentAt: timestamp('sent_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('invoice_sent_log_form_id_idx').on(table.formId),
    index('invoice_sent_log_submission_id_idx').on(table.formSubmissionId),
  ],
)
```

### 2.4 Architecture — Data Flow

```
Respondent completes payment on gateway
         │
         ▼
Gateway redirects to /forms/payment-return
         │
         ▼
finalizePagePayment() — verifies payment with gateway
  │
  ├── payment.status = 'completed' ✓
  │       │
  │       ▼
  │   completePageSubmissionRecord() — persists submission
  │       │
  │       ▼
  │   sendInvoiceEmail() ────────────────── NEW INJECTION POINT
  │       │
  │       ├── 1. Read form_invoice_configs WHERE form_id = $1
  │       ├── 2. If not enabled → return (no-op)
  │       ├── 3. Resolve respondent email from form data
  │       ├── 4. Generate invoice number (prefix + counter)
  │       ├── 5. Build template context:
  │       │      - Form fields: {{name}}, {{email}}, {{event}}, etc.
  │       │      - Payment: {{payment_amount}}, {{payment_currency}}, {{payment_date}},
  │       │                  {{payment_gateway}}, {{payment_id}}, {{invoice_number}}
  │       │      - System: {{form_title}}, {{submission_id}}, {{submitted_at}}
  │       ├── 6. Interpolate subject_template + body_template
  │       ├── 7. Send via email service (Resend or SMTP)
  │       ├── 8. Log to invoice_sent_log
  │       └── 9. On failure → log error, do NOT throw (non-blocking)
  │
  └── payment.status = 'failed' ✗
          └── No invoice sent (invoice is for completed payments only)
```

**Key design rule:** Invoice sending is **fire-and-forget, non-blocking**. The respondent always sees the success page immediately. If email sending fails, the submission and payment are still valid — the failure is logged for the form creator to investigate.

### 2.5 Invoice Number Generation

Invoice numbers follow the pattern: `{prefix}{sequential-number}`

Example: `INV-1000`, `INV-1001`, `RECEIPT-5000`

```ts
async function generateInvoiceNumber(formId: number, config: typeof formInvoiceConfigs.$inferSelect): Promise<string> {
  // Count existing invoices for this form to determine the next sequential number
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(invoiceSentLog)
    .where(eq(invoiceSentLog.formId, formId))

  const count = (result?.count ?? 0)
  const number = config.invoiceStartNumber + count
  return `${config.invoicePrefix}${number}`
}
```

---

## 3. UI Design — Invoice Template Builder

### 3.1 Where It Lives — New "Invoicing" Tab

Add a fourth tab to the form editor navigation (`src/routes/forms/$formId/edit.tsx`, lines 655-675):

```
┌──────────────────────────────────────────────────────────────┐
│  ← Forms / My Registration Form  ┌──────────────────────┐   │
│  [draft]                          │ ◆ Build              │   │
│                                   │   Responses          │   │
│                                   │   Payments           │   │
│                                   │ 🧾 Invoicing         │   │ ← NEW
│                                   └──────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

New route: `src/routes/forms/$formId/invoicing.tsx`

### 3.2 Page Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Invoice Settings                                                         │
│  Design the email your respondents receive after a successful payment.    │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ 🧾 INVOICE EMAIL                                        [ON  ●]    │ │
│  │ Send a branded invoice/receipt email when payment completes.        │ │
│  │                                                                     │ │
│  │ ── Recipient ────────────────────────────────────────────────────  │ │
│  │ Respondent email field  [email ▼]  ← pick from form fields         │ │
│  │                                                                     │ │
│  │ ── Branding ────────────────────────────────────────────────────── │ │
│  │ From name  [Acme Corp Billing ___________]                         │ │
│  │ Logo URL   [https://example.com/logo.png __]  (optional)           │ │
│  │ Accent color  [#cc785c]  🔴 color picker                           │ │
│  │                                                                     │ │
│  │ ── Invoice Numbering ───────────────────────────────────────────── │ │
│  │ Prefix  [INV-___]  Start number  [1000____]                        │ │
│  │ Example: INV-1000, INV-1001, ...                                   │ │
│  │                                                                     │ │
│  │ ── Subject ─────────────────────────────────────────────────────── │ │
│  │ [Invoice #{{invoice_number}} for {{form_title}} _________________] │ │
│  │                                                                     │ │
│  │ ── Email Body ──────────────────────────────────────────────────── │ │
│  │ ┌─────────────────────────────────────────────────────────────┐   │ │
│  │ │ [B] [I] [Link] [• List] [1. Numbered]    {📋 Variables}    │   │ │
│  │ ├─────────────────────────────────────────────────────────────┤   │ │
│  │ │                                                             │   │ │
│  │ │  <h1>Invoice #{{invoice_number}}</h1>                       │   │ │
│  │ │                                                             │   │ │
│  │ │  <p>Hi {{name}},</p>                                       │   │ │
│  │ │                                                             │   │ │
│  │ │  <p>Thank you for your payment. Here are the details:</p>   │   │ │
│  │ │                                                             │   │ │
│  │ │  <table>                                                    │   │ │
│  │ │    <tr><td>Amount:</td><td>{{payment_amount}}</td></tr>     │   │ │
│  │ │    <tr><td>Date:</td><td>{{payment_date}}</td></tr>        │   │ │
│  │ │    <tr><td>Method:</td><td>{{payment_gateway}}</td></tr>   │   │ │
│  │ │  </table>                                                   │   │ │
│  │ │                                                             │   │ │
│  │ │  <p>— Acme Corp Billing</p>                                 │   │ │
│  │ │                                                             │   │ │
│  │ └─────────────────────────────────────────────────────────────┘   │ │
│  │                                                                     │ │
│  │ ── Line Items (optional) ──────────────────────────────────────────│ │
│  │ [✓] Include form fields as line items                              │ │
│  │  ┌─────────────────────────────────────────────────────────────┐   │ │
│  │  │ Line item label        Form field variable                   │   │ │
│  │  │ [Event Ticket      ___] [ticket_type _____________________] │   │ │
│  │  │ [Ticket Price      ___] [ticket_price ____________________] │   │ │
│  │  │ [+ Add line item]                                            │   │ │
│  │  └─────────────────────────────────────────────────────────────┘   │ │
│  │                                                                     │ │
│  │ ── Payment Details ─────────────────────────────────────────────── │ │
│  │ [✓] Include payment amount, currency, gateway, and date            │ │
│  │                                                                     │ │
│  │ ── Preview ─────────────────────────────────────────────────────── │ │
│  │ [Send Test Email to: creator@email.com ____]  [Send Test]          │ │
│  │                                                                     │ │
│  │ ┌─ Preview ────────────────────────────────────────────────────┐   │ │
│  │ │                                                               │   │ │
│  │ │  ╔══════════════════════════════════════════════════════════╗ │   │ │
│  │ │  ║  🧾 Acme Corp Billing                                   ║ │   │ │
│  │ │  ║                                                          ║ │   │ │
│  │ │  ║  # INVOICE #INV-1000                                    ║ │   │ │
│  │ │  ║                                                          ║ │   │ │
│  │ │  ║  Hi Jane Doe,                                           ║ │   │ │
│  │ │  ║                                                          ║ │   │ │
│  │ │  ║  Thank you for your payment. Here are your details:      ║ │   │ │
│  │ │  ║                                                          ║ │   │ │
│  │ │  ║  ┌──────────────────────────────────────────────────┐   ║ │   │ │
│  │ │  ║  │ Event Ticket    Early Bird         ₱2,450.00    │   ║ │   │ │
│  │ │  ║  │ Ticket Price    General Admission   ₱2,000.00    │   ║ │   │ │
│  │ │  ║  │──────────────────────────────────────────────────│   ║ │   │ │
│  │ │  ║  │ Total                               ₱2,450.00    │   ║ │   │ │
│  │ │  ║  └──────────────────────────────────────────────────┘   ║ │   │ │
│  │ │  ║                                                          ║ │   │ │
│  │ │  ║  Payment Method: PayPal                                  ║ │   │ │
│  │ │  ║  Payment Date: Jan 15, 2026                              ║ │   │ │
│  │ │  ║  Payment ID: PAY-XXXX-1234                               ║ │   │ │
│  │ │  ║                                                          ║ │   │ │
│  │ │  ║  Thank you for your business!                            ║ │   │ │
│  │ │  ╚══════════════════════════════════════════════════════════╝ │   │ │
│  │ └───────────────────────────────────────────────────────────────┘   │ │
│  │                                                                     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ 📧 POST-SUBMISSION CONFIRMATION                         [OFF ○]    │ │
│  │ Send a confirmation email when a respondent submits (even without    │ │
│  │ payment). Uses the same template engine.                             │ │
│  │                                     [Configure →]                    │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ 📋 SENT INVOICES (12)                                      [View All]│ │
│  │                                                                     │ │
│  │  INV-1011  jane@email.com  sent     Jan 15, 2026   $49.00          │ │
│  │  INV-1010  john@email.com  sent     Jan 14, 2026   $29.00          │ │
│  │  INV-1009  alex@email.com  failed   Jan 14, 2026   $49.00  [Retry] │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Component Tree

```
InvoiceSettingsPage (src/routes/forms/$formId/invoicing.tsx)
├── InvoiceConfigCard                     ← Toggle + main config
│   ├── ToggleSwitch (enabled/disabled)
│   ├── RespondentEmailFieldPicker        ← Dropdown of form email fields
│   ├── BrandingSection
│   │   ├── Input (from_name)
│   │   ├── Input (logo_url)
│   │   └── ColorPicker (accent_color)
│   ├── NumberingSection
│   │   ├── Input (invoice_prefix)
│   │   └── Input (invoice_start_number)
│   ├── SubjectInput
│   ├── RichTextEditor                     ← Body template with toolbar
│   │   └── VariablePickerButton          ← Dropdown to insert {{variables}}
│   ├── LineItemsSection
│   │   ├── Checkbox (include_line_items)
│   │   └── LineItemRow[] (label + variable picker)
│   ├── PaymentDetailsCheckbox
│   └── TestEmailSection
│       ├── Input (test_recipient)
│       └── Button ("Send Test")
│
├── PreviewPanel                          ← Live preview of rendered invoice
│
├── PostSubmissionCard                    ← Secondary toggle for non-payment emails
│   └── ToggleSwitch + "Configure" link (opens similar editor)
│
└── SentInvoicesTable                     ← Recent invoice log
    └── InvoiceRow[] (number, recipient, status, date, amount, retry button)
```

### 3.4 Availability Gating

The "Invoicing" tab shows different states based on credential configuration:

| State | What User Sees |
|---|---|
| **No email credentials configured** | "Set up email first" banner with link to Integrations Hub. Invoice editor is disabled. |
| **Email configured, invoicing disabled** | Toggle is OFF. All fields are visible but grayed out. |
| **Email configured, invoicing enabled** | Full editor is active. |

---

## 4. Server Functions & Logic

### 4.1 Invoice Config CRUD

```ts
// In src/lib/server-fns/invoicing.ts — NEW FILE

export const getInvoiceConfig = createServerFn({ method: 'GET' })
  .inputValidator((data: { formId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(userId, data.formId)

    const [config] = await db
      .select()
      .from(formInvoiceConfigs)
      .where(eq(formInvoiceConfigs.formId, data.formId))
      .limit(1)

    return config ?? null
  })

export const saveInvoiceConfig = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    formId: number
    enabled?: boolean
    respondentEmailField?: string
    subjectTemplate?: string
    bodyTemplate?: string
    bodyTemplatePlain?: string
    fromName?: string
    logoUrl?: string
    accentColor?: string
    invoicePrefix?: string
    invoiceStartNumber?: number
    includePaymentDetails?: boolean
    includeLineItems?: boolean
    lineItemFields?: { label: string; variable: string }[]
  }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(userId, data.formId)

    const { formId, ...fields } = data
    const [existing] = await db
      .select({ id: formInvoiceConfigs.id })
      .from(formInvoiceConfigs)
      .where(eq(formInvoiceConfigs.formId, formId))
      .limit(1)

    if (existing) {
      const [updated] = await db
        .update(formInvoiceConfigs)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(formInvoiceConfigs.id, existing.id))
        .returning()
      return updated
    }

    const [created] = await db
      .insert(formInvoiceConfigs)
      .values({ formId, ...fields })
      .returning()
    return created
  })

export const sendTestInvoice = createServerFn({ method: 'POST' })
  .inputValidator((data: { formId: number; recipientEmail: string }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(userId, data.formId)

    const [config] = await db
      .select()
      .from(formInvoiceConfigs)
      .where(eq(formInvoiceConfigs.formId, data.formId))
      .limit(1)
    if (!config?.enabled) throw new Error('Invoice emails are not enabled for this form')

    // Build a mock context with sample data
    const mockCtx: InvoiceTemplateContext = {
      formData: { name: 'Test User', email: data.recipientEmail },
      submissionId: 0,
      formTitle: 'Test Form',
      submittedAt: new Date(),
      paymentAmount: '$49.00',
      paymentCurrency: 'USD',
      paymentDate: new Date().toLocaleDateString(),
      paymentGateway: 'PayPal',
      paymentId: 'PAY-TEST-0000',
      invoiceNumber: `${config.invoicePrefix}TEST`,
    }

    const subject = interpolateInvoice(config.subjectTemplate ?? 'Test Invoice', mockCtx)
    const body = interpolateInvoice(config.bodyTemplate ?? '<p>This is a test invoice.</p>', mockCtx)

    await sendEmail({
      config: await getEmailConfig(userId),
      to: data.recipientEmail,
      fromName: config.fromName ?? undefined,
      subject,
      htmlBody: body,
    })

    return { success: true }
  })
```

### 4.2 Template Interpolation Engine

```ts
// In src/lib/template-engine.ts — extends FT-004's interpolate()

export interface InvoiceTemplateContext {
  // From form data
  formData: Record<string, unknown>

  // System
  submissionId: number
  formTitle: string
  submittedAt: Date

  // Payment (optional — only present for paid forms)
  paymentAmount?: string        // Formatted: "$49.00"
  paymentCurrency?: string      // "USD", "PHP"
  paymentDate?: string          // Formatted date
  paymentGateway?: string       // "PayPal", "Xendit"
  paymentId?: string            // Gateway payment ID
  invoiceNumber?: string        // Generated invoice number
}

export function interpolateInvoice(
  template: string,
  ctx: InvoiceTemplateContext,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    switch (key) {
      // System variables
      case 'submission_id':    return String(ctx.submissionId)
      case 'form_title':       return ctx.formTitle
      case 'submitted_at':     return ctx.submittedAt.toISOString()

      // Payment variables (invoice-specific)
      case 'payment_amount':   return ctx.paymentAmount ?? 'N/A'
      case 'payment_currency': return ctx.paymentCurrency ?? 'N/A'
      case 'payment_date':     return ctx.paymentDate ?? 'N/A'
      case 'payment_gateway':  return ctx.paymentGateway ?? 'N/A'
      case 'payment_id':       return ctx.paymentId ?? 'N/A'
      case 'invoice_number':   return ctx.invoiceNumber ?? 'N/A'

      // Form field variables
      default: return String(ctx.formData[key] ?? `{{${key}}}`)
    }
  })
}
```

### 4.3 Invoice Email Sender (Core Logic)

```ts
// In src/lib/server-fns/invoicing.ts

export async function sendInvoiceForSubmission(
  formId: number,
  submissionId: number,
  paymentId?: number,
): Promise<void> {
  try {
    // 1. Load invoice config
    const [config] = await db
      .select()
      .from(formInvoiceConfigs)
      .where(eq(formInvoiceConfigs.formId, formId))
      .limit(1)

    if (!config?.enabled) return // No-op if not configured

    // 2. Load submission data
    const [submission] = await db
      .select()
      .from(formSubmissions)
      .where(eq(formSubmissions.id, submissionId))
      .limit(1)
    if (!submission) return

    const formData = submission.formData as Record<string, unknown>

    // 3. Resolve respondent email
    const emailField = config.respondentEmailField
    const respondentEmail = emailField
      ? String(formData[emailField] ?? '')
      : ''

    if (!respondentEmail || !respondentEmail.includes('@')) {
      // Log but don't throw — we can't send without an email
      await db.insert(invoiceSentLog).values({
        formId, formSubmissionId: submissionId, paymentId: paymentId ?? null,
        recipientEmail: respondentEmail || '(unknown)',
        invoiceNumber: '(not sent — missing email)',
        subject: '(not sent)',
        status: 'failed',
        errorMessage: 'Could not resolve respondent email address',
        sentAt: new Date(),
      })
      return
    }

    // 4. Load payment details (if paid)
    let paymentCtx: Partial<InvoiceTemplateContext> = {}
    if (paymentId) {
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, paymentId))
        .limit(1)
      if (payment) {
        paymentCtx = {
          paymentAmount: `${(payment.amount / 100).toFixed(2)}`,
          paymentCurrency: payment.currency,
          paymentDate: payment.paidAt
            ? new Date(payment.paidAt).toLocaleDateString()
            : new Date().toLocaleDateString(),
          paymentGateway: payment.paymentMethod ?? 'Online Payment',
          paymentId: payment.gatewayPaymentId ?? String(payment.id),
        }
      }
    }

    // 5. Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(formId, config)

    // 6. Build template context
    const [form] = await db
      .select({ title: forms.title })
      .from(forms)
      .where(eq(forms.id, formId))
      .limit(1)

    const ctx: InvoiceTemplateContext = {
      formData,
      submissionId,
      formTitle: form?.title ?? 'Form',
      submittedAt: submission.submittedAt ?? new Date(),
      invoiceNumber,
      ...paymentCtx,
    }

    // 7. Interpolate templates
    const subject = interpolateInvoice(
      config.subjectTemplate ?? `Invoice #{{invoice_number}}`,
      ctx,
    )
    const htmlBody = interpolateInvoice(
      config.bodyTemplate ?? '<p>Thank you for your payment.</p>',
      ctx,
    )

    // 8. Send email
    const emailConfig = await getEmailConfigForForm(formId)
    if (!emailConfig) {
      throw new Error('Email is not configured. Set up email in Integrations Hub.')
    }

    const result = await sendEmail({
      config: emailConfig,
      to: respondentEmail,
      fromName: config.fromName ?? undefined,
      subject,
      htmlBody,
    })

    // 9. Log success
    await db.insert(invoiceSentLog).values({
      formId,
      formSubmissionId: submissionId,
      paymentId: paymentId ?? null,
      recipientEmail: respondentEmail,
      invoiceNumber,
      subject,
      status: 'sent',
      messageId: result.messageId ?? null,
      sentAt: new Date(),
    })
  } catch (err) {
    // 10. Log failure — non-blocking
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    await db.insert(invoiceSentLog).values({
      formId,
      formSubmissionId: submissionId,
      paymentId: paymentId ?? null,
      recipientEmail: '(error)',
      invoiceNumber: '(not sent)',
      subject: '(not sent)',
      status: 'failed',
      errorMessage,
      sentAt: new Date(),
    })
    // Do NOT rethrow — invoice failure must not block the submission flow
    console.error(`[invoice] Failed to send invoice for submission ${submissionId}:`, errorMessage)
  }
}
```

### 4.4 Injection Points — Where Invoices Fire

#### Injection Point 1: Page-Based Form Completion (Primary)

File: `src/lib/page-builder/complete-submission.ts`, function `completePageSubmissionRecord()`

After line 101 (after the session is updated), add:

```ts
// After the submission is persisted and session updated
// Fire-and-forget: don't await, don't block the response
sendInvoiceForSubmission(
  session.formId,
  submission.id,
  Number.isFinite(paymentId) ? paymentId : undefined,
).catch(() => { /* logged internally */ })
```

This covers both paid and free forms. For paid forms, `paymentId` is provided and payment details are included in the invoice. For free forms, no payment details are included — it becomes a simple confirmation email.

#### Injection Point 2: Flow-Based Payment Completion (Legacy)

File: `src/lib/server-fns/flow-executions.ts` — the `completeExecution` handler, after the submission row is created.

```ts
// After INSERT form_submissions
sendInvoiceForSubmission(flow.formId, submission.id, payment.id).catch(() => {})
```

### 4.5 Sent Invoice Log Query

```ts
// In src/lib/server-fns/invoicing.ts

export const getSentInvoices = createServerFn({ method: 'GET' })
  .inputValidator((data: { formId: number; limit?: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    await assertFormOwner(userId, data.formId)

    return db
      .select()
      .from(invoiceSentLog)
      .where(eq(invoiceSentLog.formId, data.formId))
      .orderBy(desc(invoiceSentLog.sentAt))
      .limit(data.limit ?? 10)
  })
```

---

## 5. Available Template Variables

| Variable | Description | Example | Available In |
|---|---|---|---|
| `{{invoice_number}}` | Auto-generated invoice number | `INV-1000` | Always |
| `{{form_title}}` | Name of the form | `Event Registration` | Always |
| `{{submission_id}}` | Database ID of the submission | `42` | Always |
| `{{submitted_at}}` | Submission timestamp (ISO 8601) | `2026-01-15T14:30:00Z` | Always |
| `{{payment_amount}}` | Payment amount with symbol | `$49.00` | Paid forms only |
| `{{payment_currency}}` | Currency code | `USD`, `PHP` | Paid forms only |
| `{{payment_date}}` | Date payment completed | `Jan 15, 2026` | Paid forms only |
| `{{payment_gateway}}` | Payment method used | `PayPal`, `Xendit` | Paid forms only |
| `{{payment_id}}` | Gateway payment reference | `PAY-XXXX-1234` | Paid forms only |
| `{{field_name}}` | Any form field's bind variable | `{{name}}` → `Jane Doe` | Always |

---

## 6. How It Connects to Other Feature Plans

| Feature Plan | Connection |
|---|---|
| **FT-004 (Notifications)** | Shares the `interpolate()` template engine in `src/lib/template-engine.ts`. FT-013 extends it with `interpolateInvoice()` that adds payment variables. Both can coexist — a form can have notification emails AND invoice emails. |
| **FT-003 (Services Integration)** | Uses the email service modules (Resend/SMTP) to actually send the emails. If FT-003's dispatcher is built, invoice sending becomes a dispatched service. If not, FT-013 calls the email module directly as a stopgap. |
| **FT-002 (Integrations Hub)** | Requires email credentials configured. The invoicing UI gates availability on credential status. |
| **FT-007 (Page Builder)** | Injects into `completePageSubmissionRecord()` in the page builder flow. Also hooks into `finalizePagePayment()` for the payment-completion trigger. |
| **FT-011 (Form Templates)** | Future: invoice templates could be included in form templates. A "Deal Qualification" template could come with a pre-configured invoice template. |

---

## 7. File Change Summary

| File | Purpose |
|---|---|
| `src/db/schema.ts` | Add `formInvoiceConfigs` and `invoiceSentLog` table definitions |
| `src/lib/template-engine.ts` | **NEW** — `InvoiceTemplateContext` interface + `interpolateInvoice()` function |
| `src/lib/server-fns/invoicing.ts` | **NEW** — `getInvoiceConfig`, `saveInvoiceConfig`, `sendTestInvoice`, `sendInvoiceForSubmission`, `getSentInvoices` |
| `src/lib/page-builder/complete-submission.ts` | Inject `sendInvoiceForSubmission()` call after line 101 (after session update) |
| `src/routes/forms/$formId/invoicing.tsx` | **NEW** — Invoice settings page route |
| `src/routes/forms/$formId/edit.tsx` | Add "Invoicing" tab to navigation (after line 674, the Payments tab) |
| `src/components/forms/InvoiceConfigCard.tsx` | **NEW** — Main invoice configuration card component |
| `src/components/forms/InvoicePreview.tsx` | **NEW** — Live preview panel for rendered invoice |
| `src/components/forms/SentInvoicesTable.tsx` | **NEW** — Table of recently sent invoices |

---

## 8. Step-by-Step Tasks

### Task 1: DB Migration — Invoice Tables
- Add `formInvoiceConfigs` Drizzle definition to `src/db/schema.ts`
- Add `invoiceSentLog` Drizzle definition to `src/db/schema.ts`
- Run `npm run db:generate` → `npm run db:migrate`
- Verify: `SELECT * FROM form_invoice_configs LIMIT 0` and `SELECT * FROM invoice_sent_log LIMIT 0` succeed

### Task 2: Template Interpolation Engine
- Create `src/lib/template-engine.ts` with `InvoiceTemplateContext` interface and `interpolateInvoice()` function
- Support all 10 template variables listed in Section 5
- Handle missing/null values gracefully (return `'N/A'` instead of throwing)
- Add unit test: `src/lib/template-engine.test.ts` — test variable substitution with mock context

### Task 3: Server Functions — Invoice Config CRUD
- Create `src/lib/server-fns/invoicing.ts`
- Implement `getInvoiceConfig`, `saveInvoiceConfig`, `sendTestInvoice`, `getSentInvoices`
- Implement `sendInvoiceForSubmission()` — the core email-sending function
- Implement `generateInvoiceNumber()` — sequential counter per form
- Use `assertFormOwner()` pattern from existing server functions for auth

### Task 4: Inject Invoice Sending Into Submission Flow
- In `src/lib/page-builder/complete-submission.ts`, after line 101 (after `return { session: updated, submission }`):
  - Add fire-and-forget call: `sendInvoiceForSubmission(session.formId, submission.id, paymentId).catch(() => {})`
- Import `sendInvoiceForSubmission` from `../../server-fns/invoicing`
- Ensure the call is non-blocking — the respondent gets the success page regardless

### Task 5: Invoice Settings Page Route
- Create `src/routes/forms/$formId/invoicing.tsx` with `createFileRoute("/forms/$formId/invoicing")`
- `beforeLoad: () => requireAuth()`
- Page component: fetches invoice config via `getInvoiceConfig`, renders the full editor layout
- Gating: check if email credentials are configured; if not, show setup banner
- Add "Invoicing" tab link in `src/routes/forms/$formId/edit.tsx` (after line 674, inside the `<nav>` element)

### Task 6: Invoice Configuration UI Components
- Create `src/components/forms/InvoiceConfigCard.tsx`: toggle switch, recipient email picker, branding fields, numbering fields, subject input, rich text editor for body, line items section, send test button
- Create `src/components/forms/InvoicePreview.tsx`: renders a preview of the invoice with sample data, updates live as the user edits the template
- Create `src/components/forms/SentInvoicesTable.tsx`: table showing recent invoice sends with status badges and retry buttons for failed sends
- Variable picker: a dropdown button next to the text editor that inserts `{{variable_name}}` at the cursor position

### Task 7: Email Sending Integration
- Create a helper function in `src/lib/server-fns/invoicing.ts` that loads email credentials and sends via Resend or SMTP
- Use the pattern from `src/lib/email/resend.ts` (`sendPaymentReminderEmail`) as a reference
- Handle both Resend and SMTP providers (use the `integrations` table credential loading)
- On send failure: catch error, log to `invoiceSentLog` with status `'failed'`, do NOT throw

### Task 8: Test Email + Polish
- Implement `sendTestInvoice` server function: builds a mock context with sample data, sends to the creator's specified email
- Wire the "Send Test" button to `sendTestInvoice` with loading state
- Add validation: required fields (respondent_email_field, subject_template, body_template) must be filled before enabling the toggle
- Add retry button on failed invoices in the sent invoices table
- Add invoice sent count badge on the tab: "Invoicing (12)"

### Task 9: Validation & End-to-End Testing
- Create a form with a payment page, configure invoice settings, submit a test payment → verify invoice email is received
- Create a free form (no payment), configure invoice settings, submit → verify confirmation email is received
- Send a test invoice → verify test email arrives with sample data filled in
- Verify invoice numbering: create 3 paid submissions → invoice numbers should be INV-1000, INV-1001, INV-1002
- Verify failed email handling: misconfigure email credentials → submission still succeeds, failure logged to `invoiceSentLog`
- Verify non-blocking: payment completes and thank-you page shows even if invoice email fails

---

## 9. Risks & Open Questions

| Risk | Mitigation |
|---|---|
| **FT-004 not yet built — template engine doesn't exist** | Build `src/lib/template-engine.ts` as part of this feature. FT-004 can then depend on it. The `interpolateInvoice()` function is a superset of what FT-004 needs. |
| **FT-003 not yet built — no email service dispatcher** | FT-013 can call the email module directly (Resend API or SMTP) as a stopgap. When FT-003 is built, refactor to use the dispatcher. The injection point in `completePageSubmissionRecord()` stays the same either way. |
| **Email credentials not configured — invoice never sends** | The UI gates availability: the invoicing tab shows a setup banner if no email credentials exist. Server-side, `sendInvoiceForSubmission()` silently no-ops if credentials are missing, logging the failure to `invoiceSentLog`. |
| **Respondent email field is empty or invalid** | The sender validates the email before sending. If the email is missing or doesn't contain `@`, it logs a `failed` entry to `invoiceSentLog` with `errorMessage: 'Could not resolve respondent email address'`. The submission still completes. |
| **Invoice number collisions under high concurrency** | Invoice numbers are generated by counting existing entries in `invoiceSentLog` per form. Under concurrent submissions, two invoices could get the same number. Add a unique constraint on `(form_id, invoice_number)` and use `ON CONFLICT` retry logic. For v1, accept the very low likelihood of collision (forms don't typically get concurrent paid submissions). |
| **Email body template is too large** | `body_template` is `TEXT` (no limit in PostgreSQL). Validate client-side: max 100KB. If a creator needs more, they can host images elsewhere and link them. |

---

## 10. Validation / Testing

- [ ] DB migration runs successfully; `form_invoice_configs` and `invoice_sent_log` tables exist
- [ ] "Invoicing" tab appears in form editor navigation, links to `/forms/$formId/invoicing`
- [ ] Invoice config page loads, shows disabled state with email setup banner when no credentials
- [ ] Toggle invoice ON, fill all required fields → "Send Test" button becomes active
- [ ] Click "Send Test" → test email arrives with sample data and correct formatting
- [ ] Variable picker inserts `{{variable_name}}` at cursor position in the text editor
- [ ] Live preview updates as template fields are edited
- [ ] Create a paid form, configure invoicing, respondent pays → invoice email received with correct amount, invoice number, and form field data
- [ ] Create a free form, configure invoicing, respondent submits → confirmation email received (no payment details)
- [ ] Invoice numbers are sequential per form: `INV-1000`, `INV-1001`, `INV-1002`
- [ ] Failed email send (wrong credentials) → submission still succeeds, failure logged to `invoiceSentLog`, no error shown to respondent
- [ ] Sent invoices table shows recent entries with correct status badges (sent/failed)
- [ ] Retry button on failed invoices re-attempts the send
- [ ] Deleted form cascades: `form_invoice_configs` and `invoice_sent_log` rows are removed
