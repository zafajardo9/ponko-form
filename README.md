# PonkoForm

Multi-tenant form builder with flow automation, payment integration, and multi-step branching experiences.

---

## 📋 Prerequisites

- Node.js >= 22.12.0
- PostgreSQL database (Neon serverless recommended)
- A high-entropy Better Auth secret

## 🚀 Quick Start

```bash
pnpm install
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000).

## 📖 Documentation

### System Memory (for AI / developers)

The [`memory-ponko/`](memory-ponko/) directory contains everything you need to understand the system before working with the codebase:

| File | What It Covers |
|---|---|
| [`memory-ponko/ARCHITECTURE.md`](memory-ponko/ARCHITECTURE.md) | Tech stack, directory structure, design decisions, data flow |
| [`memory-ponko/DATABASE.md`](memory-ponko/DATABASE.md) | Full database schema with all tables, columns, indexes, config shapes |
| [`memory-ponko/CONVENTIONS.md`](memory-ponko/CONVENTIONS.md) | Coding patterns, styling rules, server function patterns, common gotchas |
| [`memory-ponko/FLOW-BUILDER.md`](memory-ponko/FLOW-BUILDER.md) | Deep dive into the Flow Builder feature |

### Feature Guides

| Guide | Description |
|---|---|
| [`docs/flow-builder-guide.md`](docs/flow-builder-guide.md) | Complete technical reference — node types, variables, expressions, runtime, API |
| [`docs/flow-form-guide.md`](docs/flow-form-guide.md) | Tutorial & computation handbook — step-by-step building, patterns, troubleshooting |
| [`docs/current-system.md`](docs/current-system.md) | Verified current capabilities, integration maturity, routes, and deployment |

## Deploy to Render

The repository includes a [`render.yaml`](render.yaml) Blueprint for a Render
Node.js web service. In Render, choose **New → Blueprint**, connect this
repository, and provide the secret values requested by the Blueprint:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `CREDENTIALS_ENCRYPTION_KEY`

`DATABASE_URL` may point to either Neon or a standard PostgreSQL database such
as Render Postgres. The correct driver is selected automatically. If the
database is behind a custom proxy, set the optional `DATABASE_DRIVER` to either
`neon-http` or `postgres`.

The build installs the frozen pnpm lockfile, compiles the Nitro Node server,
applies the idempotent database migrations, validates the schema, and seeds
built-in form templates. The start command only starts the generated server,
keeping free tier cold starts fast. Health checks use `/api/health`.

Apply the auth migration before switching traffic:

```bash
pnpm run db:prepare
```

The first successful Better Auth login links the local auth user to an existing
profile by verified email, so owned forms and integration settings remain on
the same profile row.

For Xendit, configure the webhook URL shown in **Settings → Integrations** after the
service is live. PayPal and Xendit return URLs are generated from the active
Render request domain.

## 🧪 Scripts

```bash
# Database
pnpm db:generate          # Generate Drizzle migration
pnpm db:migrate           # Apply migrations
pnpm db:seed-flow         # Seed Payment Plan sample flow
pnpm db:seed-service-flow # Seed Service Order sample flow

# Development
pnpm dev                  # Start dev server
pnpm build                # Production build
pnpm test                 # Run tests
```

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [TanStack Start](https://tanstack.com/start) (React 19 + SSR) |
| **Build** | Vite 8 |
| **Styling** | Tailwind CSS 4 + Lucide icons |
| **Database** | PostgreSQL (Neon) + Drizzle ORM |
| **Auth** | [Better Auth](https://better-auth.com) with email and password |
| **Flow Canvas** | [React Flow](https://xyflow.com) |
| **Expression Engine** | In-house safe tokenizer/parser/AST evaluator |
| **Deployment** | Render (long-running Node.js web service) |

## Deploy to Cloudflare

PonkoForm uses server-side rendering, server functions, webhooks, and a
PostgreSQL database, so deploy it as a full-stack **Cloudflare Worker** rather
than as a static Pages site. Cloudflare manages both products from the
**Workers & Pages** dashboard.

The repository includes the Cloudflare Vite integration and
[`wrangler.jsonc`](wrangler.jsonc). The normal `pnpm build` remains the
Node/Nitro build used by Render; Cloudflare has its own commands:

```bash
pnpm run dev:cloudflare
pnpm run build:cloudflare
pnpm run preview:cloudflare
pnpm run deploy:cloudflare
```

For a Git-connected deployment, create a Worker from this repository and use:

| Setting | Value |
|---|---|
| Build command | `pnpm run build:cloudflare` |
| Deploy command | `pnpm exec wrangler deploy` |
| Non-production deploy command | `pnpm exec wrangler versions upload` |
| Root directory | `/` |

Under **Settings → Variables & Secrets**, add these runtime values:

- `DATABASE_URL` — use a Neon PostgreSQL URL so the Worker uses the HTTP driver
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL` — the final Worker or custom-domain URL
- `CREDENTIALS_ENCRYPTION_KEY`

Add `APP_URL` as a runtime variable containing the final `https://...` URL.
Payment, email, and scheduled reconciliation secrets from `.env.example` are
optional and should be added only when those integrations are enabled.

Before the first deployment, apply the database migrations from a trusted
machine or CI environment:

```bash
pnpm run db:prepare
```

Never commit `.env`, `.env.local`, or the generated `dist/` directory.
