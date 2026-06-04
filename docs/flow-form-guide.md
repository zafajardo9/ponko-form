# Flow Form Guide — Tutorial & Computation Handbook

> **Feature:** FT001 Flow Builder
> **Status:** Implemented ✅
> **Audience:** Form creators building flow-powered forms
> **Prerequisites:** Familiarity with the PonkoForm dashboard, basic math literacy

This guide teaches you how to **build real-world flow forms** by walking through complete examples, explaining how each node works in practice, and showing you the computation patterns step by step.

If you need a reference for individual node types, variable types, or the database schema, see the [Flow Builder Knowledge Base](flow-builder-guide.md). This guide focuses on *how to build things*.

---

## Table of Contents

1. [What Is a Flow Form?](#1-what-is-a-flow-form)
2. [Building Blocks — Nodes & Variables](#2-building-blocks--nodes--variables)
3. [Tutorial 1: Payment Plan Flow](#3-tutorial-1-payment-plan-flow)
4. [Tutorial 2: Multi-Service Order Flow](#4-tutorial-2-multi-service-order-flow)
5. [Computation Patterns](#5-computation-patterns)
6. [Decision & Branching Patterns](#6-decision--branching-patterns)
7. [Payment Integration](#7-payment-integration)
8. [Testing & Debugging](#8-testing--debugging)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. What Is a Flow Form?

A **flow form** is a multi-step, interactive experience — think of it as a mini application rather than a single page of fields. The respondent:

1. Fills in fields one at a time
2. May be asked to make choices that determine what happens next
3. Sees automatic calculations (e.g., adding VAT, computing totals)
4. May be prompted to pay
5. Lands on a summary/receipt page

> **Flow form vs. linear form:** A linear form shows all fields on one page. A flow form guides the respondent step-by-step, branching and computing along the way.

### Example Flows

| Flow | What It Does |
|---|---|
| **Payment Plan** | User picks Full Payment or Installment → system calculates total with VAT → shows receipt |
| **Service Order** | User selects multiple services from a catalog → system sums fees, adds VAT, adds deposits → shows full breakdown |
| **Registration + Payment** | User fills in details → system calculates fee based on selections → charges card → confirmation |

---

## 2. Building Blocks — Nodes & Variables

Before you build a flow, understand the pieces you'll connect on the canvas.

### 2.1 Node Types at a Glance

| Node | Shape | Color | What It Does | Visible to Respondent? |
|---|---|---|---|---|
| **Start** | Circle | Green | Entry point — every flow starts here | No |
| **Form Field** | Rectangle | Blue | Collects input (text, email, select, checkbox, etc.) | Yes |
| **Decision** | Diamond | Amber | Branches the path based on a variable value | Yes (as radio buttons) |
| **Calculator** | Rectangle | Purple | Runs a math expression automatically | No (auto-advances) |
| **Payment** | Rectangle | Green | Shows amount and payment button | Yes |
| **Summary** | Rectangle | Gray | Shows final receipt — terminal node | Yes |
| **Redirect** | Rectangle | Gray | Sends user to an external URL — terminal node | Briefly |

### 2.2 Variables — The Data Backbone

Variables are the *memory* of your flow. Every piece of data — a name typed by the user, a selected option, a computed total — is stored in a variable.

**Variable types:**

| Type | What It Stores | Example Values |
|---|---|---|
| `string` | Text | `"Juan Dela Cruz"`, `"full"`, `'["service_a","service_b"]'` |
| `number` | Numeric value | `5`, `1200.50` |
| `boolean` | True/false | `true`, `false` |
| `money` | Monetary amount (stored as number, displayed as `₱1,200.00`) | `1500000` (interpreted as ₱15,000.00) |

**How to think about variables:**

1. **Declare** the variable first in the Variables Manager.
2. **Set** the variable by binding it to a Form Field (user fills it in) or a Calculator (system computes it).
3. **Read** the variable in a Decision (branch), Payment (amount), or Summary (display).

> ✅ **Rule of thumb:** If you need to store, compute, or display a value, declare a variable for it.

### 2.3 Connecting Nodes

Nodes are connected by **edges** (arrows). The flow runs from top to bottom in the order the edges define.

- **Source handle** (bottom of node) → drag to **target handle** (top of next node)
- One Start node, one or more paths, ends at a terminal node (Summary or Redirect)
- Decision nodes must have **one edge per branch option**

---

## 3. Tutorial 1: Payment Plan Flow

**Goal:** Build a flow where the user picks "Full Payment" or "Installment (6 months)", and the system calculates the total with 12% VAT.

### Step 1: Plan Your Variables

| Variable | Type | How It Gets Set | Purpose |
|---|---|---|---|
| `payment_plan` | `string` | Form Field (select) | Stores the user's choice: `"full"` or `"installment"` |
| `subtotal` | `money` | Default value: `10000` | Base price before VAT |
| `vat_amount` | `money` | Calculator | Computed: 12% of subtotal |
| `total_cost` | `money` | Calculator (full branch) | Subtotal × 1.12 |
| `monthly_payment` | `money` | Calculator (installment branch) | Total ÷ 6 |
| `payment_ref` | `string` | Payment node | Gateway reference |

### Step 2: Build the Node Chain

```
Start → [Choose Payment Plan] → [Plan? Decision]
                                    ├─ Full → [Full Total ×1.12] → [Pay Now] → [Confirmation]
                                    └─ Installment → [Monthly ÷6] ──┘
```

### Step 3: Configure Each Node

**① Start** — No configuration needed. Automatically created.

**② Form Field — "Choose Payment Plan"**

| Setting | Value |
|---|---|
| `fieldType` | `select` |
| `label` | "Payment Plan" |
| `required` | ✅ Yes |
| `options` | `"Full Payment" → "full"`, `"Installment (6 months)" → "installment"` |
| `bindToVariable` | `payment_plan` |

**③ Decision — "Plan?"**

| Setting | Value |
|---|---|
| `sourceVariable` | `payment_plan` |
| `branches` | `"full" → "Full Payment"`, `"installment" → "Installment"` |

Connect the **Full Payment** edge from the Decision to the Full calculator node.
Connect the **Installment** edge from the Decision to the Installment calculator node.
Each edge automatically gets a `matchValue` metadata that tells the runtime which branch to follow.

**④ Calculator — "Full Total (×1.12)"** (Full Payment branch only)

| Setting | Value |
|---|---|
| `targetVariable` | `total_cost` |
| `expression` | `{{subtotal}} * 1.12` |

**⑤ Calculator — "Monthly (÷6)"** (Installment branch only)

| Setting | Value |
|---|---|
| `targetVariable` | `monthly_payment` |
| `expression` | `round(({{subtotal}} * 1.12) / 6, 2)` |

> **Why `round(..., 2)`?** Money values should always be rounded to 2 decimal places to avoid fractions of a centavo.

**⑥ Payment — "Pay Now"**

| Setting | Value |
|---|---|
| `amountVariable` | `total_cost` |
| `currency` | `PHP` (or `USD` depending on your gateway) |
| `gatewayId` | Select the active gateway |

Connect from **both calculators** to this Payment node — regardless of which branch the user took, they end up here.

**⑦ Summary — "Confirmation"**

| Setting | Value |
|---|---|
| `title` | "Order Confirmation" |
| `template` | See below |

Template (use the template editor — variables inside `{{}}` are replaced with actual values):

```
Thank you for your order!

Plan: {{payment_plan}}
Subtotal: ₱{{subtotal}}
VAT (12%): ₱{{vat_amount}}
Total: ₱{{total_cost}}
Monthly Payment: ₱{{monthly_payment}}
Payment Ref: {{payment_ref}}
```

### Step 4: Tips for This Flow

- Use the **Test Expression** button in each Calculator to verify your math before publishing.
- The `vat_amount` variable isn't explicitly computed in this flow — you'd add another Calculator before the decision to compute `{{subtotal}} * 0.12` if needed.
- Try previewing both branches to confirm the Decision routes correctly.

---

## 4. Tutorial 2: Multi-Service Order Flow

**Goal:** Build a flow where the user selects one or more services from a catalog. The system computes:
- Sum of selected service fees
- 12% VAT on the fee total
- Total with VAT
- Sum of security deposits
- Grand total (fees + VAT + deposits)

### Step 1: Plan Your Variables

| Variable | Type | How It Gets Set | Purpose |
|---|---|---|---|
| `full_name` | `string` | Form Field | Client name |
| `email` | `string` | Form Field | Client email |
| `phone` | `string` | Form Field | Client phone |
| `address` | `string` | Form Field | Client address |
| `selected_services` | `string` | Form Field (checkbox) | JSON array of selected service keys |
| `service_fees_total` | `money` | Calculator | Sum of fees for selected services |
| `security_deposit_total` | `money` | Calculator | Sum of deposits for selected services |
| `vat_amount` | `money` | Calculator | 12% × `service_fees_total` |
| `total_with_vat` | `money` | Calculator | `service_fees_total + vat_amount` |
| `grand_total` | `money` | Calculator | `total_with_vat + security_deposit_total` |

### Step 2: Build the Node Chain

```
Start → [Full Name] → [Email] → [Phone] → [Address]
  → [Select Services (checkboxes)]
  → [∑ Service Fees Total]
  → [∑ Security Deposit Total]
  → [∑ VAT (12%)]
  → [∑ Total with VAT]
  → [∑ Grand Total]
  → [Summary & Confirmation]
```

### Step 3: Configure Each Node

**Form Fields — Personal Info**

Create four Form Field nodes in sequence:

| Node | `fieldType` | `label` | `bindToVariable` | `required` |
|---|---|---|---|---|
| Full Name | `text` | "Full Name" | `full_name` | ✅ |
| Email | `email` | "Email Address" | `email` | ✅ |
| Phone | `text` | "Phone Number" | `phone` | ✅ |
| Address | `textarea` | "Address" | `address` | ❌ |

**⑤ Form Field — "Select Services"**

| Setting | Value |
|---|---|
| `fieldType` | `checkbox` |
| `label` | "Choose the services you want to avail" |
| `required` | ✅ |
| `bindToVariable` | `selected_services` |
| `options` | One entry per service (see catalog) |
| `serviceCatalog` | Lookup map of key → `{fee, deposit}` |

Each option maps the user-facing label to a machine-readable key:

```json
[
  { "label": "No Derogatory Check — Fee: ₱15,000.00  Deposit: ₱3,000.00", "value": "no_derogatory_check" },
  { "label": "Tourist Visa Extension — Fee: ₱2,500.00  Deposit: ₱9,000.00", "value": "tourist_visa_extension" },
  ...
]
```

The `serviceCatalog` config (stored alongside the options) provides the runtime with fee/deposit amounts for each key:

```json
{
  "no_derogatory_check": { "fee": 1500000, "deposit": 300000 },
  "tourist_visa_extension": { "fee": 250000, "deposit": 900000 }
}
```

> **How this works at runtime:** When the user checks services and submits, the runtime receives the array of selected keys (e.g., `["no_derogatory_check", "tourist_visa_extension"]`). The calculator nodes use custom functions `SUM_FEES()` and `SUM_DEPOSITS()` that look up amounts from the `serviceCatalog` config.

**⑥ Calculator — "Service Fees Total"**

| Setting | Value |
|---|---|
| `targetVariable` | `service_fees_total` |
| `expression` | `SUM_FEES({{selected_services}})` |

**⑦ Calculator — "Security Deposit Total"**

| Setting | Value |
|---|---|
| `targetVariable` | `security_deposit_total` |
| `expression` | `SUM_DEPOSITS({{selected_services}})` |

**⑧ Calculator — "VAT (12%)"**

| Setting | Value |
|---|---|
| `targetVariable` | `vat_amount` |
| `expression` | `{{service_fees_total}} * 0.12` |

**⑨ Calculator — "Total with VAT"**

| Setting | Value |
|---|---|
| `targetVariable` | `total_with_vat` |
| `expression` | `{{service_fees_total}} + {{vat_amount}}` |

**⑩ Calculator — "Grand Total"**

| Setting | Value |
|---|---|
| `targetVariable` | `grand_total` |
| `expression` | `{{total_with_vat}} + {{security_deposit_total}}` |

**⑪ Summary — "Summary & Confirmation"**

Template:

```
--- Personal Information ---
Name: {{full_name}}
Email: {{email}}
Phone: {{phone}}
Address: {{address}}

--- Payment Breakdown ---
Service Fees:        ₱{{service_fees_total}}
VAT (12%):           ₱{{vat_amount}}
Total (fees + VAT):  ₱{{total_with_vat}}
Security Deposits:   ₱{{security_deposit_total}}
────────────────────────────────
GRAND TOTAL:         ₱{{grand_total}}
```

### Step 4: Walk Through a Real Calculation

Suppose the user selects **No Derogatory Check** (₱15,000 fee + ₱3,000 deposit) and **Tourist Visa Extension** (₱2,500 fee + ₱9,000 deposit):

| Step | Variable | How It's Computed | Value |
|---|---|---|---|
| Selection | `selected_services` | User checks both boxes | `["no_derogatory_check", "tourist_visa_extension"]` |
| 1 | `service_fees_total` | ₱15,000 + ₱2,500 | ₱17,500.00 |
| 2 | `security_deposit_total` | ₱3,000 + ₱9,000 | ₱12,000.00 |
| 3 | `vat_amount` | ₱17,500.00 × 0.12 | ₱2,100.00 |
| 4 | `total_with_vat` | ₱17,500.00 + ₱2,100.00 | ₱19,600.00 |
| 5 | `grand_total` | ₱19,600.00 + ₱12,000.00 | ₱31,600.00 |

---

## 5. Computation Patterns

This section collects reusable patterns you can apply in your own flow forms.

### 5.1 Basic Arithmetic

| Pattern | Expression | Use Case |
|---|---|---|
| Multiply by percentage | `{{subtotal}} * 0.12` | Add 12% VAT |
| Divide into installments | `round({{total}} / 6, 2)` | Split into 6 monthly payments |
| Apply discount | `{{price}} * 0.9` | 10% discount |
| Add fixed fee | `{{total}} + 5000` | Add shipping or processing fee |
| Quantity × unit price | `{{qty}} * {{unit_price}}` | Line-item total |

### 5.2 Conditional / Ternary

Use ternary expressions for simple if-then logic inside a Calculator:

| Condition | Expression | Result |
|---|---|---|
| Tiered pricing | `{{qty}} > 10 ? 50 : 100` | Price is 50 if qty > 10, else 100 |
| Late fee | `{{days_late}} > 30 ? {{amount}} * 1.05 : {{amount}}` | 5% penalty if late > 30 days |
| Minimum charge | `{{computed}} < 500 ? 500 : {{computed}}` | Floor at ₱500 |
| Free shipping threshold | `{{subtotal}} >= 2000 ? 0 : 350` | Free shipping over ₱2,000 |

### 5.3 Multi-Step Computations

When a calculation depends on intermediate results, **chain multiple Calculator nodes**.

**Example:** Discounted total with tax and shipping

```
[∑ Subtotal] = {{price}} * {{qty}}
[∑ Discount] = {{subtotal}} * 0.1
[∑ After Discount] = {{subtotal}} - {{discount}}
[∑ Tax] = {{after_discount}} * 0.12
[∑ With Tax] = {{after_discount}} + {{tax}}
[∑ Shipping] = {{with_tax}} >= 2000 ? 0 : 350
[∑ Grand Total] = {{with_tax}} + {{shipping}}
```

**Rule:** Each Calculator reads variables set by earlier nodes. The order of Calculator nodes in the chain matters — they execute in the order they're connected.

### 5.4 Working with Money

Money variables are stored as integers in the **smallest currency unit** (centavos for PHP, cents for USD).

| Real Amount | Stored Value | Display |
|---|---|---|
| ₱15,000.00 | `1500000` | `₱15,000.00` |
| ₱2,500.00 | `250000` | `₱2,500.00` |
| ₱0.12 × ₱17,500 | `210000` | `₱2,100.00` |

> 🔢 **Why not decimals?** Storing money as integer centavos avoids floating-point rounding errors. Always use whole numbers (no decimal point) in expressions.

### 5.5 Rounding

Always round money results:

```
round({{value}}, 2)     → rounds to 2 decimal places
round({{value}})        → rounds to nearest integer
```

Use `round` whenever you divide, apply a percentage, or compute a fraction.

---

## 6. Decision & Branching Patterns

### 6.1 Two-Way Branch (Yes/No)

```
[Decision] ── "Yes" ──→ [Calculator A]
            └── "No" ──→ [Calculator B]
```

Configure the Decision with `sourceVariable` set to a boolean or string variable. Add branches `"true"` and `"false"`. Connect each branch to its respective path. Both paths should eventually converge (e.g., both lead to the same Summary node).

### 6.2 Multi-Way Branch

```
[Decision] ── "full" ────────→ [Calculator Full]
            ├── "installment" → [Calculator Installment]
            └── "waiver" ─────→ [Calculator Waiver]
```

Configure branches to match the possible values of `sourceVariable`. The runtime checks each edge's `matchValue` and follows the first match. If no edge matches, it follows the first edge as default.

### 6.3 Converging Paths

After a branch, paths should **rejoin** at a common node. This is critical for flows that end in a single Payment or Summary:

```
        ┌── Full ──┐
Start ─→┤          ├─→ Pay ─→ Summary
        └── Install ┘
```

Simply connect both branch endpoints to the same downstream node. The runtime handles this — whichever branch was taken, it flows into the common node.

### 6.4 What NOT to Do with Decisions

| ❌ Don't | ✅ Do Instead |
|---|---|
| Use a calculator with ternary for string-based routing | Use a Decision node with branches |
| Create two separate flows for two paths | Use one flow with branches that converge |
| Leave a branch unconnected | Connect every branch to a downstream node |
| Branch but never rejoin | Converge all branches before a terminal node |

---

## 7. Payment Integration

### 7.1 Setting Up a Payment Node

1. **Declare a `money` variable** that holds the amount (e.g., `total_cost`, `grand_total`).
2. **Ensure the variable is set** by a Calculator node before the Payment node.
3. **Add a Payment node** to the canvas.
4. **Configure:**
   - `amountVariable`: the money variable (e.g., `total_cost`)
   - `currency`: `PHP` or `USD`
   - `gatewayId`: select from available gateways
5. **Connect edges:** The first outgoing edge is the **success path**. Optionally add a second edge for the **failure path** (e.g., to show an error message).

### 7.2 Payment Flow Pattern

```
... → [Calculator: total_cost] → [Payment: Pay Now] → [Summary: Success]
                                                  └─→ [Summary: Payment Failed]
```

The failure path lets you show a different summary message (e.g., "Your payment did not go through. Please try again.").

### 7.3 Simulated Payments (Preview)

During Preview mode, payments are simulated — no real charge occurs. Use the **Simulate success** / **Simulate failure** buttons in the preview toolbar to test both paths.

---

## 8. Testing & Debugging

### 8.1 Before You Publish

1. **Click Preview** in the toolbar — tests the full flow client-side
2. **Walk through every branch** — make sure each Decision path leads where you expect
3. **Check Calculator values** — use the **Test expression** button on each Calculator to verify math
4. **Test edge cases** — try selecting nothing (if a field is optional), entering extreme values, etc.
5. **Verify the Summary** — does the template render correctly with all variables?

### 8.2 Common Calculator Bugs

| Symptom | Likely Cause | Fix |
|---|---|---|
| Expression shows `NaN` | Variable referenced but not yet set | Make sure the prior node sets the variable, or provide a default value |
| Expression shows `undefined` | Variable name is misspelled | Check that the `{{name}}` matches the declared variable name exactly |
| Wrong decimal places | Missing `round()` | Wrap with `round(result, 2)` |
| Money shows as `10000` not `100.00` | Variable not stored as centavos | Multiply by 100 before storing (or use the correct unit) |
| Decision always takes the same branch | `matchValue` on edges doesn't match the variable value | Check that edge metadata `matchValue` exactly matches the option's `value` |

### 8.3 Debugging with the Summary Template

Use the Summary template as a **debug readout** during development:

```
=== DEBUG ===
payment_plan:   {{payment_plan}}
subtotal:       {{subtotal}}
vat_amount:     {{vat_amount}}
total_cost:     {{total_cost}}
monthly:        {{monthly_payment}}
payment_ref:    {{payment_ref}}
```

If a variable shows `undefined` in the summary, it was never set — trace back through the flow to find the gap.

---

## 9. Troubleshooting

### 9.1 Flow Won't Validate

| Error | Why | Fix |
|---|---|---|
| "Flow must have a Start node" | The Start node was deleted | Click **Add Start Node** or reset the flow |
| "Unconnected nodes found" | A node is not connected to the graph | Connect it or remove it |
| "Decision node has N edges but M branches" | Mismatch between branch count and edge count | Add or remove edges to match the branch count |
| "Calculator references undeclared variable" | Variable name in expression is not in the Variables Manager | Declare the variable or fix the name |
| "Form Field binds to undeclared variable" | `bindToVariable` references a variable that doesn't exist | Declare it or fix the binding |
| "No terminal node found" | No Summary or Redirect node at the end | Add a Summary or Redirect node |

### 9.2 Preview Shows Wrong Values

1. **Refresh the preview** — the preview modal caches the flow data at open time.
2. **Check variable default values** — if a variable has a default, it's used until overwritten.
3. **Verify edge connections** — an incorrectly routed edge can cause nodes to execute out of order.
4. **Clear and reset** — click **Reset** in the preview to start fresh.

### 9.3 Published Form Behaves Differently from Preview

Preview runs entirely on the client side. The published form makes server calls. Differences are rare but can happen if:

- A server function throws an error that the preview doesn't replicate
- The database has stale data (e.g., a gateway was deactivated)
- Permissions or authentication is blocking a server call

### 9.4 Performance Tips

| Issue | Solution |
|---|---|
| Too many Calculator nodes in sequence | Combine simple expressions: instead of 3 calculators for `a * 0.12`, `a + vat`, `result + deposit`, use `({{a}} * 1.12) + {{deposit}}` |
| Very long Summary template | Keep it concise — the template is rendered with all variables which can be slow |
| Too many checkbox options in one field | Consider splitting into categories with Decision nodes |

---

## Appendix: Quick Reference — Expression Examples

Copy-paste these into your Calculator nodes:

| What You Want | Expression | Target Variable | Input Variables |
|---|---|---|---|
| Add 12% VAT | `{{subtotal}} * 0.12` | `vat_amount` | `subtotal` |
| Total with VAT | `{{subtotal}} * 1.12` | `total_cost` | `subtotal` |
| Monthly installment (6 months) | `round({{total}} / 6, 2)` | `monthly` | `total` |
| Monthly installment (12 months) | `round({{total}} / 12, 2)` | `monthly` | `total` |
| 10% discount | `{{price}} * 0.9` | `discounted` | `price` |
| Quantity × unit price | `{{qty}} * {{unit_price}}` | `line_total` | `qty`, `unit_price` |
| Tiered pricing (>10 qty) | `{{qty}} > 10 ? 50 : 100` | `unit_price` | `qty` |
| Grand total with deposits | `{{fees_total}} + {{vat_amount}} + {{deposits_total}}` | `grand_total` | `fees_total`, `vat_amount`, `deposits_total` |
| Free shipping if over ₱2000 | `{{subtotal}} >= 2000 ? 0 : 350` | `shipping` | `subtotal` |
| Minimum charge of ₱500 | `{{computed}} < 500 ? 500 : {{computed}}` | `final_amount` | `computed` |
| Late payment penalty (5%) | `{{days}} > 30 ? {{amount}} * 1.05 : {{amount}}` | `amount_due` | `days`, `amount` |

---

> **Next steps:** Try building these flows yourself using the **Preview** mode. Once you're comfortable, explore the [Flow Builder Knowledge Base](flow-builder-guide.md) for the complete technical reference including server API, validation rules, and architecture.
