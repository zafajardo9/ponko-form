# Implementation Status & Roadmap — PonkoForm

> The original greenfield sprint plan has been replaced by this implementation-status document because its foundation, builder, submission, and payment phases are already present in the codebase.
> Verified against `main` at `7d2cbe3` on 2026-07-28.

## Current Baseline

| Area | Status | Notes |
|---|---|---|
| TanStack Start/React application | Complete | File routes, SSR/server functions, Nitro Node output |
| Clerk authentication and ownership checks | Complete | Authenticated creator routes; public respondent routes |
| PostgreSQL/Drizzle persistence | Complete | Migrations, schema check, Render preparation workflow |
| Form dashboard and CRUD | Complete | Templates, bulk actions, sharing, aggregate analytics |
| Page Builder | Complete baseline | Pages, 18 field types, validation, conditions, references, calculations |
| Flow Builder | Complete baseline | List/canvas views, 8 nodes, variables, DAG validation, execution persistence |
| Submissions | Complete baseline | Page sessions, flow executions, response tables, CSV, archiving |
| One-time payments | Complete for PayPal/Xendit | Hosted checkout, verification, events, reconciliation, recovery |
| Subscriptions | Complete for page-form Xendit/PHP | Recurring plan/cycle tracking and reconciliation |
| Invoicing/respondent email | Complete baseline | Resend/SMTP, templates, delivery logs, retry |
| reCAPTCHA | Complete | Page-field rendering and server verification |
| Render deployment | Complete | Blueprint, health check, DB preparation, Node start |

## Important Partial Features

“Configurable” is not the same as “operational.” These integrations have UI/credential storage but lack the end-to-end runtime named below.

| Feature | Existing pieces | Missing runtime |
|---|---|---|
| Stripe payments | Provider form and encrypted config | Gateway implementation and registry entry |
| PayMongo payments | Provider form and encrypted config | Gateway implementation and registry entry |
| Maya payments | Provider form and encrypted config | Gateway implementation and registry entry |
| Google Sheets | OAuth/configuration | Append/sync completed submissions |
| Google Calendar | Provider configuration | Event creation/token lifecycle appropriate to Calendar |
| Gemini | API-key configuration | Product AI feature and server call |
| ImageKit/Cloudinary | Provider configuration | Persistent upload pipeline |
| Calendly | Provider configuration | Scheduling workflow |

## Confirmed Product Boundaries

- New forms start as page forms; there is no creator-facing “convert this page form to a flow” workflow in the current unified editor.
- Flow graphs are acyclic and support one-time payments only.
- Xendit/PHP subscriptions are available on page forms.
- Refunds are carried out in the payment provider dashboard.
- Respondent confirmation/invoice email exists; creator notification email does not.
- Dashboard analytics are aggregate/time-series metrics, not visit or funnel analytics.
- Google Sheets OAuth does not yet mean automatic response export.
- File-upload values do not yet use the configurable cloud-storage providers.

## Recommended Delivery Order

### Phase 1 — Reliability and documentation

1. Keep `memory-ponko/`, `docs/current-system.md`, schema comments, and environment examples synchronized.
2. Close high-risk error-handling and test gaps recorded in `plans/024-code-quality-cleanup/PLAN.md`.
3. Continue splitting oversized editor modules without changing behavior.
4. Add regression tests around anonymous tokens, payment idempotency, webhook verification, and submission completion.

### Phase 2 — Finish partial integrations

1. Implement Google Sheets submission sync because OAuth/config already exists.
2. Add one payment provider at a time behind the existing gateway interface and registry.
3. Implement persistent upload storage before marketing ImageKit/Cloudinary as connected.
4. Add operational status in the integration UI so configuration-only providers are not mistaken for active automations.

### Phase 3 — Creator operations

1. Creator email notifications.
2. Per-form visit/conversion/funnel analytics.
3. Signed outbound webhooks with retries and delivery logs.
4. URL prefill/hidden campaign fields.

### Phase 4 — Commerce expansion

1. In-app refund initiation only after provider-specific idempotency/audit design.
2. Discount/coupon model.
3. Standalone payment links.
4. Flow subscription semantics, if the graph UX and resume model are specified first.

## Definition of Done for a Capability

A provider or feature should be documented as operational only when all relevant layers exist:

1. configuration and secret handling;
2. server-side runtime implementation;
3. UI entry point and user feedback;
4. persistence/idempotency where external effects occur;
5. failure and retry/recovery behavior;
6. automated tests;
7. deployment/environment documentation.

## Source Plans

Detailed future-feature specifications remain under `feature-plan/`. The July 28 competitive audit is `feature-plan/023-feature-gap-analysis.md`; code-quality follow-up is `plans/024-code-quality-cleanup/PLAN.md`. Those files are planning inputs, not proof that a feature is shipped.
