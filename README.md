# PonkoForm

Multi-tenant form builder with flow automation, payment integration, and multi-step branching experiences.

---

## 📋 Prerequisites

- Node.js >= 22.12.0
- PostgreSQL database (Neon serverless recommended)
- Clerk account (for authentication)

## 🚀 Quick Start

```bash
npm install
npm run dev
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

## 🧪 Scripts

```bash
# Database
npm run db:generate          # Generate Drizzle migration
npm run db:migrate           # Apply migrations
npm run db:seed-flow         # Seed Payment Plan sample flow
npm run db:seed-service-flow # Seed Service Order sample flow

# Development
npm run dev                  # Start dev server
npm run build                # Production build
npm run test                 # Run tests
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
| **Deployment** | Vercel (Node.js serverless) |
