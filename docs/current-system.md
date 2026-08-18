# Current System Overview

> **What PonkoForm supports today, what is partially connected, and which implementation files define each capability.**
> Verified against `main` at `26d1fa2` on 2026-08-12.

## Product Modes

PonkoForm supports two respondent experiences under one form model:

| Mode | What creators build | Current capabilities |
|---|---|---|
| **Page Builder** | Ordered pages containing fields | Multi-page progress, conditions, references, computed fields, priced options, page payments, Xendit subscriptions, final message/redirect |
| **Flow Builder** | A directed acyclic graph of nodes | One-question/group steps, decisions, calculators, payment success/failure paths, summaries, redirects |

New forms start from a built-in template or as a blank page form. Flow forms already stored in the database are edited in the same unified editor. The older `/forms/$formId/flow` URL redirects to `/forms/$formId/edit`.

## Current Creator Workflow

1. Sign in or create an account with email and password through Better Auth.
2. Create a blank form or copy a template at `/forms/new`.
3. Build at `/forms/$formId/edit`.
4. Preview, validate where applicable, customize the theme, and publish.
5. Share the public URL or iframe embed.
6. Review Responses, Payments, Invoicing, Emails, and Discounts from the form workspace.

Form owners can invite existing PonkoForm users as editors or viewers. Editors
can change form content and configuration; viewers have read-only access.
Ownership-only actions include access management, deletion, and bulk actions.

The creator routes use the form's numeric ID. Share and embed routes use the separate public ID.

## Fields and Logic

The database supports 18 field types:

`text`, `email`, `number`, `textarea`, `select`, `checkbox`, `radio`, `payment`, `date`, `time`, `datetime`, `content`, `media`, `address`, `computation`, `file_upload`, `satisfaction`, and `recaptcha`.

Page forms can use show/hide conditions, form-scoped references, direct/reference-based option pricing, visual or syntax computation, validation rules, half/full widths, and final redirects. Flow forms use eight node types: Start, Form Field, Group, Decision, Calculator, Payment, Summary, and Redirect.

## Payments

PonkoForm uses the creator's own gateway account.

| Provider | One-time | Subscription | Runtime status |
|---|---:|---:|---|
| PayPal | Yes | No | Operational |
| Xendit | Yes, PHP | Yes, page forms/PHP | Operational |
| Stripe | No | No | Configuration UI/storage only |
| PayMongo | No | No | Configuration UI/storage only |
| Maya | No | No | Configuration UI/storage only |

Payment state is tracked through hosted-checkout return verification, Xendit webhooks, manual verification/recovery actions, and protected reconciliation. Refunds are performed in the gateway dashboard; PonkoForm can represent the resulting `refunded` status.

## Discount Codes

Creators manage discount codes centrally at `/discounts` and per form at `/forms/$formId/discounts`. Codes are scoped to a creator profile and can be assigned to multiple forms through a join table.

- **Types:** percentage off or fixed amount off; fixed discounts clamp to the order amount.
- **Controls:** optional maximum discount cap, minimum order amount, maximum uses, and a start/expiry window; codes can be deactivated.
- **Validation:** codes are normalized (trimmed, uppercased) and validated server-side against the form, amount, and lifecycle before checkout.
- **Redemptions:** each applied discount records one `discount_redemptions` row (unique per payment) with the original, discounted, and final amounts.
- Payment links do not accept discount codes; subscriptions are not discounted.

## Payment Links

Payment links provide standalone checkout without a form. Creators manage them at `/dashboard/payment-links`; respondents pay at `/pay/$publicId` and land on `/pay/$publicId/success`.

- Each link has a title, amount, currency (default PHP), gateway, optional custom-amount toggle with min/max bounds, optional redirect URL, and success message.
- Links can be deactivated; `total_payments` and `total_revenue` counters track usage.

## Popups

Popups are self-contained lead-capture surfaces (decoupled from forms — a button element links to any safe URL, including a form share link). Creators manage them at `/popups` and design them at `/popups/$popupId/edit` on a free-position canvas (heading/text/image/button/divider/sanitized-html elements). Legacy `/dashboard/popups` URLs redirect to these routes.

- Triggers: on load (+delay), exit intent, scroll depth, click on a CSS selector. Frequency: every visit / once per session / day / week.
- Embedding is a copy-paste `<script data-popup>` snippet; the host-side loader (`public/embed/popup-loader.js`) fetches the config, renders an iframe (`/popups/$publicId/embed`), watches triggers, and reports view/click counters.
- Only published popups are served publicly; drafts return 404 from public config and embed routes. Owners can exercise drafts through the authenticated real-loader preview.
- See the [Popup Embed Guide](popup-embed-guide.md) for the creator flow.

## Email and Invoicing

- Resend and SMTP are operational for respondent email.
- Resend is preferred when both are configured; SMTP is the fallback.
- A form may send a confirmation or a numbered invoice based on its invoicing configuration.
- Delivery attempts, provider IDs, errors, and template snapshots are stored.
- Creator/admin new-submission notification email is not implemented.

## Integration Status

The Integrations page can store encrypted configuration for 14 providers. “Connected” means credentials were stored; it does not always mean an automation is implemented.

| Capability | Providers | Status |
|---|---|---|
| Payments | PayPal, Xendit | Operational |
| Respondent email | Resend, SMTP | Operational |
| Anti-spam | Google reCAPTCHA | Operational |
| Spreadsheet export | Google Sheets | OAuth/configuration exists; automatic submission sync is not implemented |
| Other payment catalog entries | Stripe, PayMongo, Maya | Configuration only |
| AI, scheduling, storage | Gemini, Google Calendar, Calendly, ImageKit, Cloudinary | Configuration only |

Credentials are AES-256-GCM encrypted with `CREDENTIALS_ENCRYPTION_KEY`. Secrets are never returned to the browser; UI status uses safe metadata/masks.

## Submissions and Analytics

- Page sessions and flow executions persist in-progress respondent state.
- Completed and payment-pending responses are stored in `form_submissions`.
- Responses support filtering, archiving, bulk actions, and CSV export.
- The dashboard reports forms, submissions, payments, revenue, time series, and per-form aggregate metrics.
- Visitor tracking and page-level funnel analytics are not implemented.

## Public Routes

| Route | Purpose |
|---|---|
| `/forms/submit/$publicId` | Standalone published form |
| `/forms/embed/$publicId` | Transparent responsive iframe form |
| `/forms/payment-return` | Hosted-checkout return and runtime resume |
| `/flow/$executionId/complete` | Flow completion/receipt |
| `/pay/$publicId` | Standalone payment-link checkout |
| `/pay/$publicId/success` | Payment-link completion page |
| `/popups/$publicId/embed` | Transparent popup iframe content (loader host script: `public/embed/popup-loader.js`) |
| `/popups/$publicId/preview` | Popup preview on a mock host page with trigger simulator |
| `/api/popups/$publicId/{config,view,click}` | Public popup config (CORS-open) and stats beacons |

The Xendit webhook route uses an owner-specific endpoint key. The internal reconciliation route requires `CRON_SECRET`.

## Deployment

The project has three deployment targets:

- **Render** (maintained Node web service): `render.yaml` builds with `pnpm install --frozen-lockfile && pnpm run build:render`, starts with `pnpm run start`, and checks `/api/health`.
- **Vercel**: `vercel.json` declares the `tanstack-start` framework, `pnpm install --frozen-lockfile`, `pnpm run build`, and `pnpm dev`; functions run in `iad1` and the `/api/internal/reconcile-payments` cron runs daily at 02:00 UTC.
- **Cloudflare Workers**: `wrangler.jsonc` with the `build:cloudflare` Vite mode.

The build compiles Nitro output, prepares/migrates the database, validates the schema, and seeds built-in templates. The application supports Neon and standard PostgreSQL connections.

## Authoritative Implementation Map

| Topic | Source |
|---|---|
| Schema and indexes | `src/db/schema.ts` |
| Unified editor | `src/routes/forms/$formId/edit.tsx` |
| Public runtime selection | `src/components/public-form/PublicFormView.tsx` |
| Page types/runtime | `src/lib/page-builder/types.ts`, `src/components/page-form/` |
| Flow types/runtime | `src/lib/flow-engine/`, `src/components/flow-execution/` |
| Payment registry | `src/integrations/payments/index.ts` |
| Discount domain/rules | `src/lib/discounts.ts`, `src/lib/server-fns/discounts.ts` |
| Payment links | `src/lib/payment-links/`, `src/lib/server-fns/payment-links.ts` |
| Popups (builder, runtime, loader) | `src/lib/popup-builder/`, `src/components/popup-builder/`, `src/components/popup-runtime/`, `src/lib/server-fns/popups.ts`, `public/embed/popup-loader.js` |
| Email dispatch | `src/lib/email/transactional.ts`, `src/lib/invoicing/delivery.ts` |
| Integration catalog/config | `src/lib/integrations/types.ts`, `src/components/integrations/ProviderForms.ts` |
| Deployment | `render.yaml`, `vercel.json`, `wrangler.jsonc`, `package.json`, `vite.config.ts` |

For deeper technical context, read the [AI Knowledge Bank](AI-KNOWLEDGE-BANK.md) and [system memory](../memory-ponko/README.md).
