# FT-026: Popup Embed — Canva-Style Popup Builder, Triggers & Embed Script

> **Feature Plan** — A creator builds a popup on a free-position Canva-style canvas (drag elements anywhere in a box, style them fully), picks when it appears (on load, exit intent, scroll depth, click), and publishes it to any external website with a copy-paste `<script>` snippet — WordPress included. Popups are the lead-capture layer on top of existing forms: a button element holds a plain URL link, so creators manually wire a popup to any form they already have. Views, clicks, and click-through are tracked per popup.

**Status:** ✅ **Complete** — implemented and validated on 2026-08-18. Management lives at `/popups`, legacy dashboard URLs redirect, drafts are owner-previewable but publicly unavailable, and all automated/local smoke checks pass.

**Dependencies:**
- ✅ **Embedding substrate (existing)** — `ShareDialog.tsx` already generates a responsive `<iframe>` embed for forms (`/forms/embed/:id`) with a `postMessage` resize protocol (`ponkoform:resize`). The popup embed reuses the same iframe + postMessage architecture.
- ✅ **Page Builder (FT-007)** — `PageBuilderWorkspace.tsx` + `@dnd-kit` is the proven palette → canvas → settings-panel editor pattern; the Popup Builder follows it, with free positioning instead of stacked cards.
- ✅ **Theming (existing)** — `src/lib/theme.ts` (`FormTheme`, `themeVars`, `--ponko-*` CSS custom properties) is the house theming mechanism; popup-level style uses the same CSS-var approach.
- ✅ **Dashboard page pattern (FT-018)** — `dashboard/payment-links.tsx` is the template for the Popups list page (`requireAuth` + `useQuery` + mutations).
- ✅ **Server-function + API-route patterns (FT-018, FT-020)** — `createServerFn` in `src/lib/server-fns/*`, TanStack Start file API routes (`src/routes/api/*`) with `server.handlers`.
- ⬜ **No new external dependencies.** Canvas drag/resize uses `@dnd-kit` (already installed) + pointer events; the host-side loader is dependency-free vanilla JS in `public/`.

---

## 1. User Story & Problem

### 1.1 Current State

PonkoForm can publish a **form** to the web in two ways:

- **Link** — `/forms/submit/:publicId`, a clean shareable page.
- **Embed** — `/forms/embed/:publicId` inside a responsive `<iframe>` that auto-resizes via `ponkoform:resize` postMessage (`ShareDialog.tsx`, `src/routes/forms/embed/$formId.tsx`).

**What creators can't do today:**

| Scenario | Can they do it? |
|---|---|
| "Put a newsletter signup box that pops up on my WordPress site" | ❌ |
| "Design the popup myself — drag a heading, an image, and a button into a box, size it, style it" | ❌ |
| "Show it when a visitor is about to leave (exit intent), or after scrolling halfway" | ❌ |
| "Point the popup's button at a form I already built here" | ❌ (button links don't exist as a concept) |
| "Know how many people saw it and clicked" | ❌ |
| "Embed it on ANY website with one snippet, not just forms" | ❌ |

### 1.2 What the User Wants

> "A pop-up embed feature to the website — like WordPress. We can create a pop up, lay it out in a box, set its width or responsiveness, style it like a canvas where we can put elements (text, buttons, images) with full control of the system. It gets embedded on a website and it's very helpful to get leads — e.g. a newsletter popup or a services popup that redirects to a form we already have."

Concretely, four capabilities:

1. **Canva-style builder** — a free-position canvas (`x`, `y`, `width`, `height` per element) with an element palette (heading, text, image, button, divider, raw HTML), per-element styling, and full popup-level control (size, placement, overlay, animation, fonts).
2. **Manual form connection** — a button element's *Link* setting accepts any URL. Creators paste an existing form's link (e.g. `https://ponkoform.com/forms/submit/abc123`) or any external URL. No coupling between popups and forms in v1.
3. **Triggers and delivery rules** — on load (with delay), exit intent, scroll depth, click on an element; frequency control (every visit / once per session / day / week); and an optional campaign start/end plus recurring visitor-local daily hours.
4. **Embed + stats** — a copy-paste `<script data-popup="...">` snippet for any site, and per-popup view/click/click-through stats on the dashboard.

### 1.3 Solution

- New `popups` table (content = JSONB elements + trigger/placement/frequency/style JSONB + view/click counters), one migration.
- New `Popup Builder` workspace at `/popups/:popupId/edit` — palette, free-position canvas, contextual settings panel (reusing `@dnd-kit` + Page Builder patterns).
- New public runtime: `/popups/:publicId/embed` (bare iframe page rendering the elements) + `public/embed/popup-loader.js` (vanilla-JS host script: fetches config, builds overlay/box, watches triggers, reports stats via `sendBeacon`).
- New public API routes `/api/popups/:publicId/{config|view|click}` with permissive CORS for cross-site embedding.
- New authenticated management section `/popups` — list, stats, publish toggle, embed snippet. Legacy dashboard URLs redirect here.

This deliberately keeps popups **decoupled from forms**: no FK, no shared model. A popup is a self-contained lead-capture surface whose button can point anywhere — including at an existing form's share link or embed URL. That is the whole integration story for v1.

---

## 2. System Design — Schema & Architecture

### 2.1 New Table: `popups`

One row per popup. Content (elements), behavior (trigger/placement/frequency), and look (style) are typed JSONB — the same flexible-config pattern as `flow_nodes.config` — so v1 needs a **single migration** and future element types need no schema change. Stats are lightweight counters on the row, matching the `payment_links.totalPayments` precedent.

```ts
// src/db/schema.ts — append after `paymentLinks`
export const popups = pgTable(
  'popups',
  {
    id: serial().primaryKey(),
    profileId: integer('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    status: formStatusEnum('status').default('draft').notNull(),
    publicId: varchar('public_id', { length: 32 }).notNull(),
    /** Design canvas size in px — the box the creator lays out in. */
    width: integer('width').notNull().default(420),
    height: integer('height').notNull().default(380),
    /** Where the popup sits on the host page. */
    placement: varchar('placement', { length: 20 })
      .notNull()
      .default('center')
      .$type<
        | 'center'
        | 'top-left'
        | 'top-right'
        | 'bottom-left'
        | 'bottom-right'
        | 'fullscreen'
      >(),
    /** When it appears (discriminated union — see PopupTriggerConfig). */
    trigger: jsonb('trigger')
      .$type<PopupTriggerConfig>()
      .notNull()
      .default({ type: 'on-load', delayMs: 0 }),
    /** How often it may appear to the same visitor. */
    frequency: varchar('frequency', { length: 20 })
      .notNull()
      .default('once-per-session')
      .$type<'every-visit' | 'once-per-session' | 'once-per-day' | 'once-per-week'>(),
    /** Popup-level look & feel (overlay, animation, fonts, closable). */
    style: jsonb('style').$type<PopupStyle>().notNull().default({}),
    /** The canvas content — absolutely positioned elements. */
    elements: jsonb('elements').$type<PopupElement[]>().notNull().default([]),
    /** Lead stats (v1 counters; a time-series table is a later enhancement). */
    viewCount: integer('view_count').notNull().default(0),
    clickCount: integer('click_count').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('popups_profile_id_idx').on(table.profileId),
    uniqueIndex('popups_public_id_idx').on(table.publicId),
  ],
)
```

### 2.2 Migration

Add the table to `src/db/schema.ts`, then run `pnpm db:generate` and commit the generated SQL + snapshot. The migration will be numbered **0041** (current head is `0040_condition_match_mode.sql`):

```sql
-- drizzle/0041_popups.sql (drizzle-kit generate output)
CREATE TABLE IF NOT EXISTS "popups" (
  "id" serial PRIMARY KEY NOT NULL,
  "profile_id" integer NOT NULL,
  "title" varchar(255) NOT NULL,
  "status" "form_status" DEFAULT 'draft' NOT NULL,
  "public_id" varchar(32) NOT NULL,
  "width" integer DEFAULT 420 NOT NULL,
  "height" integer DEFAULT 380 NOT NULL,
  "placement" varchar(20) DEFAULT 'center' NOT NULL,
  "trigger" jsonb DEFAULT '{"type":"on-load","delayMs":0}'::jsonb NOT NULL,
  "frequency" varchar(20) DEFAULT 'once-per-session' NOT NULL,
  "style" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "elements" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "view_count" integer DEFAULT 0 NOT NULL,
  "click_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "popups_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id")
    REFERENCES "profiles"("id") ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS "popups_profile_id_idx" ON "popups" ("profile_id");
CREATE UNIQUE INDEX IF NOT EXISTS "popups_public_id_idx" ON "popups" ("public_id");
```

### 2.3 Element Model (the Canva Content)

New file `src/lib/popup-builder/types.ts`. Every element is absolutely positioned on a design canvas of `popups.width × popups.height` px — a discriminated union on `type`, so adding a future element type is purely additive.

```ts
/** Position/size on the design canvas (px, top-left origin). */
export interface PopupRect {
  x: number
  y: number
  width: number
  height: number
}

export type PopupElementType = 'heading' | 'text' | 'image' | 'button' | 'divider' | 'html'

interface PopupElementBase extends PopupRect {
  id: string // stable client-generated id (crypto.randomUUID())
  type: PopupElementType
  zIndex: number
  opacity: number // 0–1
  rotation: number // degrees — cheap Canva flair
}

export interface HeadingElement extends PopupElementBase {
  type: 'heading'
  level: 1 | 2 | 3
  text: string
  color: string
  fontSize: number
  fontWeight: 'normal' | 'medium' | 'semibold' | 'bold'
  align: 'left' | 'center' | 'right'
}

export interface TextElement extends PopupElementBase {
  type: 'text'
  text: string
  color: string
  fontSize: number
  lineHeight: number
  align: 'left' | 'center' | 'right'
}

export interface ImageElement extends PopupElementBase {
  type: 'image'
  src: string
  alt: string
  fit: 'cover' | 'contain'
  radius: number // px
}

export interface ButtonElement extends PopupElementBase {
  type: 'button'
  label: string
  bgColor: string
  textColor: string
  radius: number // px
  /** Manual lead connection — paste any URL (e.g. an existing form link). */
  link: string
  openInNewTab: boolean
  fontWeight: 'normal' | 'medium' | 'semibold' | 'bold'
  fontSize: number
}

export interface DividerElement extends PopupElementBase {
  type: 'divider'
  color: string
  thickness: number
  lineStyle: 'solid' | 'dashed' | 'dotted'
}

export interface HtmlElement extends PopupElementBase {
  type: 'html'
  html: string // raw markup; <iframe> allowed — the manual-connect escape hatch
}

export type PopupElement =
  | HeadingElement
  | TextElement
  | ImageElement
  | ButtonElement
  | DividerElement
  | HtmlElement
```

### 2.4 Trigger, Placement, Frequency, Style

Same file (`src/lib/popup-builder/types.ts`):

```ts
export type PopupTriggerConfig =
  | { type: 'on-load'; delayMs: number } // 0 = show immediately on load
  | { type: 'exit-intent' } // mouse leaves the top of the viewport
  | { type: 'scroll-depth'; percent: number } // 1–100, % of page scrolled
  | { type: 'click-element'; selector: string } // click any element matching a CSS selector

export type PopupPlacement =
  | 'center'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'fullscreen'

export type PopupFrequency = 'every-visit' | 'once-per-session' | 'once-per-day' | 'once-per-week'

export interface PopupStyle {
  fontFamily?: 'sans' | 'serif' | 'mono' // default 'sans'
  backgroundColor?: string // popup card background, default '#ffffff'
  overlayColor?: string // default '#141413'
  overlayOpacity?: number // 0–0.9, default 0.5
  animation?: 'fade' | 'zoom' | 'slide-up' | 'none' // default 'fade'
  closable?: boolean // show the ✕ button, default true
  closeOnOverlayClick?: boolean // default true
  borderRadius?: number // popup card corners, default 16
}
```

**Runtime semantics (v1 scope):**

| Concern | Decision |
|---|---|
| One popup per snippet | Each `<script data-popup>` instance is independent; multiple snippets on one page work but may overlap (queueing is a v1.1 enhancement) |
| Publish gate | Only `published` popups are served by the embed page/API; drafts 404 publicly |
| Mobile (< 640px) | Non-fullscreen popups render as a full-width bottom sheet; the design canvas is **scaled down** with a CSS `transform: scale()` so the layout stays intact |
| Frequency storage | `sessionStorage` flag for `once-per-session`, `localStorage` timestamp for `once-per-day`/`once-per-week`, no storage for `every-visit` |
| Stats dedupe | View counted once per session per popup (session flag); each button click counts |
| Button link target | `openInNewTab=false` (default) navigates the host page (`window.top.location`); `true` opens a new tab |

### 2.5 Embed Architecture — Loader + iframe + postMessage

The host page loads `popup-loader.js` (static file in `public/`). The loader fetches a small public config, then renders an overlay + fixed-position box containing an **iframe** to `/popups/:publicId/embed` (the content page). Display concerns (position, overlay, animation, triggers, frequency) live in the loader; content rendering lives in the iframe. This mirrors the existing form-embed split (`ShareDialog` snippet ↔ `/forms/embed/:id`).

**postMessage protocol** (all messages carry `popupId` to disambiguate multiple instances):

| Direction | Message | Purpose |
|---|---|---|
| iframe → parent | `{ type: 'ponkoform:popup:ready', popupId }` | Content mounted at natural size |
| parent → iframe | `{ type: 'ponkoform:popup:show', popupId }` | Entrance animation may start |
| iframe → parent | `{ type: 'ponkoform:popup:click', popupId, link, newTab }` | Button clicked — parent counts it and opens the link (parent owns top navigation) |
| iframe → parent | `{ type: 'ponkoform:popup:close', popupId }` | ✕ / overlay-click close |
| iframe → parent | `{ type: 'ponkoform:resize', popupId, height }` | Content height changed (e.g. `html` element) — reuses the existing resize message name |

### 2.6 Stats Model

Counters on the `popups` row (`viewCount`, `clickCount`), incremented by the public API routes. The dashboard derives **click-through rate** (`clickCount / viewCount`). Session dedupe for views is enforced client-side (the loader's session flag) — the server stays stateless, so no new tables in v1.

- `view` — fired by the loader the moment a popup is shown.
- `click` — fired by the loader when it receives a `ponkoform:popup:click` message.
- Both beacons are `navigator.sendBeacon` POSTs (fire-and-forget, no CORS preflight).

### 2.7 Architecture Diagram

```mermaid
graph TD
    A[Host website<br/>e.g. WordPress] -->|script tag| B[popup-loader.js<br/>public/embed]
    B -->|GET /api/popups/:id/config| C[(popups table)]
    B -->|iframe| D[/popups/:id/embed<br/>PopupRuntime]
    D -->|postMessage click / close / ready| B
    B -->|sendBeacon view/click| E[/api/popups/:id/view + click]
    E --> C
    F[Creator management<br/>/popups] -->|createServerFn| C
    G[Popup Builder<br/>/popups/:id/edit]
    G --> F
```

---

## 3. UI Design

### 3.1 Management List — `/popups`

Follow the **Payment Links page** pattern (`src/routes/dashboard/payment-links.tsx` + `PaymentLinkCard`):

- Header with kicker, title, subtitle, and a **New popup** button (opens a create dialog asking only for a title; the popup is seeded with the sample layout from `defaults.ts`).
- Grid of `PopupCard`s: title, status pill (draft/published), trigger + placement summary line, and a stats row — **Views**, **Clicks**, **CTR%** — plus actions: *Edit*, *Embed* (opens `SharePopupDialog`), publish toggle, delete.
- A **Popups** quick-link section on `dashboard/index.tsx`, mirroring the Payment Links quick link at L568-589.

### 3.2 Builder Workspace — `/popups/:popupId/edit`

Three-pane editor following `PageBuilderWorkspace` conventions (dnd-kit, lucide icons, `Button`/`Toast` from `components/ui`):

- **Top bar** — back link, editable title, live stats (views/clicks), *Save* (auto-saves on change like `PageBuilderWorkspace.onChanged`), *Preview* (opens `/popups/:publicId/preview` in a new tab), publish toggle, *Embed* button.
- **Left palette** — draggable element chips (Heading, Text, Image, Button, Divider, HTML) using the `FIELD_DRAG_TYPE`-style drag type constant `application/x-ponkoform-popup-element`.
- **Center canvas** — a white box of exactly `width × height` px on a dotted-grid backdrop. Elements render through the same `PopupRuntime` component used publicly (live WYSIWYG). Interactions:
  - **Drop from palette** → element created at drop coordinates (clamped to canvas).
  - **Drag to move** — `useDraggable` per element + drag overlay; on drag end, update `x`/`y` with 8px snap.
  - **Resize** — bottom-right corner handle (pointer events, min 24px, updates `width`/`height`).
  - **Select** → right panel shows the element's settings; Delete key (or toolbar ✕) removes it; ⌘D duplicates.
  - Click empty canvas → deselect; canvas click also provides a small "Add element" affordance.
- **Right panel** — two modes: selected **element settings** (contextual per element type) or **popup settings** (canvas size, placement, trigger, frequency, style) via a tab or breadcrumb.

### 3.3 Element Settings (contextual)

Follow the input styling of `FieldSettings.tsx` (`inputClass` patterns, color swatches). Per type:

| Element | Controls |
|---|---|
| Heading | text, level, color, font size, weight, align |
| Text | text (textarea), color, font size, line height, align |
| Image | src URL, alt, fit (cover/contain), radius |
| Button | label, background color, text color, radius, font size, weight, **link URL** (the manual form connection), open-in-new-tab toggle |
| Divider | color, thickness, line style |
| HTML | code textarea (monospace) |

All elements share base controls: X/Y, W/H, opacity, rotation, z-index (via a "Bring forward/back" pair), delete/duplicate. Empty button links render as a dashed "Add link" placeholder in the runtime.

### 3.4 Popup Settings

- **Size** — width (280–1200) & height (200–1600) number inputs; a hint shows the mobile scale behavior.
- **Placement** — six thumbnails (center / 4 corners / fullscreen).
- **Trigger** — radio cards: *On load* (+ delay ms), *Exit intent*, *Scroll depth* (+ %), *Click on element* (+ selector input).
- **Frequency** — segmented control: every visit / once per session / day / week.
- **Style** — font family, background color, border radius, overlay color + opacity, animation (fade/zoom/slide-up/none), closable toggle, close-on-overlay-click toggle.

### 3.5 Preview Page — `/popups/:publicId/preview`

A mock host site (fake hero + body copy so scroll/exit triggers are testable) that loads the **real loader script** injected with `data-popup="<publicId>"`, plus a floating "Trigger simulator" toolbar (buttons to fire each trigger type and reset frequency state). This validates the production path end-to-end — no duplicate preview logic.

### 3.6 Share/Embed Dialog — `SharePopupDialog`

Follow `ShareDialog.tsx`: a modal with a copy button showing the snippet, only enabled for published popups:

```html
<script async src="https://ponkoform.com/embed/popup-loader.js" data-popup="abc123"></script>
```

Plus notes: paste anywhere (WordPress → Appearance → Custom HTML / Elementor HTML widget), how triggers work, and a link to the preview page.

---

## 4. Server Functions

New file `src/lib/server-fns/popups.ts`, following the `payment-links.ts` conventions (`createServerFn`, zod validators, `requireProfile()` for creator fns, `publicRequestOrigin()` where relevant).

**Creator-facing (authenticated):**

```ts
// Validator shapes (zod) — triggers are a discriminated union
const triggerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('on-load'), delayMs: z.number().int().min(0).max(600_000) }),
  z.object({ type: z.literal('exit-intent') }),
  z.object({ type: z.literal('scroll-depth'), percent: z.number().int().min(1).max(100) }),
  z.object({ type: z.literal('click-element'), selector: z.string().min(1).max(200) }),
])

const elementSchema = z.discriminatedUnion('type', [
  z.object({ id: z.string(), type: z.literal('heading'), x: z.number(), y: z.number(), width: z.number(), height: z.number(), zIndex: z.number(), opacity: z.number(), rotation: z.number(), level: z.union([z.literal(1), z.literal(2), z.literal(3)]), text: z.string(), color: z.string(), fontSize: z.number(), fontWeight: z.string(), align: z.string() }),
  // … text, image, button (incl. link + openInNewTab), divider, html — same shape family
])

const savePopupSchema = z.object({
  id: z.number(),
  title: z.string().min(1).max(255),
  width: z.number().int().min(280).max(1200),
  height: z.number().int().min(200).max(1600),
  placement: z.enum(['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'fullscreen']),
  trigger: triggerSchema,
  frequency: z.enum(['every-visit', 'once-per-session', 'once-per-day', 'once-per-week']),
  style: z.object({
    fontFamily: z.enum(['sans', 'serif', 'mono']).optional(),
    backgroundColor: z.string().optional(),
    overlayColor: z.string().optional(),
    overlayOpacity: z.number().min(0).max(0.9).optional(),
    animation: z.enum(['fade', 'zoom', 'slide-up', 'none']).optional(),
    closable: z.boolean().optional(),
    closeOnOverlayClick: z.boolean().optional(),
    borderRadius: z.number().min(0).max(64).optional(),
  }),
  elements: z.array(elementSchema),
})
```

| Function | Auth | Purpose |
|---|---|---|
| `createPopup({ data: { title } })` | profile | Insert with `publicId` (`randomBytes(8).toString('base64url').slice(0, 16)`), sample elements from `defaults.ts`; return row |
| `getPopups()` | profile | List own popups desc by `updatedAt` for the dashboard |
| `getPopup({ data: { id } })` | profile + ownership | Full row for the builder |
| `savePopup({ data })` | profile + ownership | Atomic whole-config save (title/size/placement/trigger/frequency/style/elements) + bump `updatedAt` |
| `setPopupStatus({ data: { id, status } })` | profile + ownership | draft ⇄ published toggle |
| `deletePopup({ data: { id } })` | profile + ownership | Remove row |

**Public-facing (no auth, `strict`):**

| Function | Purpose |
|---|---|
| `getPopupPublicConfig({ data: { publicId } })` | Published only → `{ publicId, width, height, placement, trigger, frequency, style }` (never elements) — consumed by the loader |
| `getPopupEmbed({ data: { publicId } })` | Published only → `{ publicId, title, width, height, style, elements }` — consumed by the embed page |
| `recordPopupView({ data: { publicId } })` | `UPDATE popups SET view_count = view_count + 1 WHERE public_id = ? AND status = 'published'` |
| `recordPopupClick({ data: { publicId } })` | Same for `click_count` |

---

## 5. Host-Side Loader Script — `public/embed/popup-loader.js`

The most novel artifact: a dependency-free vanilla-JS file served as a static asset, embedded on any site. Full reference implementation:

```js
/**
 * PonkoForm Popup Loader — v1
 *
 * Embed on any website (WordPress, Wix, static HTML):
 *
 *   <script async src="https://ponkoform.com/embed/popup-loader.js"
 *     data-popup="<publicId>"></script>
 *
 * Vanilla JS, no dependencies. Responsibilities:
 *   1. Read its own <script> tag to find the popup's public id.
 *   2. Fetch the public config (placement/size/trigger/frequency/style) from
 *      /api/popups/:id/config (the API responds with Access-Control-Allow-Origin: *).
 *   3. Build an overlay + fixed-position box containing an <iframe> that
 *      renders /popups/:id/embed (the popup content).
 *   4. Watch for the configured trigger and show the popup — unless frequency
 *      gating (once per session/day/week) says it shouldn't show again.
 *   5. Report views and clicks to the stats API via navigator.sendBeacon.
 *   6. Talk to the iframe through the postMessage protocol in §2.5.
 *
 * The loader never navigates the host page itself; navigation happens only
 * when the iframe posts a 'ponkoform:popup:click' message containing a link.
 */
(function () {
  'use strict'

  var script = document.currentScript
  var popupId = script && script.getAttribute('data-popup')
  if (!popupId) return

  // Derive the API origin from this script's own URL so the same file works
  // in dev (localhost:3000) and production (ponkoform.com).
  var ORIGIN = (function () {
    try { return new URL(script.src).origin } catch (e) { return window.location.origin }
  })()
  var API = ORIGIN + '/api/popups/' + encodeURIComponent(popupId)
  var SESSION_KEY = 'ponkoform:popup:' + popupId + ':session'
  var LAST_SHOWN_KEY = 'ponkoform:popup:' + popupId + ':lastShown'
  var MOBILE = window.matchMedia('(max-width: 639px)')

  var cfg = null
  var overlayEl = null
  var boxEl = null
  var frameEl = null
  var visible = false
  var triggerFired = false
  var sessionSeen = false // view counted once per session

  // ── Placement / sizing ──

  var PLACEMENTS = {
    center:       { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
    'top-left':   { top: '24px', left: '24px' },
    'top-right':  { top: '24px', right: '24px' },
    'bottom-left':  { bottom: '24px', left: '24px' },
    'bottom-right': { bottom: '24px', right: '24px' },
    fullscreen:   { top: '0', left: '0', right: '0', bottom: '0' },
  }

  function applyViewport() {
    if (!boxEl || !cfg) return
    var s = boxEl.style
    if (MOBILE.matches && cfg.placement !== 'fullscreen') {
      // Bottom sheet: full width, canvas scaled to fit.
      var scale = Math.min(1, (window.innerWidth - 16) / cfg.width)
      Object.assign(s, { top: 'auto', left: '0', right: '0', bottom: '0', width: '100%', height: Math.round(cfg.height * scale) + 'px', transform: 'none' })
      Object.assign(frameEl.style, { width: cfg.width + 'px', height: cfg.height + 'px', transform: 'scale(' + scale + ')', transformOrigin: 'top left' })
    } else {
      Object.assign(s, PLACEMENTS[cfg.placement] || PLACEMENTS.center)
      s.width = (cfg.placement === 'fullscreen' ? '100vw' : cfg.width + 'px')
      s.height = (cfg.placement === 'fullscreen' ? '100vh' : cfg.height + 'px')
      Object.assign(frameEl.style, { width: '100%', height: '100%', transform: 'none' })
    }
  }

  // ── DOM construction ──

  function build(cfg) {
    var style = cfg.style || {}
    overlayEl = document.createElement('div')
    overlayEl.className = 'ponko-popup-overlay'
    Object.assign(overlayEl.style, {
      position: 'fixed', inset: '0', zIndex: '99998',
      background: style.overlayColor || '#141413',
      opacity: String(style.overlayOpacity == null ? 0.5 : style.overlayOpacity),
      display: 'none', transition: 'opacity 200ms ease',
    })
    if (style.closeOnOverlayClick !== false) {
      overlayEl.addEventListener('click', hide)
    }

    boxEl = document.createElement('div')
    boxEl.className = 'ponko-popup-box'
    Object.assign(boxEl.style, {
      position: 'fixed', zIndex: '99999', display: 'none',
      transition: 'opacity 200ms ease, transform 200ms ease',
      transform: style.animation === 'none' ? 'none' : 'scale(0.92)',
    })

    frameEl = document.createElement('iframe')
    frameEl.src = ORIGIN + '/popups/' + encodeURIComponent(popupId) + '/embed'
    frameEl.title = 'PonkoForm popup'
    Object.assign(frameEl.style, { border: '0', display: 'block', borderRadius: String(style.borderRadius == null ? 16 : style.borderRadius) + 'px', background: style.backgroundColor || '#ffffff' })
    frameEl.setAttribute('loading', 'lazy')

    boxEl.appendChild(frameEl)
    document.body.appendChild(overlayEl)
    document.body.appendChild(boxEl)
    applyViewport()
    MOBILE.addEventListener ? MOBILE.addEventListener('change', applyViewport) : MOBILE.addListener(applyViewport)
  }

  // ── Show / hide ──

  function show() {
    if (!cfg || visible) return
    visible = true
    overlayEl.style.display = 'block'
    boxEl.style.display = 'block'
    requestAnimationFrame(function () {
      overlayEl.style.opacity = String(cfg.style.overlayOpacity == null ? 0.5 : cfg.style.overlayOpacity)
      boxEl.style.transform = cfg.style.animation === 'slide-up'
        ? 'translateY(24px)'
        : (cfg.style.animation === 'zoom' ? 'scale(1)' : 'none')
    })
    boxEl.contentWindow && boxEl.contentWindow.postMessage({ type: 'ponkoform:popup:show', popupId: popupId }, '*')
    try { localStorage.setItem(LAST_SHOWN_KEY, String(Date.now())) } catch (e) {}
    if (!sessionSeen) {
      sessionSeen = true
      navigator.sendBeacon && navigator.sendBeacon(API + '/view')
    }
  }

  function hide() {
    if (!visible) return
    visible = false
    overlayEl.style.opacity = '0'
    boxEl.style.transform = 'scale(0.92)'
    setTimeout(function () {
      overlayEl.style.display = 'none'
      boxEl.style.display = 'none'
    }, 200)
  }

  // ── Frequency gating ──

  function isAllowed() {
    var f = cfg.frequency
    if (f === 'every-visit') return true
    if (f === 'once-per-session') {
      try { return !sessionStorage.getItem(SESSION_KEY) } catch (e) { return true }
    }
    var last = Number(localStorage.getItem(LAST_SHOWN_KEY) || 0)
    if (!last) return true
    var days = f === 'once-per-day' ? 1 : 7
    return Date.now() - last >= days * 86400000
  }

  function maybeShow() {
    if (triggerFired || !isAllowed()) return
    triggerFired = true
    try { sessionStorage.setItem(SESSION_KEY, '1') } catch (e) {}
    show()
  }

  // ── Triggers ──

  function registerTrigger() {
    var t = cfg.trigger
    if (t.type === 'on-load') {
      setTimeout(maybeShow, Math.max(0, Number(t.delayMs) || 0))
    } else if (t.type === 'exit-intent') {
      document.addEventListener('mouseout', function (e) {
        if (!visible && e.relatedTarget === null && e.clientY <= 8) maybeShow()
      })
    } else if (t.type === 'scroll-depth') {
      var percent = Math.min(100, Math.max(1, Number(t.percent) || 50))
      var onScroll = function () {
        if (triggerFired) return
        var doc = document.documentElement
        var max = doc.scrollHeight - window.innerHeight
        if (max > 0 && (window.scrollY || doc.scrollTop) / max * 100 >= percent) maybeShow()
      }
      window.addEventListener('scroll', onScroll, { passive: true })
      onScroll()
    } else if (t.type === 'click-element') {
      document.addEventListener('click', function (e) {
        if (triggerFired) return
        try { if (e.target && e.target.closest && e.target.closest(t.selector)) maybeShow() } catch (err) {}
      })
    }
  }

  // ── postMessage from the iframe ──

  window.addEventListener('message', function (e) {
    var d = e.data
    if (!d || typeof d !== 'object') return
    if (d.popupId !== popupId) return
    if (d.type === 'ponkoform:popup:click') {
      navigator.sendBeacon && navigator.sendBeacon(API + '/click')
      if (d.link) {
        if (d.newTab) window.open(d.link, '_blank', 'noopener')
        else window.top.location.href = d.link
        hide()
      }
    } else if (d.type === 'ponkoform:popup:close') {
      hide()
    } else if (d.type === 'ponkoform:resize' && d.height) {
      frameEl.style.height = d.height + 'px'
    }
  })

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') hide()
  })

  // ── Boot ──

  fetch(API + '/config')
    .then(function (r) { if (!r.ok) throw new Error('config ' + r.status); return r.json() })
    .then(function (data) {
      cfg = data
      build(cfg)
      registerTrigger()
    })
    .catch(function () { /* silent — a broken/private popup never shows */ })
})()
```

> **Note on CORS:** `GET /api/popups/:id/config` must respond with `Access-Control-Allow-Origin: *` (the loader fetches cross-origin from the host site). `sendBeacon` POSTs need no preflight and their responses are not readable, but returning `Access-Control-Allow-Origin: *` with the 204 is harmless and future-proof.

---

## 6. File Change Summary

**New files:**

| Path | Purpose |
|---|---|
| `drizzle/0041_popups.sql` (+ meta snapshot) | `popups` table |
| `src/lib/popup-builder/types.ts` | `PopupElement`, `PopupTriggerConfig`, `PopupPlacement`, `PopupFrequency`, `PopupStyle` |
| `src/lib/popup-builder/defaults.ts` | Default style/trigger + `sampleElements()` (a "Get 10% off — join our newsletter" layout) + per-type element factory |
| `src/lib/popup-builder/runtime.ts` | Pure helpers: `scaleToFit()`, `frequencyKey()`, `isFrequencyAllowed()`, `clampToCanvas()` |
| `src/lib/popup-builder/runtime.test.ts` | Unit tests for the helpers above |
| `src/lib/server-fns/popups.ts` | All server functions from §4 |
| `src/lib/server-fns/popups.test.ts` | Validator + ownership + public-gating tests |
| `src/routes/api/popups/$publicId/config.ts` | GET config (CORS `*`) |
| `src/routes/api/popups/$publicId/view.ts` | POST view beacon → 204 |
| `src/routes/api/popups/$publicId/click.ts` | POST click beacon → 204 |
| `src/routes/popups/$publicId/embed.tsx` | Bare runtime page (iframe content) |
| `src/routes/popups/$publicId/preview.tsx` | Mock-site preview + trigger simulator |
| `src/routes/popups/index.tsx` | Authenticated list page |
| `src/routes/popups/$popupId/edit.tsx` | Authenticated builder route |
| `src/components/popup-runtime/PopupRuntime.tsx` | Renders `elements` from a config; owns the ✕ button + postMessage (shared by embed page and builder canvas) |
| `src/components/popup-builder/PopupBuilderWorkspace.tsx` | Three-pane editor shell + save/publish |
| `src/components/popup-builder/ElementPalette.tsx` | Draggable element chips |
| `src/components/popup-builder/PopupCanvas.tsx` | Drop/drag/resize/select canvas |
| `src/components/popup-builder/ElementSettings.tsx` | Contextual per-element controls |
| `src/components/popup-builder/PopupSettings.tsx` | Size/placement/trigger/frequency/style |
| `src/components/popup-builder/SharePopupDialog.tsx` | Embed snippet modal |
| `src/components/popup-builder/PopupCard.tsx` | Dashboard list card (stats + actions) |
| `public/embed/popup-loader.js` | Host-side loader (§5) |
| `docs/popup-embed-guide.md` | Creator-facing guide |

**Modified files:**

| Path | Change |
|---|---|
| `src/db/schema.ts` | Add `popups` table |
| `src/routes/dashboard/index.tsx` | Add Popups quick link (after Payment Links, L568-589) |
| `src/lib/server-fns/index.ts` | Re-export popups fns (check current barrel pattern) |
| `src/routeTree.gen.ts` | Regenerated by dev/build |
| `docs/current-system.md`, `docs/README.md` | Feature entries |
| `DESIGN.md` (optional) | Feature/architecture note |

---

## 7. Step-by-Step Tasks

These checkboxes are the completion criteria. Each phase ends runnable — server before UI, runtime before loader, loader before dashboard.

### Task 1: Types, defaults & migration (foundation)

- [x] Add `popups` table to `src/db/schema.ts` (§2.1), import types from `src/lib/popup-builder/types.ts`
- [x] Commit `drizzle/0041_popups.sql`; use the repository's compatibility migration runner (no generated snapshot required)
- [x] Create `src/lib/popup-builder/types.ts` (§2.3–2.4)
- [x] Create `src/lib/popup-builder/defaults.ts` — `sampleElements()`, `defaultStyle()`, `defaultTrigger()`, and an element factory per type
- [x] Create tested popup runtime helpers for scale, frequency, scheduling (including overnight windows), canvas size, and element bounds
- [x] Run the local schema compatibility check and confirm the seeded popup rows exist

### Task 2: Server functions

- [x] Implement popup server functions with validators, authenticated ownership checks, sanitized persistence, and owner-only preview
- [x] `createPopup` seeds `sampleElements()` + default style/trigger/placement/frequency
- [x] Public functions 404 unpublished popups; counters update published rows only
- [x] Add validator, sanitization, runtime, route-shell, and builder tests; verify ownership through authenticated/anonymous browser smoke
- [x] `pnpm test` green (104 files, 487 tests)

### Task 3: Public API routes

- [x] Public config route returns CORS-open 200/404 responses and includes the accessible popup title
- [x] View/click beacon routes return 204 and only increment published rows
- [x] Curl-smoke config, embed, view, and click routes with published and draft seeds

### Task 4: Runtime component + embed page

- [x] Implement the shared runtime with sanitized elements, safe link handling, ready/show messaging, resize reporting, close/Escape handling, and reduced-motion entrances
- [x] Implement the transparent embed route with a server-side true 404 for missing/unpublished popups and authenticated owner preview support
- [x] Browser-smoke the published embed and authenticated draft runtime against the seeded layouts

### Task 5: Loader script

- [x] Implement the loader with isolated placement/animation transforms, responsive resets, frequency gates, forced preview triggers, focus/scroll management, teardown, message verification, safe navigation, and reduced motion
- [x] Smoke the real loader through the preview host, including owner draft access, anonymous draft rejection, trigger controls, and published/draft counter behavior

### Task 6: Preview, dashboard list & stats

- [x] `src/routes/popups/$publicId/preview.tsx` — mock host page + explicit trigger simulator + clean loader reset
- [x] `src/routes/popups/index.tsx` + `PopupCard.tsx` — list, create dialog, stats (Views/Clicks/CTR), publish toggle, delete
- [x] `src/routes/dashboard/index.tsx` — Popups quick link (§3.1)

### Task 7: Builder workspace

- [x] `src/routes/popups/$popupId/edit.tsx` + `PopupBuilderWorkspace.tsx` — three-pane shell, serialized autosave, save/publish/preview flushing, validation, and bounded canvas editing
- [x] `ElementPalette.tsx` — element creation palette
- [x] `PopupCanvas.tsx` — drop/add, move, 8px grid plus canvas/element alignment guides, resize, select, delete, duplicate, layer controls, and canvas clamping
- [x] `ElementSettings.tsx` — contextual controls including safe button URLs and open-in-new-tab
- [x] `PopupSettings.tsx` — size, placement, trigger, frequency, campaign schedule, visitor-local daily hours, and style controls
- [x] Builder canvas renders via `PopupRuntime` (live WYSIWYG) with selection chrome on top

### Task 8: Share dialog + polish

- [x] `SharePopupDialog.tsx` — snippet with copy, publication state, and preview link
- [x] Wire Embed actions into the builder top bar and popup cards
- [x] Add focus/keyboard access, dialog semantics, and empty/loading states

### Task 9: Docs + end-to-end verification

- [x] Update the popup embed guide, current-system documentation, README index, routes, sanitization, and owner-preview behavior
- [x] Run tests, TypeScript, production build, schema check, loader syntax check, and diff check
- [x] Browser-smoke management list/editor, legacy redirects, real-loader preview, published runtime, and counter increments
- [x] Verify draft config/embed 404 publicly, anonymous preview does not leak content, and draft counters remain unchanged

---

## 8. Risks & Open Questions

| Risk / question | Handling |
|---|---|
| **Host-site ad blockers / privacy tools** may block the loader or iframe | Documented in the guide; nothing to build. The iframe keeps third-party tracking to a minimum (no cookies, `sendBeacon` only) |
| **Strict CSP on host sites** (`script-src` without our origin) | Documented; creator adds the origin to their allowlist |
| **Custom HTML can contain executable markup** | Sanitized at persistence and render boundaries; scripts, event handlers, and unsafe schemes are removed, and HTTPS iframes receive a sandbox. |
| **Host-page navigation from popup buttons** | Only safe HTTP(S), mail, telephone, fragment, and relative targets are accepted; messages are verified against the expected iframe source and origin. |
| **Multiple popups per page** | Supported but unmanaged (they may overlap). Queueing/priority + frequency orchestration is a v1.1 enhancement |
| **Stats are totals, not time-series** | Deliberate v1 scope (matches `payment_links` counters). A `popup_events` table + chart is a natural follow-up |
| **Mobile canvas scaling** (transform scale) makes text small on very narrow screens | Accepted for v1; a per-element mobile override is a v1.1 item |
| **`html` element growth** changes iframe height | Handled via `ponkoform:resize` from the runtime page (ResizeObserver) |
| **Open question: analytics for conversions** (form submissions from popup clicks) | v1 counts clicks; linking popup → form submission via a query param (e.g. `?ponko_popup=id`) is a clean future path |

---

## 9. Validation / Testing

- **Unit** — `runtime.test.ts` (scale, frequency, clamp) and `popups.test.ts` (validators, ownership, publish gating, counter increments), following `payment-links.test.ts`/`PublicFormView.test.tsx` patterns.
- **API smoke** — `curl -i` against `/api/popups/:id/{config,view,click}` including CORS headers.
- **Embed E2E** — `test-embed.html` + `pnpm dev` on localhost: publish a popup, paste the snippet, verify every trigger type, frequency windows, mobile bottom-sheet, counters, and CTR in the dashboard. The preview page (`/popups/:publicId/preview`) exercises the same production loader path.
- **Build** — `pnpm test` and `pnpm build` must pass (route tree regenerated).
