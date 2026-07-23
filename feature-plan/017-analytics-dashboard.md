# FT-017: Form Analytics Dashboard — Views, Conversion & Revenue Tracking

> **Feature Plan** — A per-form analytics page showing submission counts, visitor-to-submission conversion rate, revenue collected, page-by-page abandonment data, and time-series activity charts. Gives form creators visibility into how their forms are performing so they can optimize for higher completion and payment rates.

**Status:** 🚧 **Planned** — not yet implemented

**Dependencies:**
- ✅ **FT-007 (Page Builder)** — Analytics tracks multi-page form behavior. Page-by-page drop-off data depends on the `formSubmissionSessions` table and the page-based form architecture.
- ✅ **Existing `formSubmissions` + `payments` tables** — All submission and payment timestamps already exist. Analytics is primarily a read-only aggregation layer on top of these tables.
- ✅ **Recharts** (`recharts` ^3.9.1 already in `package.json`) — Time-series charts, bar charts, and pie charts for the analytics UI.
- 🚧 **FT-006 (DataTable / Submissions View)** — The analytics page complements the submissions table. Having a sortable/filterable DataTable (FT-006) makes the analytics page feel more complete.
- ⬜ **FT-018 (Payment Links)** — If standalone payment links are built, those should report into the same analytics dashboard.

---

## 1. User Story & Problem

### 1.1 Current State

A PonkoForm creator publishes a form, shares the link, and... that's it. They have **zero visibility** into what happens next:

| Question | Can they answer it today? |
|---|---|
| How many people visited my form? | ❌ No |
| What percentage of visitors actually submitted? | ❌ No |
| Which page do people drop off on? | ❌ No |
| How much revenue has this form generated? | ⚠️ Manually — sum the payments table |
| Is my form performing better this week vs. last week? | ❌ No |
| Which payment gateway converts better? | ❌ No |

The only feedback loop is: check submissions manually → see if any came in.

### 1.2 What Creators Want

> *"I run a paid workshop registration form. I shared the link on Facebook and Instagram. I want to know: how many people opened the form from each platform, how many completed registration, and how many abandoned on the payment page. Without this data, I'm guessing."*

### 1.3 The Gap

The database already has everything needed:
- `formSubmissions` has `submitted_at` timestamps
- `payments` has `amount`, `status`, `created_at`
- `formSubmissionSessions` tracks page-by-page progress

What's missing is the **aggregation layer**, the **visit tracking**, and the **visual dashboard** to surface this data.

---

## 2. System Design — DB Schema & Architecture

### 2.1 New Table: `form_visits`

Track every visit to a shared form page — lightweight, privacy-respecting, no cookies.

```sql
CREATE TABLE form_visits (
  id SERIAL PRIMARY KEY,
  form_id INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  session_id INTEGER REFERENCES form_submission_sessions(id) ON DELETE SET NULL,
  referrer TEXT,
  user_agent TEXT,
  ip_hash TEXT,                 -- SHA-256 hash of IP (not raw IP)
  country TEXT,                 -- GeoIP-derived (optional, via CF headers)
  visited_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE INDEX form_visits_form_id_visited_at_idx ON form_visits(form_id, visited_at);
```

```typescript
// In src/db/schema.ts
export const formVisits = pgTable(
  'form_visits',
  {
    id: serial().primaryKey(),
    formId: integer('form_id').notNull().references(() => forms.id, { onDelete: 'cascade' }),
    sessionId: integer('session_id').references(() => formSubmissionSessions.id, { onDelete: 'set null' }),
    referrer: text('referrer'),
    userAgent: text('user_agent'),
    ipHash: text('ip_hash'),
    country: text('country'),
    visitedAt: timestamp('visited_at').defaultNow().notNull(),
  },
  (table) => [index('form_visits_form_id_visited_at_idx').on(table.formId, table.visitedAt)],
)
```

### 2.2 Architecture — Data Flow

```
Respondent opens shared form URL
         │
         ▼
PublicFormView loads → fires lightweight beacon
  └─ POST /api/analytics/visit { formId, referrer }
  └─ Server inserts form_visits row (non-blocking, fire-and-forget)
         │
         ▼
Respondent fills form → submits
  └─ formSubmissions row created (existing)
  └─ formSubmissionSessions records page-by-page progress (existing)
         │
         ▼
Creator opens Analytics tab → GET getFormAnalytics
  └─ Aggregates form_visits + formSubmissions + payments
  └─ Returns:
       {
         totalVisits: 523,
         totalSubmissions: 87,
         conversionRate: 0.166,     // 16.6%
         totalRevenue: 1250000,     // in minor units (₱12,500.00)
         visitsByDay: [{ date, count }, ...],
         submissionsByDay: [{ date, count }, ...],
         pageDropOffs: [{ pageIndex, title, visits, submissions, dropRate }, ...],
         paymentBreakdown: { paypal: { count, revenue }, xendit: { count, revenue } },
         referrerBreakdown: [{ referrer, visits, submissions, conversionRate }, ...],
         period: { from, to }
       }
```

### 2.3 Aggregation Strategy

Rather than querying raw tables on every page load (slow for forms with thousands of submissions), cache analytics in a materialized view or a simple cache table:

**Option A — Real-time aggregation (for now):** Query `form_visits`, `formSubmissions`, `payments` with date filters. Acceptable for forms with <10K submissions. Add indexes to make this fast.

**Option B — Pre-aggregated cache (later):** A `form_analytics_cache` table refreshed via a scheduled cron or on-demand. This is premature optimization for the initial build.

**Decision: Option A** — real-time queries with good indexes. The existing tables are already indexed on `form_id`. Add a composite index on `form_visits(form_id, visited_at)` for fast date-range queries.

---

## 3. UI Design — Where It Lives, Component Tree

### 3.1 Route Placement

A new **Analytics tab** in the form editor navigation. The existing form editor tabs at `src/routes/forms/$formId/` are:

| File | Tab |
|---|---|
| `edit.tsx` | Builder |
| `flow.tsx` | Flow (if applicable) |
| `submissions.tsx` | Submissions |
| `payments.tsx` | Payments |
| `invoicing.tsx` | Invoicing |

**New route:** `src/routes/forms/$formId/analytics.tsx`

```tsx
// src/routes/forms/$formId/analytics.tsx
export const Route = createFileRoute('/forms/$formId/analytics')({
  beforeLoad: () => requireAuth(),
  component: FormAnalyticsPage,
})
```

### 3.2 Navigation Update

Add the Analytics tab in `FormSectionNav` component, which renders the tab bar across form pages. (Located in `src/components/forms/FormSectionNav.tsx`).

### 3.3 Component Tree

```
src/routes/forms/$formId/analytics.tsx
  └─ FormAnalyticsPage
       ├─ AnalyticsPeriodSelector          ← Date range picker (7d / 30d / 90d / custom)
       ├─ AnalyticsSummaryCards             ← 4 KPI cards in a grid
       │    ├─ Total Visits
       │    ├─ Submissions
       │    ├─ Conversion Rate (%)
       │    └─ Revenue (₱)
       ├─ VisitsChart                       ← Recharts AreaChart (visits over time)
       ├─ SubmissionsChart                  ← Recharts BarChart (submissions over time)
       ├─ PageDropOffFunnel                 ← Horizontal bar chart showing drop-off per page
       ├─ PaymentGatewayBreakdown           ← Pie/donut chart (PayPal vs Xendit revenue)
       └─ ReferrerTable                     ← Table of top referrers + conversion rates
```

### 3.4 Mockup — Analytics Page Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back to forms    Registration Form    [Builder] [Analytics] ...  │
│─────────────────────────────────────────────────────────────────────│
│                                                                      │
│  Period: [Last 30 days ▼]                             Export CSV    │
│                                                                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐  │
│  │  👁 523       │ │  ✅ 87        │ │  📈 16.6%     │ │  💰 ₱12,500 │  │
│  │  Total Visits │ │  Submissions  │ │  Conv. Rate   │ │  Revenue    │  │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Visits & Submissions Over Time                                │   │
│  │  ██ Visits  ██ Submissions                                     │   │
│  │  ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄   │   │
│  │  Jun 23      Jun 30      Jul 7       Jul 14      Jul 21       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────┐ ┌──────────────────────────────┐   │
│  │  Page Drop-Off Funnel       │ │  Revenue by Gateway           │   │
│  │  Page 1: Personal Info  ████│ │  ┌──────┐                     │   │
│  │  Page 2: Select Plan    ███ │ │  │ Xendit│ ████████  ₱9,200   │   │
│  │  Page 3: Payment        ██  │ │  │ PayPal│ ████      ₱3,300   │   │
│  │  Page 4: Confirmation   █   │ │  └──────┘                     │   │
│  └─────────────────────────────┘ └──────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Top Referrers                                                 │   │
│  │  Source          Visits    Submissions    Conv. Rate           │   │
│  │  facebook.com    312       58             18.6%                │   │
│  │  Direct          145       22             15.2%                │   │
│  │  instagram.com   66        7              10.6%                │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Server Functions

### 4.1 Visit Tracking Beacon

```typescript
// src/lib/server-fns/analytics.ts

export const trackVisit = createServerFn({ method: 'POST', strict: false })
  .inputValidator((data: { formId: number; referrer?: string }) => data)
  .handler(async ({ data }) => {
    // Fire-and-forget — don't block the page render
    const ipHash = await hashIp(getClientIP())
    await db.insert(formVisits).values({
      formId: data.formId,
      referrer: data.referrer ?? null,
      ipHash,
      userAgent: getHeader('user-agent') ?? null,
      country: getHeader('cf-ipcountry') ?? null, // Cloudflare
    })
    return { ok: true }
  })
```

### 4.2 Analytics Aggregation

```typescript
export const getFormAnalytics = createServerFn({ method: 'GET' })
  .inputValidator((data: { formId: number; days?: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    // Verify form ownership...

    const days = data.days ?? 30
    const since = new Date()
    since.setDate(since.getDate() - days)

    const [visits, submissions, payments, sessions] = await Promise.all([
      db.select({ count: count() }).from(formVisits)
        .where(and(eq(formVisits.formId, data.formId), gte(formVisits.visitedAt, since))),
      db.select({ count: count() }).from(formSubmissions)
        .where(and(eq(formSubmissions.formId, data.formId), gte(formSubmissions.submittedAt, since))),
      db.select({ amount: sum(payments.paidAmount), gatewayId: payments.paymentGatewayId })
        .from(payments)
        .innerJoin(formSubmissions, eq(payments.formSubmissionId, formSubmissions.id))
        .where(and(eq(formSubmissions.formId, data.formId), eq(payments.status, 'completed'), gte(payments.paidAt, since)))
        .groupBy(payments.paymentGatewayId),
      // Daily breakdown queries...
    ])

    return {
      totalVisits: visits[0].count,
      totalSubmissions: submissions[0].count,
      conversionRate: submissions[0].count / Math.max(visits[0].count, 1),
      totalRevenue: payments.reduce((sum, p) => sum + Number(p.amount ?? 0), 0),
      // ... daily breakdowns, page drop-offs, referrer data
    }
  })
```

---

## 5. Integration Points

### 5.1 Visit Tracking Injection

Add the beacon call in `src/components/public-form/PublicFormView.tsx` (line ~290, in the component body):

```tsx
useEffect(() => {
  if (formId) {
    trackVisit({ data: { formId, referrer: document.referrer || undefined } })
  }
}, [formId])
```

And in `src/components/page-form/PageFormView.tsx` similarly when the page form loads.

### 5.2 Page Drop-Off Tracking

The `formSubmissionSessions` table already records `currentPageIndex` and `status`. Page drop-off is calculated server-side:

```sql
-- For each page, count sessions that reached this page but never advanced further
SELECT
  p.position AS page_index,
  p.title,
  COUNT(DISTINCT s.id) AS sessions_reached,
  COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN s.id END) AS sessions_completed
FROM form_pages p
LEFT JOIN form_submission_sessions s ON s.form_id = p.form_id
  AND s.collected_data IS NOT NULL
WHERE p.form_id = :formId
GROUP BY p.position, p.title
ORDER BY p.position
```

---

## 6. File Change Summary

| File | Purpose |
|---|---|
| `src/db/schema.ts` | Add `formVisits` table definition |
| `drizzle/0027_form_visits.sql` | Generated migration |
| `src/lib/server-fns/analytics.ts` (new) | `trackVisit`, `getFormAnalytics` server functions |
| `src/routes/forms/$formId/analytics.tsx` (new) | Analytics page route |
| `src/components/forms/AnalyticsSummaryCards.tsx` (new) | KPI cards component |
| `src/components/forms/AnalyticsCharts.tsx` (new) | Recharts chart components |
| `src/components/forms/AnalyticsFunnel.tsx` (new) | Page drop-off funnel chart |
| `src/components/forms/FormSectionNav.tsx` (modify) | Add "Analytics" tab to form section navigation |
| `src/components/public-form/PublicFormView.tsx` (modify) | Add `trackVisit` beacon on form load |
| `src/components/page-form/PageFormView.tsx` (modify) | Add `trackVisit` beacon on form load |
| `src/routes/forms/$formId/edit.tsx` (modify) | Wire FormSectionNav with analytics tab |

---

## 7. Step-by-Step Tasks

### Task 1: DB Migration — `form_visits` table
- Add `formVisits` to `src/db/schema.ts`
- Run `pnpm db:generate` to create migration
- Run `pnpm db:migrate` to apply

### Task 2: Server Functions — analytics CRUD
- Create `src/lib/server-fns/analytics.ts`
- Implement `trackVisit` — lightweight fire-and-forget visit recording
- Implement `getFormAnalytics` — aggregate visits, submissions, payments, page drop-offs, referrer data
- Implement `getDailyBreakdown` — time-series data for charts

### Task 3: Analytics Page Route
- Create `src/routes/forms/$formId/analytics.tsx`
- Implement `FormAnalyticsPage` component with period selector
- Wire `beforeLoad` auth guard (reuse pattern from other form tabs)

### Task 4: Analytics UI Components
- Create `AnalyticsSummaryCards.tsx` — 4 KPI cards (visits, submissions, conversion rate, revenue)
- Create `AnalyticsCharts.tsx` — Recharts AreaChart + BarChart for time-series
- Create `AnalyticsFunnel.tsx` — Horizontal bar chart for page drop-off
- All components use PonkoForm design tokens and card patterns

### Task 5: Navigation — Add Analytics Tab
- In `FormSectionNav.tsx`, add "Analytics" tab between existing tabs
- Tab icon: `BarChart3` from lucide-react
- Highlight when on `/forms/$formId/analytics`

### Task 6: Visit Tracking Beacon
- In `PublicFormView.tsx`, add `useEffect` to call `trackVisit` on mount
- In `PageFormView.tsx`, add `useEffect` to call `trackVisit` on mount
- Pass `document.referrer` for referrer tracking
- Ensure the beacon is non-blocking (fire-and-forget pattern)

### Task 7: Test + Validate
- Test with a form that has 0 visits → shows empty state
- Test with a form that has visits but no submissions → shows 0% conversion
- Test page drop-off funnel with multi-page form data
- Test period selector (7d / 30d / 90d / custom)

---

## 8. Risks & Open Questions

| Risk / Question | Mitigation / Answer |
|---|---|
| **Visit tracking adds latency to form load** | The `trackVisit` beacon is fire-and-forget (`POST` with no `await` on response). The form renders before the beacon completes. If the beacon fails, the form still works. |
| **Privacy concerns — tracking IP addresses** | Only store `SHA-256(ip)` — a one-way hash. No raw IP addresses stored. No cookies. No fingerprinting. This is compliant with GDPR "legitimate interest" for basic analytics. |
| **Large forms with 10K+ visits — aggregation queries get slow** | The initial implementation uses direct SQL aggregates. For forms exceeding 10K visits, add a `form_analytics_daily` cache table refreshed via a lightweight cron. The `form_visits` table has a composite index on `(form_id, visited_at)` for fast range scans. |
| **Referrer data reliability** | `document.referrer` is only set for cross-origin navigations. Direct visits and same-origin navigations will show as `null`. This is expected behavior — label them as "Direct" in the UI. |
| **Bot traffic inflating visit counts** | Add a simple bot filter: skip visits where `user_agent` matches known bot patterns (Googlebot, AhrefsBot, etc.). A configurable blocklist in a constants file. |

---

## 9. Validation / Testing

- [ ] Visit tracking records a row in `form_visits` when a shared form is opened
- [ ] `getFormAnalytics` returns correct aggregates for a form with known submissions
- [ ] Page drop-off funnel matches expected values for a multi-page form
- [ ] Revenue breakdown correctly separates PayPal vs Xendit payments
- [ ] Period selector filters data to the correct date range
- [ ] Analytics page shows empty state when form has 0 visits
- [ ] Analytics page still loads when form has visits but 0 submissions
- [ ] Visit tracking doesn't block form rendering (beacon is async)
- [ ] No PII in `form_visits` — only SHA-256 hashed IPs
- [ ] Analytics tab appears in form section navigation for form owners only
