# PonkoForm — System Memory

> **Purpose:** This directory contains the system-level knowledge an AI or developer needs before scanning or modifying the PonkoForm codebase. Read these files first to understand the project's architecture, conventions, data model, and key features.

---

## File Index

| File | What It Covers |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | High-level system architecture, tech stack, directory layout, and key design decisions |
| [`DATABASE.md`](DATABASE.md) | Full database schema, entity relationships, table details, and migration workflow |
| [`CONVENTIONS.md`](CONVENTIONS.md) | Coding patterns, naming conventions, styling rules, and code review guidelines |
| [`FLOW-BUILDER.md`](FLOW-BUILDER.md) | Deep dive into the Flow Builder feature — node types, expression engine, runtime, validation |

---

## Quick Reference

| Aspect | Summary |
|---|---|
| **Project** | PonkoForm — a form builder with flow automation, payments, and multi-tenant support |
| **Stack** | TanStack Start + React 19, Vite 8, Tailwind CSS 4, Drizzle ORM, Neon/Postgres, Clerk Auth |
| **Core Feature** | Flow Builder — visual workflow engine (React Flow) with 8 node types |
| **Auth** | Clerk (TanStack React Start integration), TanStack Start SSR middleware |
| **Database** | PostgreSQL via Neon (serverless). Drizzle ORM with schema in `src/db/schema.ts` |
| **Package Manager** | npm (with `.npmrc legacy-peer-deps=true` due to Vite peer dep conflicts); pnpm also supported |
| **Deploy** | Vercel (Node.js serverless via `api/index.ts` + Vercel serverless functions) |

### Running the project

```bash
npm install
npm run dev        # → http://localhost:3000
npm run build      # Production build
npm run db:seed-flow          # Seed Payment Plan sample flow
npm run db:seed-service-flow  # Seed Service Order sample flow
```

---

> 🔑 **For AI agents:** Start with [`ARCHITECTURE.md`](ARCHITECTURE.md) for the big picture, then [`DATABASE.md`](DATABASE.md) to understand the data model, then [`FLOW-BUILDER.md`](FLOW-BUILDER.md) for the core feature. [`CONVENTIONS.md`](CONVENTIONS.md) is essential before writing any code.
