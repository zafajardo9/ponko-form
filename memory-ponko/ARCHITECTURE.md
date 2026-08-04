# PonkoForm Architecture

> Part of [`memory-ponko/`](README.md) — System Memory
> **Verified against:** `main` at `7d2cbe3` on 2026-07-28.

## 1. System Overview

PonkoForm is a multi-tenant form platform. Authenticated creators build, publish, share, embed, and inspect forms. Respondents use public routes without a PonkoForm account.

There are two persisted form experiences:

| Mode | Persistence | Editor | Public renderer | Best for |
|---|---|---|---|---|
| **Page form** | `form_pages`, `form_page_fields`, `field_conditions`, `form_references` | `PageBuilderWorkspace` | `PageFormView` | Linear multi-page forms, conditions, priced options, subscriptions |
| **Flow form** | `flows`, `flow_nodes`, `flow_edges`, `flow_variables` | List or Canvas flow workspace | `FlowExecutionContainer` | Branching journeys, graph decisions, calculators, redirects |

A form has at most one flow. A form without a flow is ensured to have page-form data by the unified editor. Older `form_fields` and `form_payment_configs` remain for compatibility, but new forms are created through page-form templates or from scratch.

## 2. Runtime Boundaries

```text
Authenticated creator
  └─ /forms/$formId/edit
       ├─ page form → PageBuilderWorkspace
       └─ flow form → FlowListBuilder or FlowCanvasWorkspace

Anonymous respondent
  ├─ /forms/submit/$publicId
  └─ /forms/embed/$publicId
       └─ PublicFormView
            ├─ page form → PageFormView + persisted page session
            └─ flow form → FlowExecutionContainer + persisted flow execution

Hosted checkout
  └─ /forms/payment-return
       ├─ verifies or reconciles gateway state
       └─ resumes the page session or flow execution
```

Internal numeric `forms.id` values are used on authenticated creator routes. Public and embed routes use `forms.public_id`.

## 3. Technology

| Layer | Current technology |
|---|---|
| Framework/runtime | TanStack Start with Nitro Node output |
| UI | React 19 |
| Routing | TanStack Router file routes |
| Server state | TanStack Query |
| Build | Vite 8 |
| Styling | Tailwind CSS 4 through `@tailwindcss/vite` |
| Authentication | Better Auth email/password accounts with the Drizzle adapter |
| Database | PostgreSQL; Neon HTTP or `pg` driver selected from the database URL/config |
| ORM/migrations | Drizzle ORM and Drizzle Kit |
| Flow canvas | `@xyflow/react` |
| Sorting/dragging | dnd-kit |
| Expressions | `src/lib/flow-engine/safe-expression.ts` |
| Email | Resend HTTP API and Nodemailer SMTP |
| PDF/invoice download | jsPDF-based invoice utilities |
| Deployment | Render long-running Node web service |
| Package/runtime | pnpm 10.34.5; Node.js 22+ |

Do not describe the expression system as `math.js`: that dependency is not installed. The parser accepts a deliberately small language and evaluates an AST without property access, assignment, constructors, or global-object access.

## 4. Source Layout

```text
ponkoform/
├── docs/                         # Markdown shown by the in-app docs viewer
├── drizzle/                      # Ordered SQL migrations and Drizzle metadata
├── feature-plan/                 # Feature specifications and gap analyses
├── memory-ponko/                 # Maintainer/agent system memory
├── plans/                        # Implementation and cleanup plans
├── public/                       # Static assets
├── scripts/                      # Migration, schema, seed, and reconciliation jobs
├── src/
│   ├── components/
│   │   ├── dashboard/            # Form cards, sharing, reports, charts
│   │   ├── docs/                 # Markdown documentation UI
│   │   ├── flow-builder/         # Flow list/canvas editor and node configuration
│   │   ├── flow-execution/       # Respondent flow runtime and receipt download
│   │   ├── form-builder/         # Shared field renderer split by field type
│   │   ├── forms/                # Creator workspace navigation and tables
│   │   ├── integrations/         # Integration catalog and configuration UI
│   │   ├── invoicing/            # Email/invoice template builder and delivery history
│   │   ├── page-builder/         # Page editor, logic, calculations, references
│   │   ├── page-form/            # Respondent page-form runtime
│   │   ├── public-form/          # Runtime mode selection and loading shell
│   │   └── ui/                   # Reusable UI primitives and data table
│   ├── db/
│   │   ├── schema.ts             # Authoritative schema
│   │   ├── driver.ts             # Database-driver selection
│   │   └── index.ts              # Shared database access
│   ├── integrations/
│   │   └── payments/             # Gateway contract, registry, PayPal, Xendit
│   ├── lib/
│   │   ├── auth.ts               # Better Auth server configuration
│   │   ├── auth.server.ts        # Request-session validation
│   │   ├── profile.server.ts     # Verified-identity profile linking
│   │   ├── email/                # Resend/SMTP and transactional dispatch
│   │   ├── flow-engine/          # Flow engine, validator, expression parser
│   │   ├── form-templates/       # Built-in template catalog and creation plans
│   │   ├── integrations/         # Encrypted credential access and reCAPTCHA
│   │   ├── invoicing/            # Template and delivery-domain logic
│   │   ├── page-builder/         # Page runtime, conditions, computation, completion
│   │   ├── server/               # Server-only support such as currency rates
│   │   ├── server-fns/           # TanStack Start server-function boundary
│   │   └── submissions/          # CSV and response-column helpers
│   ├── routes/                   # File-based authenticated, public, and API routes
│   └── styles.css                # Global design tokens and styles
├── render.yaml                   # Render Blueprint
├── package.json
└── vite.config.ts
```

## 5. Creator Experience

### Unified editor

`src/routes/forms/$formId/edit.tsx` loads the form, optional flow, and optional page form in one request through `getEditorForm`.

- When flow data exists, the editor offers List and Canvas views, node configuration, variables, validation, and flow preview.
- When no flow exists, `ensurePageForm` creates the page-form structure and `PageBuilderWorkspace` edits pages, fields, references, conditions, computation, payment, and final-page behavior.
- `/forms/$formId/flow` is a compatibility redirect to the unified editor.
- The workspace navigation links to Build, Responses, Payments, and Invoicing.

### Creation

`/forms/new` lets a creator start from scratch or copy a built-in/user template. A scratch form is initialized as a page form when the editor opens.

### Publication and sharing

Draft forms can be previewed by their owner. Published forms receive a public share URL based on `public_id`; the share dialog also supplies iframe embed markup.

## 6. Respondent Data Lifecycles

### Page form

1. `PublicFormView` loads the published form runtime by public ID.
2. `PageFormView` starts or restores a `form_submission_sessions` row using an opaque client token.
3. Each page validates fields, verifies reCAPTCHA when configured, merges collected data, and advances the session.
4. A payment page may create a pending `payments` row and redirect to hosted checkout.
5. Completion creates/updates `form_submissions`, links the payment, marks the session complete, and dispatches configured respondent email.

### Flow form

1. The runtime starts a `flow_executions` row with declared defaults.
2. The client engine navigates the graph while server functions persist the current node, variables, and history.
3. Calculator nodes auto-run; decisions select an edge; user-facing nodes wait for input.
4. Payment nodes create a pending payment linked to the execution, then resume after gateway return.
5. Completion creates a `form_submissions` row, links it to the execution/payment, and renders the summary or redirect result.

Opaque client tokens protect anonymous resume operations. Do not expose an unrestricted numeric execution/session ID as the only public access credential.

## 7. Payments, Email, and Integrations

### Operational payment providers

- **PayPal:** one-time hosted checkout, sandbox/live credentials, multi-currency subject to PayPal support.
- **Xendit:** one-time hosted checkout in PHP plus page-form subscriptions. Xendit events arrive at a per-owner unguessable webhook route.

Stripe, PayMongo, and Maya appear in the integration configuration catalog, but no payment gateway implementation is registered for them. The payment registry in `src/integrations/payments/index.ts` is authoritative.

Payment status is recovered from return verification, Xendit webhooks, creator verification actions, and the protected reconciliation job. `payment_events` provides idempotent audit history.

### Email

Respondent confirmation and invoice email use `src/lib/email/transactional.ts`. Resend is preferred when configured; SMTP is the fallback. `email_delivery_logs` snapshots the template and tracks attempts/status. There is no creator-notification email workflow in the current implementation.

### Integration catalog versus runtime support

| Provider/category | Current state |
|---|---|
| Xendit, PayPal | Operational payment processing |
| SMTP, Resend | Operational respondent transactional email |
| reCAPTCHA | Operational respondent verification |
| Google Sheets | Credential/OAuth flow exists; automatic submission sync is not implemented |
| Stripe, PayMongo, Maya | Configuration UI/storage only; not registered payment gateways |
| Gemini, Google Calendar, Calendly, ImageKit, Cloudinary | Configuration UI/storage only |

Secrets are encrypted at rest with AES-256-GCM using `CREDENTIALS_ENCRYPTION_KEY`. The normalized `integrations` table is primary; `integration_settings` remains as a legacy fallback during migration.

## 8. Deployment and Operations

Render is the maintained deployment path:

- Blueprint: `render.yaml`
- Build: `pnpm install --frozen-lockfile && pnpm run build:render`
- Start: `pnpm run start`
- Output: `.output/server/index.mjs`
- Health check: `/api/health`
- Database prep: migrations, schema validation, built-in template seed
- Reconciliation endpoint: `/api/internal/reconcile-payments`, protected by `CRON_SECRET`

Required production values are `DATABASE_URL`, `BETTER_AUTH_SECRET`,
`BETTER_AUTH_URL`, and `CREDENTIALS_ENCRYPTION_KEY`.
`CRON_SECRET` is required if the reconciliation endpoint is scheduled. Provider
credentials are normally connected per creator in Settings, with limited
environment fallbacks for PayPal and Xendit.

`vercel.json` remains in the repository, but the old `api/index.ts` Vercel bridge was removed. Do not document Vercel serverless as the current production architecture.

## 9. Key Contracts

| Contract | Authoritative source |
|---|---|
| Tables, enums, JSON columns, indexes | `src/db/schema.ts` |
| Page builder/runtime types | `src/lib/page-builder/types.ts` |
| Flow types and node configuration | `src/lib/flow-engine/types.ts` |
| Flow behavior | `FlowEngine.ts`, `FlowValidator.ts`, `safe-expression.ts` |
| Public mode selection | `src/components/public-form/PublicFormView.tsx` |
| Unified editor mode selection | `src/routes/forms/$formId/edit.tsx` |
| Supported payment gateways | `src/integrations/payments/index.ts` |
| Integration catalog and credential shapes | `src/lib/integrations/types.ts`, `ProviderForms.ts` |
| Deployment | `render.yaml`, `package.json`, `vite.config.ts` |

## 10. Known Product Boundaries

- Flow graphs must be acyclic.
- Flow subscriptions are not implemented; subscriptions are page-form/Xendit/PHP only.
- Refund status can be represented, but refunds are processed in the gateway dashboard.
- Configuring an integration does not imply a runtime sync or automation exists.
- File-upload values are currently stored as submitted values/data URLs; ImageKit and Cloudinary runtime upload are not implemented.
- Dashboard analytics provide aggregate and time-series data, not visitor/funnel analytics.
