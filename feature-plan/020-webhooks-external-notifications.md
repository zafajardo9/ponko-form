# FT-020: Webhooks & External Notifications — Real-Time Event Streaming

> **Feature Plan** — Form creators can register webhook URLs that PonkoForm POSTs to on key events (`form.submitted`, `payment.completed`, `payment.failed`, `form.abandoned`). Each webhook is signed with a secret for verification, retried on failure, and logged in a delivery history. Turns PonkoForm from a data silo into an event-driven platform that integrates with any external system.

**Status:** 🚧 **Planned** — not yet implemented

**Dependencies:**
- ✅ **Existing submission flow** — `completePageSubmissionRecord` in `src/lib/page-builder/complete-submission.ts` (lines 33-133) is the primary injection point. Webhook dispatch fires after submission + email dispatch.
- ✅ **Existing payment flow** — `finalizePagePayment` in `src/lib/server-fns/page-forms.ts` (lines 1101-1156) is the payment verification injection point.
- ✅ **FT-013 (Invoice Builder)** — Confirmation/invoice emails already dispatch after submission. Webhooks are a complementary channel — same event, different delivery mechanism.
- 🚧 **FT-018 (Payment Links)** — Payment link events should also fire webhooks (`payment_link.paid`, `payment_link.created`).
- ⬜ **FT-022 (Email Automation)** — Webhooks can be used as triggers for external automation tools (Zapier, Make, n8n) while FT-022 handles built-in email automation.

---

## 1. User Story & Problem

### 1.1 Current State

When a respondent submits a form or completes a payment, the only thing that happens inside PonkoForm is:
1. The submission is saved to the database
2. An invoice/confirmation email is sent (if configured via FT-013)

What does NOT happen:
- The creator's CRM (HubSpot, Salesforce) does not get updated
- Their Slack channel does not get a notification
- Their Google Sheet does not get a new row
- Their custom backend does not receive the submission data
- Zapier/Make workflows do not fire

**The result:** Creators manually check PonkoForm for new submissions or set up janky email-parsing workarounds.

### 1.2 What Creators Want

> *"Every time someone registers for our workshop, I need their data sent to our Google Sheet and a Slack notification in #registrations. I don't want to check PonkoForm manually — I want it to push the data to us."*

> *"We built a custom dashboard that shows real-time donation stats. We need a webhook that fires every time a payment completes, with the amount, donor name, and timestamp."*

### 1.3 Events to Support

| Event | When it fires | Payload includes |
|---|---|---|
| `form.submitted` | A respondent completes and submits a form | `formId`, `submissionId`, `formData`, `submittedAt` |
| `payment.completed` | A payment is verified as completed | `paymentId`, `amount`, `currency`, `gateway`, `gatewayPaymentId`, `paidAt` |
| `payment.failed` | A payment fails or expires | `paymentId`, `amount`, `failureReason`, `failedAt` |
| `form.abandoned` | A session is abandoned (inactive for 24h) | `sessionId`, `formId`, `lastPageIndex`, `collectedData` |
| `payment_link.paid` | A standalone payment link is paid (FT-018) | `linkId`, `amount`, `currency`, `gatewayPaymentId` |

---

## 2. System Design — DB Schema & Architecture

### 2.1 New Table: `webhook_configs`

```sql
CREATE TABLE webhook_configs (
  id SERIAL PRIMARY KEY,
  form_id INTEGER REFERENCES forms(id) ON DELETE CASCADE,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret VARCHAR(64) NOT NULL,           -- HMAC-SHA256 signing secret
  events JSONB NOT NULL DEFAULT '[]',    -- ["form.submitted", "payment.completed"]
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE INDEX webhook_configs_form_id_idx ON webhook_configs(form_id);
CREATE INDEX webhook_configs_profile_id_idx ON webhook_configs(profile_id);
```

```typescript
// In src/db/schema.ts
export const webhookConfigs = pgTable(
  'webhook_configs',
  {
    id: serial().primaryKey(),
    formId: integer('form_id').references(() => forms.id, { onDelete: 'cascade' }),
    profileId: integer('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    secret: varchar('secret', { length: 64 }).notNull(),
    events: jsonb('events').$type<string[]>().notNull().default([]),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('webhook_configs_form_id_idx').on(table.formId),
    index('webhook_configs_profile_id_idx').on(table.profileId),
  ],
)
```

### 2.2 New Table: `webhook_deliveries`

```sql
CREATE TABLE webhook_deliveries (
  id SERIAL PRIMARY KEY,
  config_id INTEGER NOT NULL REFERENCES webhook_configs(id) ON DELETE CASCADE,
  event_type VARCHAR(80) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, delivered, failed
  response_code INTEGER,
  response_body TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  last_attempt_at TIMESTAMP,
  next_attempt_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE INDEX webhook_deliveries_config_id_idx ON webhook_deliveries(config_id);
CREATE INDEX webhook_deliveries_status_next_attempt_idx ON webhook_deliveries(status, next_attempt_at);
```

```typescript
// In src/db/schema.ts
export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: serial().primaryKey(),
    configId: integer('config_id').notNull().references(() => webhookConfigs.id, { onDelete: 'cascade' }),
    eventType: varchar('event_type', { length: 80 }).notNull(),
    payload: jsonb('payload').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    responseCode: integer('response_code'),
    responseBody: text('response_body'),
    attemptCount: integer('attempt_count').notNull().default(1),
    lastAttemptAt: timestamp('last_attempt_at'),
    nextAttemptAt: timestamp('next_attempt_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('webhook_deliveries_config_id_idx').on(table.configId),
    index('webhook_deliveries_status_next_attempt_idx').on(table.status, table.nextAttemptAt),
  ],
)
```

### 2.3 Architecture — Webhook Dispatch Flow

```
completePageSubmissionRecord() succeeds
         │
         ▼
dispatchWebhooks(formId, 'form.submitted', payload)
  └─ Query webhook_configs WHERE form_id = :formId AND :event IN events AND is_active = true
  └─ For each config:
       ├─ Build payload: { event, timestamp, data: {...} }
       ├─ Compute HMAC-SHA256 signature using config.secret
       ├─ POST to config.url with headers:
       │    X-PonkoForm-Event: form.submitted
       │    X-PonkoForm-Signature: sha256=<hex>
       │    X-PonkoForm-Delivery: <delivery_id>
       │    Content-Type: application/json
       ├─ Record webhook_deliveries row (pending → delivered/failed)
       └─ If response is 2xx → mark delivered
            If response is 5xx or timeout → schedule retry
            Retry: 3 attempts with exponential backoff (1m, 5m, 15m)
```

### 2.4 Signature Verification (for recipients)

The receiving server can verify the webhook came from PonkoForm:

```typescript
// Recipient verifies:
const signature = request.headers['x-ponkoform-signature'] // "sha256=abc123..."
const computed = crypto.createHmac('sha256', webhookSecret)
  .update(JSON.stringify(request.body))
  .digest('hex')
const isValid = crypto.timingSafeEqual(
  Buffer.from(`sha256=${computed}`),
  Buffer.from(signature)
)
```

### 2.5 Retry Scheduler

For the initial implementation, use a simple approach:

```typescript
// On each webhook delivery attempt:
if (response.ok) {
  await db.update(webhookDeliveries).set({
    status: 'delivered', responseCode: response.status, lastAttemptAt: new Date(), nextAttemptAt: null,
  }).where(eq(webhookDeliveries.id, delivery.id))
} else if (delivery.attemptCount < 3) {
  const delays = [60_000, 300_000, 900_000] // 1min, 5min, 15min
  const nextAttempt = new Date(Date.now() + delays[delivery.attemptCount])
  await db.update(webhookDeliveries).set({
    status: 'pending', attemptCount: delivery.attemptCount + 1,
    responseCode: response.status, lastAttemptAt: new Date(), nextAttemptAt: nextAttempt,
  }).where(eq(webhookDeliveries.id, delivery.id))
} else {
  await db.update(webhookDeliveries).set({
    status: 'failed', responseCode: response.status, lastAttemptAt: new Date(),
  }).where(eq(webhookDeliveries.id, delivery.id))
}
```

A lightweight retry worker (or a cron job) picks up `webhook_deliveries` where `status = 'pending' AND next_attempt_at <= now()`.

---

## 3. UI Design — Where It Lives, Component Tree

### 3.1 Route Placement

A new **"Webhooks"** tab in the form editor navigation, alongside Builder, Analytics, Submissions, Payments, Invoicing:

```
src/routes/forms/$formId/webhooks.tsx          ← NEW route
  └─ WebhooksPage
       ├─ WebhookList                           ← List of configured webhooks
       │    └─ WebhookCard (URL, events, status, last delivery)
       ├─ AddWebhookButton → AddWebhookDialog   ← Modal form
       └─ WebhookDeliveryLog                    ← Recent deliveries for a webhook
```

### 3.2 Component Tree

```
src/components/forms/WebhookCard.tsx (new)
  └─ Shows: URL, subscribed events (tags), active toggle, last delivery status
  └─ Expand to show recent delivery attempts

src/components/forms/AddWebhookDialog.tsx (new)
  └─ URL input (validated as https://)
  └─ Event checkboxes: form.submitted, payment.completed, payment.failed, form.abandoned
  └─ Auto-generated secret (shown once, copyable)
  └─ "Test webhook" button → sends a sample payload
```

### 3.3 Mockup — Webhooks Tab

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back to forms    Registration Form    [Builder] [Webhooks] ...   │
│─────────────────────────────────────────────────────────────────────│
│                                                                      │
│  Webhooks                                      [+ Add Webhook]      │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  https://api.mysite.com/ponkoform-webhook           [Active]  │   │
│  │  Events: form.submitted  payment.completed                     │   │
│  │  Secret: sk_abc123... (shown once)                    [Copy]   │   │
│  │  Last delivery: ✅ 2 minutes ago (200 OK)                      │   │
│  │  ──────────────────────────────────────────────────           │   │
│  │  Recent deliveries:                          [View all]        │   │
│  │  Jul 23 09:45  form.submitted     ✅ 200   0.3s                │   │
│  │  Jul 23 09:32  form.submitted     ✅ 200   0.2s                │   │
│  │  Jul 23 09:18  payment.completed  ✅ 200   0.4s                │   │
│  │  Jul 22 18:05  form.submitted     ❌ 500   (retrying...)       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  https://hooks.slack.com/services/T02...             [Active]  │   │
│  │  Events: form.submitted                                        │   │
│  │  Last delivery: ✅ 1 hour ago (200 OK)                          │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Server Functions

```typescript
// src/lib/server-fns/webhooks.ts (NEW)

export const getWebhookConfigs = createServerFn({ method: 'GET' })
  .inputValidator((data: { formId: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    // ... verify form ownership
    return db.select().from(webhookConfigs)
      .where(eq(webhookConfigs.formId, data.formId))
      .orderBy(desc(webhookConfigs.createdAt))
  })

export const createWebhookConfig = createServerFn({ method: 'POST' })
  .inputValidator((data: { formId: number; url: string; events: string[] }) => data)
  .handler(async ({ data }) => {
    // Validate URL is https://
    // Generate a random secret
    const secret = generateWebhookSecret() // 64-char random string
    const [config] = await db.insert(webhookConfigs).values({
      formId: data.formId, url: data.url, events: data.events, secret,
    }).returning()
    return { ...config, secret } // Return secret once (only time it's shown)
  })

export const toggleWebhook = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: number; isActive: boolean }) => data)
  .handler(async ({ data }) => {
    await db.update(webhookConfigs).set({ isActive: data.isActive, updatedAt: new Date() })
      .where(eq(webhookConfigs.id, data.id))
  })

export const testWebhook = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const [config] = await db.select().from(webhookConfigs).where(eq(webhookConfigs.id, data.id)).limit(1)
    if (!config) throw new Error('Webhook not found')
    await deliverWebhook(config, 'test.ping', { message: 'This is a test webhook from PonkoForm' })
  })

// ── Internal dispatch (called by submission/payment flows) ──

export async function dispatchWebhooks(
  formId: number,
  eventType: string,
  payload: Record<string, unknown>,
) {
  const configs = await db.select().from(webhookConfigs)
    .where(and(
      eq(webhookConfigs.formId, formId),
      eq(webhookConfigs.isActive, true),
    ))
  for (const config of configs) {
    const eventList = (config.events ?? []) as string[]
    if (!eventList.includes(eventType)) continue
    // Fire and forget — don't block the submission flow
    deliverWebhook(config, eventType, payload).catch(err =>
      console.error(`[webhook:${config.id}] Delivery failed`, err)
    )
  }
}
```

### 4.1 Injection Points

**Form submission** — in `src/lib/page-builder/complete-submission.ts` (line 129, after `dispatchSubmissionEmails`):

```typescript
await dispatchSubmissionEmails(submission.id).catch((error) => {
  console.error(`[submission:${submission.id}] Email dispatch failed`, error)
})
// NEW: Dispatch webhooks
dispatchWebhooks(session.formId, 'form.submitted', {
  submissionId: submission.id, formData: finalFormData, submittedAt: new Date().toISOString(),
}).catch((error) => {
  console.error(`[submission:${submission.id}] Webhook dispatch failed`, error)
})
```

**Payment completion** — in `src/lib/server-fns/page-forms.ts` `finalizePagePayment` (line 1135, after `completePaidPageSubmission`):

```typescript
const reconciliation = await reconcilePayment({ paymentId: payment.id, source: 'return' })
const paymentStatus = reconciliation.status
if (paymentStatus === 'completed') {
  await completePaidPageSubmission(session.id)
  // NEW: Dispatch payment webhook
  dispatchWebhooks(session.formId, 'payment.completed', {
    paymentId: payment.id, amount: payment.amount, currency: payment.currency,
    gatewayPaymentId: payment.gatewayPaymentId, paidAt: new Date().toISOString(),
  }).catch((error) => console.error(`[payment:${payment.id}] Webhook dispatch failed`, error))
}
```

---

## 5. File Change Summary

| File | Purpose |
|---|---|
| `src/db/schema.ts` | Add `webhookConfigs` + `webhookDeliveries` tables |
| `drizzle/0029_webhooks.sql` | Generated migration |
| `src/lib/server-fns/webhooks.ts` (new) | CRUD server functions + dispatch engine |
| `src/routes/forms/$formId/webhooks.tsx` (new) | Webhooks settings page route |
| `src/components/forms/WebhookCard.tsx` (new) | Webhook config card component |
| `src/components/forms/AddWebhookDialog.tsx` (new) | Modal for creating a webhook |
| `src/components/forms/FormSectionNav.tsx` (modify) | Add "Webhooks" tab to navigation |
| `src/lib/page-builder/complete-submission.ts` (modify, line 129) | Inject `dispatchWebhooks` after email dispatch |
| `src/lib/server-fns/page-forms.ts` (modify, line 1135) | Inject `dispatchWebhooks` on payment completion |

---

## 7. Step-by-Step Tasks

### Task 1: DB Migration
- Add `webhookConfigs` + `webhookDeliveries` to `src/db/schema.ts`
- Run `pnpm db:generate` + `pnpm db:migrate`

### Task 2: Webhook Delivery Engine
- Create `src/lib/server-fns/webhooks.ts`
- Implement `deliverWebhook()` — HMAC signing, HTTP POST, response handling
- Implement retry logic: 3 attempts with 1m/5m/15m backoff
- Implement `dispatchWebhooks()` — query active configs, filter by event, fire-and-forget

### Task 3: Server Functions — CRUD
- Implement `getWebhookConfigs`, `createWebhookConfig`, `deleteWebhookConfig`, `toggleWebhook`
- Implement `testWebhook` — sends a sample `test.ping` payload
- Implement `getWebhookDeliveries` — paginated delivery log per config

### Task 4: Webhooks UI Page
- Create `src/routes/forms/$formId/webhooks.tsx`
- List configured webhooks with status, events, last delivery
- Add "Add Webhook" button → opens dialog

### Task 5: AddWebhookDialog Component
- URL input with `https://` validation
- Event checkboxes
- Auto-generated secret display (copiable, shown once)
- Test webhook button

### Task 6: Injection — Submission Flow
- In `completePageSubmissionRecord`, add `dispatchWebhooks()` call after submission completes
- Pass `formId`, event `form.submitted`, and submission payload

### Task 7: Injection — Payment Flow
- In `finalizePagePayment`, add `dispatchWebhooks()` call on payment completion
- Pass `formId`, event `payment.completed`, and payment payload

### Task 8: Navigation Update
- Add "Webhooks" tab in `FormSectionNav.tsx`
- Icon: `Webhook` from lucide-react

### Task 9: Retry Worker (Lightweight)
- Create `scripts/retry-webhooks.ts` that queries `webhook_deliveries` with `status = 'pending' AND next_attempt_at <= now()` and retries them
- Add npm script: `"webhooks:retry": "tsx scripts/retry-webhooks.ts"`
- Recommendation: run via cron every 2 minutes in production

---

## 8. Risks & Open Questions

| Risk / Question | Mitigation / Answer |
|---|---|
| **Webhook endpoint is slow or hangs** | Set a 10-second timeout on the HTTP fetch. If the endpoint doesn't respond within 10s, treat as a failure and retry. |
| **Secret exposure** | The secret is shown only once (in the creation dialog). After that, it's stored in the DB (plaintext, since it's a signing secret, not an API key). If the creator loses it, they rotate by deleting and recreating the webhook. |
| **Large payloads** | Submission `formData` can be large (including file upload metadata). Webhook payloads include the full form data. If size becomes an issue, add a `fields` filter to the webhook config ("only send these fields"). |
| **Webhook spam on high-traffic forms** | The `dispatchWebhooks` call is fire-and-forget inside the submission flow — it doesn't block the response to the respondent. Each webhook delivery is a separate async operation. Rate limiting can be added later. |
| **No built-in retry worker in serverless** | The initial retry approach uses a scheduled script (`scripts/retry-webhooks.ts`). On Vercel, this can be run via Vercel Cron Jobs. On Render, via a cron job. For a fully serverless approach, use a message queue later. |

---

## 9. Validation / Testing

- [ ] Create a webhook config for a form → stored in DB with generated secret
- [ ] Submit the form → webhook delivery logged, recipient receives POST with correct payload
- [ ] Verify HMAC signature — recipient can validate using the shared secret
- [ ] Payment completes → `payment.completed` webhook fires with correct amount
- [ ] Webhook endpoint returns 500 → delivery marked as pending, retry scheduled
- [ ] After 3 failed retries → delivery marked as failed
- [ ] Test webhook button → recipient receives `test.ping` event
- [ ] Deactivate webhook → no deliveries fire for subsequent submissions
- [ ] Webhook tab appears in form section navigation
- [ ] Secret is shown once, not retrievable after creation
