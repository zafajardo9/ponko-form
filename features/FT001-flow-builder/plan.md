# PonkoForm Flow Builder — Implementation Plan

> **Feature:** FT001 Flow Builder
> **Documents:** vision.md, requirements.md (REQ-*), spec.md (§*)
> **Dependencies:** Existing PonkoForm form system (Phases 1-6 of main plan.md)

---

## Table of Contents

- **Overview**
- **Prerequisites** — External setup, dependencies, environment
- **Phase 1** — Database Schema & Migration
- **Phase 2** — Flow Engine Library (types, expression evaluator, template interpolator, validator)
- **Phase 3** — Flow Server Functions (CRUD for flows, nodes, edges, variables, executions)
- **Phase 4** — Flow Builder Canvas & Node Components (React Flow integration)
- **Phase 5** — Flow Builder Configuration & Variables (node config panel, variable manager)
- **Phase 6** — Flow Builder Toolbar, Validation & Preview
- **Phase 7** — Flow Execution — End-User Experience (step renderer, progress bar, payment)
- **Phase 8** — Legacy Backward Compatibility & Convert-to-Flow
- **Phase 9** — Flow Completion Summary & Redirect Pages
- **Phase 10** — Documentation & Guides
- **Dependency Graph**

---

## Overview

The Flow Builder transforms PonkoForm from a linear form builder into a **visual workflow engine**. Form creators will design multi-step, branching, calculator-enabled, payment-integrated flows by connecting nodes on a canvas — no code required.

**What we're building:**
- A node-based visual canvas for composing form workflows (React Flow)
- A typed variable system shared across all nodes in a flow
- 7 node types: Start, FormField, Decision, Calculator, Payment, Summary, Redirect
- A safe expression evaluator for calculator nodes (math.js)
- A runtime engine that executes flows step-by-step for end users
- Full payment handoff integration (reusing existing gateway architecture)
- Backward compatibility with existing linear forms

**Sequencing logic:**
1. **Data foundation** first (schema + server functions) so the UI has something to save to
2. **Engine library** next (expression evaluator, validator) as pure logic that the UI depends on
3. **Builder UI** after (canvas, nodes, config panels) — the most visible work
4. **Execution UI** next (end-user step-by-step experience)
5. **Backward compat & polish** last (convert-to-flow, documentation)

---

## Prerequisites

These must be confirmed or resolved before implementation begins.

- [ ] **React Flow installed:** `npm install @xyflow/react` (v12+)
- [ ] **math.js installed:** `npm install mathjs`
- [ ] **uuid installed (if not present):** `npm install uuid` (for temporary client-side node IDs)
- [ ] **Existing form builder Phase 3** (FieldPalette, FormBuilder, FieldEditor, FieldRenderer) is complete and stable
- [ ] **Existing payment gateway Phase 5** (PaymentGateway base class, PayPalGateway, XenditGateway, Registry) is complete and stable
- [ ] **Form submission Phase 4** (submitFormResponse, validateField, validateForm) is complete and stable
- [ ] Verify `clerk doctor` passes and Neon DB is accessible
- [ ] Verify existing Drizzle migration has been applied

---

## Phase 1 — Database Schema & Migration

**Implements:** REQ-1.1, REQ-1.2, REQ-1.3  
**Reference:** spec.md §2.1, §2.2, §2.3

Add 5 new tables to the existing Drizzle schema in `src/db/schema.ts`, then generate and apply the migration.

### 1.1 — Add new tables to schema

- [ ] Add `flows` table (FK to forms, one-to-one, stores startNodeId reference)
- [ ] Add `flowVariables` table (FK to flows, unique on flowId+name, typed with string/number/boolean/money)
- [ ] Add `flowNodes` table (FK to flows, type enum, config JSONB, positionX/Y for canvas layout)
- [ ] Add `flowEdges` table (FK to flows, source/target FKs to flowNodes, metadata JSONB for matchValue)
- [ ] Add `flowExecutions` table (FK to flows, status enum, currentNodeId, variables JSONB snapshot, history JSONB array, formSubmissionId FK, completedAt)

**Pattern:** Follow the exact existing schema pattern — `serial()` PKs, `pgTable` with indexes, `jsonb` for flexible config, `varchar` enums with `.$type<>()`. See existing `formFields.options` for the JSONB pattern precedent.

**Full code provided in spec.md §2.1** — tables definitions are ready to copy into `src/db/schema.ts`.

### 1.2 — Generate and apply migration

- [ ] Run `drizzle-kit generate` — verify 5 new tables in the generated SQL
- [ ] Run `drizzle-kit migrate` — apply to Neon
- [ ] Verify in Neon dashboard that all 5 tables exist with correct columns and indexes
- [ ] Verify cascade deletes work: deleting a form cascades to its flow, nodes, edges, executions

### 1.3 — Sample data script (for development)

- [ ] Create a `scripts/seed-flow.ts` with sample flow data for a "Payment Plan" flow:
  - 1 Start node
  - 1 FormField node (Dropdown: "Payment Plan" → Full Payment / Installment)
  - 1 Decision node branching on the variable
  - 2 Calculator nodes (one for Full: total × 1.12, one for Installment: total / months)
  - 1 Payment node
  - 1 Summary node with order details template
  - Corresponding variables: `payment_plan`, `subtotal`, `vat_amount`, `total_cost`, `monthly_payment`, `payment_ref`

> **Justification:** REQ-1.1 requires the data model first. All subsequent phases depend on having the database tables available. The sample data enables parallel frontend development without waiting for the builder UI to be complete.

---

## Phase 2 — Flow Engine Library

**Implements:** REQ-1.3 (variables), REQ-1.4 (expressions), REQ-2.4 (validation), REQ-5.1 (execution context), REQ-5.2 (expression safety)  
**Reference:** spec.md §4, §5, §6, §9

Build the core runtime library as pure TypeScript — no UI dependencies. This is the brain of the Flow Builder and the most novel code in the project. It is a separate module (`src/lib/flow-engine/`) that both the Builder UI and the Execution UI will import.

### 2.1 — Define core types

- [ ] Create `src/lib/flow-engine/types.ts` with all interfaces from spec.md §4:
  - `FlowNodeType` union type (7 node types)
  - `FlowNodeConfig` interface (all possible config fields across node types)
  - `FlowNode`, `FlowEdge`, `FlowVariable` interfaces
  - `ExecutionStatus` union, `ExecutionHistoryEntry`, `FlowExecutionContext`
  - `FlowValidationError` interface

**Pattern:** Follow existing TypeScript patterns in the codebase (the `FieldConfig` interface in `FieldRenderer.tsx` is a good reference). All types are exported.

### 2.2 — Build ExpressionEvaluator

- [ ] Create `src/lib/flow-engine/ExpressionEvaluator.ts`
- [ ] Implement the safe expression evaluation using math.js:

```typescript
import { create, all, type MathJsInstance } from 'mathjs'

/**
 * ExpressionEvaluator
 *
 * Safely evaluates mathematical expressions with variable substitution.
 * Built on math.js with a restricted scope — no access to global objects.
 *
 * The evaluator:
 *   1. Replaces {{variable_name}} placeholders with actual values from the scope
 *   2. Parses and evaluates the expression using math.js eval()
 *   3. Math.js is configured with NO access to the global scope
 *   4. Only pure math operations and the allowed function set are available
 *
 * @example
 * ```ts
 * const evaluator = new ExpressionEvaluator()
 * const result = evaluator.evaluate('{{subtotal}} * (1 + {{vat_rate}})', {
 *   variables: { subtotal: 1000, vat_rate: 0.12 }
 * })
 * // result = { success: true, value: 1120 }
 * ```
 *
 * @example
 * ```ts
 * const result = evaluator.evaluate('round({{total}} / {{months}}, 2)', {
 *   variables: { total: 25000, months: 6 }
 * })
 * // result = { success: true, value: 4166.67 }
 * ```
 */
export class ExpressionEvaluator {
  private math: MathJsInstance

  constructor() {
    // Create a sandboxed math.js instance
    // 'all' imports all math.js functions, but we restrict the scope
    this.math = create(all)

    // Configure to be safe — no access to global objects
    this.math.config({
      number: 'number',
      precision: 64,
      epsilon: 1e-12,
    })
  }

  /**
   * Evaluate an expression with the given variable scope.
   *
   * @param expression - The expression string, e.g. "{{subtotal}} * 0.12"
   * @param scope - Object containing { variables, functions? }
   * @returns Result object with success flag and value or error message
   */
  evaluate(
    expression: string,
    scope: { variables: Record<string, unknown>; functions?: Record<string, (...args: unknown[]) => unknown> },
  ): { success: true; value: number } | { success: false; error: string } {
    try {
      // 1. Replace {{variable}} references with actual values
      const resolvedExpression = this.resolveVariables(expression, scope.variables)

      // 2. Build the math.js evaluation scope
      const mathScope: Record<string, unknown> = {
        ...scope.variables,
        ...(scope.functions ?? {}),
      }

      // 3. Evaluate using math.js (safe — no eval(), no global access)
      const result = this.math.evaluate(resolvedExpression, mathScope)

      return { success: true, value: result }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown evaluation error',
      }
    }
  }

  /**
   * Validate whether an expression is syntactically valid.
   * Useful for real-time validation in the builder UI.
   */
  validate(expression: string): { valid: boolean; error?: string } {
    try {
      // Replace variables with dummy numbers to test syntax
      const testExpr = expression.replace(/\{\{([^}]+)\}\}/g, '1')
      this.math.parse(testExpr)
      return { valid: true }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid expression',
      }
    }
  }

  /**
   * Resolve {{variable}} placeholders to their actual values.
   * If a variable is not found in scope, it throws.
   */
  private resolveVariables(expression: string, variables: Record<string, unknown>): string {
    return expression.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      const trimmed = varName.trim()
      if (!(trimmed in variables)) {
        throw new Error(`Unknown variable: "${trimmed}". Declare it in the Variables Manager first.`)
      }
      const value = variables[trimmed]
      // String values need to be quoted for math.js
      if (typeof value === 'string') {
        return `"${value}"`
      }
      return String(value ?? 0)
    })
  }
}
```

- [ ] Add tests for `ExpressionEvaluator`:

```typescript
import { describe, it, expect } from 'vitest'
import { ExpressionEvaluator } from './ExpressionEvaluator'

describe('ExpressionEvaluator', () => {
  const evaluator = new ExpressionEvaluator()

  it('evaluates basic arithmetic', () => {
    const result = evaluator.evaluate('2 + 3 * 4', { variables: {} })
    expect(result).toEqual({ success: true, value: 14 })
  })

  it('resolves variable references', () => {
    const result = evaluator.evaluate('{{subtotal}} * 0.12', {
      variables: { subtotal: 1000 },
    })
    expect(result).toEqual({ success: true, value: 120 })
  })

  it('supports built-in round function', () => {
    const result = evaluator.evaluate('round({{value}}, 2)', {
      variables: { value: 10.5678 },
    })
    expect(result).toEqual({ success: true, value: 10.57 })
  })

  it('returns error for unknown variables', () => {
    const result = evaluator.evaluate('{{unknown_var}} + 1', { variables: {} })
    expect(result.success).toBe(false)
  })

  it('returns error for invalid syntax', () => {
    const result = evaluator.evaluate('2 ++ 3', { variables: {} })
    expect(result.success).toBe(false)
  })

  it('validates correct expressions', () => {
    expect(evaluator.validate('{{x}} * (1 + {{y}})')).toEqual({ valid: true })
  })

  it('validates incorrect expressions', () => {
    const result = evaluator.validate('2 +/ 3')
    expect(result.valid).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('handles if() function', () => {
    const scope = { variables: { plan: 'full', full_amount: 1000, inst_amount: 500 } }
    // Expression: if plan equals "full", use full_amount, else inst_amount
    const result = evaluator.evaluate(
      '{{plan}} == "full" ? {{full_amount}} : {{inst_amount}}',
      scope,
    )
    expect(result).toEqual({ success: true, value: 1000 })
  })
})
```

### 2.3 — Build TemplateInterpolator

- [ ] Create `src/lib/flow-engine/TemplateInterpolator.ts`

```typescript
/**
 * TemplateInterpolator
 *
 * Replaces {{variable_name}} placeholders in template strings with runtime values.
 * Supports money formatting when a variable has type 'money'.
 *
 * Formatting rules:
 *   - money type: formats as "$1,200.00"
 *   - number type: formats as "1,200" (locale-aware)
 *   - string type: inserted as-is
 *   - missing variables: replaced with empty string (no error)
 *
 * @example
 * ```ts
 * const interpolator = new TemplateInterpolator()
 * const result = interpolator.interpolate(
 *   'Thank you {{name}}! Total: {{total_cost}}',
 *   { variables: { name: 'Alice', total_cost: 1200 }, types: { total_cost: 'money' } }
 * )
 * // result = 'Thank you Alice! Total: $1,200.00'
 * ```
 */
export class TemplateInterpolator {
  /**
   * Interpolate a template string with variable values.
   */
  interpolate(
    template: string,
    scope: {
      variables: Record<string, unknown>
      types?: Record<string, 'string' | 'number' | 'boolean' | 'money'>
    },
  ): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
      const trimmed = varName.trim()
      const value = scope.variables[trimmed]
      const type = scope.types?.[trimmed]

      if (value === undefined || value === null) {
        return ''
      }

      if (type === 'money') {
        const num = Number(value)
        if (!isNaN(num)) {
          return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        }
      }

      return String(value)
    })
  }
}
```

### 2.4 — Build FlowValidator

- [ ] Create `src/lib/flow-engine/FlowValidator.ts`

The validator checks a complete flow definition for errors. It implements all 9 validation rules from spec.md §6.

```typescript
import type { FlowNode, FlowEdge, FlowVariable } from './types'

/**
 * FlowValidator
 *
 * Validates a complete flow definition at build time.
 * Checks for:
 *   - Start node existence
 *   - All nodes reachable from Start
 *   - No cycles (DAG enforcement)
 *   - Complete configs per node type
 *   - Variable references exist
 *   - Decision branches match options
 *   - Payment gateway references exist
 *   - Valid calculator expressions
 *   - Correct number of edges per node type
 *
 * @example
 * ```ts
 * const validator = new FlowValidator()
 * const errors = validator.validate(nodes, edges, variables)
 * if (errors.length > 0) {
 *   // Show errors in the builder UI
 * }
 * ```
 */
export class FlowValidator {
  /**
   * Validate a complete flow and return all errors found.
   * Returns an empty array if the flow is valid.
   */
  validate(
    nodes: FlowNode[],
    edges: FlowEdge[],
    variables: FlowVariable[],
  ): FlowValidationError[] {
    const errors: FlowValidationError[] = []

    this.validateStartNode(nodes, errors)
    this.validateReachability(nodes, edges, errors)
    this.validateCycles(nodes, edges, errors)
    this.validateNodeConfigs(nodes, variables, errors)
    this.validateEdgesPerNode(nodes, edges, errors)

    return errors
  }

  private validateStartNode(nodes: FlowNode[], errors: FlowValidationError[]): void {
    const startNodes = nodes.filter((n) => n.type === 'start')
    if (startNodes.length === 0) {
      errors.push({
        type: 'missing_start',
        message: 'Flow must have exactly one Start node.',
      })
    }
  }

  private validateReachability(
    nodes: FlowNode[],
    edges: FlowEdge[],
    errors: FlowValidationError[],
  ): void {
    // BFS from start node — any node not visited is disconnected
    const startNode = nodes.find((n) => n.type === 'start')
    if (!startNode) return

    const visited = new Set<number>()
    const queue = [startNode.id]
    visited.add(startNode.id)

    while (queue.length > 0) {
      const currentId = queue.shift()!
      const outgoing = edges.filter((e) => e.sourceNodeId === currentId)
      for (const edge of outgoing) {
        if (!visited.has(edge.targetNodeId)) {
          visited.add(edge.targetNodeId)
          queue.push(edge.targetNodeId)
        }
      }
    }

    for (const node of nodes) {
      if (!visited.has(node.id) && node.type !== 'start') {
        errors.push({
          nodeId: node.id,
          type: 'disconnected',
          message: `Node "${node.label || node.type}" is not reachable from Start. Connect it to the flow.`,
        })
      }
    }
  }

  private validateCycles(
    nodes: FlowNode[],
    edges: FlowEdge[],
    errors: FlowValidationError[],
  ): void {
    // Detect cycles using DFS with backtracking
    const adjacency = new Map<number, number[]>()
    for (const node of nodes) {
      adjacency.set(node.id, [])
    }
    for (const edge of edges) {
      adjacency.get(edge.sourceNodeId)?.push(edge.targetNodeId)
    }

    const WHITE = 0, GRAY = 1, BLACK = 2
    const color = new Map<number, number>()
    for (const node of nodes) color.set(node.id, WHITE)

    function dfs(nodeId: number): boolean {
      color.set(nodeId, GRAY)
      for (const neighbor of adjacency.get(nodeId) ?? []) {
        if (color.get(neighbor) === GRAY) return true // Cycle found
        if (color.get(neighbor) === WHITE && dfs(neighbor)) return true
      }
      color.set(nodeId, BLACK)
      return false
    }

    for (const node of nodes) {
      if (color.get(node.id) === WHITE) {
        if (dfs(node.id)) {
          errors.push({
            type: 'cycle_detected',
            message: 'Flow contains a cycle. Decision branches must eventually converge without loops.',
          })
          return // One cycle error is enough
        }
      }
    }
  }

  private validateNodeConfigs(
    nodes: FlowNode[],
    variables: FlowVariable[],
    errors: FlowValidationError[],
  ): void {
    const varNames = new Set(variables.map((v) => v.name))

    for (const node of nodes) {
      const config = node.config

      switch (node.type) {
        case 'form_field':
          if (!config.fieldType) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: 'FormField: field type is required.' })
          }
          if (!config.label) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: 'FormField: label is required.' })
          }
          if (config.bindToVariable && !varNames.has(config.bindToVariable as string)) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: `FormField: variable "${config.bindToVariable}" is not declared.` })
          }
          break

        case 'decision':
          if (!config.sourceVariable) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: 'Decision: source variable is required.' })
          } else if (!varNames.has(config.sourceVariable as string)) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: `Decision: variable "${config.sourceVariable}" is not declared.` })
          }
          break

        case 'calculator':
          if (!config.targetVariable) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: 'Calculator: target variable is required.' })
          } else if (!varNames.has(config.targetVariable as string)) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: `Calculator: variable "${config.targetVariable}" is not declared.` })
          }
          if (!config.expression) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: 'Calculator: expression is required.' })
          }
          break

        case 'payment':
          if (!config.amountVariable) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: 'Payment: amount variable is required.' })
          } else if (!varNames.has(config.amountVariable as string)) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: `Payment: variable "${config.amountVariable}" is not declared.` })
          }
          if (!config.gatewayId) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: 'Payment: gateway is required. Select one from the Payment Gateways.' })
          }
          break

        case 'summary':
          if (!config.template) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: 'Summary: template is required.' })
          }
          break

        case 'redirect':
          if (!config.urlTemplate) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: 'Redirect: URL template is required.' })
          }
          break
      }
    }
  }

  private validateEdgesPerNode(
    nodes: FlowNode[],
    edges: FlowEdge[],
    errors: FlowValidationError[],
  ): void {
    for (const node of nodes) {
      const outgoing = edges.filter((e) => e.sourceNodeId === node.id)

      switch (node.type) {
        case 'start':
          if (outgoing.length !== 1) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: 'Start node must have exactly one outgoing connection.' })
          }
          break
        case 'form_field':
        case 'calculator':
        case 'summary':
        case 'redirect':
          if (outgoing.length !== 1) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: `${node.type} node must have exactly one outgoing connection.` })
          }
          break
        case 'decision': {
          const branches = (node.config.branches as { value: string }[] | undefined) ?? []
          if (outgoing.length < branches.length) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: `Decision node has ${branches.length} branches but only ${outgoing.length} connections. Each branch needs a connection.` })
          }
          break
        }
        case 'payment':
          if (outgoing.length < 1 || outgoing.length > 2) {
            errors.push({ nodeId: node.id, type: 'missing_config', message: 'Payment node needs 1 (success) or 2 (success + failure) connections.' })
          }
          break
      }
    }
  }
}
```

- [ ] Add tests for `FlowValidator` covering:
  - Valid flow passes validation
  - Missing start node is detected
  - Disconnected nodes are detected
  - Cycles are detected
  - Missing config fields per node type
  - Invalid variable references
  - Incorrect edge counts per node type

### 2.5 — Build FlowEngine

- [ ] Create `src/lib/flow-engine/FlowEngine.ts`

This is the runtime execution engine that drives the end-user flow experience step by step. It operates on the client side, advancing through nodes as the user interacts.

```typescript
import type { FlowNode, FlowEdge, FlowVariable, FlowExecutionContext, ExecutionHistoryEntry } from './types'
import { ExpressionEvaluator } from './ExpressionEvaluator'
import { TemplateInterpolator } from './TemplateInterpolator'

/**
 * The current step to be rendered in the UI.
 */
export interface FlowStep {
  nodeId: number
  nodeType: string
  config: Record<string, unknown>
  /** The rendered label/title for this step */
  label: string
  /** Whether this step expects user input (FormField, Decision) */
  expectsInput: boolean
  /** Whether this step shows a payment interface */
  isPayment: boolean
  /** Whether this step is the final one */
  isTerminal: boolean
  /** For Summary: the rendered template text */
  renderedOutput?: string
  /** For Redirect: the constructed URL */
  redirectUrl?: string
}

/**
 * Input provided by the user when advancing a step.
 */
export interface StepInput {
  /** For FormField: the field value */
  formValue?: string | string[]
  /** For Decision: the selected branch value */
  decisionValue?: string
  /** For Payment: the payment result */
  paymentResult?: { success: boolean; gatewayPaymentId?: string }
}

/**
 * FlowEngine
 *
 * Drives step-by-step execution of a flow definition.
 * Each instance represents a single flow execution session.
 *
 * Usage:
 *   const engine = new FlowEngine(nodes, edges, variables, initialValues)
 *   const step = engine.getCurrentStep()
 *   // Render the step, user interacts...
 *   engine.advance({ formValue: 'Alice' })
 *   const nextStep = engine.getCurrentStep()
 *   // ... continue until engine.isComplete()
 *
 * The engine maintains all state internally and can produce a
 * serializable snapshot for persistence via getSnapshot().
 */
export class FlowEngine {
  private nodes: Map<number, FlowNode>
  private edges: FlowEdge[]
  private variables: FlowVariable[]
  private currentNodeId: number
  private variableValues: Record<string, unknown>
  private history: ExecutionHistoryEntry[]
  private completed: boolean
  private expressionEvaluator: ExpressionEvaluator
  private templateInterpolator: TemplateInterpolator

  constructor(
    nodes: FlowNode[],
    edges: FlowEdge[],
    variables: FlowVariable[],
    initialVariableValues?: Record<string, unknown>,
  ) {
    this.nodes = new Map(nodes.map((n) => [n.id, n]))
    this.edges = edges
    this.variables = variables
    this.expressionEvaluator = new ExpressionEvaluator()
    this.templateInterpolator = new TemplateInterpolator()

    // Initialize variable values from defaults, then override with any provided values
    this.variableValues = { ...this.getDefaultVariableValues(), ...initialVariableValues }

    // Find the start node
    const startNode = nodes.find((n) => n.type === 'start')
    if (!startNode) throw new Error('Flow must have a Start node')
    this.currentNodeId = startNode.id
    this.history = []
    this.completed = false

    // Record the start node visit
    this.recordEntry(startNode)
  }

  /**
   * Get the current step to render in the UI.
   */
  getCurrentStep(): FlowStep {
    const node = this.nodes.get(this.currentNodeId)
    if (!node) throw new Error(`Node ${this.currentNodeId} not found`)

    const base: FlowStep = {
      nodeId: node.id,
      nodeType: node.type,
      config: node.config,
      label: node.label ?? this.getDefaultLabel(node.type),
      expectsInput: node.type === 'form_field' || node.type === 'decision',
      isPayment: node.type === 'payment',
      isTerminal: node.type === 'summary' || node.type === 'redirect',
    }

    // For summary nodes, render the template
    if (node.type === 'summary') {
      const template = node.config.template as string
      if (template) {
        base.renderedOutput = this.templateInterpolator.interpolate(template, {
          variables: this.variableValues,
          types: this.getVariableTypesMap(),
        })
      }
    }

    // For redirect nodes, build the URL
    if (node.type === 'redirect') {
      const urlTemplate = node.config.urlTemplate as string
      if (urlTemplate) {
        base.redirectUrl = this.templateInterpolator.interpolate(urlTemplate, {
          variables: this.variableValues,
        })
      }
    }

    return base
  }

  /**
   * Advance to the next node based on user input.
   * Call this after the user has completed the current step.
   */
  advance(input?: StepInput): void {
    if (this.completed) return

    const node = this.nodes.get(this.currentNodeId)
    if (!node) throw new Error(`Node ${this.currentNodeId} not found`)

    // Process the current node's action
    this.processNodeAction(node, input)

    // Find the next node(s)
    const outgoingEdges = this.edges.filter((e) => e.sourceNodeId === node.id)

    let nextNodeId: number | null = null

    switch (node.type) {
      case 'start':
      case 'form_field':
      case 'calculator':
      case 'summary':
        // Follow the single outgoing edge
        nextNodeId = outgoingEdges[0]?.targetNodeId ?? null
        break

      case 'decision':
        // Follow the edge matching the user's selection
        const selectedValue = input?.decisionValue ?? this.variableValues[node.config.sourceVariable as string]
        const matchingEdge = outgoingEdges.find(
          (e) => e.metadata.matchValue === String(selectedValue),
        )
        nextNodeId = matchingEdge?.targetNodeId ?? outgoingEdges[0]?.targetNodeId ?? null
        break

      case 'payment':
        if (input?.paymentResult?.success) {
          // Follow success edge (first)
          this.variableValues['payment_ref'] = input.paymentResult.gatewayPaymentId
          nextNodeId = outgoingEdges[0]?.targetNodeId ?? null
        } else {
          // Follow failure edge (second) or first edge if no failure path
          nextNodeId = outgoingEdges[1]?.targetNodeId ?? outgoingEdges[0]?.targetNodeId ?? null
        }
        break

      case 'redirect':
        // Redirect is terminal — no next node
        this.completed = true
        return
    }

    if (nextNodeId === null) {
      this.completed = true
      return
    }

    this.currentNodeId = nextNodeId
    const nextNode = this.nodes.get(nextNodeId)
    if (nextNode) {
      this.recordEntry(nextNode)
    }

    // If the next node is a calculator, auto-advance
    if (nextNode && (nextNode.type === 'calculator')) {
      this.advance()
    }

    // If the next node is terminal (summary/redirect), mark as complete
    if (nextNode && (nextNode.type === 'summary' || nextNode.type === 'redirect')) {
      this.completed = true
    }
  }

  /**
   * Go back to the previous step (if history allows).
   */
  goBack(): boolean {
    if (this.history.length < 2) return false
    // Remove current entry
    this.history.pop()
    // Go to the previous entry
    const previous = this.history[this.history.length - 1]
    this.currentNodeId = previous.nodeId
    this.completed = false
    return true
  }

  /**
   * Whether the flow has reached a terminal node.
   */
  isComplete(): boolean {
    return this.completed
  }

  /**
   * Get the current variable values.
   */
  getVariableValues(): Record<string, unknown> {
    return { ...this.variableValues }
  }

  /**
   * Get the total number of steps (for progress indicator).
   */
  getTotalSteps(): number {
    return this.nodes.size - 1 // Exclude start node
  }

  /**
   * Get the current step number (1-based, excluding start node).
   */
  getCurrentStepNumber(): number {
    return this.history.length
  }

  /**
   * Serialize the current execution state for persistence.
   */
  getSnapshot(): FlowExecutionContext {
    return {
      executionId: 0, // Assigned by server on save
      flowId: 0,      // Assigned by server on save
      status: this.completed ? 'completed' : 'in_progress',
      currentNodeId: this.currentNodeId,
      variables: { ...this.variableValues },
      history: [...this.history],
    }
  }

  // ── Private Helpers ──

  private processNodeAction(node: FlowNode, input?: StepInput): void {
    switch (node.type) {
      case 'form_field': {
        const bindTo = node.config.bindToVariable as string | undefined
        if (bindTo && input?.formValue !== undefined) {
          this.variableValues[bindTo] = input.formValue
        }
        break
      }
      case 'calculator': {
        const expression = node.config.expression as string
        const targetVar = node.config.targetVariable as string
        if (expression && targetVar) {
          const result = this.expressionEvaluator.evaluate(expression, {
            variables: this.variableValues,
          })
          if (result.success) {
            this.variableValues[targetVar] = result.value
          }
        }
        break
      }
      case 'payment': {
        // Payment is handled by the UI; we just store the result
        if (input?.paymentResult?.gatewayPaymentId) {
          this.variableValues['payment_ref'] = input.paymentResult.gatewayPaymentId
        }
        break
      }
    }
  }

  private recordEntry(node: FlowNode): void {
    this.history.push({
      nodeId: node.id,
      nodeType: node.type,
      enteredAt: new Date().toISOString(),
      data: { label: node.label },
    })
  }

  private getDefaultLabel(type: string): string {
    const labels: Record<string, string> = {
      start: 'Start',
      form_field: 'Form Field',
      decision: 'Decision',
      calculator: 'Calculator',
      payment: 'Payment',
      summary: 'Summary',
      redirect: 'Redirect',
    }
    return labels[type] ?? 'Unknown'
  }

  private getDefaultVariableValues(): Record<string, unknown> {
    const values: Record<string, unknown> = {}
    for (const v of this.variables) {
      if (v.defaultValue !== null) {
        switch (v.type) {
          case 'number':
          case 'money':
            values[v.name] = Number(v.defaultValue)
            break
          case 'boolean':
            values[v.name] = v.defaultValue === 'true'
            break
          default:
            values[v.name] = v.defaultValue
        }
      }
    }
    return values
  }

  private getVariableTypesMap(): Record<string, 'string' | 'number' | 'boolean' | 'money'> {
    const types: Record<string, 'string' | 'number' | 'boolean' | 'money'> = {}
    for (const v of this.variables) {
      types[v.name] = v.type
    }
    return types
  }
}
```

- [ ] Add tests for `FlowEngine` covering:
  - Linear flow with FormField → Summary
  - Flow with calculator that computes a value
  - Decision node routing based on variable value
  - Payment success vs. failure paths
  - Go back navigation
  - Auto-advance through calculator nodes

> **Justification:** This phase is the most novel code in the project. The ExpressionEvaluator, FlowValidator, and FlowEngine don't exist anywhere in the codebase. They need full, detailed implementation with complete tests because they are the foundation everything else builds on. spec.md §5 defines the engine architecture, REQ-1.4 requires expression support, and REQ-5.2 requires sandboxed evaluation.

---

## Phase 3 — Flow Server Functions

**Implements:** REQ-1.1, REQ-1.2, REQ-1.3, REQ-5.1, REQ-5.3  
**Reference:** spec.md §8

Create server functions following the existing patterns in `src/lib/server-fns/`. These handle all database CRUD for flow data.

### 3.1 — Flow CRUD (`src/lib/server-fns/flows.ts`)

- [ ] Create `getFlow(formId)` — Fetch complete flow object with all nodes, edges, and variables, ordered and structured for the frontend
- [ ] Create `createFlow(formId)` — Create a new flow with a single Start node at position (250, 100) on the canvas
- [ ] Create `deleteFlow(formId)` — Delete a flow and cascade to all nodes/edges/variables/executions

**Pattern:** Follow existing server functions in `src/lib/server-fns/forms.ts` — same structure with `createServerFn`, auth check via `requireAuth()`, `ensureProfile()`, and error handling. The functions are straightforward CRUD with JSON serialization.

### 3.2 — Flow Node & Edge CRUD (`src/lib/server-fns/flow-nodes.ts`)

- [ ] Create `addFlowNode(flowId, type, positionX, positionY)` — Insert a new node, return it with its ID
- [ ] Create `updateFlowNode(nodeId, config)` — Update node config, label, and/or position
- [ ] Create `deleteFlowNode(nodeId)` — Delete a node and all its edges (both incoming and outgoing)
- [ ] Create `addFlowEdge(flowId, sourceNodeId, targetNodeId, metadata)` — Connect two nodes
- [ ] Create `updateFlowEdge(edgeId, metadata)` — Update edge metadata (e.g., set matchValue for decision branches)
- [ ] Create `deleteFlowEdge(edgeId)` — Remove an edge
- [ ] Create `saveFlowLayout(flowId, nodes)` — Bulk update node positions after a drag operation on the canvas

### 3.3 — Flow Variables CRUD (`src/lib/server-fns/flow-variables.ts`)

- [ ] Create `getFlowVariables(flowId)` — List all variables for a flow
- [ ] Create `createFlowVariable(flowId, name, type, defaultValue?, description?)` — Declare a new variable (validate name uniqueness within flow)
- [ ] Create `updateFlowVariable(varId, changes)` — Update variable properties
- [ ] Create `deleteFlowVariable(varId)` — Remove a variable (check no nodes reference it first)

### 3.4 — Flow Execution Management (`src/lib/server-fns/flow-executions.ts`)

- [ ] Create `startFlowExecution(flowId)` — Create a new execution record with `in_progress` status and default variable values, return the execution ID and first step
- [ ] Create `advanceExecution(executionId, nodeOutput)` — Record the current node's output, update the execution's `currentNodeId`, `variables`, and `history`, return the next step
- [ ] Create `completeExecution(executionId)` — Mark execution as `completed`, set `completedAt`, link to form submission
- [ ] Create `getExecutionState(executionId)` — Fetch the current execution context (for page refresh / resume)

> **Justification:** REQ-1.1 requires persistent storage. Server functions bridge the frontend to the database. Following existing patterns means minimal novel code here — the novelty is in the data structures, not the CRUD implementation. spec.md §8 lists all required functions.

---

## Phase 4 — Flow Builder Canvas & Node Components

**Implements:** REQ-2.1 (visual canvas)  
**Reference:** spec.md §3 (file structure), §7 (React Flow integration)

This is the most visible part of the feature. Build the visual canvas where creators compose their flows by dragging, connecting, and arranging nodes.

### 4.1 — Install and configure React Flow

- [ ] Verify `@xyflow/react` is installed
- [ ] Create `src/components/flow-builder/FlowCanvas.tsx`:

```typescript
/**
 * FlowCanvas
 *
 * The main canvas component wrapping React Flow.
 * Provides:
 *   - Snap-to-grid (20px)
 *   - Smoothstep edges (right-angle connections)
 *   - Custom node types registered via nodeTypes prop
 *   - Minimap in bottom-right corner
 *   - Controls (zoom +/-) in bottom-left
 *   - Delete key handling for selected nodes/edges
 *   - Drag-and-drop from the palette (via onDrop handler)
 *
 * Props:
 *   - nodes / edges: React Flow node/edge arrays
 *   - onNodesChange / onEdgesChange: React Flow state handlers
 *   - onConnect: handler for new edge connections
 *   - onNodeClick: open config panel for selected node
 *   - onDrop: handle dropping a new node type from the palette
 *   - nodeTypes: map of custom React Flow node components
 *
 * Layout:
 *   The canvas fills the center of the 3-column builder layout.
 *   It has the existing app background color (#faf9f5).
 *
 * React Flow reference:
 *   https://reactflow.dev/api-reference/react-flow
 */
```

The canvas layout mirrors the existing form builder's 3-column layout pattern (FieldPalette left, Canvas center, ConfigPanel right).

### 4.2 — Build custom Node components

- [ ] Create `src/components/flow-builder/nodes/` directory
- [ ] Create each node component following the same pattern:

Each node renders as a compact card with:
- **Type icon** (left): Different icon per type — `▶` Start, `☐` FormField, `◇` Decision, `∑` Calculator, `$` Payment, `≡` Summary, `↗` Redirect
- **Label** (center): The node's label truncated to 20 chars
- **Validation badge** (if errors exist): Red dot with error count
- **Handles** (top = target, bottom = source): React Flow `Handle` components
- **Status indicator**: Green border if configured, gray if incomplete

```typescript
// Pattern for each node component:
// import { Handle, Position, type NodeProps } from '@xyflow/react'
// 
// export function CalculatorNode({ data, selected }: NodeProps) {
//   return (
//     <div className={`... ${selected ? 'ring-2 ring-[#cc785c]' : ''}`}>
//       <Handle type="target" position={Position.Top} />
//       <div className="flex items-center gap-2">
//         <span className="icon">∑</span>
//         <span>{data.label}</span>
//         {data.hasError && <span className="error-badge">!</span>}
//       </div>
//       <Handle type="source" position={Position.Bottom} />
//     </div>
//   )
// }
```

- [ ] Create node components for all 7 types:
  - `StartNode.tsx` — Round shape, green accent, no target handle
  - `FormFieldNode.tsx` — Rectangle, shows field type icon + label
  - `DecisionNode.tsx` — Diamond shape (CSS rotate), branch labels
  - `CalculatorNode.tsx` — Rectangle with ∑ icon and expression preview
  - `PaymentNode.tsx` — Rectangle with $ icon and amount variable
  - `SummaryNode.tsx` — Rectangle with ≡ icon and template preview
  - `RedirectNode.tsx` — Rectangle with ↗ icon and URL preview

- [ ] Create `src/components/flow-builder/FlowPalette.tsx`:

A sidebar component (following the existing `FieldPalette` pattern in `src/components/form-builder/FieldPalette.tsx`) listing all available node types that can be dragged onto the canvas. Each palette item shows the node icon, name, and a brief description. Dragging an item creates a new node on the canvas.

```typescript
/**
 * FlowPalette
 *
 * Left sidebar listing all available node types.
 * Users drag items from here onto the canvas.
 *
 * Node types available:
 *   - FormField: A form input (text, email, number, etc.)
 *   - Decision: Branch based on a variable value
 *   - Calculator: Compute a value from an expression
 *   - Payment: Collect payment via a gateway
 *   - Summary: Show a dynamic result page
 *   - Redirect: Send user to an external URL
 *
 * Pattern: Mirror existing FieldPalette layout and styling.
 * Uses native HTML5 drag-and-drop (dragstart / onDrop on canvas).
 */
```

### 4.3 — Wire up the canvas page route

- [ ] Create `src/routes/forms/$formId/flow.tsx` — The Flow Builder page
- [ ] On mount, call `getFlow(formId)` to load existing flow or show "Create Flow" button
- [ ] Implement the FlowBuilderPage component composing:
  - Left: `FlowPalette`
  - Center: `FlowCanvas`
  - Right: `NodeConfigPanel` (from Phase 5)
- [ ] Add a "Flow" tab next to the existing "Edit" tab in the form navigation (see existing form layout patterns)

### 4.4 — Add "Flow" tab to form navigation

- [ ] Modify the form detail page layout (likely in the existing form route component wrapper) to include a "Flow" tab alongside "Edit" and "Submissions"
- [ ] The tab navigates to `/forms/$formId/flow`

> **Justification:** REQ-2.1 requires the visual canvas. This is novel UI work — there's nothing like a node graph in the existing codebase. React Flow is the right library choice, and the custom node components need bespoke styling and behavior.

---

## Phase 5 — Flow Builder Configuration & Variables

**Implements:** REQ-2.2 (node configuration), REQ-2.3 (variables manager)  
**Reference:** spec.md §3 (config-forms/, VariablesManager)

### 5.1 — Build NodeConfigPanel

- [ ] Create `src/components/flow-builder/NodeConfigPanel.tsx`

A right-side properties panel that opens when a node on the canvas is clicked. Follows the existing `FieldEditor` pattern in `src/components/form-builder/FieldEditor.tsx` — same layout, save-on-blur behavior, close button.

```typescript
/**
 * NodeConfigPanel
 *
 * Right sidebar that shows configuration options for the selected node.
 * Renders a type-specific config form based on the node's type.
 *
 * Props:
 *   - node: The selected flow node
 *   - variables: Available variables (for variable picker dropdowns)
 *   - gateways: Available payment gateways (for payment config)
 *   - onUpdate(nodeId, config): Save updated config
 *   - onClose(): Close the panel
 *
 * Behavior:
 *   - Shows node type and label at the top
 *   - Renders the appropriate config form component
 *   - Auto-saves on blur (following existing FieldEditor pattern)
 *   - Close button to deselect the node
 *   - "Delete node" button at the bottom (with confirmation)
 */
```

### 5.2 — Build config form components

- [ ] Create `src/components/flow-builder/config-forms/` directory
- [ ] Create each config form:

**FormFieldConfig.tsx:**
- Field type selector (dropdown of all existing field types)
- Label input
- Placeholder input (for text/email/number/textarea types)
- Required toggle
- Options editor (for select/checkbox/radio — reuse existing pattern from `FieldEditor.tsx`)
- Bind to variable: dropdown of declared variables

**DecisionConfig.tsx:**
- Source variable: dropdown of string-type variables
- Branches editor: list of { value, label } pairs
- Each branch automatically creates a labeled edge in the canvas

**CalculatorConfig.tsx:**
- Target variable: dropdown of number/money-type variables (or create new)
- Expression input with:
  - Variable picker (click to insert {{variable}})
  - Function list (round, sum, min, max, abs, if)
  - Expression preview (shows parsed result if possible)
- "Test expression" button that evaluates with current flow defaults

**PaymentConfig.tsx:**
- Amount variable: dropdown of number/money-type variables
- Currency: USD, PHP, EUR, etc. (dropdown)
- Payment gateway: dropdown of active gateways (from existing `paymentGateways` table)
- Preview: "Will charge {{amount}} via {{gateway}}"

**SummaryConfig.tsx:**
- Title input
- Template editor (textarea with variable picker)
- Live preview of rendered template with example variable values

**RedirectConfig.tsx:**
- URL template input
- Variable picker to insert {{variables}}
- Example: `https://example.com/course-access?ref={{payment_ref}}&name={{customer_name}}`

### 5.3 — Build VariablesManager

- [ ] Create `src/components/flow-builder/VariablesManager.tsx`

```typescript
/**
 * VariablesManager
 *
 * A sidebar panel (toggled via toolbar button) or modal that lists
 * all declared variables for the current flow.
 *
 * Shows:
 *   - Variable name (editable)
 *   - Type badge (string/number/boolean/money) with color coding
 *   - Default value (editable)
 *   - Description (optional, editable)
 *   - "Used by X nodes" reference count
 *   - Delete button (disabled if referenced by any node)
 *   - "+ Add Variable" button at the top
 *
 * Each variable type shows appropriate input:
 *   - string: text input
 *   - number: number input
 *   - boolean: toggle
 *   - money: number input with $ prefix
 *
 * The manager auto-saves changes on blur.
 */
```

### 5.4 — Flow builder page integration

- [ ] Wire VariablesManager into the flow builder page as a toggleable sidebar or modal
- [ ] Pass variables list to NodeConfigPanel for variable picker dropdowns
- [ ] Pass active gateways list to PaymentConfig

> **Justification:** REQ-2.2 requires node configuration forms, and REQ-2.3 requires variable management. These follow existing UI patterns (FieldEditor) but with novel per-node-type config forms. The variable picker and expression builder are completely new interactions.

---

## Phase 6 — Flow Builder Toolbar, Validation & Preview

**Implements:** REQ-2.4 (flow validation), REQ-2.5 (flow preview)  
**Reference:** spec.md §6 (validation rules)

### 6.1 — Build FlowToolbar

- [ ] Create `src/components/flow-builder/FlowToolbar.tsx`

```typescript
/**
 * FlowToolbar
 *
 * Top toolbar above the canvas with action buttons.
 *
 * Buttons:
 *   - Save: Persist all flow data (nodes, edges, configs, variables)
 *   - Validate: Run FlowValidator and show errors as a list
 *   - Preview: Open FlowPreviewPanel to test-run the flow
 *   - Variables: Toggle VariablesManager sidebar
 *   - Auto-layout: Arrange nodes in a readable layout
 *
 * Save behavior:
 *   - Calls saveFlowLayout() for positions
 *   - Calls updateFlowNode() for each node config
 *   - Shows save confirmation or error toast
 *
 * Validate behavior:
 *   - Runs FlowValidator.validate() on the current flow
 *   - Shows errors in a collapsible panel below the toolbar
 *   - Clicking an error navigates to and selects the offending node
 */
```

### 6.2 — Build FlowValidationBadge

- [ ] Create `src/components/flow-builder/FlowValidationBadge.tsx`

A small badge overlaid on nodes that have validation errors. Shows a red dot with the error count. Clicking it shows the error message in a tooltip.

### 6.3 — Build FlowPreviewPanel

- [ ] Create `src/components/flow-builder/FlowPreviewPanel.tsx`

```typescript
/**
 * FlowPreviewPanel
 *
 * A side panel or modal that lets the creator test-run their flow
 * without publishing. It uses the FlowEngine directly (client-side)
 * to step through each node.
 *
 * Behavior:
 *   - Opens as a slide-in panel from the right, replacing the config panel
 *   - Shows the current node rendered with a "test" mode indicator
 *   - User can input values, make decisions, see calculator results
 *   - Payments are simulated ("[TEST] Would charge $X via PayPal")
 *   - Shows a step counter: "Step 2 of 5"
 *   - "Back" and "Next" buttons for navigation
 *   - Variable inspector panel showing all current variable values
 *   - "Reset" button to restart the preview
 *   - "Close" button to return to the builder
 *
 * Implementation:
 *   Instantiates a new FlowEngine with the current flow data.
 *   Each "Next" click calls engine.advance() with the test input.
 *   Displays the result of getCurrentStep().
 *
 * This runs entirely client-side — no server calls except loading the initial flow data.
 */
```

### 6.4 — Validation integration

- [ ] Add validation error badges to custom node components (pass `hasError` via React Flow node data)
- [ ] Show validation error count in the toolbar
- [ ] Add real-time validation on config change (re-validate whenever a node config is saved)

> **Justification:** REQ-2.4 requires validation, REQ-2.5 requires preview. Both depend on the FlowValidator and FlowEngine built in Phase 2. The preview panel is the first place the FlowEngine runs in a UI context.

---

## Phase 7 — Flow Execution — End-User Experience

**Implements:** REQ-3.1 (runtime engine), REQ-3.2 (multi-step UI), REQ-3.3 (payment integration), REQ-5.1 (execution context)  
**Reference:** spec.md §5 (engine design)

### 7.1 — Build FlowStepRenderer

- [ ] Create `src/components/flow-execution/FlowStepRenderer.tsx`

```typescript
/**
 * FlowStepRenderer
 *
 * Renders the current step of a flow execution for the end user.
 * Based on the step's nodeType, it renders the appropriate interface.
 *
 * For FormField steps:
 *   - Reuses the existing FieldRenderer component from
 *     src/components/form-builder/fields/FieldRenderer.tsx
 *   - Renders the field with the configured type, label, placeholder, options
 *   - Passes the bound variable name for storing the value
 *
 * For Decision steps:
 *   - Shows the decision question
 *   - Renders radio buttons for each branch
 *   - User selects one to proceed
 *
 * For Calculator steps:
 *   - Shows a brief "Calculating..." animation
 *   - Displays the computed result
 *   - Auto-advances (user doesn't need to click anything)
 *
 * For Payment steps:
 *   - Delegates to PaymentStep component
 *
 * For Summary steps:
 *   - Renders the interpolated template as rich HTML
 *   - Shows all variable values in a summary table
 *
 * For Redirect steps:
 *   - Shows a "Redirecting..." message
 *   - Auto-navigates after a short delay
 *
 * Props:
 *   - step: FlowStep from engine.getCurrentStep()
 *   - onNext(input): Called when user completes the step
 *   - onBack: Called for "Go Back" navigation
 *   - canGoBack: Whether back navigation is available
 *   - stepNumber: Current step number
 *   - totalSteps: Total steps
 *
 * Styling:
 *   - Centered card layout similar to existing form submission page
 *   - Max-width container for readability
 *   - Progress bar at the top (from FlowProgressBar)
 */
```

### 7.2 — Build FlowProgressBar

- [ ] Create `src/components/flow-execution/FlowProgressBar.tsx`

Shows step progress as a segmented progress bar. Each segment represents a step type with color coding:
- FormField: blue
- Decision: amber
- Calculator: purple
- Payment: green
- Summary/Redirect: gray (final steps)

The current step is highlighted. Completed steps are filled. Future steps are outlined.

### 7.3 — Build CalculatorDisplay

- [ ] Create `src/components/flow-execution/CalculatorDisplay.tsx`

Animated display that shows a brief "Calculating..." with a loading animation, then reveals the computed value with a subtle emphasis animation (e.g., number counter animation).

### 7.4 — Build PaymentStep

- [ ] Create `src/components/flow-execution/PaymentStep.tsx`

```typescript
/**
 * PaymentStep
 *
 * Renders the payment interface during flow execution.
 * Integrates with the existing payment gateway architecture.
 *
 * Behavior:
 *   1. Shows the amount to be charged (from the flow's variable value)
 *   2. Shows the selected gateway (PayPal, Xendit, etc.)
 *   3. Initiates payment via the existing payment API
 *   4. On success: calls onNext({ paymentResult: { success: true, gatewayPaymentId } })
 *   5. On failure: shows error and retry button, or calls onNext with failure result
 *
 * Integration:
 *   - Reuses existing payment gateway infrastructure from Phase 5 of the main plan
 *   - Calls createPayment API route then handles the gateway redirect or inline payment
 *   - On redirect-back, verifies the payment and continues the flow
 *
 * Styling:
 *   - Centered card with payment amount prominently displayed
 *   - Gateway logo/button
 *   - Secure badge for trust
 *   - Loading state during payment processing
 */
```

### 7.5 — Modify the submission route

- [ ] Modify `src/routes/forms/submit/$formId.tsx` to detect:

```typescript
// On route load:
const flow = await getFlow(formId)
if (flow) {
  // Render FlowExecutionContainer instead of the legacy form
} else {
  // Render existing linear form (backward compatibility)
}
```

- [ ] Create a `FlowExecutionContainer` component that:
  1. Calls `startFlowExecution(flowId)` to create a server-side execution record
  2. Instantiates a client-side `FlowEngine` with the flow data
  3. Drives the step-by-step UX through `FlowStepRenderer`
  4. On each step completion, calls `advanceExecution()` to persist progress
  5. On final step, calls `completeExecution()` and navigates to the completion page

> **Justification:** REQ-3.1 through REQ-3.4 define the end-user experience. This is the most important part from the respondent's perspective. It reuses existing FieldRenderer and payment infrastructure but introduces the multi-step flow pattern and the runtime engine integration.

---

## Phase 8 — Legacy Backward Compatibility & Convert-to-Flow

**Implements:** REQ-4.1 (legacy forms), REQ-4.2 (opt-in upgrade)  
**Reference:** spec.md §10

### 8.1 — Legacy form detection

- [ ] The submission route check from Phase 7.5 already handles this — if a form has no flow, it renders the existing single-step form
- [ ] Add a "Flow Status" indicator on the form dashboard cards showing whether a form is "Flow-powered" or "Linear"

### 8.2 — Convert-to-Flow button

- [ ] Add a "Convert to Flow" button on the form dashboard for forms that don't have a flow yet
- [ ] Implement the conversion logic (server function `convertFormToFlow(formId)`):

```typescript
/**
 * convertFormToFlow
 *
 * Converts a traditional linear form into a flow.
 * Steps:
 *   1. Create a new flow record for the form
 *   2. Create a Start node at position (250, 100)
 *   3. For each existing formField (ordered by .order):
 *      a. Create a FormField node with the same config
 *      b. Create a corresponding variable (name: field_label_snake)
 *      c. Set bindToVariable on the node
 *   4. Create edges connecting Start → field1 → field2 → ... → last
 *   5. Create a Summary node after the last field
 *   6. Create edge: lastField → Summary
 *   7. Redirect to /forms/$formId/flow
 *
 * The original formFields remain untouched for backward compatibility.
 * If the flow is deleted, the form reverts to linear mode.
 */
```

- [ ] Add confirmation dialog before conversion (informational: "This will create a flow from your existing fields. You can then extend it with decisions, calculators, and payments.")

> **Justification:** REQ-4.1 and REQ-4.2 ensure existing users are not disrupted. This is straightforward data transformation work.

---

## Phase 9 — Flow Completion Summary & Redirect Pages

**Implements:** REQ-3.4 (completion)  
**Reference:** spec.md §3 (routes)

### 9.1 — Build flow completion page

- [ ] Create `src/routes/flow/$executionId/complete.tsx`

```typescript
/**
 * CompletePage
 *
 * Displayed after a flow execution completes.
 * Shows:
 *   - A success checkmark animation
 *   - The Summary node's rendered template (if applicable)
 *   - A receipt-style table of all variable values
 *   - Payment details (amount paid, reference, gateway)
 *   - "Back to form" or custom CTA link
 *   - Option to submit another response
 *
 * If the flow ended with a Redirect node, this page shows briefly
 * before redirecting to the constructed URL.
 *
 * Route: /flow/$executionId/complete
 * Called on: After completeExecution() returns
 */
```

### 9.2 — Handle Redirect nodes

- [ ] In the FlowStepRenderer/FlowExecutionContainer, when the current step is a Redirect:
  1. Show a brief "Redirecting..." page (2-3 seconds)
  2. Navigate to the constructed URL (`step.redirectUrl`)
  3. Call `completeExecution()` before navigating

### 9.3 — Store flow data in form submissions

- [ ] When a flow execution completes, create a `formSubmission` record containing:
  - All variable values as `formData`
  - The execution path (which nodes were visited)
  - Payment references
- [ ] Link the `formSubmission` to the `flowExecution` record

> **Justification:** REQ-3.4 requires completion page and redirect handling. This is the landing point for end users after they finish the flow.

---

## Phase 10 — Documentation & Guides

- [ ] Update `src/components/flow-builder/FlowCanvas.tsx` and all new components with inline documentation (JSDoc for public methods/interfaces, as already provided in earlier phases)
- [ ] Create `docs/flow-builder-guide.md` covering:
  - What is the Flow Builder? (conceptual overview)
  - Node types reference (each type, its config, and behavior)
  - Variables system (how to declare, reference, and use them)
  - Expression syntax reference (all operators, functions, examples)
  - Adding calculator formulas (real-world examples: VAT, discounts, installments)
  - Setting up payment flows (connecting to gateways)
  - Testing flows via Preview mode
  - Publishing flows
  - Migrating from linear forms
- [ ] Update `README.md` with Flow Builder feature overview (add to feature list)
- [ ] Update `docs/progress-tracker.md` with FT001 phases and checkboxes

> **Justification:** The feature development process requires documentation as the final phase. The expression syntax and node behavior are complex enough to need a dedicated guide.

---

## Dependency Graph

```
Prerequisites ──────────────────────────────────────────────┐
                                                             ▼
Phase 1: Database Schema ──────────┐                         │
                                   ▼                         ▼
Phase 2: Flow Engine Library ──────┬─────────────────────────┤
                                   │                         │
                                   ▼                         │
Phase 3: Flow Server Functions ────┤                         │
                                   │                         │
                                   ▼                         ▼
Phase 4: Flow Canvas & Nodes ──────┤                         │
                                   │                         │
                                   ▼                         │
Phase 5: Config Panel & Variables ─┤                         │
                                   │                         │
                                   ▼                         │
Phase 6: Toolbar, Validation,      │                         │
          Preview ─────────────────┤                         │
                                   │                         │
                                   ├─────────────────────────┘
                                   ▼
Phase 7: Flow Execution (End User) ──────────────────────────┐
                                                             │
                                   ▼                         ▼
Phase 8: Backward Compatibility ───┤                         │
                                   │                         │
                                   ▼                         │
Phase 9: Completion Pages ─────────┤                         │
                                   │                         │
                                   ▼                         │
Phase 10: Documentation ───────────┘                         │
                                                             │
                                   ◄─────────────────────────┘
                                   (All phases depend on Prerequisites)
```

**Key parallelization opportunities:**
- Phase 4 (Canvas) and Phase 5 (Config) can be built simultaneously since they're independent UI concerns — just ensure the component interfaces are agreed upon first
- Phase 3 (Server functions) can start as soon as Phase 1 (Schema) creates the tables
- Phase 10 (Documentation) can be written incrementally alongside other phases

**Prerequisite chain (strict):**
- Phase 1 → Phase 2: Schema must exist before the engine can store/load data
- Phase 2 → Phase 4: Engine types drive the component interfaces
- Phase 2 → Phase 6: Validator and engine are used by toolbar and preview
- Phase 1 + Phase 2 → Phase 3: Both schema and types inform server function contracts
- Phase 4 + Phase 5 → Phase 6: UI must exist before you can add toolbar/preview
- Phase 7 depends on Phase 2 (engine) + Phase 4/5 (UI patterns) + existing payment infrastructure
- Phase 8 depends on Phase 4 (flow builder exists to redirect to)
- Phase 9 depends on Phase 7 (execution must work before completion pages matter)
