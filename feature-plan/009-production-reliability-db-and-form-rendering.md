# FT-009: Production Reliability — Fix Database Connection Hangs & Page Form Rendering

> **Feature Plan** — Fixes production-only database connection timeouts in Vercel serverless that cause page forms to appear as a blank loading screen. Replaces the `pg` TCP driver with Neon's HTTP-based serverless driver and makes the `PageFormView` resilient to slow session initialization.

**Status:** 🚧 **Planned** — not yet implemented

**Dependencies:**
- ✅ **FT-007 (Form Builder Revision)** — the page forms system (`formPages`, `formPageFields`, `formSubmissionSessions`) this fix protects. The session-based multi-page runtime is from FT-007.
- ⬜ **FT-003 (Services Integration)** — any future service dispatch that hits `formSubmissionSessions` must also be guarded against DB unavailability.

---

## 1. Problem — Production-Only Form Freeze

### 1.1 What Happens

When a respondent visits a published page form (e.g., `/forms/submit/73083904f2af18a4fe906d33`) in **production on Vercel**, the form never renders beyond a pulsing skeleton placeholder. In development (`vite dev`), the same form loads instantly.

**Vercel logs confirm the root cause:**

| Request | Server Function | Status | Duration |
|---------|----------------|--------|----------|
| `GET /_serverFn/...` | `getFlow` | ✅ 200 | 4s |
| `POST /_serverFn/ea211688...` | **`startPageSession`** | ❌ 504 | **5 minutes** |

The `startPageSession` POST hangs for the full Vercel function timeout (5+ min) with **"No outgoing requests"** — the database operation never completes.

### 1.2 The Chain of Failure

```
1. Browser: visits /forms/submit/$formId
2. SSR: renders PublicFormView → PageFormView
3. PageFormView mounts, fires startPageSession() via useEffect
4. startPageSession calls db.select() → db.insert() on formSubmissionSessions
5. pg driver tries to establish TCP connection to Neon
6. TCP handshake hangs (Vercel serverless networking issue)
7. Function sits idle for 5 minutes → Vercel responds 504
8. Meanwhile: sessionId stays null → PageFormView stays on loading skeleton
   (line 154 in PageFormView.tsx before fix: blocks on !sessionId)
9. Respondent sees: "nothing shows"
```

### 1.3 Why Dev Works But Prod Doesn't

| Factor | Dev (`vite dev`) | Prod (Vercel serverless) |
|--------|-----------------|--------------------------|
| Network | Localhost → Neon (same datacenter, stable TCP) | Vercel iad1 → Neon (cross-region, cold-start TCP unreliable) |
| Process lifecycle | Long-lived dev server, persistent connection pool | Ephemeral function instances, cold starts create new pools |
| `pg` driver | TCP connection reuses existing pool | Each cold start builds a new TCP pool — one hang blocks all queries |
| `vite-plugin-neon-new` | Runs in dev mode, intercepts `pg` imports | May not reliably alias `pg` → `@neondatabase/serverless` in the server build |

### 1.4 The `pg` TCP Problem

The current database client (`src/db/index.ts`) uses `drizzle-orm/node-postgres`, which depends on the `pg` npm package. The `pg` driver:

- Opens a **TCP connection pool** at module initialization time
- In Vercel serverless, a **cold start** triggers `new Pool()` → `pg` tries `net.connect()` to Neon
- If the TCP SYN hangs (firewall, NAT, Neon proxy issue), **all queries on that instance block forever**
- The `vite-plugin-neon-new` plugin (v0.8.0) is supposed to replace `pg` with `@neondatabase/serverless` (which uses HTTP fetch, not TCP), but the production build output still shows `import { drizzle } from "drizzle-orm/node-postgres"` — the aliasing may not persist through the Vite server build

---

## 2. System Design — Reliable Database Access

### 2.1 Solution Strategy: Two-Part Fix

```
┌─────────────────────────────────────────────────────┐
│  PART A: Resilience — PageFormView renders fast     │
│  (already applied in earlier fix, needs refinement) │
├─────────────────────────────────────────────────────┤
│  - Don't block rendering on sessionId                │
│  - Retry submission when session becomes available    │
│  - Show non-blocking warning if session start fails   │
└─────────────────────────────────────────────────────┘
                         +
┌─────────────────────────────────────────────────────┐
│  PART B: Root Cause — Replace TCP driver with HTTP  │
│  (new work — this is the permanent fix)              │
├─────────────────────────────────────────────────────┤
│  - Switch db/index.ts to drizzle-orm/neon-serverless │
│  - Use @neondatabase/serverless HTTP driver           │
│  - Remove vite-plugin-neon-new (no longer needed)     │
│  - Add query timeout via AbortController              │
└─────────────────────────────────────────────────────┘
```

### 2.2 Database Client Switch — Before & After

**BEFORE** (`src/db/index.ts` — current, unreliable in Vercel):
```ts
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema.ts'
export const db = drizzle(process.env.DATABASE_URL!, { schema })
```

**AFTER** (`src/db/index.ts` — new, HTTP-based, serverless-safe):
```ts
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import * as schema from './schema.ts'

const sql = neon(process.env.DATABASE_URL!)
export const db = drizzle(sql, { schema })
```

**Key differences:**
| Aspect | `node-postgres` (old) | `neon-serverless` (new) |
|--------|----------------------|------------------------|
| Transport | TCP socket (`pg.Pool`) | HTTP fetch (Neon SQL over HTTP) |
| Connection model | Persistent pool | Stateless per-query |
| Vercel cold start | Risky (TCP hang) | Safe (HTTP handshake is fast + has timeouts) |
| Query timeout | None built-in | HTTP layer has natural timeouts |
| Package weight | Heavy (pg + dependencies) | Light (fetch-based) |

### 2.3 Query Timeout Guard

Even with HTTP-based transport, network issues can still occur. Add a timeout wrapper to catch hangs:

```ts
// src/db/with-timeout.ts
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`DB timeout: ${label} (${ms}ms)`)), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}
```

Apply to `startPageSession`:
```ts
export const startPageSession = createServerFn({ method: 'POST', strict: false })
  .inputValidator((data: { formId: number }) => data)
  .handler(async ({ data }) => {
    const [form] = await withTimeout(
      db.select().from(forms).where(eq(forms.id, data.formId)).limit(1),
      10_000, 'startPageSession: select forms'
    )
    if (!form || form.status !== 'published') throw new Error('Form not found or not published')
    const [session] = await withTimeout(
      db.insert(formSubmissionSessions)
        .values({ formId: data.formId, currentPageIndex: 0, collectedData: {}, status: 'in_progress' })
        .returning(),
      10_000, 'startPageSession: insert formSubmissionSessions'
    )
    return session
  })
```

### 2.4 Clean Up Obsolete Files

After the switch, these become dead code:

| File | Action |
|------|--------|
| `src/db.ts` | **Delete** — unused `getClient()` using raw `neon()` (the new `db/index.ts` handles this now) |
| `neon-vite-plugin.ts` | **Delete** — the Vite plugin that aliasied `pg` → `@neondatabase/serverless` is no longer needed |
| `vite.config.ts` (line 16) | **Remove** `neon` plugin from the plugins array |

### 2.5 Architecture — After Fix

```
                      Vercel Serverless Function
┌─────────────────────────────────────────────────────────────┐
│  api/index.ts                                                │
│    ↓                                                         │
│  dist/server/server.js  (TanStack Start fetch handler)       │
│    ↓                                                         │
│  startPageSession handler                                    │
│    ↓                                                         │
│  db.select() / db.insert()                                   │
│    ↓                                                         │
│  drizzle-orm/neon-serverless                                 │
│    ↓                                                         │
│  @neondatabase/serverless  (neon() sql template tag)        │
│    ↓                                                         │
│  HTTP POST https://ep-xxxxx.neon.tech/sql                    │
│    ↓  (HTTPS, not raw TCP)                                   │
│  Neon Serverless PostgreSQL                                   │
└─────────────────────────────────────────────────────────────┘
```

No TCP connection pool. No cold-start hangs. Every query is a self-contained HTTP request with its own timeout.

---

## 3. UI Resilience — PageFormView Guards

### 3.1 Current State (after partial fix)

The earlier hotfix in `src/components/page-form/PageFormView.tsx` removed the blocking `!sessionId` render gate and added a queued submission retry. These changes are included in this plan as formal tasks.

### 3.2 Remaining Gaps in PageFormView

| Issue | Handling |
|-------|----------|
| `startMut.isPending` (session starting) | Form renders immediately; `startMut` fires in background |
| `startMut.isError` (session failed) | Amber warning banner: *"Unable to save your progress..."* |
| User clicks Submit before session ready | Queues `nextData` in `submissionQueuedRef`; retries via `useEffect([sessionId])` |
| User leaves page mid-session-start | `startedRef` prevents duplicate calls; form is stateless anyway |

### 3.3 What NOT to Do

- ❌ Do not silently swallow errors — users should know if their submission can't be saved
- ❌ Do not add a full-page error state — the form should always be usable
- ❌ Do not retry `startPageSession` infinitely — one attempt is sufficient; if it fails, the user submits statelessly

---

## 4. File Change Summary

| File | Change |
|------|--------|
| `src/db/index.ts` | **Rewrite** — Switch from `drizzle-orm/node-postgres` to `drizzle-orm/neon-serverless` with `neon()` SQL client |
| `src/db/with-timeout.ts` | **New** — `withTimeout()` utility for query-level timeouts |
| `src/db.ts` | **Delete** — obsolete raw `neon()` client (superseded by new `db/index.ts`) |
| `neon-vite-plugin.ts` | **Delete** — `pg` → Neon aliasing no longer needed |
| `vite.config.ts` | **Modify** — Remove `neon` from plugins array (line 16) |
| `src/lib/server-fns/page-forms.ts` (lines 707-717) | **Modify** — Wrap `startPageSession` DB calls with `withTimeout()` |
| `src/lib/server-fns/page-forms.ts` (lines 719+) | **Modify** — Wrap `advancePageSession` and `completePageSubmission` DB calls with `withTimeout()` |
| `src/components/page-form/PageFormView.tsx` | **Modify** — Finalize resilience guards (remove blocking gate, add error display, queued submission retry) |
| `package.json` | **Modify** — Remove `vite-plugin-neon-new` from dependencies if no longer needed; verify `@neondatabase/serverless` is present |

---

## 5. Step-by-Step Tasks

### Task 1: Switch Database Driver to Neon HTTP

- [ ] **1.1** Verify `@neondatabase/serverless` is in `package.json` dependencies (it should be — check that it's not a transitive-only dep)
- [ ] **1.2** Verify `drizzle-orm/neon-serverless` is available (bundled with `drizzle-orm` since v0.29+)
- [ ] **1.3** Rewrite `src/db/index.ts`:
  ```ts
  import { neon } from '@neondatabase/serverless'
  import { drizzle } from 'drizzle-orm/neon-serverless'
  import * as schema from './schema.ts'

  const sql = neon(process.env.DATABASE_URL!)
  export const db = drizzle(sql, { schema })
  ```
- [ ] **1.4** Delete `src/db.ts` (the old `getClient()` raw neon client — dead code now)
- [ ] **1.5** Delete `neon-vite-plugin.ts` (the Vite plugin aliasing `pg` is no longer needed)
- [ ] **1.6** In `vite.config.ts`, remove the `neon` import and plugin entry (lines 9, 15-16)
- [ ] **1.7** Run `npm run build` and verify the build succeeds with no `pg`-related or `drizzle-orm/node-postgres` imports in `dist/server/assets/db-*.js`
- [ ] **1.8** Run `npm run dev` and verify the dashboard, form editor, and public forms work locally

### Task 2: Add Query Timeout Utility

- [ ] **2.1** Create `src/db/with-timeout.ts`:
  ```ts
  export async function withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    label: string,
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout>
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`DB timeout: ${label} (${ms}ms)`)), ms)
    })
    try {
      return await Promise.race([promise, timeout])
    } finally {
      clearTimeout(timer)
    }
  }
  ```
- [ ] **2.2** Unit test the utility (optional but recommended)

### Task 3: Guard Page Session Server Functions with Timeouts

- [ ] **3.1** In `src/lib/server-fns/page-forms.ts`, import `withTimeout` from `../../db/with-timeout`
- [ ] **3.2** Wrap `startPageSession` handler DB calls (lines 710, 712-715) with `withTimeout(..., 10_000, 'startPageSession: ...')`
- [ ] **3.3** Wrap `advancePageSession` handler DB calls with `withTimeout(..., 10_000, 'advancePageSession: ...')`
- [ ] **3.4** Wrap `completePageSubmission` handler DB calls with `withTimeout(..., 15_000, 'completePageSubmission: ...')`
- [ ] **3.5** Wrap `startFlowExecution` and `initiatePayment` in their respective server function files with appropriate timeouts

### Task 4: Finalize PageFormView Resilience

- [ ] **4.1** Remove the `sessionId` blocking render gate (line 154: change `if (resumeQuery.isLoading || (!preview && !resumeSessionId && !sessionId))` to `if (resumeQuery.isLoading)`)
- [ ] **4.2** Add `submissionQueuedRef` (`useRef<Record<string, unknown> | null>(null)`) to store queued submission data
- [ ] **4.3** Add retry `useEffect` that fires `completeMut.mutate(queuedData)` when `sessionId` becomes available and `submissionQueuedRef.current` is non-null
- [ ] **4.4** In `goNext()`, guard `completeMut.mutate(nextData)` with `sessionId` check; if no session, store `nextData` in `submissionQueuedRef.current` and show "Preparing your submission..."
- [ ] **4.5** Add `startMut.isError` display with amber warning: *"Unable to save your progress. You can still fill out the form, but your responses may not be saved if you leave the page."*
- [ ] **4.6** Disable the Submit button when `startMut.isPending` and `!sessionId` (optional — prevents confusion)

### Task 5: Deploy & Validate on Vercel

- [ ] **5.1** Push to a preview deployment branch
- [ ] **5.2** Verify Vercel preview deploys successfully (no build errors from removed neon plugin)
- [ ] **5.3** Open a published page form on the preview URL — confirm it renders within 5 seconds
- [ ] **5.4** Submit the multi-page form — confirm submission completes
- [ ] **5.5** Check Vercel function logs for any remaining timeouts or errors
- [ ] **5.6** Promote to production

---

## 6. Risks & Open Questions

| Risk | Mitigation |
|------|-----------|
| `drizzle-orm/neon-serverless` might have subtle API differences from `drizzle-orm/node-postgres` | Both use the same Drizzle query builder API (`db.select().from().where()`). The only difference is the transport layer. Run the full test suite / manual smoke test. |
| Neon connection string format might need `?sslmode=require` or pooler URL | Neon's default connection string works with the HTTP driver. Verify the `DATABASE_URL` in Vercel env vars is the regular connection string, not the pooled one (HTTP driver handles pooling internally). |
| Removing `vite-plugin-neon-new` breaks local dev | Local dev also switches to `drizzle-orm/neon-serverless` — the HTTP driver works fine locally. If issues arise, the old `pg`-based setup can be restored by reverting `db/index.ts`. |
| Every query now makes a new HTTP request (no connection reuse) | Neon's HTTP SQL endpoint is optimized for this pattern — it's their recommended approach for serverless. Query latency is typically 1-5ms for simple queries within the same region. |
| Other server functions (beyond page forms) might also time out | The DB driver switch fixes ALL server functions globally — any function using `db` from `src/db/index.ts` benefits immediately. |

---

## 7. Validation / Testing

- [ ] **Local dev**: `npm run dev` → dashboard loads, form editor saves fields, public form renders and submits
- [ ] **Local build**: `npm run build` succeeds with no `drizzle-orm/node-postgres` or `pg` in dist
- [ ] **Public form — cold load**: Open published page form URL in an incognito window → form renders within 5 seconds
- [ ] **Public form — multi-page navigation**: Click through all pages, verify data persists between pages
- [ ] **Public form — submission**: Complete all pages and submit → see "Thank you!" screen
- [ ] **Public form — submission shows in dashboard**: Check form's submissions list → new submission appears
- [ ] **Dashboard**: List forms, create form, edit form fields — all work
- [ ] **Flow builder**: Create/edit flow nodes, run flow execution — all work
- [ ] **Payments**: Payment forms still work (initiate + finalize)
- [ ] **Vercel logs**: No 504 timeouts, no `startPageSession` hangs
- [ ] **Regression**: All existing forms (linear, flow, page) continue to function
