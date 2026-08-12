# PonkoForm Documentation

> User guides and codebase-aligned technical references. Current-state docs were verified on 2026-08-12.

## Start Here

| Guide | Purpose |
|---|---|
| [**Getting Started**](getting-started.md) | Create, preview, publish, and share a page form |
| [**Current System Overview**](current-system.md) | What is operational today, what is configuration-only, and where it lives |
| [**Payments Guide**](payments-guide.md) | PayPal/Xendit setup, one-time checkout, Xendit subscriptions, discount codes, payment links, recovery |

## Builder Guides

| Guide | What It Covers |
|---|---|
| [**Flow Form Guide**](flow-form-guide.md) | Flow nodes, variables, computation patterns, branching, testing |
| [**Flow Builder Reference**](flow-builder-guide.md) | Graph data model, engine, server functions, routes, validation |
| [**AI Knowledge Bank**](AI-KNOWLEDGE-BANK.md) | Page and flow systems, fields, payments, email, analytics, routes, schema |

## Project Context

| Document | Audience |
|---|---|
| [**Implementation Status & Roadmap**](implementation-plan.md) | Maintainers deciding what is complete versus next |
| [**Naming Philosophy**](naming-philosophy.md) | Internal brand story and positioning |
| [**System Memory**](../memory-ponko/README.md) | Developers and AI agents modifying the codebase |

## Documentation Contract

- `src/db/schema.ts` is authoritative for persistence.
- Registered gateway code is authoritative for payment support; an integration card alone is not a working integration.
- `src/routes/` is authoritative for URLs and authentication boundaries.
- Update these docs when a route, schema, builder mode, field/node type, integration lifecycle, or deployment workflow changes.
