# FT-022: Conditional Email Automation — Triggered Follow-Ups Based on Form Answers

> **Feature Plan** — Automatic emails sent to respondents based on their form answers. "If satisfaction < 3, send a follow-up email in 24 hours." "If they selected 'Enterprise Plan', send a personalized onboarding email immediately." Turns PonkoForm from a passive data collector into an active engagement platform that responds intelligently to what respondents tell you.

**Status:** 🚧 **Planned** — not yet implemented

**Dependencies:**
- ✅ **FT-007 (Page Builder)** — The submission data (`formSubmissions.formData`) contains all field values keyed by `bindVariable`. Automation rules reference these bind variables.
- ✅ **FT-013 (Invoice Builder / Email Delivery)** — The email delivery infrastructure (SMTP/Resend, template interpolation, `dispatchSubmissionEmails`) is already built. Automation emails reuse the same delivery pipeline.
- ✅ **FT-002 (Integrations Hub)** — SMTP/Resend credentials must be configured before automated emails can send.
- ✅ **FT-014 (Satisfaction Rating Field)** — The satisfaction field stores numeric values (1–5), making it a perfect trigger for conditional emails (e.g., "if satisfaction ≤ 2, send retention email").
- 🚧 **FT-020 (Webhooks)** — Automation emails and webhooks are complementary: webhooks notify external systems, emails engage respondents directly.
- ⬜ **FT-021 (Discount Codes)** — Could trigger a "You got a discount!" email when a code is applied.

---

## 1. User Story & Problem

### 1.1 Current State

When a respondent submits a form, PonkoForm sends exactly one email: the confirmation/invoice email configured in FT-013. That's it. No follow-ups, no conditional messaging, no drip sequences.

**What creators can't do today:**

| Scenario | Can they do it? |
|---|---|
| Low satisfaction score → send apology + discount offer 24h later | ❌ |
| Selected "Enterprise Plan" → send onboarding PDF immediately | ❌ |
| Payment above ₱10,000 → send personalized thank-you from CEO | ❌ |
| Abandoned form with email collected → send reminder after 2 hours | ❌ |
| Event registration → send "See you tomorrow!" 24h before event date | ❌ |

### 1.2 What Creators Want

> *"If a customer rates us 1 or 2 stars on the satisfaction survey, I want to automatically email them 24 hours later saying 'We're sorry you had a bad experience. Here's 20% off your next purchase.' This turns a negative moment into a retention opportunity."*

> *"When someone registers for our premium workshop (₱10,000+), I want them to immediately receive a personalized email with preparation materials, parking instructions, and my direct phone number. I don't want to manually send this every time."*

### 1.3 Automation Triggers

| Trigger | Example | Delay |
|---|---|---|
| **Field value match** | `satisfaction_score <= 2` | Immediate or delayed |
| **Payment amount threshold** | `payment.amount > 1000000` (₱10,000) | After payment verified |
| **Payment completed** | Any successful payment | Immediate or delayed |
| **Form submitted** | Any submission | Immediate (like FT-013 confirmation) or delayed |
| **Date field approaching** | `event_date` is 1 day away | Scheduled based on field value |

---

## 2. System Design — DB Schema & Architecture

### 2.1 New Table: `email_automations`

```sql
CREATE TABLE email_automations (
  id SERIAL PRIMARY KEY,
  form_id INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger_type VARCHAR(30) NOT NULL,       -- 'field_value' | 'payment_amount' | 'payment_completed' | 'form_submitted' | 'date_approaching'
  trigger_field VARCHAR(100),              -- bindVariable (for field_value and date_approaching)
  trigger_operator VARCHAR(20),            -- 'equals' | 'not_equals' | 'less_than' | 'greater_than' | 'less_than_or_equal' | 'greater_than_or_equal' | 'contains'
  trigger_value TEXT,                      -- Value to compare against
  delay_minutes INTEGER NOT NULL DEFAULT 0,  -- 0 = immediate, 1440 = 24 hours, etc.
  email_to_field VARCHAR(100),             -- bindVariable for the field that contains the respondent's email
  email_subject VARCHAR(255) NOT NULL,
  email_body TEXT NOT NULL,
  email_body_plain TEXT,                   -- Plain text fallback
  from_name VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMP,
  total_sent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE INDEX email_automations_form_id_idx ON email_automations(form_id);
```

```typescript
// In src/db/schema.ts
export const emailAutomations = pgTable(
  'email_automations',
  {
    id: serial().primaryKey(),
    formId: integer('form_id').notNull().references(() => forms.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    triggerType: varchar('trigger_type', { length: 30 }).notNull(),
    triggerField: varchar('trigger_field', { length: 100 }),
    triggerOperator: varchar('trigger_operator', { length: 20 }),
    triggerValue: text('trigger_value'),
    delayMinutes: integer('delay_minutes').notNull().default(0),
    emailToField: varchar('email_to_field', { length: 100 }),
    emailSubject: varchar('email_subject', { length: 255 }).notNull(),
    emailBody: text('email_body').notNull(),
    emailBodyPlain: text('email_body_plain'),
    fromName: varchar('from_name', { length: 255 }),
    isActive: boolean('is_active').notNull().default(true),
    lastTriggeredAt: timestamp('last_triggered_at'),
    totalSent: integer('total_sent').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('email_automations_form_id_idx').on(table.formId)],
)
```

### 2.2 New Table: `email_automation_logs`

Tracks every automation email sent for auditing.

```sql
CREATE TABLE email_automation_logs (
  id SERIAL PRIMARY KEY,
  automation_id INTEGER NOT NULL REFERENCES email_automations(id) ON DELETE CASCADE,
  form_submission_id INTEGER NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'sent',   -- 'sent' | 'failed'
  error_message TEXT,
  triggered_at TIMESTAMP DEFAULT now() NOT NULL,
  sent_at TIMESTAMP
);

CREATE INDEX email_automation_logs_automation_id_idx ON email_automation_logs(automation_id);
```

```typescript
export const emailAutomationLogs = pgTable(
  'email_automation_logs',
  {
    id: serial().primaryKey(),
    automationId: integer('automation_id').notNull().references(() => emailAutomations.id, { onDelete: 'cascade' }),
    formSubmissionId: integer('form_submission_id').notNull().references(() => formSubmissions.id, { onDelete: 'cascade' }),
    recipientEmail: varchar('recipient_email', { length: 255 }).notNull(),
    subject: varchar('subject', { length: 255 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('sent'),
    errorMessage: text('error_message'),
    triggeredAt: timestamp('triggered_at').defaultNow().notNull(),
    sentAt: timestamp('sent_at'),
  },
  (table) => [index('email_automation_logs_automation_id_idx').on(table.automationId)],
)
```

### 2.3 Architecture — Trigger Evaluation & Delivery

```
Form submission completes
         │
         ▼
completePageSubmissionRecord() succeeds
         │
         ▼
evaluateEmailAutomations(formId, submissionId, formData)
  └─ Query email_automations WHERE form_id = :formId AND is_active = true
  └─ For each automation:
       ├─ Evaluate trigger:
       │    triggerType = 'field_value'  → formData[triggerField] <operator> triggerValue
       │    triggerType = 'payment_completed' → submission has a successful payment
       │    triggerType = 'form_submitted' → always true
       │    triggerType = 'payment_amount' → payment.amount <operator> triggerValue
       │
       ├─ If trigger matches:
       │    ├─ Resolve respondent email from formData[emailToField]
       │    ├─ Interpolate email body with {{variables}} from formData + submission
       │    ├─ If delayMinutes > 0:
       │    │    └─ Schedule delivery: INSERT into email_automation_queue (to be picked up by scheduler)
       │    └─ If delayMinutes == 0:
       │         └─ Send immediately via existing email pipeline (dispatchSubmissionEmails pattern)
       │
       └─ Log to email_automation_logs
```

### 2.4 Delayed Email Queue (Lightweight)

For the initial implementation, use a simple scheduled approach rather than a message queue:

```sql
CREATE TABLE email_automation_queue (
  id SERIAL PRIMARY KEY,
  automation_id INTEGER NOT NULL REFERENCES email_automations(id) ON DELETE CASCADE,
  form_submission_id INTEGER NOT NULL REFERENCES form_submissions(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body_html TEXT NOT NULL,
  body_plain TEXT,
  from_name VARCHAR(255),
  scheduled_for TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  sent_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE INDEX email_automation_queue_status_scheduled_idx ON email_automation_queue(status, scheduled_for);
```

A lightweight script (`scripts/process-email-queue.ts`) runs every minute via cron:

```bash
# Runs every minute in production
*/1 * * * * tsx scripts/process-email-queue.ts
```

It queries `email_automation_queue WHERE status = 'queued' AND scheduled_for <= NOW()` and sends each email, updating status to `sent` or `failed`.

---

## 3. UI Design — Where It Lives, Component Tree

### 3.1 Route Placement

New tab in the form editor: **"Automations"**:

```
src/routes/forms/$formId/automations.tsx         ← NEW route
  └─ AutomationsPage
       ├─ AutomationList                           ← List of configured automations
       │    └─ AutomationCard (name, trigger description, delay, status, sent count)
       ├─ AddAutomationButton → AutomationEditor
       └─ AutomationLog                            ← Recent sends for an automation
```

### 3.2 Automation Editor (Modal or Inline)

```
┌──────────────────────────────────────────────────────────────┐
│  New Automation                                               │
│──────────────────────────────────────────────────────────────│
│                                                                │
│  Name                                                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Low satisfaction follow-up                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  Description                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Sends an apology email when satisfaction is 2 or below   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  Trigger                                                        │
│  ┌────────────────────┐ ┌──────────┐ ┌──────┐                │
│  │ Satisfaction Score │ │ <=       │ │  2   │                │
│  └────────────────────┘ └──────────┘ └──────┘                │
│                                                                │
│  Send to                                                        │
│  ┌────────────────────┐                                       │
│  │ Email field        │  (resolved from form data)            │
│  └────────────────────┘                                       │
│                                                                │
│  Delay                                                         │
│  ┌────────┐ ┌──────────────────┐                              │
│  │   24   │ │ Hours         [▼]│                              │
│  └────────┘ └──────────────────┘                              │
│                                                                │
│  ── Email Content ──                                          │
│  Subject                                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ We're sorry about your experience, {{full_name}}         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  Body (HTML)                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ <h1>Hi {{full_name}},</h1>                               │  │
│  │ <p>We noticed you rated your experience {{rating}}.      │  │
│  │ We take feedback seriously and want to make it right.</p> │  │
│  │ <p>Here's a <strong>20% discount</strong> on your next   │  │
│  │ visit. Use code <strong>SORRY20</strong> at checkout.</p> │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  Available variables: {{full_name}}, {{rating}}, {{email}}     │
│                                                                │
│  [Test Email]                              [Cancel]  [Save]    │
└──────────────────────────────────────────────────────────────┘
```

### 3.3 Automation Card in List

```
┌──────────────────────────────────────────────────────────────┐
│  Low satisfaction follow-up                      [Active ↕]  │
│  When Satisfaction Score <= 2 → send after 24 hours           │
│  To: email field · Sent: 12 emails                            │
│  ──────────────────────────────────────────────────────────── │
│  Last triggered: Jul 23, 2026 09:45 AM                        │
│  Recent: ✅ sent  ✅ sent  ❌ failed (no email found)         │
│                                               [Edit] [Delete] │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Server Functions

```typescript
// src/lib/server-fns/email-automations.ts (NEW)

export const getEmailAutomations = createServerFn({ method: 'GET' })
  .inputValidator((data: { formId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    // ...verify form ownership
    return db.select().from(emailAutomations)
      .where(eq(emailAutomations.formId, data.formId))
      .orderBy(desc(emailAutomations.createdAt))
  })

export const createEmailAutomation = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    formId: number; name: string; description?: string;
    triggerType: string; triggerField?: string; triggerOperator?: string; triggerValue?: string;
    delayMinutes: number; emailToField?: string;
    emailSubject: string; emailBody: string; emailBodyPlain?: string; fromName?: string;
  }) => data)
  .handler(async ({ data }) => {
    const [automation] = await db.insert(emailAutomations).values(data).returning()
    return automation
  })

export const toggleEmailAutomation = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: number; isActive: boolean }) => data)
  .handler(async ({ data }) => {
    await db.update(emailAutomations).set({ isActive: data.isActive, updatedAt: new Date() })
      .where(eq(emailAutomations.id, data.id))
  })

export const testAutomation = createServerFn({ method: 'POST' })
  .inputValidator((data: { automationId: number; testEmail: string }) => data)
  .handler(async ({ data }) => {
    // Send a test email to the specified address using the automation's subject + body
    const [automation] = await db.select().from(emailAutomations)
      .where(eq(emailAutomations.id, data.automationId)).limit(1)
    await sendAutomationEmail(automation, { email: data.testEmail, full_name: 'Test User' }, true)
  })

// ── Internal: Trigger evaluation ──

export async function evaluateEmailAutomations(
  formId: number,
  submissionId: number,
  formData: Record<string, unknown>,
  paymentAmount?: number,
) {
  const automations = await db.select().from(emailAutomations)
    .where(and(eq(emailAutomations.formId, formId), eq(emailAutomations.isActive, true)))

  for (const automation of automations) {
    let triggered = false

    switch (automation.triggerType) {
      case 'form_submitted':
        triggered = true
        break
      case 'field_value': {
        const fieldValue = formData[automation.triggerField!]
        triggered = evaluateCondition(fieldValue, automation.triggerOperator!, automation.triggerValue!)
        break
      }
      case 'payment_completed':
        triggered = paymentAmount != null && paymentAmount > 0
        break
      case 'payment_amount': {
        const threshold = Number(automation.triggerValue)
        triggered = evaluateCondition(paymentAmount, automation.triggerOperator!, threshold)
        break
      }
    }

    if (!triggered) continue

    const recipientEmail = automation.emailToField
      ? String(formData[automation.emailToField] ?? '')
      : null
    if (!recipientEmail) {
      await logAutomationResult(automation.id, submissionId, '', 'failed', 'No recipient email found')
      continue
    }

    const interpolated = interpolateTemplate(automation.emailSubject, automation.emailBody, formData, submissionId)

    if (automation.delayMinutes > 0) {
      // Queue for later delivery
      await db.insert(emailAutomationQueue).values({
        automationId: automation.id,
        formSubmissionId: submissionId,
        recipientEmail,
        subject: interpolated.subject,
        bodyHtml: interpolated.bodyHtml,
        bodyPlain: automation.emailBodyPlain ?? stripHtml(interpolated.bodyHtml),
        fromName: automation.fromName,
        scheduledFor: new Date(Date.now() + automation.delayMinutes * 60_000),
        status: 'queued',
      })
    } else {
      // Send immediately
      try {
        await sendAutomationEmail({ ...automation, emailSubject: interpolated.subject, emailBody: interpolated.bodyHtml }, { email: recipientEmail, ...formData })
        await logAutomationResult(automation.id, submissionId, recipientEmail, 'sent')
      } catch (error) {
        await logAutomationResult(automation.id, submissionId, recipientEmail, 'failed', String(error))
      }
    }

    await db.update(emailAutomations).set({
      lastTriggeredAt: new Date(),
      totalSent: sql`total_sent + 1`,
      updatedAt: new Date(),
    }).where(eq(emailAutomations.id, automation.id))
  }
}

function evaluateCondition(
  actual: unknown,
  operator: string,
  expected: string | number,
): boolean {
  const a = typeof actual === 'number' ? actual : Number(actual)
  const e = typeof expected === 'number' ? expected : Number(expected)
  switch (operator) {
    case 'equals': return String(actual) === String(expected)
    case 'not_equals': return String(actual) !== String(expected)
    case 'less_than': return a < e
    case 'greater_than': return a > e
    case 'less_than_or_equal': return a <= e
    case 'greater_than_or_equal': return a >= e
    case 'contains': return String(actual).toLowerCase().includes(String(expected).toLowerCase())
    default: return false
  }
}
```

### 4.1 Injection Point

In `src/lib/page-builder/complete-submission.ts` (line 129), after submission completes:

```typescript
await dispatchSubmissionEmails(submission.id).catch((error) => {
  console.error(`[submission:${submission.id}] Email dispatch failed`, error)
})
// NEW
const paymentPage = pages.find((page) => page.hasPayment)
const paymentAmount = paymentPage ? /* resolve payment amount from session */ undefined : undefined
evaluateEmailAutomations(session.formId, submission.id, finalFormData, paymentAmount).catch((error) => {
  console.error(`[submission:${submission.id}] Automation evaluation failed`, error)
})
```

---

## 5. File Change Summary

| File | Purpose |
|---|---|
| `src/db/schema.ts` | Add `emailAutomations` + `emailAutomationLogs` + `emailAutomationQueue` tables |
| `drizzle/0031_email_automations.sql` | Generated migration |
| `src/lib/server-fns/email-automations.ts` (new) | CRUD server functions + trigger evaluation engine + template interpolation |
| `src/routes/forms/$formId/automations.tsx` (new) | Automation management page route |
| `src/components/forms/AutomationCard.tsx` (new) | Card showing automation config + status |
| `src/components/forms/AutomationEditor.tsx` (new) | Full editor for trigger, delay, email content |
| `src/components/forms/FormSectionNav.tsx` (modify) | Add "Automations" tab |
| `src/lib/page-builder/complete-submission.ts` (modify, line 129) | Inject `evaluateEmailAutomations` after submission |
| `scripts/process-email-queue.ts` (new) | Cron script to process delayed emails |

---

## 7. Step-by-Step Tasks

### Task 1: DB Migration
- Add `emailAutomations`, `emailAutomationLogs`, `emailAutomationQueue` to `src/db/schema.ts`
- Run `pnpm db:generate` + `pnpm db:migrate`

### Task 2: Trigger Evaluation Engine
- Create `src/lib/server-fns/email-automations.ts`
- Implement `evaluateCondition()` for all operators
- Implement `evaluateEmailAutomations()` — query automations, evaluate triggers, dispatch/schedule
- Implement `interpolateTemplate()` — replace `{{variables}}` in subject + body

### Task 3: Server Functions — CRUD
- Implement `getEmailAutomations`, `createEmailAutomation`, `updateEmailAutomation`, `toggleEmailAutomation`, `deleteEmailAutomation`
- Implement `testAutomation` — send a test email to a specified address

### Task 4: Automation Management UI
- Create `src/routes/forms/$formId/automations.tsx`
- List configured automations with status and send counts
- Create button opens AutomationEditor

### Task 5: Automation Editor Component
- Trigger type selector (field value, payment amount, payment completed, form submitted)
- Dynamic trigger fields based on type
- Delay selector (0h, 1h, 6h, 24h, 48h, custom)
- Email subject + HTML body with variable autocomplete
- Test email button

### Task 6: Injection — Submission Flow
- In `completePageSubmissionRecord`, add `evaluateEmailAutomations()` after `dispatchSubmissionEmails`
- Pass formId, submissionId, formData, paymentAmount

### Task 7: Delayed Email Queue Processor
- Create `scripts/process-email-queue.ts`
- Query `email_automation_queue WHERE status = 'queued' AND scheduled_for <= NOW()`
- Send each email via existing email pipeline
- Update status to `sent` or `failed`

### Task 8: Navigation + Test
- Add "Automations" tab in `FormSectionNav.tsx`
- Icon: `Zap` from lucide-react
- End-to-end test: create automation, submit form that triggers it, verify email received

---

## 8. Risks & Open Questions

| Risk / Question | Mitigation / Answer |
|---|---|
| **No email field collected** | The automation config requires an `email_to_field` — a bind variable that maps to an email-type field. If the form doesn't have an email field before the satisfaction question, the automation won't fire (logged as "no recipient email found"). |
| **Delayed emails + serverless timeouts** | The email queue processing is done via a separate cron script (`process-email-queue.ts`), not inside the serverless function. This avoids the 10s timeout on Vercel functions. |
| **Template injection vulnerabilities** | The email body uses the same template interpolation as FT-013 (confirmed safe — no raw HTML from user input is rendered without sanitization). |
| **Automation loops** | None by design. Automations fire exactly once per submission (when `completePageSubmissionRecord` is called). They don't re-trigger on subsequent events. |
| **Large number of automations slowing submissions** | The evaluation runs async (`.catch()` in the injection point). If evaluation takes 2 seconds, the submission response to the respondent is already sent. |

---

## 9. Validation / Testing

- [ ] Create a "field_value" automation → submit form with matching value → automation fires
- [ ] Create a "field_value" automation → submit form with non-matching value → automation does NOT fire
- [ ] Create automation with 1 hour delay → email appears in queue with correct `scheduled_for`
- [ ] Run `process-email-queue.ts` → queued emails are sent and marked as `sent`
- [ ] Automation with no email field collected → logged as `failed` with "no recipient email found"
- [ ] Template variables `{{full_name}}`, `{{satisfaction_score}}` interpolated correctly in email body
- [ ] Test email button sends a test email to the creator's address
- [ ] Toggle automation inactive → no longer fires on new submissions
- [ ] Payment amount trigger fires only when payment is above threshold
- [ ] Multiple automations on the same form → all matching ones fire independently
