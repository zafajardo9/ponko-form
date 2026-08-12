# FT-001: Interactive Onboarding

> **Feature Plan** — Interactive walkthrough that introduces new users to PonkoForm's concepts, UI areas, and capabilities before they start building.

**Goal:** When a user first signs up (or first visits the dashboard with zero forms), show a stepped, dismissible, interactive overlay that introduces the app's key surfaces — what they are, why they matter, and how to use them — optionally with short GIF/video demos.

---

## 1. User Story

> "As a new form creator, I want to understand what each part of PonkoForm does (dashboard, page-based form editor, conditional fields, payments) in a guided, visual way — so I feel confident building my first form instead of guessing."

---

## 2. Why This Matters

- New users landing on the dashboard see an empty state and a docs link — no visual tour of the system's capabilities
- New users should learn the page-based builder first: pages, fields, conditions, payments, and publishing. The legacy Flow Builder remains for older advanced forms, but it should not be the default onboarding story.
- Competitors (Typeform, Jotform, Tally) all have onboarding overlays that reduce churn
- A short GIF showing "this is how pages, fields, conditions, and payments fit together" is worth 1000 words of docs

---

## 3. Proposed Approach

### Architecture

- **Onboarding overlay** — a full-screen, multi-step modal (or spotlight + tooltip combos) rendered on top of the dashboard and/or the form editor
- **Steps** — ordered numbered tour points, each with: title, description, optional media (GIF/MP4), highlight target (a DOM selector to spotlight), and a "next" / "skip" / "back" / "got it" button
- **Persistence** — track completion in `profiles.onboarding_completed` (DB column) so it only shows once per user, but is re-accessible from a `?` icon in the top nav
- **Media** — short screen recordings hosted under `public/onboarding/` as loop-able GIFs or MP4s
- **No new dependency** — build the overlay with existing React + Tailwind; no external tour library needed (keeps bundle small)

### State Machine

```
  [user signs up / visits dashboard]
        │
        ▼
  ┌──────────────────────┐     skip / close     ┌─────────┐
  │ onboarding_completed │ ────────────────────→ │  DONE   │
  │      = false         │                       │ (never  │
  │  + no forms created  │                       │  show)  │
  └──────────┬───────────┘                       └─────────┘
             │  starts tour
             ▼
    ┌───────────────┐
    │  Step 1:      │
    │  Dashboard    │
    └───────┬───────┘
            │ next
            ▼
    ┌───────────────┐
    │  Step 2:      │
    │  Create Form  │
    └───────┬───────┘
            │ next
            ▼
    ┌───────────────┐
    │  Step 3:      │
    │  Editor UI    │
    │  (palette,    │
    │   page tabs,  │
    │   config)     │
    └───────┬───────┘
            │ next
            ▼
    ┌───────────────┐
    │  Step 4:      │
    │  Conditions   │
    └───────┬───────┘
            │ next
            ▼
    ┌───────────────┐
    │  Step 5:      │
    │  Payments     │
    └───────┬───────┘
            │ next
            ▼
    ┌───────────────┐
    │  Step 7:      │
    │  Preview &    │
    │  Publish      │
    └───────┬───────┘
            │ finish
            ▼
  ┌───────────────────┐
  │  onb_completed=K  │
  │  redirect to      │
  │  /forms/new       │
  └───────────────────┘
```

---

## 4. Step Details

### Step 1 — Welcome / Dashboard

| Field | Content |
|---|---|
| **Title** | Welcome to PonkoForm 🎉 |
| **Description** | Build forms that collect more — fields, logic, payments, all in one place. Your forms live here on the dashboard. |
| **Media** | `public/onboarding/01-dashboard.gif` — pan across the dashboard UI |
| **Spotlight** | `body` (full-screen greeting) |
| **Actions** | Next · Skip all |

### Step 2 — Create a Form

| Field | Content |
|---|---|
| **Title** | Create your first form |
| **Description** | Click "New Form" to get started. You'll name it and land in the editor where the magic happens. |
| **Media** | `public/onboarding/02-create-form.gif` — clicking New Form, typing a name |
| **Spotlight** | `.create-form-btn` or the `Link[to="/forms/new"]` button |
| **Actions** | Back · Next · Skip |

### Step 3 — The Form Editor

| Field | Content |
|---|---|
| **Title** | The Editor — where forms come to life |
| **Description** | **Left palette** → add fields. **Top tabs** → organize the form into pages. **Center page** → arrange fields. **Right panel** → configure fields, conditions, payments, and the final page. |
| **Media** | `public/onboarding/03-editor.gif` — adding a field, opening config |
| **Spotlight** | The editor page layout |
| **Actions** | Back · Next · Skip |

### Step 4 — Conditions

| Field | Content |
|---|---|
| **Title** | Conditions — show the right questions |
| **Description** | Add simple show/hide rules to a field, such as showing dietary notes only when a respondent chooses a vegetarian meal. |
| **Media** | `public/onboarding/04-conditions.gif` — adding a show/hide condition to a field |
| **Spotlight** | The field settings panel |
| **Actions** | Back · Next · Skip |

### Step 5 — Payments

| Field | Content |
|---|---|
| **Title** | Accept payments |
| **Description** | Connect PayPal or Xendit in Settings. Mark a page as a payment page, choose an amount field, and publish. |
| **Media** | `public/onboarding/05-payments.gif` — page payment settings and respondent checkout |
| **Spotlight** | The page payment settings |
| **Actions** | Back · Next · Skip |

### Step 6 — Preview & Publish

| Field | Content |
|---|---|
| **Title** | Preview, then publish |
| **Description** | Click Preview to step through your pages as a respondent would. When it looks right, publish your form — respondents get a shareable link or embed code. |
| **Media** | `public/onboarding/06-publish.gif` — preview + publish toggle |
| **Spotlight** | The toolbar (Preview button) |
| **Actions** | Back · Finish tour |

---

## 5. Technical Design

### 5.1 DB Change — `profiles` table

Add an `onboarding_completed` column:

```sql
ALTER TABLE profiles ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;
```

Drizzle schema change in `src/db/schema.ts`:

```ts
export const profiles = pgTable('profiles', {
  id: serial().primaryKey(),
  clerkId: text('clerk_id').notNull().unique(),
  displayName: varchar('display_name', { length: 255 }),
  avatarUrl: text('avatar_url'),
  onboardingCompleted: boolean('onboarding_completed').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
```

### 5.2 New Component — `OnboardingOverlay`

**File:** `src/components/onboarding/OnboardingOverlay.tsx`

Props:
```ts
interface OnboardingOverlayProps {
  open: boolean
  onClose: () => void        // skip/close — saves onboarding_completed=false? no, they can re-access
  onComplete: () => void     // finish — saves onboarding_completed=true
}
```

Internal state:
- `stepIndex` (0..6) — current step
- `dismissed` (local boolean) — if user clicks X, we just close the overlay

Structure:
```
┌─────────────────────────────────────────────┐
│  [X close]                                  │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  GIF / MP4 / screenshot media       │    │
│  │  (auto-play loop, muted, 16:9)      │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ● Step 3 of 7                              │
│                                             │
│  ## The Form Editor                         │
│                                             │
│  Left palette → drag fields. Center         │
│  canvas → your flow graph. Right panel      │
│  → configure. Toggle Canvas / List view.    │
│                                             │
│  ┌──────────┐  ┌────────────┐  ┌────────┐  │
│  │  ← Back  │  │  Next →    │  │ Skip → │  │
│  └──────────┘  └────────────┘  └────────┘  │
└─────────────────────────────────────────────┘
```

### 5.3 New Component — `OnboardingStepData`

**File:** `src/components/onboarding/onboardingSteps.ts`

An array of step objects:
```ts
export interface OnboardingStep {
  title: string
  description: string
  mediaSrc?: string          // path to GIF/MP4 under /onboarding/
  mediaAlt?: string
  spotlightSelector?: string // CSS selector for the DOM element to spotlight
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  { title: 'Welcome to PonkoForm', ... },
  { title: 'Create your first form', ... },
  // ... 7 steps total
]
```

### 5.4 Server Function — Save Onboarding Status

**File:** `src/lib/server-fns/onboarding.ts`

```ts
export const completeOnboarding = createServerFn({ method: 'POST' })
  .handler(async () => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    // update profiles.onboarding_completed = true
  })

export const getOnboardingStatus = createServerFn({ method: 'GET' })
  .handler(async () => {
    const { userId } = await auth()
    if (!userId) return { completed: false }
    // select profiles.onboarding_completed
  })
```

### 5.5 Integration Points

| Page | Location | Trigger |
|---|---|---|
| **Dashboard** (`/dashboard/`) | `EmptyState` component OR on page load | If `onboarding_completed === false` AND the user has 0 forms, auto-open the overlay. Also re-accessible from a `?` help icon in the top nav. |
| **Top Nav** (`__root.tsx`) | Add a `?` help icon next to the UserButton | If onboarding was completed, clicking it re-opens the overlay from step 1 (or a condensed version). |

### 5.6 Media Assets

Location: `public/onboarding/`

| File | Content | Target size |
|---|---|---|
| `01-dashboard.gif` | Dashboard overview with cursor movement | ~2-5 MB |
| `02-create-form.gif` | Click New Form → type name → editor loads | ~2-5 MB |
| `03-editor.gif` | Drag field, open config, toggle views | ~3-8 MB |
| `04-node-types.gif` | An animated flow graph being built | ~3-8 MB |
| `05-variables.gif` | Add variable, use in expression | ~2-5 MB |
| `06-payments.gif` | Payment step in preview | ~3-8 MB |
| `07-publish.gif` | Preview button → publish toggle | ~2-5 MB |

Each GIF loops, muted, no audio. Alternative: use MP4 (smaller) with `autoPlay loop muted playsinline`.

---

## 6. Step-by-Step Tasks

### Task 1: DB Migration — add `onboarding_completed` to profiles

**Files:**
- Modify: `src/db/schema.ts` — add `onboardingCompleted: boolean('onboarding_completed').default(false).notNull()` to profiles table
- Create: `drizzle/NNNN_onboarding.sql` — `ALTER TABLE profiles ADD COLUMN onboarding_completed boolean DEFAULT false NOT NULL;`

**Verification:** `pnpm exec drizzle-kit generate` produces the migration, `pnpm exec tsc --noEmit` passes.

**Commit:** `git add -A && git commit -m "feat: add onboarding_completed column to profiles"`

### Task 2: Server functions — onboarding CRUD

**Create:** `src/lib/server-fns/onboarding.ts`
- `completeOnboarding` (POST) — sets `profiles.onboarding_completed = true` for `auth().userId`
- `getOnboardingStatus` (GET) — returns `{ completed: boolean }`

**Verification:** `pnpm exec tsc --noEmit` passes.

**Commit:** `git add -A && git commit -m "feat: onboarding server fns"`

### Task 3: Steps data + components

**Create:** `src/components/onboarding/onboardingSteps.ts` — the `ONBOARDING_STEPS` array (7 steps, each with title, description, mediaSrc, spotlightSelector)

**Create:** `src/components/onboarding/OnboardingOverlay.tsx`
- Full-screen modal with backdrop
- Step counter ("Step N of 7")
- Media area (GIF/MP4 `<video>` with auto-play loop muted)
- Descriptive text
- Back / Next / Skip / Close buttons

**Create:** `src/components/onboarding/index.ts` — barrel export

**Verification:** `pnpm exec tsc --noEmit` passes. Build: `pnpm run build`.

**Commit:** `git add -A && git commit -m "feat: onboarding overlay component + steps"`

### Task 4: Wire into Dashboard + Top Nav

**Modify:** `src/routes/dashboard/index.tsx`
- On mount, call `getOnboardingStatus()`
- If `!completed && forms.length === 0`, auto-open overlay
- Pass `onComplete` that calls `completeOnboarding()` and closes

**Modify:** `src/routes/__root.tsx` (TopNav component)
- Add a `?` circle help icon after the nav links (always visible when signed in)
- Clicking it opens the onboarding overlay (or re-opens it)

**Verification:** Sign in as a new user → see overlay. Complete → overlay disappears. Toast? icon in nav reopens it.

**Commit:** `git add -A && git commit -m "feat: wire onboarding into dashboard and nav"`

### Task 5: Record + optimize media (GIFs/MP4s)

**Action:** Record 7 short screen captures of the app, crop/resize, convert to GIF or MP4, place in `public/onboarding/`.

**Tools:** QuickTime Player (record) → ffmpeg (crop + resize) → gifski (GIF) or handbrake (MP4).

**Target constraints:** Each file <5 MB, 16:9 aspect ratio, 800px wide max.

**Commit:** `git add -A && git commit -m "docs: add onboarding media assets"`

### Task 6: Accessibility + edge cases

- Keyboard: Escape closes overlay, Tab navigates buttons, Enter advances
- Screen reader: `aria-modal="true"`, `role="dialog"`, `aria-labelledby` on step title
- Mobile: overlay becomes full-screen with no backdrop (saves screen space), media area stacks above text
- Re-onboarding: if user clicks `?` icon after completing, show a condensed 3-step version (What are forms? / Flow Builder / Payments)

**Verification:** Tab through overlay — focus stays trapped. Narrator reads step titles. On mobile viewport 375px, layout stacks and all buttons are tappable (≥44px).

**Commit:** `git add -A && git commit -m "feat: onboarding a11y + responsive + condensed tour"`

---

## 7. File Change Summary

| Action | Path |
|---|---|
| Modify | `src/db/schema.ts` (+1 column, profiles) |
| Create | `drizzle/NNNN_onboarding.sql` |
| Create | `src/lib/server-fns/onboarding.ts` |
| Create | `src/components/onboarding/onboardingSteps.ts` |
| Create | `src/components/onboarding/OnboardingOverlay.tsx` |
| Create | `src/components/onboarding/index.ts` |
| Modify | `src/routes/dashboard/index.tsx` |
| Modify | `src/routes/__root.tsx` |
| Create | `public/onboarding/01-dashboard.gif` |
| Create | `public/onboarding/02-create-form.gif` |
| Create | `public/onboarding/03-editor.gif` |
| Create | `public/onboarding/04-node-types.gif` |
| Create | `public/onboarding/05-variables.gif` |
| Create | `public/onboarding/06-payments.gif` |
| Create | `public/onboarding/07-publish.gif` |

---

## 8. Risks & Open Questions

| Risk | Mitigation |
|---|---|
| **GIFs are heavy** — 7 files at 5 MB each = 35 MB added to the bundle | Use MP4 instead (smaller). Lazy-load media assets — only the current step's file loads. |
| **Tour feels intrusive** | Show only to users with zero forms. Always dismissible. One `?` icon in nav for re-access. |
| **Steps get stale** if the UI changes | Steps data is in a single file; update descriptions + re-record media when the layout changes. |
| **Clerk user has no profile row yet** (race condition on first sign-up) | `getOnboardingStatus` fallback: if no profile row exists (`select` returns empty), default to `{ completed: false }`. The profile is created by a separate server fn (Clerk webhook or first server fn). |
| **Mobile responsiveness** | Overlay is full-screen on small viewports; no spotlight (not enough room). Text + media stack vertically. |

**Open Questions:**
1. Should the tour auto-navigate to the next page? (e.g. Step 2 "Create a Form" automatically opens the create form page) — could be jarring. Prefer keeping the tour on the dashboard and only navigating when the user clicks "Finish".
2. Should we record GIFs/MP4s now or leave placeholder `<div className="bg-[#e8e0d2] animate-pulse h-48 rounded-lg">Media coming soon</div>`? — Recommend placeholders first, fill in media later.
3. Condensed re-tour: 3 steps or same 7 steps? — Recommend 3: "Dashboard" / "Editor & Flow Builder" / "Payments & Publishing".

---

## 9. Validation / Testing

| Check | How |
|---|---|
| First sign-up, no forms → overlay appears | Create a new Clerk user, navigate to `/dashboard`, see the welcome modal |
| Complete all 7 steps → overlay closes, `onboarding_completed=true` | Check DB with `SELECT onboarding_completed FROM profiles` |
| Refresh page → overlay does NOT re-appear | `getOnboardingStatus` returns `{ completed: true }` |
| Click `?` in top nav → overlay re-opens | Even after completion, the help icon triggers the tour |
| Close with X → overlay closes, no DB change | `onboarding_completed` stays `false` |
| Tab navigation inside overlay → focus trapped | Tab cycles through Back/Next/Skip/Close only |
| Build passes | `pnpm run build` exits 0 |
| No TypeScript errors | `pnpm exec tsc --noEmit` produces 0 errors |
