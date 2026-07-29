# Flow Builder — Deep Dive

> Part of [`memory-ponko/`](README.md) — System Memory
> **Verified against:** `main` at `7d2cbe3` on 2026-07-28.

---

## 1. What Is the Flow Builder?

The Flow Builder stores a **visual workflow graph** for forms that need step-by-step input, branching, calculation, payment, and redirect behavior. Creators can edit the primary path as a sortable list or edit the full graph on a canvas.

A form with a `flows` row uses the flow runtime. A form without a flow uses the Page Builder runtime; legacy `form_fields` data is retained for backward compatibility.

---

## 2. Node Types

| Node | Shape | Color | Purpose | Visible to Respondent? |
|---|---|---|---|---|
| **Start** | Circle | Green | Entry point — exactly one per flow | No |
| **Form Field** | Rectangle | Blue | Collects input (text, email, select, checkbox, date, time, datetime, etc.) | Yes |
| **Field Group** | Rectangle | Purple | Shows multiple fields on one step | Yes |
| **Decision** | Diamond | Amber | Branches based on a variable's value | Yes (radio buttons) |
| **Calculator** | Rectangle | Purple | Evaluates a math expression automatically | No (auto-advances) |
| **Payment** | Rectangle | Green | Shows amount + gateway payment button | Yes |
| **Summary** | Rectangle | Gray | Shows final receipt — terminal node | Yes |
| **Redirect** | Rectangle | Gray | Sends user to an external URL — terminal node | Briefly |

### Node Constraints

| Node | Incoming Edges | Outgoing Edges |
|---|---|---|
| Start | 0 | Exactly 1 |
| Form Field | Reachable from Start | Exactly 1 |
| Field Group | Reachable from Start | Exactly 1 |
| Decision | Reachable from Start | At least one connection per configured branch |
| Calculator | Reachable from Start | Exactly 1 |
| Payment | Reachable from Start | 1 (success) or 2 (success + failure) |
| Summary | Reachable from Start | 0 (terminal) |
| Redirect | Reachable from Start | 0 (terminal) |

The current validator enforces reachability and outgoing-edge counts; it does not independently enforce a numeric incoming-edge minimum.

---

## 3. Variables System

Variables are the **typed data backbone** of every flow. They are declared in the Variables Manager and accessed by nodes.

### Variable Types

| Type | Stored As | Display Format | Calculator Target |
|---|---|---|---|
| `string` | Text | Raw text | No |
| `number` | Number | Locale-formatted (e.g., `1,200`) | Yes |
| `boolean` | `true`/`false` | `true` / `false` | No |
| `money` | Major-unit number during execution | `1200` → `₱1,200.00` | Yes (auto-rounded to 2 decimals) |
| `date` | ISO string (`YYYY-MM-DD`) | Locale-formatted (e.g., `Jan 15, 2026`) | No |
| `time` | ISO string (`HH:mm`) | Locale-formatted (e.g., `2:30 PM`) | No |
| `datetime` | ISO string (`YYYY-MM-DDTHH:mm`) | Locale-formatted (e.g., `Jan 15, 2026, 2:30 PM`) | No |

### Variable Lifecycle

1. **Declaration** — Creator declares a variable (name, type, optional default)
2. **Binding** — Form Field stores respondent input via `bindToVariable`
3. **Transformation** — Calculator reads variables, writes result to target
4. **Reading** — Decision checks variable values; Payment/Summary display them
5. **Persistence** — On completion, all variables saved into `formSubmissions.formData`

### Safety

A variable **cannot be deleted** while any node references it. The UI shows "Used by N nodes" and disables delete. References are checked across all config fields: `bindToVariable`, `sourceVariable`, `targetVariable`, `amountVariable`, and inside `expression`, `template`, and `urlTemplate` strings.

---

## 4. Expression Engine

Calculator expressions use the tokenizer, parser, and AST evaluator in `safe-expression.ts`. The grammar cannot express property access, assignment, constructors, or global-object access, and it never executes JavaScript through `eval` or `Function`.

### Syntax

```
VARIABLE_REF  = '{{' IDENTIFIER '}}'
IDENTIFIER    = [a-zA-Z_][a-zA-Z0-9_]*  (must match a declared variable)

Operators:  +  -  *  /  %  ^  **  >  >=  <  <=  ==  !=  &&  ||  and  or  !  not
Ternary:    condition ? value_if_true : value_if_false
```

### Built-in Functions

| Function | Purpose | Example |
|---|---|---|
| `if(condition, yes, no)` | Conditional value | `if({{qty}} > 10, 50, 100)` |
| `contains(value, expected)` | String substring or array membership | `contains({{services}}, "design")` |
| `round(x, decimals?)` | Round a number | `round({{total}}, 2)` |
| `sum(a, b, ...)` | Sum values | `sum({{price1}}, {{price2}}, ...)` |
| `min(a, b, ...)` | Minimum | `min({{a}}, {{b}})` |
| `max(a, b, ...)` | Maximum | `max({{a}}, {{b}})` |
| `abs(x)` | Absolute | `abs({{difference}})` |
| `equalText(a, b)` | **String** comparison | `equalText({{plan}}, "full")` |

`==` and `!=` intentionally do not compare strings. Use `equalText()` for text equality, `contains()` for membership/substring checks, or a Decision node for routing.

Safety limits are 10,000 source characters, 1,000 tokens, parse depth 100, and 500 AST nodes. A calculator must produce a finite number.

### Common Expression Patterns

| What You Want | Expression | Inputs | Target |
|---|---|---|---|
| Add VAT (12%) | `{{subtotal}} * 0.12` | `subtotal` | `vat_amount` |
| Total with VAT | `{{subtotal}} * 1.12` | `subtotal` | `total_cost` |
| Monthly installment | `round({{total}} / 6, 2)` | `total` | `monthly` |
| Apply discount | `{{price}} * 0.9` | `price` | `discounted` |
| Quantity × price | `{{qty}} * {{unit_price}}` | `qty`, `unit_price` | `line_total` |
| Tiered pricing | `{{qty}} > 10 ? 50 : 100` | `qty` | `unit_price` |
| Minimum charge | `{{computed}} < 500 ? 500 : {{computed}}` | `computed` | `final_amount` |

---

## 5. Decision & Branching

Decision nodes route the flow based on a variable's value. Each outgoing edge carries a `matchValue` in its `metadata`:

```
Decision (sourceVariable: "payment_plan")
  ├── edge (matchValue: "full") → Calculator: Full Total
  └── edge (matchValue: "installment") → Calculator: Monthly
```

**Runtime behavior:**
1. Engine reads the source variable
2. Finds the outgoing edge whose `matchValue` matches
3. Follows that edge to the next node
4. If no match found, follows the **first edge** as default

**Converging paths:** Both branch endpoints should connect to the same downstream node (e.g., both "Full" and "Installment" calculators lead to the same "Pay Now" payment node).

---

## 6. Payment Integration

Payment nodes display an amount and let the respondent choose among compatible connected gateways. Published forms run **real checkout** with registered PayPal/Xendit implementations and encrypted per-owner credentials. The normalized `integrations` table is primary, with `integration_settings` as a legacy fallback. **Preview** mode simulates payments client-side.

### Payment Node Config

```json
{
  "amountVariable": "total_cost",
  "currency": "PHP",
  "gatewayId": null
}
```

`gatewayId` is retained in the config shape for compatibility, but current checkout resolves the respondent's choice from the owner's connected gateways and currency support.

### Success/Failure Paths

The Payment node supports two outgoing edges:
1. First edge = **success path** (leads to Summary)
2. Second edge = **failure path** (optional, leads to error message)

### Real Payment Flow (Production)

For published forms, the runtime uses a **redirect → verify → resume** architecture:

1. The Payment step calls `src/lib/server-fns/payments.ts`, converts the major-unit flow amount to integer minor units, creates a gateway checkout, and persists a `payments` row linked to the current execution. A draft `form_submissions` row may already exist so payment and later completion share one response record.
2. The respondent is redirected to the gateway's hosted checkout.
3. The gateway redirects back to `src/routes/forms/payment-return.tsx`, which verifies the payment server-side.
4. On success, `FlowEngine.restore` rehydrates the execution from `flow_executions` and resumes at the next node; the `payments` row's `form_submission_id` is backfilled at completion.

### Simulated Payments (Preview)

During Preview, the creator can click "Simulate success" or "Simulate failure" to test both paths without real charges.

---

## 7. Runtime Engine (`FlowEngine.ts`)

`FlowEngine` is the deterministic in-memory graph runner used by preview and the respondent UI. Production progress is persisted through server functions in `flow-executions.ts`; the class itself is not a server-only engine.

### Key Methods

| Method | Purpose |
|---|---|
| `getCurrentStep()` | Returns the current `FlowStep` with rendering info |
| `advance(input?)` | Move to the next node, optionally with user input |
| `goBack()` | Return to the previous node (preview only) |
| `getCurrentStepNumber()` | Returns the 1-based step number |
| `getTotalSteps()` | Returns the total number of steps in the path |
| `getVariableValues()` | Returns all current variable values |
| `getSnapshot()` | Returns the full execution context (for persistence) |
| `isComplete()` | Whether the flow has reached a terminal node |
| `FlowEngine.restore(...)` | **Static.** Rehydrates an execution from persisted state (e.g. after a payment redirect) and resumes at the saved node |

### FlowStep Shape

```tsx
interface FlowStep {
  nodeId: number
  nodeType: string
  config: Record<string, unknown>
  label: string
  expectsInput: boolean      // FormField, Decision
  isPayment: boolean
  isTerminal: boolean        // Summary, Redirect
  renderedOutput?: string    // For Summary nodes
  redirectUrl?: string       // For Redirect nodes
}
```

### Execution Algorithm

```
advance(input?):
  1. Record current node in history
  2. If FormField → store input value in bound variable
  3. If Decision → follow the matching edge
  4. If Calculator → evaluate expression, store result in target variable
  5. If Payment → record payment result (simulated)
  6. If Summary/Redirect → mark as terminal
  7. Follow the outgoing edge to the next node
  8. If next node is Calculator → auto-advance (loop until user-facing node)
```

---

## 8. Validation (`FlowValidator.ts`)

The `FlowValidator` checks a flow graph for correctness:

| Rule | Error Message |
|---|---|
| A Start node must exist | `Flow must have exactly one Start node.` |
| Every non-Start node must be reachable from Start | Node-specific `is not reachable from Start` error |
| Graph must be acyclic | `Flow contains a cycle...` |
| Node configuration must be present | Node-specific field/config errors |
| Referenced flow variables must be declared | Node-specific undeclared-variable errors |
| Outgoing edge count must fit the node type | Node-specific connection error |

Summary and Redirect nodes are terminal and must have no outgoing edge. The validator does not emit a separate “no terminal node” rule; an acyclic reachable graph with valid outgoing counts necessarily ends at a terminal node.

---

## 9. Path Utilities (`path-utils.ts`)

| Function | Purpose |
|---|---|
| `linearizePrimaryPath(nodes, edges)` | BFS from Start node → returns ordered node IDs along the main path + off-path IDs |
| `isPureLinear(nodes, edges)` | Whether the flow has no Decision nodes (fully linear) |
| `findBranchNodes(nodes, edges)` | Returns nodes that are reachable only through a specific Decision branch |

---

## 10. UI Architecture (Editor)

The unified form editor at `/forms/:formId/edit` shows either the Page Builder or the flow editor. Flow mode has two views:

### Canvas View (React Flow)

- **Left:** `FlowPalette` — draggable node type list
- **Center:** `FlowCanvas` — React Flow canvas with custom node renderers (in `nodes/index.tsx` + `nodes/NodeShell.tsx`), minimap, zoom controls
- **Right:** `NodeConfigPanel` — type-specific config form for the selected node, delegates to `config-forms/{Type}Config.tsx` components. Shared form controls in `config-forms/controls.tsx`

The config-forms directory contains one file per node type:
- `FormFieldConfig.tsx` — text, email, number, select, checkbox, radio fields
- `GroupConfig.tsx` — group title + `GroupFieldsEditor.tsx` for inline fields
- `DecisionConfig.tsx` — source variable + branch options + `OptionsEditor.tsx`
- `CalculatorConfig.tsx` — expression input with variable autocomplete
- `PaymentConfig.tsx` — amount variable and currency (`gatewayId` remains a compatibility field; respondent gateway choice is resolved at checkout)
- `SummaryConfig.tsx` — title + template with `{{var}}` interpolation
- `RedirectConfig.tsx` — URL template with `{{var}}` interpolation

Additional builder panels accessible from the toolbar:
- **`SettingsDialog.tsx`** — Form metadata and theme settings
- **`VariablesManager.tsx`** — Declare, edit, and delete flow variables
- **`VariableDialog.tsx`** — Add/edit single variable (name, type, default)

### List View (dnd-kit)

- **Left:** `BuilderPalette` — unified field + logic palette
- **Center:** `FlowListBuilder` — sortable vertical list of nodes along the primary path
- **Right:** Same config panel as canvas view

### Responsive Editor Layout

- Desktop (`lg+`) uses the dense three-column editor: `BuilderPalette` left, List/Canvas center, `NodeConfigPanel` or `VariablesManager` right.
- Mobile stacks the editor vertically. The palette becomes a compact top section, header actions and logic nodes use horizontal scrolling, and node config / variables render as full-width panels below the builder only when opened.
- Keep the desktop layout intact when changing mobile behavior. The responsive shell lives primarily in `src/routes/forms/$formId/edit.tsx`, with supporting mobile layout in `BuilderPalette.tsx` and `FlowToolbar.tsx`.

### Preview

- Opens a modal that runs the `FlowEngine` client-side
- Steps through nodes, lets the creator test field input, decisions, payments
- Shows a variable inspector panel

---

## 11. Seed Flows

Two seed scripts create sample flows for development:

### `scripts/seed-flow.ts` — Payment Plan

```
Start → [Choose Payment Plan] → [Plan? Decision]
                                    ├─ Full → [Full Total ×1.12] → [Pay Now] → [Confirmation]
                                    └─ Installment → [Monthly ÷6] ──┘
```

6 variables, 7 nodes, 7 edges.

### `scripts/seed-service-flow.ts` — Service Order

```
Start → [Name] → [Email] → [Phone] → [Address] → [Select Services]
  → [∑ Fees] → [∑ Deposits] → [∑ VAT] → [∑ w/ VAT] → [∑ Grand Total] → [Summary]
```

15 variables, 12 nodes, 11 edges, 17 services in catalog.

This older seed emits `SUM_FEES(...)` and `SUM_DEPOSITS(...)` expressions, but the current `FlowEngine` does not register those custom functions. Treat it as catalog/migration fixture data until the expressions are rewritten with supported `contains()`/`if()` terms or the runtime deliberately supplies scoped custom functions.

---

## 12. Docs

Two complementary documents in `docs/`:

| File | Audience | Content |
|---|---|---|
| `flow-builder-guide.md` | Developers & advanced creators | Complete technical reference — schema, types, engine, API, UI tree, validation |
| `flow-form-guide.md` | Form creators | Hands-on tutorial — building flows step by step, computation patterns, troubleshooting |

---

## 13. Key Source Files

| File | Lines (approx) | Why It Matters |
|---|---|---|
| `src/db/schema.ts` | ~880 | All database table definitions |
| `src/lib/flow-engine/types.ts` | ~150 | Flow-related TypeScript types |
| `src/lib/flow-engine/FlowEngine.ts` | ~350 | Core execution engine |
| `src/lib/flow-engine/FlowValidator.ts` | ~150 | Flow graph validation |
| `src/lib/flow-engine/ExpressionEvaluator.ts` | ~80 | Math expression evaluator |
| `src/lib/flow-engine/safe-expression.ts` | ~420 | Safe expression tokenizer, parser, limits, and evaluator |
| `src/lib/flow-engine/submission-draft.ts` | ~50 | Draft submission save/restore |
| `src/lib/flow-engine/server-data.ts` | ~40 | Server-side data helpers |
| `src/lib/flow-engine/TemplateInterpolator.ts` | ~60 | `{{var}}` template replacement |
| `src/lib/flow-engine/path-utils.ts` | ~100 | Graph traversal utilities |
| `src/lib/theme.ts` | ~117 | Per-form theming (FormTheme, themeVars, accent presets) |
| `src/lib/crypto.ts` | ~40 | AES-256-GCM encrypt/decrypt for integration secrets |
| `src/routes/forms/$formId/edit.tsx` | Unified page/flow editor route |
| `src/components/flow-builder/NodeConfigPanel.tsx` | ~500 | Right-side config panel |
| `src/components/flow-builder/FlowListBuilder.tsx` | ~400 | List view with sortable nodes |
| `src/components/flow-builder/FlowCanvas.tsx` | ~110 | React Flow canvas wrapper |
| `src/components/flow-builder/FlowCanvasWorkspace.tsx` | ~350 | Canvas workspace + preview |
| `src/components/flow-execution/` | ~600 | Runtime flow components for respondents |
| `src/components/flow-execution/GroupStepView.tsx` | ~80 | Group node field layout |
| `src/components/flow-builder/config-forms/` | Per-node-type config forms and shared `Controls.tsx` |
| `src/components/flow-builder/nodes/` | ~80 | Custom React Flow node renderers (2 files) |
