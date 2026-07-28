# 024 Code Quality & Hygiene — Post-Audit Cleanup

## 1. Goal

Eliminate all remaining code-quality issues discovered in the July 28 system audit — unhandled promise chains, non-null assertions, dead directories, naming inconsistencies, missing tests, and large-file debt. This is the cleanup complement to the 4 critical fixes already applied (error boundaries, FieldRenderer split, PageBuilderWorkspace partial split, cross-boundary imports).

## 2. Audit Context

**Completed (July 28):**
- ✅ Error Boundary added — wraps all `lazy()` components
- ✅ FieldRenderer split — 687 → 80 lines + 18 per-field renderers
- ✅ PageBuilderWorkspace partial split — 4,344 → 3,290 lines + `Shared.tsx` + `ExpressionBuilder.tsx`
- ✅ Cross-boundary import fixed — types extracted to `lib/form-field-types.ts`

**Current health:**
- Build: 484ms ✅
- TypeScript: 0 errors (excl. `smtp.test.ts`) ✅
- Tests: 292/297 (5 failures = broken `smtp.test.ts`)

---

## 3. Issues by Priority

### 🔴 HIGH — Risk of Silent Failures & Crashes (6 issues)

#### 3.1 `.then()` without `.catch()` — 4 sites

| # | File:Line | Risk |
|---|-----------|------|
| H1 | `src/components/flow-execution/FlowExecutionContainer.tsx:182` | `mutateAsync().then()` — mutation failure = flow silently hangs |
| H2 | `src/components/integrations/IntegrationModal.tsx:39` | `getGoogleAuthUrl().then()` — failure = user sees no feedback |
| H3 | `src/components/docs/MarkdownRenderer.tsx:48` | Dynamic import `.then()` — syntax highlighting silently missing |
| H4 | `src/components/page-form/RecaptchaField.tsx:69` | `.then(api => ...)` — recaptcha API load fails silently |

**Fix:** Add `.catch()` handler on each with structured `console.error` and appropriate fallback UX (show error state, disable button, etc.).

#### 3.2 Non-null assertions (`!`) — 7 sites

| # | File:Line | Risk |
|---|-----------|------|
| H5 | `src/components/ui/FlowPreviewModal.tsx:88-90,98` | 4× `engine!` — engine null = crash |
| H6 | `src/components/flow-builder/FlowListBuilder.tsx:426` | `moveTargets!.map()` — null reference = crash |
| H7 | `src/components/dashboard/TimeSeriesChart.tsx:97` | `points.at(-1)!` — empty array = crash |
| H8 | `src/components/integrations/IntegrationModal.tsx:65` | `cfg!.fields` — null config = crash |

**Fix:** Replace each `!` with a runtime guard (early return, conditional render, or explicit error throw).

#### 3.3 PageBuilderWorkspace.tsx — 3,290 lines

Status: `Shared.tsx` and `ExpressionBuilder.tsx` extracted. Remaining inline:
- `FieldSettings`, `OptionsDialog`/`OptionsEditor`, `LogicDialog`/`RulesDialog`
- `ComputationDialog`/`FormulaComposer`, `SatisfactionSettings`, `ReferencesPanel`
- `PageSettings`, `SortablePageTab`, `SortableFieldCard`

**Fix:** Resume extraction — these are 8 sub-components, each 100–400 lines. Expected final size: ~800 lines.

#### 3.4 Broken test — `smtp.test.ts`

`src/lib/email/smtp.test.ts` imports `smtpDeliveryError` and `smtpTransportSecurity` from `./smtp` — neither function exists. The file is untracked. Causes 5 test failures.

**Fix:** Either implement the missing functions in `smtp.ts` or remove the test file.

---

### 🟠 MEDIUM — Hygiene Debt (5 issues)

#### 3.5 Bare `console.error` — 3 sites

| # | File:Line | Current | Fix |
|---|-----------|---------|-----|
| M1 | `src/routes/dashboard/index.tsx:219` | `console.error(downloadError)` | Prefix: `[ponkoform]` |
| M2 | `src/utils/mcp-handler.ts:40` | `console.error('MCP handler error:', error)` | Prefix: `[ponkoform-mcp]` |
| M3 | `src/lib/page-builder/complete-submission.ts:149` | `console.error(...)` (already structured) → check for duplicate with `submissions.ts:88` | Merge or differentiate |

#### 3.6 Empty directories

| Directory | Action |
|-----------|--------|
| `src/db-collections/` | `rm -rf` |
| `src/lib/icon/` | `rm -rf` (actual icons live in `src/lib/icons/`) |

#### 3.7 Wrong test file extensions

| File | Fix |
|------|-----|
| `src/components/flow-builder/FlowCanvasWorkspace.test.ts` | Rename → `.test.tsx` |
| `src/components/flow-execution/InvoicePDF.test.ts` | Rename → `.test.tsx` |

#### 3.8 Lowercase component files

| File | Fix |
|------|-----|
| `src/components/docs/syntax-highlighter.ts` | Rename → `SyntaxHighlighter.ts` |
| `src/components/flow-builder/config-forms/controls.tsx` | Rename → `Controls.tsx` |
| `src/components/flow-execution/invoice.ts` | Rename → `InvoiceUtils.ts` |
| `src/components/integrations/providerForms.ts` | Rename → `ProviderForms.ts` |

Update all imports referencing these files.

#### 3.9 Server functions with zero test coverage — 14 files

```
src/lib/server-fns/dashboard.ts       src/lib/server-fns/docs.ts
src/lib/server-fns/email-surveys.ts   src/lib/server-fns/fields.ts
src/lib/server-fns/flow-executions.ts src/lib/server-fns/flow-helpers.ts
src/lib/server-fns/flow-nodes.ts      src/lib/server-fns/flow-variables.ts
src/lib/server-fns/flows.ts           src/lib/server-fns/forms.ts
src/lib/server-fns/gateways.ts        src/lib/server-fns/google-oauth.ts
src/lib/server-fns/integrations.ts    src/lib/server-fns/invoicing.ts
src/lib/server-fns/page-forms.ts      src/lib/server-fns/payments-view.ts
src/lib/server-fns/payments.ts        src/lib/server-fns/references.ts
src/lib/server-fns/submissions.ts
```

**Fix:** Add at minimum smoke tests for critical paths (form CRUD, payment initiation, submission query).

---

### 🟡 LOW — Quick Wins (7 issues)

| # | Issue | Fix |
|---|-------|-----|
| L1 | `@/` path alias defined in tsconfig but never used — 50+ files use `../../../` | Adopt `@/` in top 20 files |
| L2 | No barrel exports in `ui/`, `payments/`, `invoicing/`, `server-fns/` | Add `index.ts` |
| L3 | `src/lib/email-survey-html.ts` should live inside `src/lib/email/` | Move |
| L4 | `src/utils/AI-KNOWLEDGE-BANK.md` is reference docs, not code | Move to `docs/` |
| L5 | `src/mcp-todos.ts` is demo/stub code unrelated to PonkoForm | Delete |
| L6 | `db/init.sql` at project root — irrelevant todo schema | Delete |
| L7 | `src/lib/icon/` vs `src/lib/icons/` mismatch — singular is empty | Keep plural, delete singular |

---

## 4. Implementation Order

### Phase 1: Immediate Fixes (~30 min)
**Goal:** Eliminate crash risks and dead weight.

```
Step 1 — Fix .then() chains (H1–H4)
  ├── FlowExecutionContainer.tsx:182 — add .catch() with error state
  ├── IntegrationModal.tsx:39 — add .catch() with user-visible error
  ├── MarkdownRenderer.tsx:48 — add .catch() with fallback
  └── RecaptchaField.tsx:69 — add .catch() with disabled state

Step 2 — Fix non-null assertions (H5–H8)
  ├── FlowPreviewModal.tsx:88-98 — add engine null guard
  ├── FlowListBuilder.tsx:426 — add moveTargets null guard
  ├── TimeSeriesChart.tsx:97 — add empty array guard
  └── IntegrationModal.tsx:65 — add cfg null guard

Step 3 — Delete dead weight (L5, L6, L7, 3.6)
  ├── rm -rf src/db-collections/
  ├── rm -rf src/lib/icon/
  ├── rm src/mcp-todos.ts
  └── rm db/init.sql

Step 4 — Fix smtp.test.ts (3.4)
  └── Either implement smtpDeliveryError/smtpTransportSecurity or delete test
```

**Verification:** `pnpm run build && pnpm run test` must pass.

### Phase 2: Hygiene Cleanup (~1 hour)
**Goal:** Consistent naming, proper organization.

```
Step 5 — Rename files (3.7, 3.8)
  ├── FlowCanvasWorkspace.test.ts → .test.tsx
  ├── InvoicePDF.test.ts → .test.tsx
  ├── syntax-highlighter.ts → SyntaxHighlighter.ts
  ├── controls.tsx → Controls.tsx
  ├── invoice.ts → InvoiceUtils.ts
  └── providerForms.ts → ProviderForms.ts
  └── Update all imports in consuming files

Step 6 — Fix bare console.errors (3.5)
  ├── dashboard/index.tsx:219 — add prefix
  ├── mcp-handler.ts:40 — add prefix
  └── complete-submission.ts:149 — merge with submissions.ts:88 or differentiate

Step 7 — Relocate misplaced files (L3, L4)
  ├── mv lib/email-survey-html.ts → lib/email/email-survey-html.ts
  └── mv utils/AI-KNOWLEDGE-BANK.md → docs/AI-KNOWLEDGE-BANK.md
```

**Verification:** `pnpm run build && pnpm run test` after each rename.

### Phase 3: Structural Improvements (~4 hours)
**Goal:** Reduce large files, add coverage.

```
Step 8 — Resume PageBuilderWorkspace extraction (3.3)
  ├── Extract FieldSettings.tsx
  ├── Extract OptionsDialog.tsx (OptionsDialog + OptionsEditor)
  ├── Extract LogicDialog.tsx (LogicDialog + RulesDialog)
  ├── Extract ComputationDialog.tsx (ComputationDialog + FormulaComposer)
  ├── Extract SatisfactionSettings.tsx
  ├── Extract ReferencesPanel.tsx
  ├── Extract PageSettings.tsx
  ├── Extract SortableComponents.tsx (SortablePageTab + SortableFieldCard)
  └── Target: PageBuilderWorkspace ~800 lines

Step 9 — Add barrel exports (L2)
  ├── src/components/ui/index.ts
  ├── src/lib/payments/index.ts
  ├── src/lib/invoicing/index.ts
  └── src/lib/server-fns/index.ts

Step 10 — Add minimal tests (3.9)
  └── Focus on forms.ts, payments.ts, submissions.ts (highest traffic)
```

**Verification:** `pnpm run build && pnpm run test` after each extraction.

### Phase 4: Optional Polish (~3 hours)
**Goal:** Long-term maintainability.

```
Step 11 — Adopt @/ imports (L1)
  └── Convert top 20 most-imported files from ../../../ to @/

Step 12 — Split schema.ts (880 lines)
  └── schema/forms.ts, schema/payments.ts, schema/flows.ts, schema/index.ts
```

---

## 5. File Change Summary

| Phase | Files Created | Files Modified | Files Deleted |
|-------|---------------|----------------|---------------|
| 1 | 0 | ~8 | 4 |
| 2 | 0 | ~8 | 0 |
| 3 | ~10 | ~4 | 0 |
| 4 | ~3 | ~25 | 0 |
| **Total** | **~13** | **~45** | **4** |

---

## 6. Risks

- **PageBuilderWorkspace extraction** — risk of breaking the drag-and-drop behavior. Verify with `PageBuilderWorkspace.test.tsx` (5 tests) after each extraction.
- **smtp.test.ts** — if the functions are intentionally absent (not yet implemented), deleting the test is fine. If they were accidentally removed, re-implement.
- **File renames** — must update every import site. Use `grep -rl 'old-name' src/` to find all references before renaming.
- **@/ alias adoption** — must be done incrementally; changing all 50+ files at once risks merge conflicts with active feature work.

---

## 7. Verification Checklist

- [ ] `pnpm run build` — passes (<1s)
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `pnpm run test` — 292/292 pass (smtp fixed or removed)
- [ ] `git status` — clean, expected changes only
- [ ] No new `console.error` without structured prefix
- [ ] No remaining `!` non-null assertions in source code
- [ ] All renamed files import correctly
- [ ] Empty directories confirmed deleted
