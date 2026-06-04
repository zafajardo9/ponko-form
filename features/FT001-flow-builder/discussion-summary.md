# FT001 Flow Builder — Discussion Summary

> **Feature:** Flow Builder — Visual workflow engine for PonkoForm
> **Directory:** `features/FT001-flow-builder/`

---

## Pre-Planning Phase

### Context

The Flow Builder originated from a user request for conditional/cascading fields in forms. During exploration, the scope expanded significantly from "show/hide fields based on dropdown selection" to a full **visual workflow engine** with:

- Node-based flow composition (React Flow canvas)
- Typed variable system shared across nodes
- Calculator nodes with safe expression evaluation
- Decision nodes for conditional branching
- Payment nodes integrated with existing gateway architecture
- Summary/Redirect nodes for post-completion handling

### Key Discovery

The existing PonkoForm codebase already had:
- All basic field types (text, email, number, textarea, select, checkbox, radio, payment)
- A drag-and-drop form builder (FieldPalette → FormBuilder → FieldEditor)
- Form submission pipeline with validation
- Payment gateway architecture (PayPal, Xendit)

This meant the Flow Builder could **wrap around** the existing field system rather than replacing it — FormField nodes reuse the existing `FieldRenderer` component, and Payment nodes reuse the existing gateway infrastructure.

---

## Plan Phase

### Implementation Approach Decisions

| Decision | Chosen Approach | Alternatives Considered |
|---|---|---|
| **Canvas library** | **React Flow** (`@xyflow/react`) | Built-from-scratch (too much effort), Retool-like grid (not flexible enough for branching) |
| **Expression evaluator** | **math.js** with sandboxed scope | `eval()` / `new Function()` (rejected for security, REQ-5.2), custom parser (unnecessary when math.js exists) |
| **Execution engine** | **Client-side** `FlowEngine` class with server-side persistence | Pure server-side execution (too latent for step-by-step UX), pure client-side (loses state on refresh) |
| **Backward compat** | **Detection-based** — check if flow exists; if not, render legacy form | Forced migration (breaks existing forms), dual-render (unnecessary complexity) |
| **Node config forms** | **Per-type components** (FormFieldConfig, DecisionConfig, etc.) | Single generic config form (too complex, poor UX), JSON editor (not creator-friendly) |

### Sequencing Rationale

1. **Schema first** (Phase 1) — because everything persists to the database
2. **Engine next** (Phase 2) — pure logic, testable without UI, foundational for validation and preview
3. **Server functions** (Phase 3) — bridge between DB and frontend, can be built once schema is stable
4. **Canvas & nodes** (Phase 4) + **Config & variables** (Phase 5) — independent UI work, buildable in parallel
5. **Toolbar & preview** (Phase 6) — depends on both UI (canvas exists) and engine (validator + engine exist)
6. **End-user execution** (Phase 7) — depends on engine + UI patterns + payment infrastructure
7. **Backward compat** (Phase 8) — can be late since it doesn't affect new flow development
8. **Completion pages** (Phase 9) — last UX piece
9. **Documentation** (Phase 10) — iterative throughout, finalized at end

### Pivots During Planning

- **Original scope:** Conditional show/hide on Dropdown/Radio fields → **Evolved to:** Full visual workflow engine with 7 node types
- **Data model approach:** Initially considered adding conditions to existing `formFields.options` → **Changed to:** New 5-table schema for flows, nodes, edges, variables, executions
- **Execution model:** Initially server-side only → **Changed to:** Hybrid client-side engine with server persistence (better UX for step-by-step flows)

### Key Decisions Log

| # | Decision | Rationale | Date |
|---|---|---|---|
| KD-1 | Use React Flow for node canvas | Mature library, handles zoom/pan/edges/drag out of the box | 2026-06-02 |
| KD-2 | Use math.js for expression evaluation | Safe sandboxed evaluation, built-in math functions, variable substitution | 2026-06-02 |
| KD-3 | 5-table schema for flow data | Proper relational model with cascade deletes, indexes, and JSONB for flexible config | 2026-06-02 |
| KD-4 | Client-side FlowEngine + server persistence | Best UX for step-by-step execution while storing progress for resume/reliability | 2026-06-02 |
| KD-5 | Detection-based backward compatibility | Zero disruption for existing forms — they continue as-is until creator opts in | 2026-06-02 |
| KD-6 | `{{variable}}` syntax for expressions/templates | Familiar to users (similar to Handlebars/Mustache), easy to parse with regex | 2026-06-02 |

### Technical Context

**Referenced files from existing codebase:**
- `src/db/schema.ts` — Existing schema patterns (serial PKs, JSONB enums, indexes)
- `src/lib/server-fns/forms.ts` — Server function pattern (createServerFn, requireAuth, ensureProfile)
- `src/components/form-builder/FieldPalette.tsx` — Palette component pattern
- `src/components/form-builder/FieldEditor.tsx` — Config panel pattern (save-on-blur, layout)
- `src/components/form-builder/fields/FieldRenderer.tsx` — Field rendering pattern
- `src/routes/forms/$formId/edit.tsx` — Builder route pattern
- `src/routes/forms/submit/$formId.tsx` — Submission route pattern

**New files created in this feature:**
- `features/FT001-flow-builder/vision.md`
- `features/FT001-flow-builder/requirements.md`
- `features/FT001-flow-builder/spec.md`
- `features/FT001-flow-builder/plan.md`
- `features/FT001-flow-builder/discussion-summary.md`

## Open Questions

1. **Expression syntax — should we support multi-line expressions?** For complex calculators (e.g., tiered pricing with multiple if/else conditions), a multi-line approach would be more powerful but harder to build. Current plan: single-line expressions with `if()` function. Multi-line can be added later.

2. **Variable scoping — should variables be globally accessible across all flows?** Current plan: variables are scoped per flow. Cross-flow sharing could be a future enhancement.

3. **Flow versioning — should we support versioning published flows?** For now, flows are edited and published in-place. Versioning (draft/published versions) could be added as a later phase.
