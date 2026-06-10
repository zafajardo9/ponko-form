# Flow Form Guide — Tutorial & Computation Handbook

> **Build real-world flow forms** — from simple contact forms to multi-service order forms with payment. This guide walks you through complete examples with step-by-step instructions.

**New here?** Start with the [Getting Started guide](getting-started.md) first.

---

## Table of Contents

1. [What Is a Flow Form?](#1-what-is-a-flow-form)
2. [Building Blocks — Nodes, Variables & Edges](#2-building-blocks--nodes-variables--edges)
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

1. **Fills in fields** one step at a time
2. **Makes choices** that determine what happens next
3. **Sees automatic calculations** (VAT, totals, discounts)
4. **May pay** via integrated checkout
5. **Gets a receipt** or confirmation

> **Flow form vs. linear form:** A linear form shows all fields on one page, same for everyone. A flow form guides each respondent on their own unique journey.

### What Can You Build?

| Example | Key Features |
|---|---|
| **Payment Plan** | Branch (pick a plan) → Calculator (add VAT) → Payment → Receipt |
| **Service Order** | Select services from catalog → Sum fees → Add deposits → Show breakdown |
| **Registration + Payment** | Fill details → Calculate fee → Charge card → Confirmation |
| **Quote Request** | Answer questions → Compute estimate → Email summary |

---

## 2. Building Blocks — Nodes, Variables & Edges

A flow is a **graph** made of three things:

- **Nodes** — each step in the flow (a field, a calculation, a payment)
- **Edges** — connections that determine the path through nodes
- **Variables** — data that flows through the graph

### 2.1 Node Types at a Glance

```
  Start ──→ Form Field ──→ Decision ──→ Calculator ──→ Payment ──→ Summary
   (begin)    (ask)        (branch)      (compute)     (charge)     (end)
```

| Node | Icon | Purpose | Example |
|---|---|---|---|
| **Start** | ▶️ | Marks the beginning (auto-created) | — |
| **Form Field** | ☐ | Asks the respondent for input | Name, email, dropdown, checkbox |
| **Group** | 📋 | Collects multiple fields on one step | Address block (street + city + zip) |
| **Decision** | ◇ | Branches based on an answer | "Are you a student? → Yes / No" |
| **Calculator** | ∑ | Computes a value from other values | `subtotal * 1.12` (add 12% VAT) |
| **Payment** | $ | Charges the respondent | Amount due via PayPal/Xendit |
| **Summary** | ≡ | Shows a confirmation/receipt | "Thanks! Your order total is $120.00" |
| **Redirect** | ↗ | Sends the respondent to a URL | "Click here to access your dashboard" |

### 2.2 Variables — The Data Backbone

Variables are the **memory** of your flow. Every answer, every calculation result — it's stored in a variable.

```
  Step 1: "What's your name?"  →  stored in  {{full_name}}
  Step 2: "How many items?"    →  stored in  {{quantity}}
  Step 3: Calculator computes  →  stored in  {{total_cost}}  =  {{quantity}} * 10
  Step 4: "Pay {{total_cost}}" →  Payment node charges that amount
```

#### Variable Types

| Type | Stores | Example Values |
|---|---|---|
| `string` | Text | `"Juan Dela Cruz"`, `"full"`, `"yes"` |
| `number` | Plain numbers | `5`, `100`, `0.5` |
| `money` | Currency amounts | `150000` (stored as cents — represents ₱1,500.00) |
| `boolean` | True/false | `true`, `false` |

> **Money is stored in the smallest currency unit** (cents, centavos, sen). ₱1,500.00 is stored as `150000`. When displayed, it auto-formats as `₱1,500.00`. **Never use decimals for money** — use integers and let the system format it.

#### Variable Lifecycle

```
  Declare ──→ Assign (by form field) ──→ Transform (by calculator) ──→ Use (payment/template)
   (create      (respondent fills    (calculator computes     (payment charges,
    variable)     in a field)          new value)               template displays)
```

### 2.3 How Edges Work

Edges are the **arrows** connecting nodes. They determine:

- **The order** of steps (which node comes next)
- **Branches** (which path to take based on a decision)
- **Fallthrough** (when all branches lead to the same place)

```
  [Ask: Payment Plan?] ────"full"────→ [Calculator: Full Total]
                      └───"installment"─→ [Calculator: Monthly]
                                              │
                                  Both converge here
                                              │
                                       [Payment: Charge]
```

---

## 3. Tutorial 1: Payment Plan Flow

**What you'll build:** A form where the respondent picks a payment plan (Full Payment or 6-month Installment), the system calculates the total with VAT, and charges accordingly.

```
  Start → Choose Plan → Decision → [Full: Calc Full Total] → Payment → Summary
                                    [Installment: Calc Monthly]
```

### Step 1: Plan Your Variables

First, declare these variables in the **Variables Manager** (click "Variables" in the toolbar):

| Variable | Type | Default | Description |
|---|---|---|---|
| `payment_plan` | string | `full` | Selected plan |
| `subtotal` | money | `10000` | Base price (₱100.00) |
| `amount_due` | money | — | Final amount to charge |
| `payment_ref` | string | — | Gateway reference (auto-filled) |

> **Tip:** Setting `subtotal`'s default to `10000` means you can test without filling in a field for it. Change it later to whatever your base price should be.

### Step 2: Build the Node Chain

From the palette, add these nodes in order:

```
1. Start (auto-created)
2. Form Field → "Select" type → label: "Choose Payment Plan"
3. Decision
4. Calculator (for Full Payment path)
5. Calculator (for Installment path)
6. Payment
7. Summary
```

### Step 3: Configure Each Node

#### Form Field: "Choose Payment Plan"

| Field | Value |
|---|---|
| **Label** | `Choose your plan` |
| **Field Type** | `Select` |
| **Required** | ✅ |
| **Options** | `Full Payment` → `full`, `Installment (6 months)` → `installment` |
| **Bind to Variable** | `payment_plan` |

#### Decision: Route by Plan

| Field | Value |
|---|---|
| **Source Variable** | `payment_plan` |
| **Branches** | `full` → label "Full Payment", `installment` → label "Installment" |

Connect the decision's `full` branch to **Calculator 1** and `installment` to **Calculator 2**.

#### Calculator 1: Full Payment Total

| Field | Value |
|---|---|
| **Target Variable** | `amount_due` |
| **Expression** | `{{subtotal}} * 1.12` |
| **Label** | `Full payment total incl. 12% VAT` |

This multiplies the subtotal by 1.12 (adds 12% VAT) and stores it in `amount_due`.

#### Calculator 2: Installment Monthly

| Field | Value |
|---|---|
| **Target Variable** | `amount_due` |
| **Expression** | `round(({{subtotal}} * 1.12) / 6, 2)` |
| **Label** | `Monthly payment over 6 months` |

Same VAT calculation, but divided by 6 months and rounded to 2 decimal places.

> **Both calculators write to `amount_due`** — whichever path the respondent takes, the payment node charges the correct amount. This is a common pattern: decisions route to different calculators, but they all write to the same variable.

#### Payment: Charge

| Field | Value |
|---|---|
| **Amount Variable** | `amount_due` |
| **Currency** | `USD` (or your preferred currency) |

> The gateway selection happens at checkout time — the respondent chooses from whatever payment methods you've connected in Settings.

#### Summary: Confirmation

| Field | Value |
|---|---|
| **Title** | `Order Confirmation` |
| **Template** | `Thank you! Plan: {{payment_plan}}. Amount due: {{amount_due}}. Reference: {{payment_ref}}.` |

### Step 4: Connect the Edges

Your final flow should look like:

```
  [Start]
     │
  [Choose Plan] (form_field)
     │
  [Decision: payment_plan]
     ├─── "full" ───→ [Calc: Full Total] ──┐
     └─── "installment" → [Calc: Monthly] ──┘
                                              │
                                          [Payment: Charge]
                                              │
                                          [Summary]
```

### Step 5: Test It

1. Click **Preview**
2. Pick "Full Payment" → the total should be `₱112.00` (₱100 × 1.12)
3. Go back, pick "Installment" → the monthly should be `₱18.67` (₱112 ÷ 6)
4. Verify the payment step shows the correct amount

---

## 4. Tutorial 2: Multi-Service Order Flow

**What you'll build:** A service order form where respondents select multiple services from a catalog. The system calculates fees, adds VAT and deposits, and shows a full breakdown.

```
  Personal Info → Service Selection → Calculate Totals → Summary
```

### Step 1: Plan Your Variables

| Variable | Type | Default | Description |
|---|---|---|---|
| `full_name` | string | — | Client's full name |
| `email` | string | — | Client's email |
| `phone` | string | — | Contact number |
| `address` | string | — | Client address |
| `selected_services` | string | — | Comma-separated service slugs |
| `total_fee` | money | `0` | Sum of all service fees |
| `vat_amount` | money | `0` | 12% VAT on total fee |
| `total_deposit` | money | `0` | Sum of all service deposits |
| `grand_total` | money | `0` | Total fee + VAT + deposits |

### Step 2: Build the Node Chain

```
  Start → Full Name → Email → Phone → Address → Service Selector → Calc Fees → Calc VAT → Calc Deposits → Calc Grand Total → Summary
```

### Step 3: Configure Each Node

Add form fields for `full_name` (Text), `email` (Email), `phone` (Text), and `address` (Textarea). Each binds to its respective variable.

#### The Service Selector (Group node)

A **Group** node collects multiple fields on one step. For the service catalog, add checkbox fields:

| Field | Label | Value | Bind To |
|---|---|---|---|
| Checkbox | `No Derogatory Check` | `no_derogatory_check` | `selected_services` |
| Checkbox | `Tourist Visa Extension` | `tourist_visa_extension` | `selected_services` |
| Checkbox | `Permanent Residence` | `permanent_residence` | `selected_services` |
| Checkbox | `Work Permit Renewal` | `work_permit_renewal` | `selected_services` |
| Checkbox | `Business Registration` | `business_registration` | `selected_services` |

> Each service has an associated **fee** and **deposit** amount. In the flow, you'll use calculators to look up these amounts based on what the respondent selected.

#### Calculator: Calculate Total Fees

| Field | Value |
|---|---|
| **Target Variable** | `total_fee` |
| **Expression** | A calculator that sums fees based on selected services |

This is where the **service catalog** comes in. Use conditional expressions to sum fees:

```
if(contains({{selected_services}}, 'no_derogatory_check'), 5000, 0) + 
if(contains({{selected_services}}, 'tourist_visa_extension'), 3000, 0) +
...
```

#### Calculator: Calculate VAT

| Field | Value |
|---|---|
| **Target Variable** | `vat_amount` |
| **Expression** | `{{total_fee}} * 0.12` |

#### Calculator: Calculate Total Deposits

Similar to fees — sum deposits for selected services.

#### Calculator: Grand Total

| Field | Value |
|---|---|
| **Target Variable** | `grand_total` |
| **Expression** | `{{total_fee}} + {{vat_amount}} + {{total_deposit}}` |

### Step 4: Walk Through a Real Calculation

A respondent selects "No Derogatory Check" (₱5,000 fee, ₱3,000 deposit) and "Work Permit Renewal" (₱8,000 fee, ₱5,000 deposit):

| Step | Calculation | Result |
|---|---|---|
| Total Fee | 5,000 + 8,000 | ₱13,000.00 |
| VAT (12%) | 13,000 × 0.12 | ₱1,560.00 |
| Total Deposit | 3,000 + 5,000 | ₱8,000.00 |
| **Grand Total** | 13,000 + 1,560 + 8,000 | **₱22,560.00** |

---

## 5. Computation Patterns

This section covers every calculation pattern you'll need. Each pattern includes a **template** and a **real example**.

### 5.1 Basic Arithmetic

| Pattern | Expression | Example |
|---|---|---|
| Add | `{{price}} + {{shipping}}` | Item price + shipping cost |
| Subtract | `{{total}} - {{discount}}` | Total minus discount |
| Multiply | `{{quantity}} * {{unit_price}}` | Qty × price |
| Divide | `{{total}} / {{installments}}` | Split into payments |

### 5.2 Conditional / Ternary

```
if({{variable}} == 'value', result_if_true, result_if_false)
```

**Example:** Discount for students
```
if({{user_type}} == 'student', {{total}} * 0.9, {{total}})
```
Gives 10% off if the respondent is a student, otherwise charges full price.

**Nested conditional (multi-branch):**
```
if({{tier}} == 'premium', 100, if({{tier}} == 'standard', 50, 25))
```

### 5.3 Multi-Step Computations

Break complex math into multiple calculator nodes:

```
Calculator 1: subtotal = sum of item prices
Calculator 2: discount = subtotal * 0.1 (10% off)
Calculator 3: after_discount = subtotal - discount
Calculator 4: tax = after_discount * 0.12
Calculator 5: total = after_discount + tax
```

Each calculator stores its result in a different variable. The next calculator reads from the previous one.

### 5.4 Working with Money

| Pattern | Expression |
|---|---|
| Add VAT (12%) | `{{amount}} * 1.12` |
| Apply discount (10%) | `{{amount}} * 0.9` |
| Split into installments | `{{amount}} / 6` |
| Round to 2 decimals | `round({{amount}}, 2)` |

> **Always round money values:** `round({{amount}}, 2)` ensures you don't end up with fractions of a cent.

### 5.5 Useful Built-in Functions

| Function | What It Does | Example |
|---|---|---|
| `round(x, n)` | Rounds x to n decimal places | `round({{total}} / 6, 2)` |
| `if(cond, a, b)` | Returns `a` if true, `b` if false | `if({{age}} >= 18, 'adult', 'minor')` |
| `contains(str, substr)` | Checks if string contains substring | `contains({{items}}, 'premium')` |

---

## 6. Decision & Branching Patterns

### 6.1 Two-Way Branch (Yes/No)

```
  [Decision: has_discount?]
     ├─── "yes" ───→ [Calculator: Apply discount]
     └─── "no" ────→ [Calculator: Full price]
                          │
                    Both converge
                          │
                      [Payment]
```

The decision's **Source Variable** should be a boolean or a form field with two options (e.g., "Yes"/"No").

### 6.2 Multi-Way Branch

```
  [Decision: plan_type]
     ├─── "basic" ──────→ [Calc: Basic pricing]
     ├─── "pro" ────────→ [Calc: Pro pricing]
     ├─── "enterprise" ──→ [Calc: Enterprise pricing]
     └─── default ──────→ [Calc: Default pricing]
```

Each edge from the decision node has a **matchValue** that corresponds to one of the options. The runtime picks the matching edge.

### 6.3 Converging Paths

After branching, paths often need to come back together (converge). This is done by having multiple edges point to the same node:

```
  [Branch A] ──→ [Calculator A] ──┐
                                    ├──→ [Summary]
  [Branch B] ──→ [Calculator B] ──┘
```

Both Calculator A and Calculator B connect to the same Summary node. Whichever branch was taken arrives at the same place.

### 6.4 What NOT to Do

- **Don't create loops** — the flow engine is a directed graph. Going back to a previous node isn't supported.
- **Don't fork without converging** — every split should eventually lead back to a common path (or both lead to terminal nodes).
- **Don't leave a node disconnected** — every node (except terminal ones) must have an outgoing edge.

---

## 7. Payment Integration

See the dedicated [Payments Guide](payments-guide.md) for full details. Here's a quick summary:

### Setting Up a Payment Node

1. Connect a gateway in **Settings** (PayPal or Xendit)
2. Add a **Payment** node to your flow
3. Set the **Amount Variable** — this variable must be computed by a calculator before the payment step
4. Set the **Currency**

### Transaction Records

Every payment is automatically recorded. To view them:

- **From the form editor:** Click the **Payments** tab
- **From Responses:** Each response shows a payment status badge
- **Detail view:** Click a transaction to see full details including gateway reference, payment channel, and raw gateway response

---

## 8. Testing & Debugging

### 8.1 Before You Publish

1. **Use Preview** — click "Preview" in the editor to walk through your flow as a respondent would
2. **Check every branch** — if you have a Decision node, test each option
3. **Verify calculations** — use a calculator or spreadsheet to compute expected values, then compare
4. **Test with "Skip Required"** — the checkbox at the bottom of each field step lets you quickly jump through

### 8.2 Common Calculator Bugs

| Symptom | Likely Cause |
|---|---|
| Result is `NaN` | Division by zero, or one of the variables hasn't been assigned a value yet |
| Result is `undefined` | Variable name is misspelled in the expression |
| Wrong total | Operator precedence: `{{a}} + {{b}} * {{c}}` multiplies first! Use parentheses: `({{a}} + {{b}}) * {{c}}` |
| Money shows `0.00` | The variable default is `0` — make sure a calculator has run before it's displayed |

### 8.3 Debugging with the Summary Template

The summary template is your best debugging tool. Use it to inspect intermediate values:

```
=== DEBUG ===
Subtotal: {{subtotal}}
Discount: {{discount}}
After discount: {{after_discount}}
VAT: {{vat_amount}}
Grand total: {{grand_total}}
Selected plan: {{payment_plan}}
```

Run through the flow in Preview and check that each value is what you expect.

### 8.4 Calculator Expression Tester

When configuring a Calculator node, use the built-in **tester** to plug in sample values and see the result instantly:

```
Expression:  round(({{subtotal}} * 1.12) / 6, 2)

Sample values:
  subtotal = 10000  →  Result: 1866.67
  subtotal = 50000  →  Result: 9333.33
```

This lets you verify your expression before any respondent sees it.

---

## 9. Troubleshooting

### 9.1 Flow Won't Validate

| Error | What It Means | Fix |
|---|---|---|
| `Flow has no Start node` | The Start node was deleted | Add a new Start node from the palette |
| `Node has no outgoing edge` | A node isn't connected to anything | Drag an edge from its output dot to the next node |
| `Decision node has no branches` | No edges from the decision node | Connect edges with match values for each branch |
| `Payment node has no amount variable` | The amount variable is not set | Open the Payment node config and pick a variable |
| `Calculator target variable not set` | The target variable is missing | Open the Calculator config and set the target variable |
| `Multiple start nodes detected` | There's more than one Start | Delete the extra Start nodes |

### 9.2 Preview Shows Wrong Values

1. **Check defaults** — variables with default values start with those values. Set defaults to `0` for money/number types.
2. **Check expression order** — calculators run in the order they're connected. Make sure the calculator computing the total comes before the payment node.
3. **Spelling matters** — `{{total_cost}}` and `{{totalcost}}` are different variables.
4. **Use the Summary debug trick** — put `{{variable_name}}` in the summary template to see what value it holds.

### 9.3 Published Form Behaves Differently from Preview

| Possible Cause | Check |
|---|---|
| You changed the flow after publishing | Re-publish the form to apply changes |
| The respondent is using a different browser | Test in the same browser |
| Required fields are blocking progress | Make sure you filled all required fields in the test |

### 9.4 Performance Tips

| Tip | Why |
|---|---|
| **Limit Decision branches to 10** | More branches make the graph hard to read and maintain |
| **Use Group nodes for related fields** | Fewer steps = faster completion |
| **Set sensible defaults** | Respondents see pre-filled values when applicable |
| **Test with realistic data** | A catalog with 50+ services may slow the calculator |

---

## Appendix: Quick Reference — Expression Examples

| Goal | Expression |
|---|---|
| Add VAT (12%) | `{{subtotal}} * 1.12` |
| Apply discount (10%) | `{{total}} * 0.9` |
| Add two values | `{{price}} + {{shipping}}` |
| Subtract | `{{total}} - {{discount}}` |
| Divide into parts | `{{amount}} / {{parts}}` |
| Round money | `round({{value}}, 2)` |
| Conditional discount | `if({{is_member}} == 'yes', {{total}} * 0.85, {{total}})` |
| String contains check | `contains({{items}}, 'premium')` |
| Nested conditional | `if({{tier}} == 'gold', 100, if({{tier}} == 'silver', 50, 25))` |
| Percentage of total | `({{part}} / {{total}}) * 100` |
