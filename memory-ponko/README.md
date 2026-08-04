# PonkoForm — System Memory

> **Purpose:** Codebase-grounded context for developers and AI agents working on PonkoForm.
> **Verified against:** `main` at `7d2cbe3` on 2026-07-28.

## Read Order

| File | What It Covers |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Current system shape, runtime boundaries, deployment, integrations, and source map |
| [`DATABASE.md`](DATABASE.md) | PostgreSQL schema, relationships, indexes, migrations, and persistence rules |
| [`CONVENTIONS.md`](CONVENTIONS.md) | TypeScript, React, server-function, database, testing, and styling patterns |
| [`FLOW-BUILDER.md`](FLOW-BUILDER.md) | Flow graph model, variables, expression language, validation, execution, and payments |

User-facing and extended technical guides live in [`../docs/`](../docs/README.md). When memory and code disagree, `src/db/schema.ts`, route files, server functions, and tests are authoritative.

## Current System at a Glance

| Aspect | Current implementation |
|---|---|
| **Product** | Multi-tenant form builder with page forms, branching flow forms, payments, subscriptions, invoicing, and respondent email |
| **Builders** | Page Builder for linear multi-page forms; Flow Builder for node-graph journeys |
| **Editor** | Unified route at `/forms/$formId/edit`; `/forms/$formId/flow` redirects there |
| **Public runtime** | `/forms/submit/$publicId` and `/forms/embed/$publicId`; selects page or flow runtime from persisted form data |
| **Stack** | TanStack Start, React 19, Vite 8, Tailwind CSS 4, TanStack Query, Drizzle ORM, PostgreSQL, Better Auth |
| **Flow canvas** | `@xyflow/react`; list reordering uses dnd-kit |
| **Expressions** | In-house tokenizer/parser/evaluator in `safe-expression.ts`; no JavaScript `eval` and no `math.js` dependency |
| **Payments** | Working PayPal and Xendit one-time payments; Xendit/PHP subscriptions on page forms |
| **Email** | Resend preferred, SMTP fallback; confirmation and invoice templates with delivery logs |
| **Integrations** | 14 providers can be represented in the hub; only a subset has operational runtime behavior—see `ARCHITECTURE.md` |
| **Deploy** | Render Node web service using Nitro output; health check at `/api/health` |
| **Package manager** | pnpm 10.34.5; Node.js 22+ |

## Common Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm test

pnpm db:generate
pnpm db:migrate
pnpm db:check
pnpm db:prepare
pnpm payments:reconcile
```

`pnpm db:prepare` prepares the database, validates the schema, and seeds built-in form templates. The sample flow seeds remain available as `db:seed-flow` and `db:seed-service-flow`.

## Documentation Maintenance Rule

Update system memory in the same change when one of these contracts changes:

- a route, public identifier, or authentication boundary;
- a database table, enum, index, or JSON configuration shape;
- a builder mode, node type, field type, or expression rule;
- a working integration, payment lifecycle, email lifecycle, or deployment command.

Add a new verification date only after checking the corresponding implementation, not just another document.
