# PonkoForm Architecture

> Part of [`memory-ponko/`](README.md) — System Memory

---

## 1. High-Level Overview

PonkoForm is a **multi-tenant form builder with flow automation and payment integration**. Form creators build forms on a dashboard; respondents submit data through them. The unique feature is the **Flow Builder** — a visual workflow engine that turns linear forms into multi-step, branching, calculator-enabled, payment-integrated experiences.

### User Roles

| Role | What They Do |
|---|---|
| **Form Creator** | Logged-in user who builds and publishes forms via the dashboard |
| **Respondent** | Anonymous or known user who fills out a published form |
| **System** | Handles auth, persistence, payment simulation, routing |

---

## 2. Tech Stack

| Layer | Technology | Version / Notes |
|---|---|---|
| **Framework** | [TanStack Start](https://tanstack.com/start) (React Router + SSR) | v1.168 — wraps Vinxi/Nitro |
| **UI Library** | React 19 | — |
| **Build Tool** | Vite 8 | Configured via `vite.config.ts` |
| **Styling** | Tailwind CSS 4 | `@tailwindcss/vite` plugin, custom colors (see below) |
| **Icons** | Lucide React | v0.577 |
| **Flow Canvas** | React Flow (xyflow) | v12 — `@xyflow/react` |
| **Drag & Drop** | dnd-kit | Reordering nodes in list view |
| **Database ORM** | Drizzle ORM | v0.45 — schema in `src/db/schema.ts` |
| **Database** | PostgreSQL (Neon serverless) | — |
| **Auth** | Clerk | `@clerk/tanstack-react-start` v1.3 |
| **Expression Engine** | math.js | v15 — sandboxed, no eval |
| **Drag & Sort** | dnd-kit | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` |
| **Package Manager** | npm | Uses `.npmrc` with `legacy-peer-deps=true` |
| **Deployment** | Vercel | Node.js serverless functions via `api/index.ts` |

### Tailwind CSS Custom Colors

The design system uses a bespoke palette rather than Tailwind's default. Key tokens:

| Token | Hex | Usage |
|---|---|---|
| `ink` | `#141413` | Primary text |
| `muted` | `#6c6a64` | Secondary/muted text |
| `muted-soft` | `#8e8b82` | Soft text, icons |
| `primary` | `#cc785c` | Primary accent, links, selected state |
| `primary-active` | `#a9583e` | Hover/active primary |
| `error` | `#c64545` | Error text, delete buttons |
| `surface-card` | `#efe9de` | Card backgrounds |
| `surface-soft` | `#f5f0e8` | Soft backgrounds |
| `surface-cream` | `#faf9f5` | Page/app background |
| `surface-cream-strong` | `#e8e0d2` | Active surface |
| `border-subtle` | `#e6dfd8` | Borders, dividers |

Usage: `text-[#141413]` not `text-ink` (custom tokens aren't mapped to Tailwind's default palette — they use arbitrary values).

---

## 3. Directory Structure

```
ponkoform/
├── api/                          # Vercel serverless function entry
│   └── index.ts                  #   Imports dist/server/server.js, bridges Node↔Fetch
├── db/                           # SQL init scripts
│   └── init.sql
├── docs/                         # User & developer documentation
│   ├── README.md                 #   Docs index
│   ├── flow-builder-guide.md     #   Complete knowledge base (reference)
│   ├── flow-form-guide.md        #   Tutorial & computation handbook
│   └── implementation-plan.md    #   Original sprint plan
├── drizzle/                      # Drizzle Kit generated migrations
│   └── meta/
├── memory-ponko/                 # System memory (this directory)
│   ├── README.md                 #   Entry point
│   ├── ARCHITECTURE.md           #   This file
│   ├── DATABASE.md               #   Schema reference
│   ├── CONVENTIONS.md            #   Coding conventions
│   └── FLOW-BUILDER.md           #   Flow Builder deep dive
├── public/                       # Static assets
├── scripts/                      # Standalone utility scripts
│   ├── seed-flow.ts              #   Seeds Payment Plan flow
│   └── seed-service-flow.ts      #   Seeds Service Order flow
├── src/
│   ├── components/
│   │   ├── dashboard/            # Dashboard page components
│   │   │   ├── FormCard.tsx       #   Form card with actions menu
│   │   │   ├── EmptyState.tsx     #   Empty state placeholder
│   │   │   └── ShareDialog.tsx    #   Share link/embed dialog
│   │   ├── docs/                 # Documentation viewer
│   │   │   ├── DocCard.tsx        #   Doc listing card
│   │   │   ├── DocSidebar.tsx     #   Doc sidebar nav
│   │   │   └── MarkdownRenderer.tsx # Markdown → HTML renderer
│   │   ├── flow-builder/         # Flow Builder components
│   │   │   ├── BuilderPalette.tsx #   Left sidebar — palette
│   │   │   ├── FlowCanvas.tsx     #   React Flow canvas wrapper
│   │   │   ├── FlowListBuilder.tsx#   List view — sortable node rows
│   │   │   ├── FlowPalette.tsx    #   Canvas palette items
│   │   │   ├── FlowPreviewPanel.tsx # Preview panel
│   │   │   ├── FlowToolbar.tsx    #   Top toolbar
│   │   │   ├── FlowValidationBadge.tsx
│   │   │   ├── NodeConfigPanel.tsx#   Right sidebar — node config
│   │   │   ├── VariablesManager.tsx  # Variables manager panel
│   │   │   ├── VariableDialog.tsx #   Add/edit variable dialog
│   │   │   ├── SettingsDialog.tsx #   Flow-level settings (title, description, etc.)
│   │   │   ├── config-forms/      #   Per-node-type config forms
│   │   │   │   ├── FormFieldConfig.tsx
│   │   │   │   ├── GroupFieldsEditor.tsx
│   │   │   │   ├── OptionsEditor.tsx
│   │   │   │   ├── GroupConfig.tsx
│   │   │   │   ├── DecisionConfig.tsx
│   │   │   │   ├── CalculatorConfig.tsx
│   │   │   │   ├── PaymentConfig.tsx
│   │   │   │   ├── SummaryConfig.tsx
│   │   │   │   ├── RedirectConfig.tsx
│   │   │   │   └── controls.tsx   #   Shared form controls (dropdowns, inputs)
│   │   │   └── nodes/            #   Custom React Flow node renderers
│   │   │       ├── index.tsx      #   Node type → renderer map
│   │   │       └── NodeShell.tsx  #   Shared node wrapper (handles, labels, colors)
│   │   ├── flow-execution/       # Runtime components for respondents
│   │   │   ├── FlowExecutionContainer.tsx
│   │   │   ├── FlowStepRenderer.tsx
│   │   │   ├── FlowProgressBar.tsx
│   │   │   ├── CalculatorDisplay.tsx
│   │   │   ├── PaymentStep.tsx
│   │   │   ├── InvoicePDF.tsx     #   PDF receipt (@react-pdf/renderer)
│   │   │   └── invoice.ts         #   Invoice data builder
│   │   ├── public-form/          # Public (anonymous) form view
│   │   │   └── PublicFormView.tsx
│   │   ├── form-builder/         # Linear form builder (legacy)
│   │   ├── ui/                   # Shared UI primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── PreviewDialog.tsx
│   │   │   └── FlowPreviewModal.tsx
│   │   └── header/               # App header
│   ├── db/
│   │   ├── index.ts              # Drizzle client (db) — import from here
│   │   └── schema.ts             # Drizzle schema — ALL tables
│   ├── integrations/
│   │   ├── clerk/                # Clerk provider setup
│   │   ├── payments/             # Payment gateway implementations
│   │   │   ├── base.ts           #   Abstract gateway interface
│   │   │   ├── types.ts          #   Payment gateway types
│   │   │   ├── currencies.ts     #   Supported currency definitions
│   │   │   ├── registry.ts       #   Gateway registry (slug→gateway map)
│   │   │   ├── index.ts          #   Barrel exports
│   │   │   ├── xendit/gateway.ts #   Xendit payment gateway
│   │   │   └── paypal/gateway.ts #   PayPal payment gateway
│   │   └── tanstack-query/       # TanStack Query client setup
│   │   ├── lib/
│   │   │   ├── flow-engine/          # Flow Builder core engine
│   │   │   │   ├── FlowEngine.ts     #   Client-side runtime engine
│   │   │   │   ├── FlowValidator.ts  #   Flow validation logic
│   │   │   │   ├── TemplateInterpolator.ts # {{var}} replacement
│   │   │   │   ├── ExpressionEvaluator.ts  # math.js expression eval
│   │   │   │   ├── path-utils.ts     #   Graph traversal utilities
│   │   │   │   ├── index.ts          #   Barrel exports
│   │   │   │   └── types.ts          #   Flow-related TypeScript types
│   │   │   ├── server-fns/           # TanStack Start server functions
│   │   │   │   ├── auth.ts           #   Auth helpers
│   │   │   │   ├── forms.ts          #   Form CRUD (+ public getPublicForm)
│   │   │   │   ├── flows.ts          #   Flow CRUD
│   │   │   │   ├── flow-nodes.ts     #   Node & Edge CRUD
│   │   │   │   ├── flow-variables.ts #   Variable CRUD
│   │   │   │   ├── flow-executions.ts#   Execution CRUD
│   │   │   │   ├── flow-helpers.ts   #   Shared flow server-fn helpers
│   │   │   │   ├── submissions.ts    #   Form submission CRUD
│   │   │   │   ├── gateways.ts       #   Payment gateway CRUD
│   │   │   │   ├── payments.ts       #   Real PayPal/Xendit checkout + verify
│   │   │   │   ├── payments-view.ts  #   Payment listing/viewing server fns
│   │   │   │   ├── integrations.ts   #   Per-user encrypted credential CRUD
│   │   │   │   ├── docs.ts           #   Docs server fns
│   │   │   │   └── fields.ts         #   Form field CRUD
│   │   │   ├── integrations/         # Gateway credential resolution
│   │   │   │   ├── credentials.ts    #   Decrypt + resolve per-user creds
│   │   │   │   └── types.ts          #   Integration config types
│   │   │   ├── theme.ts              # Per-form theming (FormTheme, themeVars, accent presets)
│   │   │   ├── crypto.ts             # AES-256-GCM encrypt/decrypt for secrets
│   │   │   ├── form-utils.ts         # Form helpers
│   │   │   └── docs-parser.ts        # Docs markdown parser
│   ├── routes/                   # File-based routing (TanStack Router)
│   │   ├── __root.tsx            #   Root layout
│   │   ├── index.tsx             #   Landing page
│   │   ├── dashboard/
│   │   │   ├── index.tsx         #   Dashboard (My Forms)
│   │   │   └── settings.tsx      #   Integration settings (creds)
│   │   ├── forms/
│   │   │   ├── new.tsx           #   Create new form
│   │   │   ├── $formId/
│   │   │   │   ├── edit.tsx      #   Form editor (flow builder)
│   │   │   │   ├── flow.tsx      #   Flow builder route
│   │   │   │   └── submissions.tsx #  View form submissions
│   │   │   ├── submit/
│   │   │   │   └── $formId.tsx   #   Public form submission
│   │   │   ├── embed/
│   │   │   │   └── $formId.tsx   #   Embedded form view
│   │   │   └── payment-return.tsx #  Gateway redirect-back + verify
│   │   ├── flow/
│   │   │   └── $executionId/
│   │   │       └── complete.tsx  #   Flow completion receipt
│   │   ├── docs/
│   │   │   ├── index.tsx         #   Docs index
│   │   │   └── $slug.tsx         #   Individual doc page
│   │   ├── mcp.ts                #   MCP server endpoint
│   │   ├── sign-in.$.tsx         #   Clerk sign-in
│   │   └── sign-up.$.tsx         #   Clerk sign-up
│   ├── styles.css                # Global styles, Tailwind import, per-form theme vars
├── .npmrc                        # legacy-peer-deps=true
├── vercel.json                   # Vercel deployment config
├── vite.config.ts                # Vite config (TanStack Start + Tailwind + React Compiler)
├── drizzle.config.ts             # Drizzle Kit config
├── neon-vite-plugin.ts           # Neon DB plugin
├── vitest.config.ts              # Vitest config
├── tsconfig.json                 # TypeScript config (strict, noEmit, bundler)
├── package.json                  # Dependencies & scripts (npm or pnpm)
└── README.md                     # Project README
```

---

## 4. Key Design Decisions

### 4.1 Flow Forms vs Linear Forms

A **linear form** renders all fields on one page (traditional model). A **flow form** uses a graph of connected nodes (Start → Form Fields → Decisions → Calculators → Payment → Summary). The system detects which mode to use at runtime:

- If a form has a `flow` record → **step-by-step flow experience**
- If no flow → **classic linear form** (backward compatible)

This is checked in the public form submission route (`/forms/submit/:formId`).

### 4.2 One Flow Per Form

Each form can have **at most one flow** (enforced by a `unique` constraint on `flows.formId`). Deleting the flow reverts the form to linear mode.

### 4.3 Client-Side Preview, Server-Side Production

- **Preview mode** runs the `FlowEngine` entirely in-browser (no server calls, no data persisted)
- **Published forms** execute via the server — each step persists to the `flow_executions` table

### 4.4 Deploy on Vercel via Serverless Functions

TanStack Start outputs `dist/server/server.js` (a Web Fetch-API handler). Vercel runs this via `api/index.ts` which wraps it in Node.js `(req, res)` handler. Static assets are served from `dist/client/`.

### 4.5 Peer Dependency Conflicts

`vite-plugin-neon-new@0.8.0` only declares support for Vite 6/7 but works fine with Vite 8. The `.npmrc` with `legacy-peer-deps=true` suppresses this.

### 4.6 Per-Form Theming

Each form can have a `theme` (stored as JSONB on the `forms` table) that customizes the respondent-facing form's appearance: primary accent color, background color, and corner radius (sharp/rounded/pill). Theme values propagate through CSS custom properties (`--ponko-*`) defined in `src/lib/theme.ts`. Un-themed forms fall back to the house palette. Creators choose from curated accent presets or enter custom hex values.

---

## 5. Authentication Flow

1. Clerk handles auth at the app root via `<ClerkProvider>` in `src/integrations/clerk/provider.tsx`
2. Protected routes use `requireAuth()` in their `beforeLoad` handler (TanStack Router middleware)
3. Server functions call `auth()` from `@clerk/tanstack-react-start/server` to verify the user server-side
4. Profiles table maps Clerk user IDs (`clerk_id`) to internal profile IDs

---

## 6. Data Flow — Form Submission (Flow Mode)

```
Respondent opens /forms/submit/:formId
  → Route loader calls getForm() + getFlow() + getActiveGateways()
  → If flow exists → render FlowExecutionContainer
  → FlowExecutionContainer loads FlowEngine (server-side)
  → Each step:
      1. Engine determines current node type
      2. Respondent interacts (fills field, picks branch, clicks pay)
      3. Engine advances to next node, evaluates calculators automatically
      4. All variable values tracked in execution context
  → On terminal node (Summary/Redirect):
      → Creates formSubmission record (formData = all variables)
      → Updates flowExecution.status = 'completed'
      → Shows completion receipt at /flow/:executionId/complete
```

---

## 7. Key Files to Know

| File | Why It Matters |
|---|---|
| `src/db/schema.ts` | Single source of truth for ALL database tables |
| `src/lib/flow-engine/FlowEngine.ts` | Heart of the flow runtime |
| `src/lib/flow-engine/types.ts` | All flow-related TypeScript types |
| `src/lib/theme.ts` | Per-form theming system (FormTheme, themeVars, accent presets) |
| `src/lib/crypto.ts` | AES-256-GCM encrypt/decrypt for integration secrets |
| `src/routes/forms/$formId/edit.tsx` | The big editor page — palette, canvas, list, config, preview |
| `src/components/flow-builder/` | All builder UI components |
| `api/index.ts` | Vercel serverless entry point |
| `vite.config.ts` | Build configuration, plugins |
| `vercel.json` | Deployment configuration |
