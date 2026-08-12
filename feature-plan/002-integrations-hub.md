# FT-002: Integrations Hub

> **Feature Plan** — A dedicated `/dashboard/integrations` page where users discover, configure, and manage all third-party integrations grouped by category.

**Status:** ✅ **IMPLEMENTED** (all 8 tasks completed) — live at `/dashboard/integrations`

**Monitoring needed:**
- [ ] Data migration: verify `integration_settings` → `integrations` ran for all existing users
- [ ] Payment gateway code: `loadIntegrationConfigs()` reads new table with fallback to old — confirm no breakage
- [ ] Google OAuth: works once `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` env vars are set
- [ ] Modal UX: "Saved — leave blank to keep" placeholder only applies to password fields — confirm text fields don't need it too
- [ ] Remove old `integration_settings` table and legacy server fns (`saveXenditSettings`, `savePaypalSettings`, `saveSmtpSettings`) after 30-day cooldown

**Goal:** Replace the flat long-form `/dashboard/settings` integration sections with a standalone integrations hub that groups providers by category (Payments, Email, Data Export, AI, Scheduling, File Storage) and lets users click into each to configure with a modal form.

**Architecture:** New `integrations` table (normalized — one row per profile + provider) replaces the column-per-provider approach, making it trivial to add new integrations without schema changes. Existing `integration_settings` data is migrated.

---

## 1. Integrations Catalog

### 💳 Payments
| # | Provider | Slug | Config fields | Notes |
|---|---|---|---|---|
| P1 | **Stripe** | `stripe` | `secretKey` (sk_live_…), `publishableKey` (pk_live_…), `webhookSecret` (whsec_…) | Already have PayPal + Xendit from existing |
| P2 | **PayMongo** | `paymongo` | `secretKey` (sk_test_… / sk_live_…), `publicKey` (pk_test_… / pk_live_…) | PH payments: card, GCash, GrabPay, Maya via one API |
| P3 | **GCash (via PayMongo)** | `gcash` | Share config with PayMongo (it's a PayMongo payment method, not a separate gateway) | Use PayMongo's GCash-specific checkout |
| P4 | **Maya** | `maya` | `clientId`, `clientSecret`, `mode` (sandbox/live) | Maya Checkout API |

### 📬 Email
| # | Provider | Slug | Config fields | Notes |
|---|---|---|---|---|
| E1 | **SMTP** | `smtp` | `host`, `port`, `secure`, `user`, `password`, `fromEmail`, `fromName` | Existing — keep and enhance with "Test send" button |
| E2 | **Resend** | `resend` | `apiKey` (re_…) | Modern email API, free tier (100/day), React email |

### 📊 Data Export
| # | Provider | Slug | Config fields | Notes |
|---|---|---|---|---|
| D1 | **Google Sheets** | `google-sheets` | OAuth flow (no manual keys — auth via Google OAuth) | Every new row in a sheet = new form submission |

### 🧠 AI
| # | Provider | Slug | Config fields | Notes |
|---|---|---|---|---|
| A1 | **Google Gemini** | `gemini` | `apiKey` | AI-powered auto-fill, smart suggestions, field generation |

### 📅 Scheduling
| # | Provider | Slug | Config fields | Notes |
|---|---|---|---|---|
| S1 | **Google Calendar** | `google-calendar` | OAuth flow, `calendarId` | Create calendar events on form submission |
| S2 | **Calendly** | `calendly` | `apiToken`, `organizationUrl` (e.g. `calendly.com/username`) | Embed booking links in flow steps |

### ☁️ File Storage
| # | Provider | Slug | Config fields | Notes |
|---|---|---|---|---|
| F1 | **ImageKit** | `imagekit` | `publicKey`, `privateKey`, `urlEndpoint` (e.g. `https://ik.imagekit.io/your-id`) | Image upload with transforms |
| F2 | **Cloudinary** | `cloudinary` | `cloudName`, `apiKey`, `apiSecret` | Image/video upload with transforms |

---

## 2. DB Schema Change

### New `integrations` table

```sql
CREATE TABLE integrations (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,  -- 'stripe', 'paymongo', 'smtp', 'resend', etc.
  config TEXT,                     -- AES-256-GCM encrypted JSON
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(profile_id, provider)
);
```

Drizzle schema (`src/db/schema.ts`):

```ts
export const integrations = pgTable(
  'integrations',
  {
    id: serial().primaryKey(),
    profileId: integer('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 50 }).notNull(),
    config: text('config'), // encrypted JSON
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('integrations_profile_provider_idx').on(table.profileId, table.provider)],
)
```

### Migration script

1. Create new `integrations` table
2. Migrate existing `integration_settings` rows into `integrations` rows:
   - `xendit_config` → provider:`xendit`
   - `paypal_config` → provider:`paypal`
   - `smtp_config` → provider:`smtp`
3. Keep `integration_settings` table for backward compatibility during rollout, drop in a cleanup migration

---

## 3. Navigation

### Before (current)

```
/dashboard/settings
├── Xendit Section (card with form)
├── PayPal Section (card with form)
└── SMTP Section (card with form)
```

### After

```
/dashboard/settings
└── <inline> Integrations button
    └── /dashboard/integrations
        ├── 💳 Payments section
        │   ├── PayPal card → modal
        │   ├── Xendit card → modal
        │   ├── Stripe card → modal
        │   ├── PayMongo card → modal
        │   └── Maya card → modal
        ├── 📬 Email section
        │   ├── SMTP card → modal
        │   └── Resend card → modal
        ├── 📊 Data Export section
        │   └── Google Sheets card → OAuth flow
        ├── 🧠 AI section
        │   └── Google Gemini card → modal
        ├── 📅 Scheduling section
        │   ├── Google Calendar card → OAuth flow
        │   └── Calendly card → modal
        └── ☁️ File Storage section
            ├── ImageKit card → modal
            └── Cloudinary card → modal
```

### Settings page changes

The existing `/dashboard/settings` gets simplified — it keeps any non-integration settings, and gains a prominent "Integrations" button that navigates to the new `/dashboard/integrations` page.

New route: `/dashboard/integrations` (works seamlessly with the existing file-based routing).

---

## 4. Page UI

### Integration Card (per provider)

```
┌─────────────────────────────────────────────┐
│  [icon]  Provider Name                      │
│  Description line about what it does        │
│                                             │
│  ┌───────────┐                              │
│  │ Configure │  or  ┌──────┐  ┌──┐         │
│  │ (not set) │      │Edit  │  │⛌│         │
│  └───────────┘      └──────┘  └──┘         │
│         ↑                    ↑              │
│     not configured      configured          │
└─────────────────────────────────────────────┘
```

### Integration Categories (section headers)

```
💳 Payments
─── ─── ─── ─── ─── ─── ─── ─── ─── ───
[PayPal ✓] [Xendit] [Stripe] [PayMongo] [Maya]

📬 Email
─── ─── ─── ─── ─── ─── ─── ─── ─── ───
[SMTP ✓] [Resend]
...
```

### Configuration Modal

When a user clicks "Configure" (or "Edit") on a card:

```
┌──────────────────────────────────────────┐
│  Provider Name           [X close]       │
│  ─────────────────────────────────────── │
│                                          │
│  Logo / Brand area                       │
│                                          │
│  ──── Credentials ─────────────────────── │
│                                          │
│  [Input: API Key / Secret Key]           │
│  [Input: Other config fields]            │
│                                          │
│  ┌─── Help / Where to find this ─────────┐│
│  │ Go to Stripe Dashboard → Developers  ││
│  │ → API Keys → Create secret key       ││
│  └──────────────────────────────────────┘│
│                                          │
│  [Cancel]           [Save Integration]   │
└──────────────────────────────────────────┘
```

---

## 5. Data Flow

```
User clicks a card → modal opens
  → modal shows form fields for that provider
  → user fills in credentials → Save
  → server fn:
      1. encryptJson(config)  (AES-256-GCM, same crypto.ts)
      2. db.insert(integrations).values({ profileId, provider, config }).onConflictDoUpdate(...)
      3. return { success: true }
  → UI shows "Connected ✓" badge
  → Modal closes

User clicks Edit → modal pre-fills with last saved masked values
User clicks Remove (🗑) → db.delete → UI resets to "Configure"
```

---

## 6. File Changes

| # | Action | File | Reason |
|---|---|---|---|
| 1 | **Modify** | `src/db/schema.ts` | Add `integrations` table (keep `integration_settings` during migration) |
| 2 | **Create** | `drizzle/NNNN_integrations.sql` | Migration to create table + migrate existing data |
| 3 | **Create** | `src/lib/integrations/types.ts` | Add config interfaces for new 10 providers + update existing |
| 4 | **Modify** | `src/lib/integrations/credentials.ts` | Add `loadAllIntegrations`, `getIntegration`, `upsertIntegration`, `deleteIntegration` for the new table |
| 5 | **Modify** | `src/lib/server-fns/integrations.ts` | Add generic `saveIntegration` + `deleteIntegration` server fns (or keep per-provider ones) |
| 6 | **Create** | `src/lib/server-fns/integration-list.ts` | Server fn that returns all integrations status for a profile (used by the hub page) |
| 7 | **Create** | `src/components/integrations/IntegrationsHub.tsx` | Main page component — renders all category sections, loads statuses |
| 8 | **Create** | `src/components/integrations/CategorySection.tsx` | Section header + provider card grid |
| 9 | **Create** | `src/components/integrations/ProviderCard.tsx` | Single integration card (icon, name, desc, status badge, configure/edit button) |
| 10 | **Create** | `src/components/integrations/IntegrationModal.tsx` | Generic modal that renders provider-specific form fields |
| 11 | **Create** | `src/components/integrations/providerForms.ts` | Per-provider form config schemas (field definitions, docs links) |
| 12 | **Create** | `src/components/integrations/index.ts` | Barrel export |
| 13 | **Create** | `src/routes/dashboard/integrations.tsx` | Route page — renders `IntegrationsHub` |
| 14 | **Modify** | `src/routes/dashboard/settings.tsx` | Add "View Integrations" button, simplify integration sections or remove them |
| 15 | **Modify** | `src/routes/__root.tsx` (TopNav) | Update "Settings" nav link — or add "Integrations" as a direct nav item |

---

## 7. Step-by-Step Tasks

### Task 1: DB migration — create `integrations` table

**Files:**
- Modify: `src/db/schema.ts` — add `integrations` table
- Create: `drizzle/NNNN_integrations.sql` — create table + migrate existing `integration_settings` data into `integrations` rows

**Migration SQL (inline in the drizzle file after `drizzle-kit generate`):**
```sql
-- The new table (Drizzle generates this from schema change)
CREATE TABLE IF NOT EXISTS integrations ( ... );

-- Migrate existing data
INSERT INTO integrations (profile_id, provider, config)
SELECT profile_id, 'xendit', xendit_config FROM integration_settings WHERE xendit_config IS NOT NULL
ON CONFLICT (profile_id, provider) DO NOTHING;

INSERT INTO integrations (profile_id, provider, config)
SELECT profile_id, 'paypal', paypal_config FROM integration_settings WHERE paypal_config IS NOT NULL
ON CONFLICT (profile_id, provider) DO NOTHING;

INSERT INTO integrations (profile_id, provider, config)
SELECT profile_id, 'smtp', smtp_config FROM integration_settings WHERE smtp_config IS NOT NULL
ON CONFLICT (profile_id, provider) DO NOTHING;
```

**Verification:** `pnpm exec drizzle-kit generate && pnpm exec tsc --noEmit`

**Commit:** `git add -A && git commit -m "feat: add integrations table + migrate existing data"`

### Task 2: Extend integration types for all 10 new providers

**Files:**
- Modify: `src/lib/integrations/types.ts` — add config interfaces for Stripe, PayMongo, Maya, Resend, GoogleSheets, Gemini, GoogleCalendar, Calendly, ImageKit, Cloudinary
- Add `ProviderSlug` type union

```ts
export type ProviderSlug =
  | 'xendit' | 'paypal' | 'stripe' | 'paymongo' | 'maya'
  | 'smtp' | 'resend'
  | 'google-sheets'
  | 'gemini'
  | 'google-calendar' | 'calendly'
  | 'imagekit' | 'cloudinary'

export interface IntegrationRow {
  id: number
  profileId: number
  provider: ProviderSlug
  config: string | null // encrypted JSON
  createdAt: Date
  updatedAt: Date
}

export interface IntegrationStatus {
  provider: ProviderSlug
  configured: boolean
  // Non-secret metadata for display (provider-specific)
  meta?: Record<string, string>
}
```

**Verification:** `pnpm exec tsc --noEmit`

**Commit:** `git add -A && git commit -m "feat: add integration type definitions for all providers"`

### Task 3: New credentials access layer + server functions

**Files:**
- Modify: `src/lib/integrations/credentials.ts`
  - `getAllIntegrations(profileId)` → returns all `IntegrationStatus[]`
  - `getIntegrationConfig(profileId, provider)` → decrypt and return config
  - `saveIntegration(profileId, provider, config)` → encrypt + upsert
  - `removeIntegration(profileId, provider)` → delete row
- Modify: `src/lib/server-fns/integrations.ts`
  - Add `getAllIntegrationStatuses` (GET) — returns `IntegrationStatus[]`
  - Add `saveIntegration` (POST) — generic, takes `(provider, config)` 
  - Update `deleteIntegration` to accept any `ProviderSlug`
  - Keep existing `saveXenditSettings`, `savePaypalSettings`, `saveSmtpSettings` as aliases (backward compat)

**Verification:** `pnpm exec tsc --noEmit`

**Commit:** `git add -A && git commit -m "feat: generic integration CRUD server functions"`

### Task 4: Provider forms config — field definitions per provider

**Create:** `src/components/integrations/providerForms.ts`

```ts
export interface ProviderFormField {
  name: string        // e.g. 'secretKey', 'apiKey'
  label: string       // e.g. 'Secret API key'
  type: 'password' | 'text' | 'select' | 'email'
  placeholder?: string
  required?: boolean
  docLink?: string    // URL to "where do I find this?"
}

export interface ProviderFormConfig {
  provider: ProviderSlug
  name: string          // Display name
  icon: string          // Emoji or SVG path
  description: string   // Short one-liner
  category: 'payments' | 'email' | 'data-export' | 'ai' | 'scheduling' | 'file-storage'
  fields: ProviderFormField[]
  docsUrl?: string      // Full setup guide URL
  planned?: boolean     // true = shown as "Coming soon"
}

export const PROVIDER_FORMS: Record<ProviderSlug, ProviderFormConfig> = {
  stripe: {
    provider: 'stripe',
    name: 'Stripe',
    icon: '💳',
    description: 'Accept payments from 135+ currencies worldwide.',
    category: 'payments',
    fields: [
      { name: 'secretKey', label: 'Secret key', type: 'password', required: true, placeholder: 'sk_live_...', docLink: 'https://dashboard.stripe.com/apikeys' },
      { name: 'publishableKey', label: 'Publishable key', type: 'text', required: true, placeholder: 'pk_live_...' },
      { name: 'webhookSecret', label: 'Webhook signing secret', type: 'password', placeholder: 'whsec_...' },
    ],
    docsUrl: 'https://stripe.com/docs/keys',
  },
  paymongo: { ... },
  maya: { ... },
  resend: { ... },
  gemini: { ... },
  'google-sheets': { ... },  // special: OAuth flow, no manual keys
  'google-calendar': { ... }, // special: OAuth flow
  calendly: { ... },
  imagekit: { ... },
  cloudinary: { ... },
  // xendit, paypal, smtp are migrated from the old table / kept for backward compat
}
```

**Verification:** `pnpm exec tsc --noEmit`

**Commit:** `git add -A && git commit -m "feat: provider form definitions for all integrations"`

### Task 5: Integrations Hub page

**Create:** `src/components/integrations/ProviderCard.tsx`
- Props: `provider: ProviderSlug, configured: boolean, meta?: Record<string, string>, onConfigure: () => void`
- Renders: icon, name, description, status badge, Configure/Edit/Remove buttons

**Create:** `src/components/integrations/CategorySection.tsx`
- Props: `title: string, icon: string, providers: ProviderSlug[]`
- Renders section header + horizontal wrap of `ProviderCard` items

**Create:** `src/components/integrations/IntegrationModal.tsx`
- Receives `provider: ProviderSlug, open, onClose, onSave`
- Looks up form config from `PROVIDER_FORMS`
- Renders fields with inputs, "Where to find this" doc link, Save/Cancel
- On save: calls `saveIntegration()` server fn
- Handles OAuth providers separately (opens popup window for Google OAuth)

**Create:** `src/components/integrations/IntegrationsHub.tsx`
- Fetches `getAllIntegrationStatuses()` on mount
- Groups results by category
- Renders `<CategorySection>` for each group
- Manages modal state (which provider to configure)

**Create:** `src/routes/dashboard/integrations.tsx`
```tsx
export const Route = createFileRoute('/dashboard/integrations')({
  beforeLoad: () => requireAuth(),
  component: IntegrationsPage,
})
function IntegrationsPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-medium text-[#141413]">Integrations</h1>
      <p className="mt-1 text-[#6c6a64]">Connect your accounts to extend what your forms can do.</p>
      <div className="mt-10">
        <IntegrationsHub />
      </div>
    </div>
  )
}
```

**Verification:** Navigate to `/dashboard/integrations`, see all provider cards grouped by category. Click a card → modal opens with form fields. Fill → Save → card shows "Connected" badge.

**Commit:** `git add -A && git commit -m "feat: integrations hub page with provider cards and modals"`

### Task 6: Wire navigation — settings page + top nav

**Modify:** `src/routes/dashboard/settings.tsx`
- Replace the 3 inline sections (Xendit, PayPal, SMTP) with a single "Integrations" callout card:
  ```
  ┌──────────────────────────────────────────┐
  │  ⚡ Integrations                         │
  │  Manage payment gateways, email, AI,     │
  │  and more from the integrations hub.     │
  │                                          │
  │  [View Integrations →]                   │
  └──────────────────────────────────────────┘
  ```

**Modify:** `src/routes/__root.tsx` (TopNav)
- Keep "Settings" link (it now points to `/dashboard/settings`)
- (Optional) Add an "Integrations" link next to Settings, or integrate it within Settings page

**Verification:** Click Settings → see "View Integrations" button → click → lands on `/dashboard/integrations`. The top nav still works.

**Commit:** `git add -A && git commit -m "feat: wire integrations hub into settings and navigation"`

### Task 7: OAuth flows for Google Sheets + Google Calendar

**Create:** `src/lib/server-fns/google-oauth.ts`
- `getGoogleAuthUrl()` — returns Google OAuth consent URL (scoped to sheets + calendar)
- `handleGoogleCallback(code)` — exchanges auth code for tokens, stores in `integrations` under provider `google-sheets` / `google-calendar`
- `revokeGoogleTokens()` — revokes + removes

**Modify:** `src/components/integrations/IntegrationModal.tsx`
- When provider is `google-sheets` or `google-calendar`, show a "Connect with Google" button instead of manual fields
- Opens a popup to `getGoogleAuthUrl()`, listens for the callback via `window.addEventListener('message', ...)` or redirects back

**File:** `.env` — add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`

**Verification:** Click Google Sheets → Google OAuth popup opens → authorize → popup closes → card shows "Connected"

**Commit:** `git add -A && git commit -m "feat: Google OAuth for Sheets and Calendar integration"`

### Task 8: Planned/coming-soon state + empty states

- Providers with `planned: true` show as greyed-out "Coming soon" cards (design mockup for future integrations without full implementation)
- Empty state when no integrations in a category: "No integrations in this category yet"
- Loading state: skeleton cards while statuses load from server

**Verification:** Greyed cards appear for unlisted providers. Loading shows skeleton animation.

**Commit:** `git add -A && git commit -m "feat: coming-soon state for planned integrations"`

---

## 8. Risks & Open Questions

| Risk | Mitigation |
|---|---|
| **Xendit/PayPal/SMTP breakage** during migration from old `integration_settings` table | Data migration script runs in a transaction. Old table is kept and deleted in a SEPARATE cleanup PR after the new system is verified. All existing server fns still work via backward-compat path. |
| **Google OAuth is complex** | Use `openid-client` or a minimal OAuth helper. The popup + postMessage approach requires the OAuth redirect target to be on the same domain. Alternative: redirect the full page. |
| **Some providers may never be used** | `planned: true` flag on config. Show as "Coming soon" cards — no wasted dev time, users can still see what's planned. |
| **Encrypted config schema changes** (we add/remove fields) | The JSON is versionless — adding optional fields is backward-safe. Removing required fields requires a migration to null out old configs. Avoid breaking changes by marking fields optional where possible. |
| **Token storage size** | Each encrypted config is <2 KB. Even at 1M users with 5 integrations each, 10 GB of storage — negligible. |

**Open Questions:**
1. Should OAuth tokens (Google Sheets, Google Calendar) be stored in the same `integrations.config` field, or in a separate `integrations.tokens` column? — Recommend same field (just include `{ accessToken, refreshToken, expiryDate }` in the config JSON alongside any other settings).
2. Should we add a "Test connection" button for SMTP/Stripe/etc. to verify credentials before saving? — Nice-to-have, defer to v2.
3. Top nav: should "Integrations" be its own nav item or nested under Settings? — Stretch goal: add as a separate nav item if the integration list grows beyond 10.

---

## 9. Validation / Testing

| Check | How |
|---|---|
| `/dashboard/integrations` loads with all provider cards | Navigate to route, see 💳 📬 📊 🧠 📅 ☁️ sections |
| Click unconfigured card → modal opens with form fields | Modal renders correct fields per provider |
| Fill fields → Save → card shows "Connected" | `SELECT * FROM integrations WHERE profile_id = X` has row |
| Click Edit → modal pre-fills masked values | Modal shows `Saved (sk_****)` placeholders |
| Click Remove → card resets to "Configure" | Row deleted, UI updates |
| Xendit from old settings page still works | Old `saveXenditSettings` fn still works (backward compat) |
| Build passes | `pnpm run build` exits 0 |
| TypeScript | `pnpm exec tsc --noEmit` = 0 errors |

---

## 10. Future Improvements — Ideas to Explore

These are NOT planned/in-scope yet — just brain-dumped for when we want to expand.

### 🔌 New Integrations (add as `ProviderSlug`)

| Category | Provider | Why | Effort |
|---|---|---|---|
| 💳 **Payments** | **GCash Direct** | 80M+ PH users — biggest wallet | Medium (needs PH partnership) |
| 💳 **Payments** | **Dragonpay** | PH over-the-counter/bank transfer payments | Medium |
| 💳 **Payments** | **PesoPay / 2C2P** | SE Asian payment gateway | Medium |
| 📬 **Email** | **SendGrid** | Industry standard transactional email | Low |
| 📬 **Email** | **Mailgun** | Developer-friendly email API | Low |
| 📬 **Email** | **Postmark** | Reliable transactional email | Low |
| 📊 **Data** | **Airtable** | Sync submissions to Airtable base | Medium (OAuth) |
| 📊 **Data** | **Notion Database** | Push to Notion DB on submission | Medium (OAuth) |
| 🔗 **Automation** | **Outgoing Webhooks** | POST submission JSON to any URL. **Unlocks everything** — users connect Zapier/Make/n8n themselves | **Low effort, HIGH value** |
| 🔗 **Automation** | **Zapier** | 5,000+ app integrations | Low (webhook-based) |
| 🔗 **Automation** | **Make (Integromat)** | Visual automation, more powerful than Zapier | Low (webhook-based) |
| 🧠 **AI** | **OpenAI** | Auto-fill, smart suggestions, field generation | Low (same pattern as Gemini) |
| 🧠 **AI** | **Claude API** | Same as OpenAI, alternative provider | Low |
| 🔏 **e-Sign** | **Dropbox Sign** | Add a signature step in a flow | Medium |
| 🔏 **e-Sign** | **DocuSign** | Enterprise e-signature | Medium |
| 📅 **Scheduling** | **Cal.com** | Open-source Calendly alternative | Low |
| 🔐 **Spam** | **Cloudflare Turnstile** | Privacy-friendly CAPTCHA for public forms | Low |
| 🔐 **Spam** | **reCAPTCHA v3** | Google's invisible CAPTCHA | Low |
| 📱 **Messaging** | **Slack Webhooks** | Post submissions to a Slack channel | Low |
| 📱 **Messaging** | **Telegram Bot** | Receive submissions as messages | Low |
| 📱 **Messaging** | **Discord Webhooks** | Post to a Discord channel | Low |
| 📱 **Messaging** | **Twilio SMS** | SMS notification on submission | Medium |
| ☁️ **Storage** | **Uploadcare** | File upload with CDN delivery (free tier) | Low |
| ☁️ **Storage** | **S3 / R2 / B2** | Object storage for file uploads | Medium |
| 📈 **Analytics** | **Google Analytics 4** | Track form views/submissions as events | Low |
| 📈 **Analytics** | **Meta Pixel** | Conversion tracking for Facebook ads | Low |
| 🤝 **CRM** | **HubSpot** | Create contact on form submission | Medium (OAuth) |
| 🤝 **CRM** | **Salesforce** | Enterprise CRM lead creation | High |
| 🤝 **CRM** | **Mailchimp** | Add respondent to mailing list | Medium (OAuth) |

### 🧰 Platform Features (not just adding a provider)

| Feature | What it does | Why it matters | Effort |
|---|---|---|---|
| **Outgoing Webhooks** | POST raw submission data to a user-configured URL on every form completion | **Single most powerful feature.** Lets users wire up ANYTHING — Zapier, Make, n8n, custom apps | **Low** (~2 files, similar pattern to `saveIntegration`) |
| **Test Connection** | Button inside each config modal that validates credentials (e.g. Stripe: `GET /v1/balance`) | Users know immediately if their keys work | Low-Medium |
| **REST API Key** | Generate a scoped API key so users can create forms / read submissions programmatically | Developer power-user feature | Medium |
| **MCP Server** | Expose forms, submissions, integrations via Model Context Protocol | AI agents (like me!) can manage PonkoForm directly | Medium |
| **Branded Email Templates** | Custom HTML email templates for submission notifications + receipts | SMTP/Resend users expect branded emails | Medium |
| **Submission Analytics** | Drop-off tracking per flow step, conversion rates, time-to-complete | Form creators want to know where respondents leave | Medium |
| **Multi-lingual Forms** | Per-field translations — respondent picks language | Opens international markets | High |
| **Custom Domain** | Serve forms from user's own domain (CNAME + SSL) | Professional look for enterprise users | High |
| **Zapier / Make Direct Integration** | Published Zapier app so users can connect PonkoForm without webhooks | Discovery in Zapier's marketplace | High (requires Zapier partnership) |

### 🏆 Top 3 Recommendations (highest impact per effort)

1. **Outgoing Webhooks** — 1-2 days to build, gives users infinite integrations via Zapier/Make/n8n
2. **Test Connection button** — 1 day, eliminates the #1 support question ("why isn't my integration working?")
3. **Slack / Discord webhooks** — 1 day, high-visibility "wow" feature for teams
