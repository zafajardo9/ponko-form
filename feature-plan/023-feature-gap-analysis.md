# PonkoForm Feature Gap Analysis — Competitive & Internal Audit

**Date:** 2026-07-28  
**Codebase:** `/Users/zafajardo/Documents/Development/ponkoform`

---

## 1. Current Feature Scope (Mapped)

### 1.1 Form Builder Paradigms
- **Page Builder** (FT-007): Linear multi-page forms, per-page fields, field conditions (show/hide), form references, templates, pre-created field groups
- **Flow Builder** (FT-001): Visual node-graph editor — nodes: `start`, `form_field`, `group`, `decision`, `calculator`, `payment`, `summary`, `redirect`

### 1.2 Field Types (17 total)
`text`, `email`, `number`, `textarea`, `select`, `checkbox`, `radio`, `payment`, `date`, `time`, `datetime`, `content`, `media`, `address`, `computation`, `file_upload`, `satisfaction`, `recaptcha`

### 1.3 Flow Engine
Variables system (string, number, boolean, money, date, time, datetime), template interpolation, execution tracking with history, variable binding

### 1.4 Payments
- **Fully implemented gateways**: Xendit (PH), PayPal (multi-currency)
- **UI-only (no gateway code)**: Stripe, PayMongo, Maya — config forms exist but `src/integrations/payments/index.ts` only registers PayPal + Xendit
- Subscriptions (Xendit cycles), payment events, webhook reconciliation, sandbox/live mode switching
- Payment computation engine (field/sum/options/fixed/formula)

### 1.5 Integrations Hub (FT-002)
Generic CRUD with AES-256-GCM encrypted configs, 15 providers across 7 categories. Full-stack integration pattern documented.

| Category | Providers | Status |
|---|---|---|
| Payments | Xendit, PayPal, Stripe, PayMongo, Maya | ✅ Xendit+PayPal; 🟡 Stripe/PayMongo/Maya (UI only) |
| Email | SMTP, Resend | ✅ Fully implemented |
| Data Export | Google Sheets | 🟡 OAuth flow done; sync engine MISSING |
| AI | Gemini | 🟡 Config only; no AI logic |
| Scheduling | Google Calendar, Calendly | 🟡 Config only; no integration logic |
| File Storage | ImageKit, Cloudinary | 🟡 Config only; no integration logic |
| Security | reCAPTCHA | ✅ Fully implemented |

### 1.6 Email System
SMTP + Resend transactional email, confirmation emails, invoice emails with HTML templates, delivery logs with snapshotting. Prefers Resend, falls back to SMTP.

### 1.7 Submissions & Analytics
- Submissions query engine with JSONB querying
- CSV export
- Dashboard analytics: aggregate stats (forms/submissions/payments/revenue), time series (30-day), per-form analytics, multi-currency conversion
- **Missing**: per-form page-level funnel analytics (FT-017 planned), visitor tracking

### 1.8 Other
- Invoicing with template builder (FT-013)
- Satisfaction surveys with email invitations (FT-014)
- Form theming (accent/background/corners)
- reCAPTCHA anti-spam
- Docs viewer (markdown)
- Form templates (built-in + user)
- MCP SDK dependency

---

## 2. Competitor Feature Gaps

Comparing PonkoForm to **Typeform, JotForm, Tally, Paperform, Fillout**:

| Feature | PonkoForm | Typeform | JotForm | Tally | Paperform | Fillout |
|---|---|---|---|---|---|---|
| **Conditional logic** (answers → show/hide fields) | ✅ Page builder only | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Logic jumps** (branching questions) | ✅ Flow builder | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Payments (Stripe)** | ❌ UI only | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Payment links** (no-form checkout) | ❌ Planned (FT-018) | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Webhooks / Zapier** | ❌ Planned (FT-020) | ✅ (native) | ✅ (native+Zapier) | ✅ (Zapier) | ✅ (native+Zapier) | ✅ (Zapier) |
| **Discount codes / coupons** | ❌ Planned (FT-021) | ❌ | ✅ | ❌ | ✅ | ❌ |
| **Answer piping** (use prev answers in later questions) | ✅ Flow variables | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Hidden fields / URL parameters** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Calculator / scoring** | ✅ Calculator node | ✅ | ✅ | ✅ | ✅ | ✅ |
| **File upload** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Partial submissions** (save & resume) | ✅ (via sessions) | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Email notifications** (creator gets notified) | ❌ No creator notifications | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Respondent email confirmations** | ✅ (FT-013) | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Analytics dashboard** | 🟡 Basic only | ✅ | ✅ | ✅ | ✅ | ✅ |
| **A/B testing** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Themes / custom branding** | ✅ Basic theming | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Custom CSS** | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| **Embeddable (iframe/JS)** | ✅ (embed route) | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Google Sheets sync** | 🟡 OAuth only | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Slack notifications** | ❌ | ✅ (paid) | ✅ | ✅ | ❌ | ✅ |
| **Multi-language forms** | ❌ | ✅ | ✅ | ❌ | ✅ (basic) | ❌ |
| **Respondent progress bar** | ✅ Page builder | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Quiz / test scoring** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Signature field** | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| **GDPR consent** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Spam protection** | ✅ reCAPTCHA | ✅ reCAPTCHA | ✅ reCAPTCHA | ✅ honeypot | ✅ reCAPTCHA | ✅ reCAPTCHA |

---

## 3. Partially-Implemented Features (Highest ROI to Complete)

### 3.1 🟡 Stripe Payment Gateway — *UI config exists, no gateway code*
- **Files to touch**: `src/integrations/payments/stripe/gateway.ts` (NEW), `src/integrations/payments/index.ts` (register it)
- **Effort**: Medium (2–3 days) — Stripe SDK well-documented, existing gateway base class
- **Impact**: Opens PonkoForm to global market (135+ currencies), most requested gateway

### 3.2 🟡 Google Sheets Auto-Sync — *OAuth works, no sync engine*
- **Files to touch**: `src/lib/integrations/google-sheets-sync.ts` (NEW), hook into `completePageSubmissionRecord`, webhook handler
- **Effort**: Medium (2–3 days) — Token refresh exists, just need Google Sheets API append logic
- **Impact**: Most-used data-export integration, competitor table-stakes

### 3.3 🟡 PayMongo Payment Gateway — *PH market critical, UI config exists*
- **Files to touch**: `src/integrations/payments/paymongo/gateway.ts` (NEW), `src/integrations/payments/index.ts`
- **Effort**: Medium (1–2 days) — GCash/GrabPay/Maya via single API
- **Impact**: Essential for PH market penetration

### 3.4 🟡 Google Calendar Integration — *Config exists, no event creation*
- **Files to touch**: `src/lib/integrations/google-calendar-sync.ts` (NEW), hook into submission completion
- **Effort**: Medium (1–2 days) — OAuth infrastructure shared with Sheets
- **Impact**: Appointment/form combo use case (workshops, bookings)

### 3.5 🟡 Per-Form Analytics Dashboard (FT-017) — *Planned, detailed spec exists*
- **Files to touch**: `src/routes/forms/$formId/analytics.tsx` (NEW), `src/lib/server-fns/form-analytics.ts` (NEW), schema: `form_visits` table
- **Effort**: Medium (3–4 days) — Detailed plan exists in `feature-plan/017-analytics-dashboard.md`
- **Impact**: Mission-critical for paid form creators who need conversion data

---

## 4. Proposed New Features (5-10 Concrete)

### 4.1 ✅ Creator Email Notifications — *LOW complexity*
**Problem:** When a respondent submits a form, only the respondent gets email. The creator checks PonkoForm manually.

**Implementation:**
- Add `notifyEmail` field to `forms` table
- Hook into `dispatchSubmissionEmails` (also send a notification to creator)
- Add UI toggle in form settings "Email me on new submissions"

**Files:** ~4 files (schema + migration, forms server-fn, settings UI, email dispatch)
**Estimated changes:** ~80 lines of code

### 4.2 ✅ URL Prefill / Hidden Fields — *LOW complexity*
**Problem:** Can't pass values via URL parameters to pre-fill form fields. This is essential for campaign tracking (`?utm_source=fb`), CRM integration (`?contact_id=123`), and personalized links.

**Implementation:**
- Add `allowUrlPrefill` boolean to `formPages` or `forms`
- Read `URLSearchParams` in form viewer, pre-populate matching `bindVariable` fields
- Sanitize values; mark pre-filled fields visually

**Files:** ~5 files (schema, migration, PageFormView, PublicFormView, form settings)
**Estimated changes:** ~150 lines of code

### 4.3 ⬜ Webhooks / External Notifications (FT-020) — *MEDIUM complexity*
**Problem:** No way to push data to CRMs, Slack, Zapier, or custom backends. Competitors all offer this.

**Implementation:** Detailed plan in `feature-plan/020-webhooks-external-notifications.md`. New `webhooks` table, HMAC-SHA256 signing, retry with exponential backoff, delivery logs.

**Files:** ~10 files (schema + migration, webhook CRUD, dispatch service, UI page, settings route)
**Estimated changes:** ~800 lines of code

### 4.4 ⬜ Discount Codes / Coupons (FT-021) — *MEDIUM complexity*
**Problem:** No way to offer promotions. PH market needs this for events, workshops, promos.

**Implementation:** Plan in `feature-plan/021-discount-codes-coupons.md`. New `discount_codes` table, percentage/fixed amount, usage limits, expiry, integration into payment computation pipeline.

**Files:** ~12 files (schema + migration, CRUD server fns, UI management page, checkout integration, test)
**Estimated changes:** ~1000 lines of code

### 4.5 ⬜ Payment Links / Standalone Checkout (FT-018) — *MEDIUM complexity*
**Problem:** To collect a simple payment, user must create a form with dummy fields. Huge friction for donations, product sales, invoice payments.

**Implementation:** Plan in `feature-plan/018-payment-links.md`. New `payment_links` table, shareable URL → checkout, reuses existing payment gateway layer.

**Files:** ~15 files (schema + migration, payment link CRUD, UI generation page, public route, payment dispatch)
**Estimated changes:** ~1200 lines of code

### 4.6 ⬜ Maya Payment Gateway — *LOW-MEDIUM complexity*
**Problem:** Maya (PayMaya) is one of PH's top digital wallets. The UI config already exists.

**Implementation:** Create `src/integrations/payments/maya/gateway.ts` extending `PaymentGateway` base class, implement Maya Checkout API, register in `index.ts`.

**Files:** ~5 files (gateway + test, registry registration, amounts helper, config types)
**Estimated changes:** ~300 lines of code

### 4.7 ⬜ Conditional Email Automation (FT-022) — *HIGH complexity*
**Problem:** Can only send one confirmation email. No follow-ups, drip sequences, or behavior-based emails.

**Implementation:** Plan in `feature-plan/022-email-automation.md`. New `email_automation_rules` table, trigger conditions (field value, payment amount, date proximity), delayed sends, cron-based dispatch.

**Files:** ~15 files (schema + migration, rules CRUD, rule engine, cron job, UI rule builder, email dispatch integration)
**Estimated changes:** ~1500 lines of code

### 4.8 ⬜ Multi-Language Form Support — *HIGH complexity*
**Problem:** All form labels/placeholders/options are monolingual. PH market needs English + Filipino; international needs more.

**Implementation:** Add `locale` column to forms, i18n framework (react-i18next), translation storage for field labels/options, language switcher in form viewer.

**Files:** ~20 files (schema, migration, i18n setup, field translation UI, form viewer, route config)
**Estimated changes:** ~2000 lines of code

### 4.9 ⬜ Gemini AI Integration — *MEDIUM complexity*
**Problem:** The Gemini AI provider exists in the hub but does nothing. Could offer AI-powered field suggestions, auto-form generation from description, or sentiment analysis on satisfaction responses.

**Implementation:** Use existing `getIntegrationConfig<GeminiConfig>` to get the API key, build a server function that calls Gemini API, add a "Generate form from prompt" feature and/or AI suggestions in the builder.

**Files:** ~8 files (AI service module, form generation endpoint, builder UI integration, prompt engineering)
**Estimated changes:** ~500 lines of code

### 4.10 ⬜ ImageKit / Cloudinary File Upload Storage — *MEDIUM complexity*
**Problem:** File uploads exist in-browser as data URLs but have no persistent cloud storage backend. Large files or long-lived forms need CDN storage.

**Implementation:** Use existing integration configs, build upload proxy that pushes files to ImageKit/Cloudinary on submission, return CDN URLs instead of data URLs.

**Files:** ~8 files (upload service, file upload hook integration, submission storage, config UI enhancements)
**Estimated changes:** ~500 lines of code

---

## 5. Prioritized Implementation Roadmap

### Tier 1: Quick Wins (Week 1–2)
| # | Feature | Complexity | Files | Impact |
|---|---|---|---|---|
| 1 | Creator Email Notifications | Low | ~4 | Immediate creator QoL |
| 2 | URL Prefill / Hidden Fields | Low | ~5 | Campaign tracking, CRM |
| 3 | PayMongo Gateway | Medium | ~5 | PH market critical |
| 4 | Maya Gateway | Low-Med | ~5 | PH wallet coverage |

### Tier 2: Table Stakes (Week 3–4)
| # | Feature | Complexity | Files | Impact |
|---|---|---|---|---|
| 5 | Stripe Gateway | Medium | ~5 | Global payments |
| 6 | Google Sheets Sync Engine | Medium | ~6 | Most-requested integration |
| 7 | Google Calendar Event Creation | Medium | ~5 | Appointment use case |

### Tier 3: Differentiation (Week 5–8)
| # | Feature | Complexity | Files | Impact |
|---|---|---|---|---|
| 8 | Webhooks (FT-020) | Medium | ~10 | Platform play (Zapier, CRM) |
| 9 | Discount Codes (FT-021) | Medium | ~12 | Promotions, conversion |
| 10 | Payment Links (FT-018) | Medium | ~15 | Monetization without forms |

### Tier 4: Advanced (Week 8+)
| # | Feature | Complexity | Files | Impact |
|---|---|---|---|---|
| 11 | Form Analytics Dashboard (FT-017) | Medium | ~12 | Creator insights |
| 12 | Conditional Email Automation (FT-022) | High | ~15 | Marketing automation |
| 13 | Gemini AI Integration | Medium | ~8 | AI differentiation |
| 14 | Multi-Language Forms | High | ~20 | International market |

---

## 6. Key Observations

1. **Integration hub is well-architected but half-empty.** The generic CRUD + encrypted config + provider form pattern is solid. But 6 of 15 providers have NO actual integration logic — just credential storage. The architecture makes adding them straightforward.

2. **Payment infrastructure is Xendit/PayPal-only.** Stripe, PayMongo, Maya all have UI configs but no gateway code. Each new gateway is ~300 lines via the `PaymentGateway` base class. High-ROI because each one opens a market segment.

3. **Email is the strongest integration.** SMTP + Resend with dual-table backward compat, delivery logs, template snapshots, and transactional abstraction. But it only sends TO respondents — never TO creators or admins.

4. **No event-driven architecture.** No webhooks, no Zapier, no Slack notifications. Everything is pull-based. This is the biggest competitive gap vs. Typeform/JotForm/Tally.

5. **Four detailed feature plans exist but are unimplemented** (FT-017 through FT-022). These represent ~5,000 lines of detailed specs ready for implementation.

6. **PH market is well-served by providers but under-served by implementations.** PayMongo, Maya, GCash (via PayMongo) are all in the UI — but only Xendit actually processes PH payments.

7. **Competitive parity would require ~15 additional features.** The most strategically valuable quick steps: Stripe gateway, webhooks, and Google Sheets sync.
