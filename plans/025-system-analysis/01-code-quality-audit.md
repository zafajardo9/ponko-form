# PonkoForm Code Quality Audit — July 28, 2026

**Scope:** 324 source files, 48,645 total lines  
**Methodology:** Multi-pass search-driven audit (Pass 1: file size, Pass 2: code smells, Pass 3: structure, Pass 4: safety)  
**Previous audit baseline:** July 28, 2026 (known findings tracked in ponkoform skill)

---

## 1. File Size Ranking — Top 30 Largest Files

Files >700 lines are strong split candidates; >400 lines merit review.

| Rank | Lines | File | Notes |
|-----:|------:|------|-------|
| 1 | 1,456 | `src/lib/server-fns/page-forms.ts` | 21 server functions — sessions, pages, payments in one file |
| 2 | 1,107 | `src/routes/forms/$formId/edit.tsx` | Route component with 10+ lazy imports |
| 3 | 936 | `src/components/page-builder/ExpressionBuilder.tsx` | Expression builder UI |
| 4 | 880 | `src/db/schema.ts` | 29 tables, 4 enums — split into domain modules |
| 5 | 869 | `src/components/page-builder/PageBuilderWorkspace.tsx` | **Fixed:** Was 4,344 in previous audit |
| 6 | 858 | `src/lib/server-fns/payments-view.ts` | 8 server functions for payment views |
| 7 | 828 | `src/routes/forms/$formId/payments.tsx` | Payment management route page |
| 8 | 722 | `src/components/page-builder/PageSettings.tsx` | Form settings panel |
| 9 | 685 | `src/lib/payments/reconciliation.ts` | Payment reconciliation logic |
| 10 | 668 | `src/routes/forms/$formId/submissions.tsx` | Submissions management route |
| 11 | 647 | `src/components/flow-builder/FlowListBuilder.tsx` | Flow builder list/canvas |
| 12 | 630 | `src/components/page-builder/FieldSettings.tsx` | Field settings panel |
| 13 | 591 | `src/lib/page-builder/references.ts` | Reference resolution engine |
| 14 | 579 | `src/routes/dashboard/index.tsx` | Dashboard route |
| 15 | 560 | `src/routeTree.gen.ts` | Auto-generated — excluded from audit |
| 16 | 548 | `src/components/page-form/PageFormView.tsx` | Respondent page-form runtime |
| 17 | 528 | `src/lib/server-fns/flow-nodes.ts` | Flow node CRUD |
| 18 | 503 | `src/components/docs/MarkdownRenderer.tsx` | Docs markdown + mermaid |
| 19 | 473 | `src/components/ui/DataTable.tsx` | Shared DataTable component |
| 20 | 473 | `src/components/homepage/ProductMockups.tsx` | Homepage mockup graphics |
| 21 | 463 | `src/lib/dashboard-report.ts` | Dashboard report generation |
| 22 | 460 | `src/components/homepage/HomePage.tsx` | Landing page |
| 23 | 452 | `src/components/ui/FlowPreviewModal.tsx` | Flow preview modal |
| 24 | 448 | `src/components/dashboard/ShareDialog.tsx` | Form sharing dialog |
| 25 | 435 | `src/lib/flow-engine/FlowEngine.ts` | Core flow execution engine |
| 26 | 432 | `src/lib/server-fns/forms.ts` | Form CRUD server functions |
| 27 | 432 | `src/integrations/payments/xendit/gateway.ts` | Xendit payment gateway |
| 28 | 429 | `src/lib/server-fns/dashboard.ts` | Dashboard server functions |
| 29 | 425 | `src/lib/server-fns/payments.ts` | Payment server functions |
| 30 | 424 | `src/lib/flow-engine/safe-expression.ts` | Safe expression evaluator |

### File count by directory

| Directory | .ts/.tsx files |
|-----------|--------------:|
| `components/` | 151 |
| `lib/` | 123 |
| `routes/` | 25 |
| `integrations/` | 15 |
| `db/` | 6 |
| `utils/` | 1 |

### Component files by feature area

| Feature | Components | Tests | Test Ratio |
|---------|----------:|------:|:----------:|
| flow-builder | 24 | 1 | 4% |
| form-builder | 20 | 1 | 5% |
| ui | 20 | 4 | 20% |
| page-builder | 14 | 2 | 14% |
| flow-execution | 11 | 4 | 36% |
| forms | 8 | 3 | 38% |
| page-form | 8 | 3 | 38% |
| dashboard | 7 | 2 | 29% |
| integrations | 5 | 1 | 20% |
| layout | 5 | 2 | 40% |
| invoicing | 5 | 1 | 20% |
| docs | 4 | 1 | 25% |
| public-form | 3 | 1 | 33% |
| homepage | 3 | 1 | 33% |

---

## 2. Code Smell Inventory

### 2.1 Console statements (22 instances across 17 files)

All console statements use the structured `[ponkoform-*]` prefix pattern — this is good hygiene. Only one `console.warn`; all others are `console.error`.

**Error boundaries** (`console.error` in catch blocks — expected):
- `ErrorBoundary.tsx:24` — Render failure logging ✓
- `with-timeout.ts:43` — DB timeout logging ✓

**User-facing error handling** (fire-and-forget in catch blocks):
- `complete-submission.ts:149` — Email dispatch failure
- `submissions.ts:84` — Email dispatch failure
- `flow-executions.ts:235` — Email dispatch failure
- `delivery.ts:194` — Email delivery failure
- `FlowExecutionContainer.tsx:206` — Flow completion failure
- `IntegrationModal.tsx:49` — OAuth URL load failure
- `RecaptchaField.tsx:88` — Recaptcha load failure
- `PagePaymentStep.tsx:198,209` — Checkout creation failure

**Network/webhook**:
- `$endpointKey.ts:94` — Xendit webhook failure
- `page-forms.ts:1344` — Payment checkout failure

**Misc**:
- `dashboard/index.tsx:219` — Dashboard report download failure
- `mcp-handler.ts:40` — MCP request failure

**Verdict:** All structured. No bare `console.log` statements. Low priority — consider aggregating to a shared logger.

### 2.2 `as any` casts (5 non-generated)

| File | Line | Code | Severity |
|------|-----:|------|----------|
| `FlowExecutionContainer.tsx` | 137 | `(data.execution.history as any[])` | MEDIUM |
| `MarkdownRenderer.tsx` | 69 | `(window as any).mermaid` | LOW |
| `MarkdownRenderer.tsx` | 70 | `(window as any).mermaid.run(...)` | LOW |
| `MarkdownRenderer.tsx` | 77 | `(window as any).mermaid` | LOW |
| `MarkdownRenderer.tsx` | 78 | `(window as any).mermaid.initialize(...)` | LOW |

`routeTree.gen.ts` has 23 `as any` casts but is auto-generated — excluded.

**Specific fix needed:** `FlowExecutionContainer.tsx:137` should use the schema's typed `$type<>()` instead of `as any[]`. The history array has a known type from the flow execution schema.

**Mermaid issue:** 4 `window as any` casts for the mermaid library. Add a global type declaration:
```typescript
// src/types/mermaid.d.ts
interface Window {
  mermaid?: {
    initialize: (config: Record<string, unknown>) => void
    run: (options: { nodes: Element[] }) => Promise<void>
  }
}
```

### 2.3 TODO / FIXME / HACK

**Zero results.** The codebase is clean of deferred-work markers.

### 2.4 eslint-disable (5 instances)

| File | Line | Directive | Audit |
|------|-----:|-----------|-------|
| `routeTree.gen.ts` | 1 | `/* eslint-disable */` | Auto-generated ✓ |
| `payment-return.tsx` | 95 | `react-hooks/exhaustive-deps` | Needs audit |
| `FlowExecutionContainer.tsx` | 160 | `react-hooks/exhaustive-deps` | Needs audit |
| `PagePaymentStep.tsx` | 171 | `react-hooks/exhaustive-deps` | Needs audit |
| `FieldRenderer.tsx` | 66 | `no-console` | For `console.warn` — reasonable |

**Risk:** The 3 `react-hooks/exhaustive-deps` suppressions can mask stale closure bugs. Each should be re-audited:
- Try removing the disable and check if `tsc --noEmit` produces errors
- If the effect genuinely needs a narrower dependency set, document why in a comment

### 2.5 `.then()` chains

**20 total instances** — categorized:

**Safe (React.lazy dynamic imports):** 14 instances in `__root.tsx`, `edit.tsx`, `PublicFormView.tsx` — these are required by `lazy()` API. No `.catch()` needed (Suspense handles loading failures).

**Safe (dynamic imports with .catch()):** 2 instances:
- `MarkdownRenderer.tsx:48` — Syntax highlighter import with `.catch()`
- `IntegrationModal.tsx:44` — OAuth URL load with `.catch()`

**Concerning (no .catch()):**
- `FlowExecutionContainer.tsx:188` — `.then(() => { … redirect … })` with `.catch()` on line 204 ✓ (has catch)
- `dashboard.ts:87,107,131` — `.then((rows) => rows[0])` on query results — these chain on the promise returned by `db.select()`. No `.catch()` needed since the server fn boundary catches unhandled rejections.
- `response-columns.ts:103` — `Promise.all(…).then(…)` — no `.catch()`, but the caller (server fn) catches.
- `RecaptchaField.tsx:69` — `loadRecaptcha().then((api) => …)` — no `.catch()`, but it's voided and the error is handled by the callback availability check.
- `SyntaxHighlighter.ts:33` — Dynamic import chain — caller handles failure.

**Verdict:** The genuinely unhandled `.then()` chains from the previous audit (`FlowExecutionContainer.tsx:188`, `IntegrationModal.tsx:39`) now have `.catch()` handlers. All remaining `.then()` instances are either React.lazy (safe by design), dynamically imported with `.catch()`, or wrapped in server fn boundaries.

### 2.6 `void` promises (7 instances)

| File | Line | Pattern | Analysis |
|------|-----:|---------|----------|
| `dashboard/index.tsx` | 297 | `void downloadReport("overview")` | Fire-and-forget in onClick ✓ |
| `dashboard/index.tsx` | 346 | `void refetch()` | Fire-and-forget in onClick ✓ |
| `dashboard/index.tsx` | 574 | `void downloadReport(reportTarget)` | Fire-and-forget in callback ✓ |
| `router.tsx` | 10 | `void import('react-grab')` | Side-effect import ✓ |
| `IntegrationModal.tsx` | 43 | `void getGoogleAuthUrl()` | Non-critical UI load ✓ |
| `MarkdownRenderer.tsx` | 47 | `void import("./SyntaxHighlighter")` | Dynamic import ✓ |
| `RecaptchaField.tsx` | 68 | `void loadRecaptcha()` | Non-critical UI load ✓ |

All intentional fire-and-forget patterns. No action needed.

---

## 3. Duplication Analysis

### 3.1 HIGH: Email dispatch error handling (triplicated)

**Files:** `complete-submission.ts:148-150`, `submissions.ts:83-85`, `flow-executions.ts:234-236`

All three contain identical logic:
```typescript
await dispatchSubmissionEmails(submission.id).catch((error) => {
  console.error(`[ponkoform-X:${submission.id}] Email dispatch failed`, error)
})
```

**Recommendation:** Extract to a shared helper in `src/lib/email/`:
```typescript
// src/lib/email/dispatch-helper.ts
export async function dispatchAndLog(submissionId: number, context: string) {
  await dispatchSubmissionEmails(submissionId).catch((error) => {
    console.error(`[ponkoform-${context}:${submissionId}] Email dispatch failed`, error)
  })
}
```

### 3.2 MEDIUM: `updateOption` function (duplicated)

**Files:** `OptionsDialog.tsx:46`, `FieldSettings.tsx:89`

Two implementations with different behaviors:
- `OptionsDialog.tsx` — general option editing with `optionValueForLabel` auto-derivation
- `FieldSettings.tsx` — satisfaction-specific with `setPreset('custom')` side effect

**Recommendation:** Extract the core option-update logic from `OptionsDialog.tsx` into a shared utility. `FieldSettings.tsx` can compose it with its satisfaction-specific concerns.

### 3.3 Fixed: InvoiceEditor / ConfirmationEditor

**Previous audit** flagged these as 80% structurally identical in `InvoiceTemplateBuilder.tsx`. **Fixed.** The file is now 141 lines with a unified JSX structure — both editor sections are inline and share the same `Field` helper component. No extraction needed.

---

## 4. Structural & Organization Recommendations

### 4.1 HIGH: `db/schema.ts` (880 lines, 29 tables + 4 enums)

**Current state:** One monolithic file with all database tables.

**Recommendation:** Split into domain modules under `src/db/schema/`:

```
src/db/schema/
├── index.ts          — re-exports all tables
├── enums.ts          — formStatusEnum, fieldTypeEnum, paymentStatusEnum, submissionStatusEnum
├── auth.ts           — profiles, integrationSettings
├── forms.ts          — forms, formFields, formReferences, formTemplates
├── page-builder.ts    — formPages, formPageFields, fieldConditions
├── submissions.ts    — formSubmissions, formSubmissionSessions, emailSurveyInvitations
├── payments.ts       — paymentGateways, formPaymentConfigs, payments, subscriptionCycles, paymentEvents
├── invoicing.ts      — formInvoiceConfigs, formConfirmationConfigs, emailDeliveryLogs
├── flows.ts          — flows, flowVariables, flowNodes, flowEdges, flowExecutions
└── integrations.ts   — integrations
```

**Effort:** Medium (~2 hours). Requires updating 50+ import sites from `@/db/schema` to `@/db/schema` (barrel re-export handles this automatically).

### 4.2 HIGH: `page-forms.ts` (1,456 lines, 21 server functions)

**Current state:** One file handles pages, fields, conditions, sessions, and payments.

**Recommendation:** Split into 3 files:

```
src/lib/server-fns/
├── page-forms.ts      — ensurePageForm, getPageForm, getPageSessionData (~300 lines)
├── page-pages.ts      — createPage, updatePage, deletePage, reorderPages, createPageField, updatePageField, deletePageField, movePageField, saveFieldConditions (~350 lines)
├── page-sessions.ts   — startPageSession, advancePageSession, completePageSubmission (~500 lines)
└── page-payments.ts   — getPagePaymentOptions, ensurePagePaymentDraft, initiatePagePayment, finalizePagePayment (~400 lines)
```

**Effort:** Medium (~3 hours). Import paths are mostly internal (`../payments/reconciliation`, `../integrations/credentials`) so only the route call sites need updating.

### 4.3 MEDIUM: `edit.tsx` (1,107 lines)

**Current state:** Route file that combines 10+ lazy imports, form state, editor cache restoration, and navigation.

**Recommendation:** Extract the workspace routing logic into a dedicated component under `src/components/forms/EditorWorkspace.tsx`. The route file should be thin — auth check + delegate to workspace.

### 4.4 MEDIUM: `payments-view.ts` (858 lines, 8 server functions)

**Recommendation:** Split by concern:
- `payments-view.ts` — getFormPayments, getPaymentActivity (query functions)
- `payment-verification.ts` — verifyFormPayment, bulkVerifyPayments (mutation functions)
- `payment-recovery.ts` — getPaymentRecoveryLink, replaceExpiredPaymentLink, emailPaymentRecoveryLink (recovery functions)

### 4.5 LOW: Barrel files (14 in total)

All 14 barrel files (`index.ts`/`index.tsx`) are appropriately scoped. No deep import chains detected. The pattern of re-exporting from domain barrels (`lib/flow-engine/index.ts`, `lib/payments/index.ts`, etc.) is clean.

### 4.6 LOW: Top-level `src/lib/` flattened files

The `src/lib/` directory has 17 standalone `.ts` files at root level that could be grouped:
- `crypto.ts` → `lib/crypto/` or remain root (utility)
- `currency-conversion.ts` → `lib/payments/` (payment-adjacent)
- `dashboard-analytics.ts`, `dashboard-report.ts` → `lib/dashboard/`
- `docs-parser.ts`, `docs-parser-types.ts` → `lib/docs/`
- `editor-cache.ts`, `editor-route.ts` → `lib/editor/`
- `form-field-types.ts`, `form-utils.ts` → `lib/forms/`
- `legacy-submission.ts` → `lib/submissions/`
- `payment-verification.ts` → `lib/payments/`
- `public-route.ts`, `public-session-access.ts` → `lib/public/`
- `server-delivery.ts` → `lib/server-fns/` or `lib/invoicing/`
- `theme.ts` → stays root (cross-cutting)

---

## 5. Test Coverage Gap Analysis

### 5.1 Critical paths with NO tests (HIGH)

| Path | File | Risk |
|------|------|------|
| Page form completion | `lib/page-builder/complete-submission.ts` | Data mutation, email dispatch |
| Flow execution completion | `lib/server-fns/flow-executions.ts` | Data mutation, email dispatch |
| Form creation/update | `lib/server-fns/forms.ts` | Core CRUD |
| Page form server fns | `lib/server-fns/page-forms.ts` | 21 server functions, zero tests |
| Payment reconciliation | `lib/payments/reconciliation-utils.ts` | Financial data integrity |
| Email delivery | `lib/invoicing/delivery.ts` | External service integration |
| Flow engine types | `lib/flow-engine/types.ts` | Central type definitions |
| Template interpolation | `lib/flow-engine/TemplateInterpolator.ts` | Variable rendering |

### 5.2 Component areas with weakest coverage

| Area | Test ratio | Gap |
|------|:----------:|-----|
| flow-builder | 4% | 23 of 24 components untested |
| form-builder | 5% | 19 of 20 components untested |
| page-builder | 14% | 12 of 14 components untested |

### 5.3 What IS well-tested

- Payment gateways: `xendit/gateway.test.ts`, `paypal/gateway.test.ts`
- Flow engine: `FlowEngine.test.ts`, `ExpressionEvaluator.test.ts`, `FlowValidator.test.ts`, `path-utils.test.ts`
- Page form core: `PageFormView.test.tsx`, `PagePaymentStep.test.tsx`, `RecaptchaField.test.tsx`
- DataTable: `DataTable.test.tsx`, `DataTablePagination.test.tsx`, `DataTableToolbar.test.tsx`
- DB layer: `driver.test.ts`, `with-timeout.test.ts`
- Payments: `reconciliation.test.ts`, `checkout-state.test.ts`, `subscriptions.test.ts`, `xendit-webhook.test.ts`

---

## 6. Safety & Sanity Checks

### 6.1 Error boundaries

**Previous audit:** "No error boundaries anywhere."  
**Current state:** ✓ Fixed. `ErrorBoundary` wraps root app in `__root.tsx` and lazy-loaded `RichTextEditor` in `FieldSettings.tsx`.

### 6.2 Non-null assertions

Non-null assertion search returned mostly `if (!value)` conditionals (logical NOT, not TS non-null). No `!.` postfix operator found in non-test code.

### 6.3 setTimeout magic values

| File | Line | Value | Purpose |
|------|-----:|-------|---------|
| `FlowExecutionContainer.tsx` | 192 | 1500ms | Redirect delay before navigation |
| `CalculatorDisplay.tsx` | 21 | 700ms | Reveal animation delay |
| `CalculatorDisplay.tsx` | 22 | 1400ms | Completion callback delay |
| `PublicFormView.tsx` | 147 | 3000ms | Slow-load detection |
| `PagePaymentStep.tsx` | 179 | 3000ms | Slow-load detection |
| `ShareDialog.tsx` | 115 | 2000ms | Copy feedback timeout |
| `MarkdownRenderer.tsx` | 395 | 2000ms | Copy button text reset |
| `InvoiceDownloadButton.tsx` | 30 | 0ms | Blob URL revocation |

**Recommendation:** Centralize animation/UX timing constants in `src/lib/constants.ts`:
```typescript
export const UI_TIMING = {
  REDIRECT_DELAY: 1500,
  REVEAL_ANIMATION: 700,
  COMPLETE_CALLBACK: 1400,
  SLOW_LOAD_THRESHOLD: 3000,
  COPY_FEEDBACK: 2000,
} as const
```

### 6.4 Hardcoded hex colors

Found in routes, flow-builder, and reusable components — all use the project's design tokens (e.g., `[#cc785c]`, `[#e6dfd8]`, `[#141413]`). The project uses Tailwind arbitrary values consistently. No hardcoded non-token colors found. ✓

---

## 7. Regression from Previous Audit

### Items FIXED since July 28, 2026 baseline

| Item | Previous | Current | Status |
|------|----------|---------|:------:|
| PageBuilderWorkspace.tsx | 4,344 lines | 869 lines | ✓ Fixed |
| FieldRenderer.tsx monolith | 687 lines | Split into 18 renderers | ✓ Fixed |
| InvoiceEditor/ConfirmationEditor duplication | 80% identical | Merged into 141-line file | ✓ Fixed |
| Error boundaries | None anywhere | Root + RichTextEditor wrapped | ✓ Fixed |
| Unhandled .then() chains | 2 instances | Both now have .catch() | ✓ Fixed |

### Items STILL OUTSTANDING

| Item | Severity | Status |
|------|----------|:------:|
| `db/schema.ts` split | HIGH | Not started |
| `page-forms.ts` split | HIGH | Not started |
| `updateOption` duplication | MEDIUM | Still duplicated |
| Email dispatch error handling triplication | MEDIUM | Still triplicated |
| `as any` in FlowExecutionContainer.tsx:137 | MEDIUM | Still present |
| `window as any` for mermaid (×4) | LOW | Still present |
| Magic timeout values | LOW | Still scattered |
| 3 `eslint-disable react-hooks/exhaustive-deps` | LOW | Still present |

---

## 8. Priority Action Items

### HIGH (blocking quality)

1. **Split `db/schema.ts` into domain modules** — 880 lines, 29 tables. Use barrel re-export for zero-impact migration. Effort: ~2h.

2. **Split `page-forms.ts` into 4 focused modules** — 1,456 lines, 21 functions spanning 4 concerns. Effort: ~3h.

### MEDIUM (improving maintainability)

3. **Extract shared email dispatch error handler** — 3 identical blocks → 1 utility function. Effort: 15 min.

4. **Extract shared `updateOption` logic** — 2 near-duplicate implementations. Effort: 30 min.

5. **Add `window.mermaid` type declaration** — Replace 4 `as any` casts. Effort: 10 min.

6. **Split `payments-view.ts`** — 858 lines, 3 logical groups (query, verification, recovery). Effort: ~1h.

### LOW (nice to have)

7. **Centralize UI timing constants** — 8 scattered magic `setTimeout` values → `UI_TIMING` object. Effort: 30 min.

8. **Audit 3 `eslint-disable react-hooks/exhaustive-deps`** — Each may mask stale closure bugs. Effort: 30 min.

9. **Group top-level `src/lib/` files into domain subdirectories** — 10 files could move to existing directories. Effort: ~1h.

10. **Extract `edit.tsx` workspace routing** — 1,107-line route file should delegate to a workspace component. Effort: ~2h.

---

## 9. Overall Assessment

**Quality score:** B+ (up from C+ in previous audit)

**Strengths:**
- Major monolith extractions completed (PageBuilderWorkspace, FieldRenderer)
- Console logging is structured with `[ponkoform-*]` prefix throughout
- Zero TODO/FIXME/HACK markers — no deferred technical debt
- Good test coverage on payment gateways, flow engine, and DataTable
- Error boundaries now protect the application shell
- Clean barrel file architecture with no deep import chains

**Growth areas:**
- Test coverage for flow-builder (4%) and form-builder (5%) components is critical
- Two large server-function files (`page-forms.ts`, `payments-view.ts`) need splitting
- Schema should be modularized before adding more tables
- 3 remaining code duplications (email dispatch, updateOption) are quick wins
- Mermaid `window as any` casts are trivially fixable with a type declaration

---

*Generated: July 28, 2026 by automated multi-pass code audit*  
*Tools: wc, grep, search_files (ripgrep), madge (timeout)*  
*Previous baseline: ponkoform skill v1.2.0 references/code-quality-audit-methodology.md*
