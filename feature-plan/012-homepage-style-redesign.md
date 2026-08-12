# FT-012: Homepage Redesign — Clear Product Story and Payment Reliability

> **Feature Plan** — Redesign `/` as a responsive product narrative that shows how PonkoForm builds forms, collects responses and payments, and keeps the results manageable without advertising unfinished capabilities.

**Status:** ✅ **IMPLEMENTED** — component refactor, truthful content pass, render tests, full test suite, production build, and local HTTP smoke check completed on July 14, 2026. Browser-based viewport screenshots remain a follow-up QA item because the local browser controller was unavailable during implementation.

**Dependencies:**
- ✅ **FT-002 (Integrations Hub)** — implemented at `/settings/integrations`; the homepage links to it for signed-in users.
- ✅ **FT-007 (Page Builder)** — supplies the page-based builder, responsive runtime, conditional fields, file uploads, share links, and embed route represented on the homepage.
- ✅ **FT-011 (Form Templates)** — supplies the five built-in templates shown in the hero and workflow.
- ✅ **Payment tracking and recovery** — the existing payments workspace, event history, verification, reconciliation, and recovery-link functions support the payment reliability story.
- ✅ **DESIGN.md** — supplies the cream canvas, coral accent, dark surface, serif headline, spacing, and card conventions used throughout the page.

---

## 1. Product Goal

The previous homepage described the builder and payment gateways but did not give first-time visitors a complete picture of the product. Payment tracking was buried, product mockups lacked context, and the footer did not provide useful navigation.

The redesigned homepage now serves two audiences:

- Form creators who need a fast explanation of how to build, publish, and manage a form.
- Evaluators who need evidence that submissions and payment status remain connected after checkout.

Marketing copy is intentionally limited to behavior verified in the repository. There are no fabricated usage statistics, testimonials, partner-verification claims, or links to routes that do not exist.

---

## 2. Implemented Page Architecture

The homepage uses this section order and surface rhythm:

```text
Cream canvas     Hero: value proposition, auth-aware CTAs, form mockup
Soft cream       Trust bar: templates, payments, response tools
Cream canvas     Nine verified features grouped by Build / Collect / Manage
Cream card       Four-step workflow with CSS product mockups
Dark surface     Payment lifecycle, verification, and recovery
Cream canvas     PayPal, Xendit, and Resend integration uses
Cream card       Responsive phone and desktop form mockups
Coral            Final auth-aware CTA
Dark surface     Footer with working destinations only
```

### 2.1 Auth-Aware Navigation

- Signed-out primary actions use `/sign-up/` and `/sign-in/`.
- Signed-in actions use `/forms`, `/forms/new`, and `/settings/integrations`.
- “See how it works” targets the in-page `#how-it-works` anchor.
- The footer contains only Forms/Templates/Integrations actions and `/docs`.
- Pricing, Help Center, Privacy, Terms, and Cookies are omitted because those routes do not exist.

### 2.2 Verified Feature Coverage

| Category | Homepage capability | Repository support |
|---|---|---|
| Build | Page-based builder | Existing page builder workspace and field configuration |
| Build | Live preview | Existing preview flow and responsive public form runtime |
| Build | Five templates | Built-in template catalog and `/forms/new` selection UI |
| Collect | PayPal/Xendit payment steps | Existing payment gateways and page/flow payment runtime |
| Collect | File uploads | Existing `file_upload` field type |
| Collect | Conditional fields | Existing page-builder condition evaluation |
| Manage | Search, sort, filter, inspect, and CSV export | Existing submissions DataTable and export server function |
| Manage | Share and embed | Existing share dialog, public URL, and embed route |
| Manage | Payment recovery | Existing verify, copy-link, expired-link replacement, and Resend reminder actions |

General form-notification templates, analytics charts, password-protected forms, and automation for other configured providers are not presented as live features.

### 2.3 Payment Reliability Story

The dark payment section mirrors the implemented model rather than inventing a simplified guarantee:

- Statuses are `pending`, `completed`, `failed`, and `refunded`.
- Gateway returns, webhooks, reconciliation, and manual verification can contribute status evidence.
- Amount and currency checks are part of reconciliation.
- Pending links can be copied while valid; expired or failed links can be replaced.
- The CSS dashboard mockup is labeled “Illustrative dashboard” and uses generic payment identifiers.

---

## 3. Component Design

`src/routes/index.tsx` only registers the `/` route and renders `HomePage`.

`src/components/homepage/` owns the feature:

```text
HomePage.tsx
├── HeroSection
├── TrustBar
├── FeaturesSection
├── WorkflowSection
├── PaymentReliabilitySection
├── IntegrationsSection
├── RespondentExperienceSection
├── CtaSection
└── Footer

content.ts
├── TrustItem / FeatureItem / FeatureGroup
├── WorkflowStep / IntegrationItem
└── Typed content collections

ProductMockups.tsx
├── HeroFormMockup
├── WorkflowMockup
├── PaymentTrackerMockup
└── ResponsiveFormsMockup
```

All product mockups are CSS-rendered, non-interactive, and marked `aria-hidden`. Real links receive visible focus-ring styles. The page has one `h1`, section-level `h2` headings, card-level `h3` headings, and labeled footer navigation.

No database schema, server function, public API, route, package, or external image asset was added.

---

## 4. File Change Summary

| File | Change |
|---|---|
| `src/routes/index.tsx` | Reduced to the route declaration and `HomePage` composition entrypoint. |
| `src/components/homepage/HomePage.tsx` | Added all nine responsive homepage sections and auth-aware navigation. |
| `src/components/homepage/content.ts` | Added typed, codebase-verified marketing content. |
| `src/components/homepage/ProductMockups.tsx` | Added decorative form, workflow, payment, and device mockups. |
| `src/components/homepage/HomePage.test.tsx` | Added signed-in/signed-out rendering, navigation, anchor, claim, and dead-link coverage. |
| `feature-plan/012-homepage-style-redesign.md` | Replaced the outdated speculative plan with this implementation record. |

---

## 5. Validation

Completed:

- [x] Focused homepage render tests pass: 2 tests.
- [x] Full Vitest suite passes: 18 files, 89 tests.
- [x] `pnpm run build` completes successfully.
- [x] Local signed-out request to `/` returns HTTP 200.
- [x] Server-rendered HTML contains the new hero and `#how-it-works` anchor.
- [x] Server-rendered HTML does not contain Pricing, Help Center, Privacy, Terms, or Cookies links.
- [x] Signed-in and signed-out CTA destinations are covered by tests.
- [x] Decorative payment dashboard is covered as `aria-hidden`.

Follow-up visual QA:

- [ ] Capture and inspect the page at 375px, 768px, 1024px, and 1440px once browser control is available.
- [ ] Confirm no horizontal overflow and comfortable mockup sizing at each breakpoint.
- [ ] Perform a final keyboard and screen-reader pass in a real browser.

Known unrelated validation output:

- TanStack reports existing `createServerFn().inputValidator()` deprecation warnings in server-function files during the otherwise successful production build.
- A standalone `pnpm exec tsc --noEmit` check remains red because of existing type errors in seed scripts, form rendering, integrations, payment-route props, and other pre-existing files. After removing one unused homepage import found by that check, no reported TypeScript error points to the homepage implementation.
