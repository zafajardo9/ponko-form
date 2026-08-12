# FT-010: Cold Start Resilience — Keep-Alive, Wake-Up Handling & Payment Step Recovery

> **Feature Plan** — Prevents the "server error" and stuck loading states that occur when public shared/embedded forms are left idle. Addresses Neon free-tier database sleep, Vercel serverless cold starts, and payment step hang recovery so respondents always see a working form, even after inactivity.

**Status:** ⚠️ **Partially implemented** — payment-step retry UI (`PagePaymentStep`) and the `reconcile-payments` cron exist; keep-alive layer missing: `/api/health` does not ping the DB, no `*/4` cron, no `RetryableQuery`

**Dependencies:**
- 🚧 **FT-009 (Production Reliability — DB & Form Rendering)** — this plan builds on FT-009's database driver switch and timeout guards. FT-009 fixes the TCP hang; FT-010 fixes the cold-start wake-up delay and idle timeout.
- ✅ **FT-007 (Form Builder Revision)** — the page form and payment step components this plan touches are from FT-007.
- ⬜ **FT-003 (Services Integration)** — payment gateway calls (PayPal/Xendit) are already wired; this plan improves their resilience during cold starts.

---

## 1. Problem — Idle Forms Break for Respondents

### 1.1 Two Symptoms, One Root Cause

| Symptom | What the respondent sees | When it happens |
|---------|------------------------|-----------------|
| **"Server error" on shared/embedded form** | Page loads blank or shows a generic error | After leaving the form tab idle for ~5+ minutes, then refreshing or navigating |
| **Payment page stuck on "loading" / "preparing secure connections"** | `PagePaymentStep` shows pulsing skeleton forever; gateway hosted page spins on "securing connection" | When the DB is asleep and a payment server function is called |

Both symptoms share the same trigger: **Neon free-tier database has entered sleep mode** after inactivity.

### 1.2 The Cold-Start Chain

```
Neon DB idle for ~5 minutes
        ↓
Neon suspends compute (free tier)
        ↓
Browser: respondent opens form link or clicks "Next" to a payment page
        ↓
Vercel: routes request to serverless function
        ↓
Vercel cold start: spins up function instance (0-2s)
        ↓
Function: calls server function (getPagePaymentOptions, startPageSession, etc.)
        ↓
drizzle-orm query → @neondatabase/serverless → HTTP POST to Neon SQL endpoint
        ↓
Neon: compute is ASLEEP → wakes up (1-5s) → processes query → responds
        ↓
Total delay: 2-10 seconds (Vercel cold start + Neon wake-up)
```

The problem is:
1. **No keep-alive**: Nothing pings the database periodically to prevent sleep
2. **No wake-up signaling**: The client doesn't know the DB is waking up — it just sees a loading state with no feedback
3. **Payment steps are the worst case**: `getPagePaymentOptions` + `initiatePagePayment` each need the DB; if both are slow, the respondent sees a loading skeleton, then a "preparing secure connection" spinner on the gateway's hosted page

### 1.3 Why It's Worse for Payments

The payment flow touches the database **three times** in sequence:

```
Step 1: PageFormView → advancePageSession (DB write — save collected data)
Step 2: PagePaymentStep → getPagePaymentOptions (DB read — resolve amount, currency, gateways)
Step 3: User clicks "Pay with PayPal" → initiatePagePayment (DB read/write — credentials, create payment record)
```

If any of these DB calls hit a sleeping Neon instance, the entire flow stalls. The worst case is Step 3 — the user has already filled out the form, clicked the payment button, and is staring at a loading state while the gateway's JS loads in a new page.

### 1.4 Neon Free Tier Sleep Behavior

From Neon documentation:
- **Suspend after**: ~5 minutes of no activity (no queries, no connections)
- **Wake-up time**: 1-5 seconds for the compute to restart
- **Scale-to-zero**: If no active connections, the compute shuts down entirely
- **Effect**: The first query after sleep initiates a compute restart; the query appears to hang until the compute is ready

---

## 2. System Design — Three-Layer Defense

```
┌──────────────────────────────────────────────────────────────────┐
│  LAYER 1: Keep-Alive — Prevent sleep in the first place          │
│  (Vercel Cron Job pings a lightweight endpoint every 4 minutes)  │
├──────────────────────────────────────────────────────────────────┤
│  LAYER 2: Wake-Up Buffer — Client retries with backoff           │
│  (Server functions return a "waking" status; client polls until  │
│   ready, with a progress indicator so the respondent isn't lost) │
├──────────────────────────────────────────────────────────────────┤
│  LAYER 3: Graceful Failure — Every component handles timeouts    │
│  (Loading skeletons have timeouts → fall back to retry UI;       │
│   payment steps show clear status instead of infinite spinners)  │
└──────────────────────────────────────────────────────────────────┘
```

### 2.1 Layer 1: Database Keep-Alive (Vercel Cron)

Add a lightweight **health-check server function** and a Vercel Cron Job that calls it every 4 minutes, preventing Neon from ever entering sleep mode.

**New server function** in `src/lib/server-fns/health.ts`:

```ts
import { createServerFn } from '@tanstack/react-start'
import { db } from '../../db/index'
import { sql } from 'drizzle-orm'

/**
 * Lightweight health check that keeps the Neon database from sleeping.
 * Called by Vercel Cron every 4 minutes.
 *
 * Returns the current timestamp so we can monitor uptime.
 */
export const healthCheck = createServerFn({ method: 'GET' }).handler(async () => {
  const [row] = await db.execute(sql`SELECT NOW()`)
  return { ok: true, ts: (row as any)?.now ?? new Date().toISOString() }
})
```

**New Vercel config** in `vercel.json`:

```json
{
  "buildCommand": "pnpm run build",
  "outputDirectory": "dist/client",
  "installCommand": "pnpm install",
  "regions": ["iad1"],
  "rewrites": [
    { "source": "/(.*)", "destination": "/api/index" }
  ],
  "crons": [
    {
      "path": "/_serverFn/<health-check-hash>",
      "schedule": "*/4 * * * *"
    }
  ]
}
```

**Note:** The cron path needs the server function's hash ID (determined at build time). The build generates a manifest mapping server function names to hashes. We'll determine the hash post-build and update `vercel.json`, or use a dedicated API route.

**Alternative approach if cron hashes are unstable:** Create a dedicated API route at `api/health.ts` that directly imports and calls `db.execute(sql`SELECT NOW()`)` — no TanStack Start RPC needed.

**Dedicated health API route** (`api/health.ts`):

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { neon } from '@neondatabase/serverless'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const sql = neon(process.env.DATABASE_URL!)
    await sql`SELECT 1`
    res.status(200).json({ ok: true })
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) })
  }
}
```

This avoids the TanStack Server Function RPC layer entirely — it's a direct Vercel serverless function that pings Neon with a single query.

### 2.2 Layer 2: Wake-Up Retry with Progress Indicator

Add a `RetryableQuery` wrapper component that detects when a server function is slow (likely DB waking up) and shows a progress indicator with automatic retry.

**New component** `src/components/ui/RetryableQuery.tsx`:

```tsx
interface RetryableQueryProps {
  isLoading: boolean
  isError: boolean
  error: Error | null
  onRetry: () => void
  children: React.ReactNode
  /** If the query takes longer than this (ms), show a "waking up" message */
  slowThreshold?: number
}

export function RetryableQuery({
  isLoading,
  isError,
  error,
  onRetry,
  children,
  slowThreshold = 3000,
}: RetryableQueryProps) {
  const [showSlow, setShowSlow] = useState(false)

  useEffect(() => {
    if (!isLoading) { setShowSlow(false); return }
    const timer = setTimeout(() => setShowSlow(true), slowThreshold)
    return () => clearTimeout(timer)
  }, [isLoading, slowThreshold])

  if (isError) {
    return (
      <div className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-4 text-sm text-[#6c6a64]">
        <p>{error?.message ?? 'Something went wrong. The server may be waking up.'}</p>
        <button onClick={onRetry} className="mt-2 text-[#cc785c] underline">
          Try again
        </button>
      </div>
    )
  }

  if (showSlow) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-sm text-[#8e8b82]">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 animate-bounce rounded-full bg-[#cc785c]" style={{ animationDelay: '0ms' }} />
          <span className="h-2 w-2 animate-bounce rounded-full bg-[#cc785c]" style={{ animationDelay: '150ms' }} />
          <span className="h-2 w-2 animate-bounce rounded-full bg-[#cc785c]" style={{ animationDelay: '300ms' }} />
        </div>
        <p>Waking up the server… this may take a few seconds.</p>
      </div>
    )
  }

  if (isLoading) {
    return <div className="h-24 animate-pulse rounded-lg bg-[#efe9de]" />
  }

  return <>{children}</>
}
```

### 2.3 Layer 3: Graceful Failure in Payment Steps

Wrap `PagePaymentStep`'s loading state with timeout-based fallback to the `RetryableQuery` component. Currently, it shows an infinite pulsing skeleton — no timeout, no retry prompt.

**Modify `PagePaymentStep`** (`src/components/page-form/PagePaymentStep.tsx`, lines 38-51):

Replace the existing loading/error states with:

```tsx
if (isLoading || isError || !data) {
  return (
    <RetryableQuery
      isLoading={isLoading}
      isError={isError || !data}
      error={isError ? (queryError as Error) : null}
      onRetry={() => refetch()}
    >
      {/* children won't render until data is ready */}
      {null}
    </RetryableQuery>
  )
}
```

Also add timeout handling to the `initiate` mutation so the user knows if the payment gateway connection is slow:

```tsx
const initiate = useMutation({
  mutationFn: (gatewaySlug: 'paypal' | 'xendit') =>
    initiatePagePayment({ data: { sessionId, pageId, gatewaySlug } }),
  onSuccess: (result) => {
    window.location.href = result.paymentUrl
  },
  onError: (err) => {
    // Show inline error instead of silently failing
    // (add error state to component)
  },
})
```

### 2.4 What About Existing Timeout Guards (FT-009)?

FT-009 adds `withTimeout()` wrappers to server functions like `startPageSession`, `advancePageSession`, and `initiatePagePayment`. These will cause the functions to **throw after 10-15 seconds** instead of hanging for 5 minutes. Combined with FT-010's retry UI, the respondent will see:

1. Loading skeleton for 3 seconds
2. "Waking up the server…" for up to 10 seconds
3. If still failing → error message with "Try again" button

This is a huge improvement over the current behavior (blank page or infinite spinner).

---

## 3. UI Design — Where Changes Surface

### 3.1 Components Affected

```
PublicFormView
  └── PageFormView                              ← benefits from RetryableQuery on session start
        └── PagePaymentStep                      ← PRIMARY TARGET: loading → retry fallback
              ├── getPagePaymentOptions (query)  ← add timeout + retry UI
              └── initiatePagePayment (mutation) ← add error display + retry

FlowExecutionContainer                          ← benefits from retry on flow advance
  └── Payment step (inline)                     ← `getPaymentOptions` + `initiatePayment`

PaymentReturnPage                               ← already has retry; benefits from keep-alive
  └── finalizePayment / finalizePagePayment     ← already resilient, just faster with warm DB
```

### 3.2 Mockup — Payment Step States

```
┌──────────────────────────────────────────────────┐
│  NORMAL (DB warm)                                │
│  ┌────────────────────────────────────────────┐  │
│  │ Amount due                                  │  │
│  │ $150.00                                     │  │
│  │ [Pay with PayPal]  [Pay with Xendit]        │  │
│  └────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────┤
│  LOADING (first 3s)                              │
│  ┌────────────────────────────────────────────┐  │
│  │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │  │
│  │ (pulsing skeleton, h-24)                   │  │
│  └────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────┤
│  WAKING (>3s, DB asleep)                         │
│  ┌────────────────────────────────────────────┐  │
│  │         ● ● ●                              │  │
│  │  Waking up the server…                     │  │
│  │  this may take a few seconds.              │  │
│  └────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────┤
│  ERROR (>15s, timeout)                           │
│  ┌────────────────────────────────────────────┐  │
│  │  Payment setup could not be loaded.         │  │
│  │  The server may still be waking up.         │  │
│  │  [Try again]                               │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### 3.3 Mockup — Gateway Redirect State

```
┌──────────────────────────────────────────────────┐
│  PAYMENT INITIATED (redirecting)                  │
│  ┌────────────────────────────────────────────┐  │
│  │                                             │  │
│  │         ⟳                                  │  │
│  │  Connecting to PayPal…                      │  │
│  │  Setting up a secure connection.            │  │
│  │                                             │  │
│  │  (This is PayPal's hosted page loading —    │  │
│  │   not something we can speed up, but we     │  │
│  │   can make the transition clearer)          │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

Note: The "preparing secure connections" message is from PayPal/Xendit's hosted checkout JS. We can't control it, but we can add a brief transition screen before the redirect so the respondent knows what's happening.

---

## 4. Server Functions & API Routes

### 4.1 New: Health Check Endpoint

| Function | File | Purpose |
|----------|------|---------|
| `GET /api/health` | `api/health.ts` (new) | Pings the DB with `SELECT 1` every 4 minutes via Vercel Cron to prevent Neon sleep |

### 4.2 Modified: Payment Server Functions (FT-009 integration)

| Function | File | Change |
|----------|------|--------|
| `getPagePaymentOptions` | `src/lib/server-fns/page-forms.ts` (line 815) | Wrap DB queries with `withTimeout(..., 12_000)` |
| `initiatePagePayment` | `src/lib/server-fns/page-forms.ts` (line 871) | Already has `withTimeout` — verify it's 15s |
| `getPaymentOptions` | `src/lib/server-fns/payments.ts` (line 116) | Add `withTimeout(..., 12_000)` |
| `initiatePayment` | `src/lib/server-fns/payments.ts` (line 145) | Add `withTimeout(..., 15_000)` |
| `finalizePayment` | `src/lib/server-fns/payments.ts` | Add `withTimeout(..., 15_000)` |
| `finalizePagePayment` | `src/lib/server-fns/page-forms.ts` | Add `withTimeout(..., 15_000)` |

---

## 5. Vercel Configuration Changes

### 5.1 Add Cron Job

In `vercel.json`, add a cron job that hits `/api/health` every 4 minutes:

```json
{
  "buildCommand": "pnpm run build",
  "outputDirectory": "dist/client",
  "installCommand": "pnpm install",
  "regions": ["iad1"],
  "rewrites": [
    { "source": "/(.*)", "destination": "/api/index" }
  ],
  "crons": [
    {
      "path": "/api/health",
      "schedule": "*/4 * * * *"
    }
  ]
}
```

### 5.2 Increase Function Timeout (Pro/Enterprise plans only)

If on a paid Vercel plan, increase the function max duration to handle slow wake-ups:

```json
{
  "functions": {
    "api/index.ts": {
      "maxDuration": 30
    },
    "api/health.ts": {
      "maxDuration": 10
    }
  }
}
```

On Hobby plan, max is 10s (default). The `withTimeout` guards at 10-15s will cut off before Vercel's 10s limit, ensuring a clean error instead of a 504.

---

## 6. File Change Summary

| File | Action | Purpose |
|------|--------|---------|
| `api/health.ts` | **New** | Lightweight DB ping for Vercel Cron keep-alive |
| `src/components/ui/RetryableQuery.tsx` | **New** | Reusable wrapper: loading skeleton → wake-up indicator → retry prompt |
| `src/components/page-form/PagePaymentStep.tsx` (lines 38-51) | **Modify** | Replace infinite loading skeleton with `RetryableQuery`; add mutation error display |
| `src/lib/server-fns/payments.ts` (lines 116, 145) | **Modify** | Add `withTimeout()` to `getPaymentOptions` and `initiatePayment` |
| `src/lib/server-fns/page-forms.ts` (line 815) | **Modify** | Add `withTimeout()` to `getPagePaymentOptions` |
| `src/lib/server-fns/page-forms.ts` (finalize functions) | **Modify** | Add `withTimeout()` to `finalizePagePayment` |
| `vercel.json` | **Modify** | Add `crons` array with `/api/health` ping every 4 minutes |
| `src/db/with-timeout.ts` | **Verify** | Ensure `withTimeout` utility is imported correctly (from FT-009) |

---

## 7. Step-by-Step Tasks

### Task 1: Create Health Check Endpoint for Keep-Alive

- [ ] **1.1** Create `api/health.ts` — a Vercel serverless function that does `neon(DATABASE_URL)` → `sql`SELECT 1`` and returns `{ ok: true }`
- [ ] **1.2** Test locally: `curl http://localhost:3000/api/health` → should return 200
- [ ] **1.3** Add `crons` configuration to `vercel.json` pointing to `/api/health` with schedule `*/4 * * * *`
- [ ] **1.4** Deploy to Vercel preview and verify cron job appears in Vercel dashboard → Settings → Cron Jobs
- [ ] **1.5** Verify logs show health check running every 4 minutes

### Task 2: Build RetryableQuery Component

- [ ] **2.1** Create `src/components/ui/RetryableQuery.tsx` with the interface and states described in Section 2.2
- [ ] **2.2** Implement three states: fast-loading skeleton (<3s), wake-up indicator (3-10s), error-with-retry (>10s or actual error)
- [ ] **2.3** Use CSS animation for the bouncing dots (no external dependency)
- [ ] **2.4** Export as named export

### Task 3: Add Timeout Guards to Payment Server Functions

- [ ] **3.1** In `src/lib/server-fns/payments.ts`, import `withTimeout` from `../../db/with-timeout`
- [ ] **3.2** Wrap `getPaymentOptions` handler's DB queries with `withTimeout(..., 12_000, 'getPaymentOptions')`
- [ ] **3.3** Wrap `initiatePayment` handler's DB queries with `withTimeout(..., 15_000, 'initiatePayment')`
- [ ] **3.4** Wrap `finalizePayment` handler with `withTimeout(..., 15_000, 'finalizePayment')`
- [ ] **3.5** In `src/lib/server-fns/page-forms.ts`, wrap `getPagePaymentOptions` with `withTimeout(..., 12_000)`
- [ ] **3.6** Verify `initiatePagePayment` already has `withTimeout` (line 943) — ensure timeout is 15_000
- [ ] **3.7** Wrap `finalizePagePayment` with `withTimeout(..., 15_000)`
- [ ] **3.8** Run `pnpm run build` to verify no import errors

### Task 4: Upgrade PagePaymentStep with Retry UI

- [ ] **4.1** Import `RetryableQuery` into `src/components/page-form/PagePaymentStep.tsx`
- [ ] **4.2** Replace the `if (isLoading)` skeleton and `if (isError || !data)` error block with `RetryableQuery` wrapping
- [ ] **4.3** Add `isPending` state display to the payment buttons so the user knows a payment is being initiated
- [ ] **4.4** Add inline error display for `initiate.isError` below the payment buttons
- [ ] **4.5** Add a brief transition state when redirecting to the gateway (show "Redirecting to PayPal…" for 500ms before `window.location.href`)

### Task 5: Apply RetryableQuery to Other Public Form Components

- [ ] **5.1** In `PageFormView`, wrap the session-start loading state with `RetryableQuery` for `startMut`
- [ ] **5.2** In `FlowExecutionContainer`, wrap the payment step's `getPaymentOptions` query with `RetryableQuery`
- [ ] **5.3** In `PublicFormView`, add a global error boundary that catches unhandled server function errors and shows a retry prompt

### Task 6: Deploy & Validate

- [ ] **6.1** Push to Vercel preview deployment
- [ ] **6.2** Open a shared form link in an incognito window → verify form loads (even after being idle)
- [ ] **6.3** Navigate to a payment page → verify amount and gateway buttons appear
- [ ] **6.4** Leave the form idle for 10 minutes, then refresh → verify form still loads (keep-alive working)
- [ ] **6.5** Simulate DB sleep by temporarily stopping the cron job → verify wake-up indicator appears and retry works
- [ ] **6.6** Check Vercel Cron Job logs → confirm `/api/health` runs every 4 minutes with 200 responses
- [ ] **6.7** Promote to production

---

## 8. Risks & Open Questions

| Risk | Mitigation |
|------|-----------|
| Vercel Cron Job free tier limit: 2 cron jobs, min 1/day on Hobby | Hobby plan allows cron jobs once per day minimum. The `*/4 * * * *` schedule requires a **Pro plan**. If on Hobby, use an **external cron service** (cron-job.org, uptimerobot.com free tier) to ping `/api/health` every 5 minutes. |
| `api/health.ts` itself cold-starts | Health check is a simple `SELECT 1` — even with cold start, it completes in 1-2s. The cron timeout should be set to 5s. |
| Neon free tier compute hours limit (190h/mo) | Keep-alive pings every 4 min = ~10,800 pings/month. Each ping uses <0.01 compute seconds. Total: ~108 compute seconds/month — well within the 190h free limit. |
| `RetryableQuery` adds complexity to every query component | Only apply to slow paths: payment queries, session starts, flow advances. Fast queries (getPublicForm, getFields) don't need it. |
| Cron job hash may change between builds | Using `api/health.ts` as a dedicated Vercel function avoids TanStack server function hashing entirely. Path is stable across builds. |

---

## 9. Validation / Testing

- [ ] **Keep-alive**: Vercel Cron dashboard shows `/api/health` runs every 4 minutes with 200 status
- [ ] **Cold start — form page**: Open shared form link after 10+ min inactivity → form renders within 5 seconds
- [ ] **Cold start — payment step**: Navigate to payment page after inactivity → amount displays within 7 seconds (allowing for Vercel cold start + Neon wake-up)
- [ ] **Wake-up indicator**: If DB is slow (>3s), the "Waking up the server…" bouncing dots appear
- [ ] **Error recovery**: If DB response exceeds timeout, retry prompt appears; clicking "Try again" re-fetches
- [ ] **Payment initiation**: Clicking PayPal/Xendit button shows pending state, then redirects
- [ ] **Payment finalization**: Return from gateway → payment confirmed, flow resumes normally
- [ ] **No regression**: Dashboard, form editor, linear forms, and flow forms continue to work
