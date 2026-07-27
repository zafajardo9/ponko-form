# PonkoForm

Multi-tenant form builder with flow automation, payment integration, and multi-step branching experiences.

---

## 📋 Prerequisites

- Node.js >= 22.12.0
- PostgreSQL database (Neon serverless recommended)
- Clerk account (for authentication)

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

## Deploy to Render

The repository includes a [`render.yaml`](render.yaml) Blueprint for a Render
Node.js web service. In Render, choose **New → Blueprint**, connect this
repository, and provide the secret values requested by the Blueprint:

- `DATABASE_URL`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_PUBLISHABLE_KEY` (use the same `pk_...` value)
- `CLERK_SECRET_KEY`
- `CREDENTIALS_ENCRYPTION_KEY`

`DATABASE_URL` may point to either Neon or a standard PostgreSQL database such
as Render Postgres. The correct driver is selected automatically. If the
database is behind a custom proxy, set the optional `DATABASE_DRIVER` to either
`neon-http` or `postgres`.

The build installs the frozen pnpm lockfile, compiles the Nitro Node server,
applies the idempotent database migrations, validates the schema, and seeds
built-in form templates. The start command only starts the generated server,
keeping free tier cold starts fast. Health checks use `/api/health`.

In Clerk, allow the generated `https://<service-name>.onrender.com` domain. For
Xendit, configure the webhook URL shown in **Settings → Integrations** after the
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
| **Auth** | [Clerk](https://clerk.com) |
| **Flow Canvas** | [React Flow](https://xyflow.com) |
| **Expression Engine** | [math.js](https://mathjs.org) |
| **Deployment** | Render (long-running Node.js web service) |
