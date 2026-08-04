# PonkoForm Coding Conventions

> Part of [`memory-ponko/`](README.md) — System Memory
> **Verified against:** `main` at `7d2cbe3` on 2026-07-28.

---

## 1. TypeScript & React

### 1.1 General Rules

- Prefer **functional components**. Use a named props interface/type when it improves reuse or readability; inline prop types are acceptable for small private components.
- Prefer **named exports** for application modules. Tooling configuration may use the default export its framework expects.
- **Hooks** follow standard React patterns. TanStack Query for data fetching.
- **Server Functions** use `createServerFn` and the codebase's `.validator(...)` API. Most validators are typed pass-through/normalization functions; Zod is available but is not mandatory.
- Use the `@/` alias for new cross-directory imports. Preserve nearby relative-import style when changing a small existing module.

### 1.2 Naming

| What | Convention | Example |
|---|---|---|
| Components | PascalCase | `FlowCanvas`, `NodeConfigPanel` |
| Functions | camelCase | `handleDelete`, `getForm` |
| Variables (code) | camelCase | `selectedNodeId`, `formData` |
| Variables (DB/flow) | snake_case | `payment_plan`, `total_cost` |
| Types/Interfaces | PascalCase | `FlowNodeProps`, `FlowValidationError` |
| Files (components) | PascalCase | `FlowListBuilder.tsx` |
| Files (utils/server functions) | kebab-case | `path-utils.ts`, `flow-executions.ts` |
| CSS classes | kebab-case (Tailwind) | `flex items-center gap-2` |

### 1.3 Props Interface Pattern

```tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
  disabled?: boolean
  onClick?: () => void
}

export function Button({ variant = 'primary', size = 'md', children, ...rest }: ButtonProps) {
  // ...
}
```

### 1.4 Import Order

1. External libraries (React, TanStack, Better Auth, etc.)
2. Internal components (`@/components/...`)
3. Internal utilities (`@/lib/...`)
4. Type-only imports (`import type ...`)
5. Styles (rare — mostly Tailwind)

```tsx
import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { X, Edit, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { getForms } from '@/lib/server-fns/forms'
import type { FlowNode } from '@/lib/flow-engine/types'
```

---

## 2. Styling (Tailwind CSS)

### 2.1 No CSS Modules or styled-components

All styling is done via Tailwind utility classes directly in JSX.

### 2.2 Color Palette

The app uses a custom warm-toned palette with arbitrary values. Key tokens:

| Token | Hex | Usage |
|---|---|---|
| `text-[#141413]` | #141413 | Primary text (ink) |
| `text-[#6c6a64]` | #6c6a64 | Muted text |
| `text-[#8e8b82]` | #8e8b82 | Soft text, icon colors |
| `text-[#cc785c]` | #cc785c | Accent, links, active state |
| `text-[#c64545]` | #c64545 | Error, destructive actions |
| `bg-[#faf9f5]` | #faf9f5 | Page background (cream) |
| `bg-[#efe9de]` | #efe9de | Card backgrounds |
| `bg-[#f5f0e8]` | #f5f0e8 | Soft section backgrounds |
| `border-[#e6dfd8]` | #e6dfd8 | Borders, dividers |

Reuse the established warm palette and shared primitives. When a new semantic state genuinely needs another color, add it consistently and verify contrast rather than scattering one-off values.

### 2.3 Layout Patterns

| Pattern | Classes |
|---|---|
| Page container | `mx-auto max-w-6xl px-6 py-12` |
| Card | `rounded-xl border border-[#e6dfd8] bg-[#efe9de] p-6` |
| Three-column editor | `flex flex-1 overflow-hidden` / `w-60 flex-none` / `flex-1` |
| Button (primary) | `inline-flex items-center rounded-md bg-[#cc785c] px-4 py-2 text-sm font-medium text-white hover:bg-[#a9583e]` |
| Button (secondary) | `inline-flex items-center rounded-md border border-[#e6dfd8] bg-[#faf9f5] px-4 py-2 text-sm text-[#141413] hover:bg-[#f5f0e8]` |
| Form input | `rounded-md border border-[#e6dfd8] bg-[#faf9f5] px-3 py-2 text-sm text-[#141413] outline-none focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/20` |

### 2.4 Responsive Design

- Dashboard grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Form editor is responsive:
  - Desktop (`lg+`) keeps the system-like three-column layout: palette left, builder center, config/variables right.
  - Mobile stacks the editor vertically: header actions and logic palette may scroll horizontally, fields use compact grids, and config/variables open as full-width panels below the builder.
  - Preserve desktop density when making mobile changes — use responsive classes (`sm:`, `lg:`) instead of replacing the desktop layout.
- Forms are responsive on the respondent side

---

## 3. Server Functions

### 3.1 Pattern

```tsx
import { createServerFn } from '@tanstack/react-start'
import { requireProfile } from '@/lib/server-fns/auth'
import { assertFormAccess } from '@/lib/server-fns/flow-helpers'

export const getForm = createServerFn({ method: 'GET' })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const profile = await requireProfile()
    const access = await assertFormAccess(data.id, profile.id)
    return { ...access.form, accessRole: access.role }
  })
```

### 3.2 Key Rules

- Protected server functions resolve the signed-in profile through
  `server-fns/auth.ts`, then use the access helper appropriate to the operation:
  `assertFormOwner`, `assertFormEditor`, or `assertFormAccess`. Authentication
  alone is never sufficient authorization.
- Use **`.validator()`** for input validation and normalization. Several public/payment functions also set `strict: false` because they are called across the public server boundary.
- Import the shared DB client from `src/db/index.ts` (normally `@/db` or a correct relative path).
- Return plain objects (serializable)
- Server functions are in `src/lib/server-fns/`, one file per domain entity
- Mutation functions use `method: 'POST'`
- Public respondent mutations must validate the form's publication state and opaque client token/session ownership where applicable.
- Keep server-only dependencies inside `.handler()` or server-only modules so client bundles do not pull in database, crypto, Nodemailer, or Node APIs.

---

## 4. Database Access

### 4.1 Drizzle Client

The Drizzle client is initialized in `src/db/index.ts` and imported in server functions as `import { db } from '../../db/index'`. Table definitions live separately in `src/db/schema.ts`.

### 4.2 Query Patterns

The codebase uses Drizzle's **core query builder** (`db.select().from()`), not the relational `db.query.*` API — no `relations()` are defined, so `db.query.*` and `with: {...}` are unavailable.

```tsx
import { db } from '../../db/index'
import { forms, flowNodes, flows } from '../../db/schema'
import { eq } from 'drizzle-orm'

// Select one
const [form] = await db
  .select()
  .from(forms)
  .where(eq(forms.id, formId))
  .limit(1)

// Select many (fetch related rows in separate queries and assemble in code)
const nodes = await db.select().from(flowNodes).where(eq(flowNodes.flowId, flowId))

// Insert
const [newNode] = await db.insert(flowNodes).values({ /* ... */ }).returning()

// Delete
await db.delete(flows).where(eq(flows.formId, form.id))
```

### 4.3 Money Handling

Persisted payment amounts are **integers in the smallest currency unit**:
- `1500000` = ₱15,000.00
- `250000` = ₱2,500.00

Never persist binary floats as gateway amounts. Flow `money` variables and page computation values are JavaScript numbers during calculation, then payment boundaries normalize to minor units.

---

## 5. Component Architecture

### 5.1 Composition Over Configuration

Prefer composing small, focused components over adding more inline UI to the unified editor or `PageBuilderWorkspace`.

- Flow mode delegates to `BuilderPalette`, `FlowCanvasWorkspace`/`FlowListBuilder`, and `NodeConfigPanel`/`VariablesManager`.
- Page mode delegates to `PageBuilderWorkspace`, which in turn uses separate settings, rules, computation, expression, and sorting components.
- Shared field rendering belongs under `form-builder/fields/renderers/`; do not rebuild field behavior independently in each runtime.

### 5.2 State Management

- **Local state** — `useState` for UI state (selected node, panel visibility)
- **Server state** — TanStack Query (`useQuery`, `useMutation`) for all data fetched from the server
- **Flow engine state** — The `FlowEngine` class manages its own internal state; UI reads from it via `getCurrentStep()`, `getVariableValues()`, etc.
- **No global state manager** — no Redux, Zustand, or Context for app state. TanStack Query handles cache.

### 5.3 File Naming

- Components: `PascalCase.tsx`
- Server functions: `kebab-case.ts` (in `src/lib/server-fns/`)
- Utilities: `kebab-case.ts`
- Routes: file-based per TanStack Router conventions

---

## 6. Flow Builder Engine

### 6.1 Core Classes (in `src/lib/flow-engine/`)

| File | Purpose |
|---|---|
| `FlowEngine.ts` | Client-side execution engine. Steps through nodes, evaluates decisions, runs calculators, tracks variables. |
| `FlowValidator.ts` | Validates Start presence, reachability, cycles, variable/config references, and outgoing-edge counts. |
| `ExpressionEvaluator.ts` | Resolves `{{variable}}` placeholders and evaluates the safe AST, requiring a finite numeric result. |
| `safe-expression.ts` | Tokenizer, parser, complexity limits, operators, and safe built-in functions. |
| `TemplateInterpolator.ts` | Replaces `{{variable}}` placeholders in Summary templates with actual values. |
| `path-utils.ts` | Graph traversal: linearizes the primary path, finds branch-only nodes, checks if flow is pure-linear. |
| `types.ts` | All flow-related TypeScript types (`FlowNode`, `FlowEdge`, `FlowVariable`, `FlowStep`, etc.). |

### 6.2 Supporting Libraries

| File | Purpose |
|---|---|
| `src/lib/theme.ts` | Per-form theming system. `FormTheme` interface, `themeVars()` for CSS custom properties (`--ponko-*`), accent presets, color utilities (`darken`, `withAlpha`, `deriveSurface`). |
| `src/lib/crypto.ts` | AES-256-GCM encrypt/decrypt for normalized `integrations` rows and the legacy `integration_settings` fallback. |

### 6.3 Engine Execution Loop

```
1. Start at the Start node
2. Look up the current node type
3. If FormField/Decision → wait for user input
4. If Calculator → evaluate expression, store result, auto-advance
5. If Payment → wait for payment result
6. If Summary/Redirect → terminal, mark complete
7. Follow edges to the next node
```

---

## 7. Testing

- **Framework:** Vitest (configured in `vitest.config.ts`)
- **Run:** `pnpm run test`
- Test files co-located with source files as `*.test.ts` or `*.test.tsx`
- Run targeted tests for the changed domain, then the full suite when practical.
- Prefer behavior tests at public/server boundaries for authentication, anonymous access, payment idempotency, and validation.

---

## 8. Git & Pull Requests

- **Branch naming:** use the repository/team convention for the current workflow.
- **Commit messages:** descriptive present tense.
- No conventional commits required

---

## 9. Common Gotchas

| Issue | Solution |
|---|---|
| Local dependency versions drift | Use `pnpm install`; `pnpm-lock.yaml` and `packageManager` are authoritative |
| Render does not start | Verify `.output/server/index.mjs` exists after `pnpm build` and use `pnpm start` |
| Render schema is stale | Run `pnpm db:prepare`; it migrates, checks the schema, and seeds templates |
| Persisted payment amount shows as `10000` | `payments.amount` is minor units (`10000` = ₱100.00); flow/page calculations use major-unit numbers before checkout conversion. |
| Decision node always takes the same branch | Check `matchValue` in edge metadata — must exactly match the option's `value` |
| Flow won't validate | Add/fix a terminal Summary/Redirect, connect unreachable nodes, remove cycles, and correct missing node config. |
| Integration appears connected but does nothing | Check the runtime-support table in `ARCHITECTURE.md`; several providers currently store config only. |
| Anonymous resume fails | Preserve and send the opaque client token; numeric execution/session IDs alone are insufficient. |
| `@tanstack/*` packages with `"latest"` | These resolve to the latest published version. Pin to specific versions if stability is needed. |
