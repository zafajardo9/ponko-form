# AI Knowledge Bank — PonkoForm

> **Comprehensive reference of all form fields, flow mechanics, and system behaviors.**
> Last updated: 2026-07-24

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Form Field Types](#2-form-field-types)
3. [Flow Builder — Node Types & Mechanics](#3-flow-builder--node-types--mechanics)
4. [The Flow Engine — Runtime Mechanics](#4-the-flow-engine--runtime-mechanics)
5. [Variables System](#5-variables-system)
6. [Expression & Calculator Language](#6-expression--calculator-language)
7. [Payment System](#7-payment-system)
8. [Subscription System](#8-subscription-system)
9. [Page Builder Mechanics](#9-page-builder-mechanics)
10. [Field Conditions (Show/Hide Logic)](#10-field-conditions-showhide-logic)
11. [Form References](#11-form-references)
12. [Validation Rules](#12-validation-rules)
13. [Invoicing & Email System](#13-invoicing--email-system)
14. [Submission & Response System](#14-submission--response-system)
15. [Dashboard & Analytics](#15-dashboard--analytics)
16. [Public Form Experience](#16-public-form-experience)
17. [Data Model Reference](#17-data-model-reference)
18. [Route Structure](#18-route-structure)
19. [Safety Limits & Constraints](#19-safety-limits--constraints)

---

## 1. System Overview

PonkoForm is a flexible form creation tool (similar to Google Forms) with integrated payment gateway support. It offers two form-building paradigms:

| Paradigm | Description | When to Use |
|---|---|---|
| **Page Builder** | Traditional linear multi-page forms with independent pages | Simple surveys, contact forms, linear workflows |
| **Flow Builder** | Visual node-graph editor for branching logic, calculations, and conditional paths | Complex processes (payment plans, service calculators, branching apps) |

**Tech Stack:** TanStack React Start + Clerk Auth + Neon (PostgreSQL) + Drizzle ORM

**Payment Gateways:** Bring-your-own-gateway model — PayPal (multi-currency) and Xendit (PHP only), extensible via registry pattern.

---

## 2. Form Field Types

All 17 field types available in the form builder:

### Input Fields

| Field Type | DB Enum | Description | UX |
|---|---|---|---|
| **Text** | `text` | Single-line text input | `<input type="text">` |
| **Email** | `email` | Email input with validation | `<input type="email">` — validated via regex |
| **Number** | `number` | Numeric input | `<input>` — validated with `isNaN()` |
| **Long Text** | `textarea` | Multi-line text area | `<textarea>` — supports rich text in builder mode |
| **Dropdown** | `select` | Single-select from options | `<select>` |
| **Checkboxes** | `checkbox` | Multi-select from options | Array of checkbox inputs — value is `string[]` |
| **Radio** | `radio` | Single-select radio buttons | Radio group |

### Date/Time Fields

| Field Type | DB Enum | Description |
|---|---|---|
| **Date** | `date` | Date picker |
| **Time** | `time` | Time picker |
| **Date & Time** | `datetime` | Combined date + time picker |

### Special Display Fields

| Field Type | DB Enum | Description |
|---|---|---|
| **Content** | `content` | Static rich-text content block (not an input — rendered as HTML with XSS sanitization) |
| **Media** | `media` | Image/video display — supports URLs, auto-detects images via `isImageUrl()` |

### Advanced Fields

| Field Type | DB Enum | Description | Custom Config |
|---|---|---|---|
| **Address** | `address` | Structured address form | Composite value `{ currentAddress, apartment, country, city, stateProvince, zipPostalCode }` — each sub-field can be toggled as required via options |
| **File Upload** | `file_upload` | File attachment | Configurable accept types (`any`, `image`, `document`, `custom`), multiple files toggle — value is `UploadFileValue[]` (name, size, type, dataUrl) |
| **Satisfaction** | `satisfaction` | Star/numeric rating | Renders SVG stars (1–5) or numeric options — hover state tracked client-side |
| **Computation** | `computation` | Auto-calculated field | See [Page Builder Mechanics](#9-page-builder-mechanics) — computed server-side from other fields/references |
| **Payment** | `payment` | Legacy page-builder payment field | Used in page-builder forms (not in flow builder) |

### Security Field

| Field Type | DB Enum | Description |
|---|---|---|
| **reCAPTCHA** | `recaptcha` | Google reCAPTCHA anti-bot | Requires `recaptchaSiteKey` on the form — rendered as `<RecaptchaField>` |

### Field Option Shape

All option-based fields (select, checkbox, radio, satisfaction) use:

```ts
interface FieldOption {
  label: string
  value: string
  emoji?: string | null
  price?: number | null          // Direct price for this option
  priceReference?: string | null  // Reference key for dynamic pricing
  additionalPrice?: number | null
  additionalPriceReference?: string | null
}
```

---

## 3. Flow Builder — Node Types & Mechanics

### 3.1 Node Types at a Glance

```
  Start ──→ Form Field ──→ Decision ──→ Calculator ──→ Payment ──→ Summary
   (begin)    (ask)        (branch)      (compute)     (charge)     (end)
```

| Node | Icon | Purpose | Example |
|---|---|---|---|
| **Start** | ▶️ | Marks the beginning (auto-created) | — |
| **Form Field** | ☐ | Asks the respondent for input | Name, email, dropdown, checkbox |
| **Group** | 📋 | Collects multiple fields on one step | Address block (street + city + zip) |
| **Decision** | ◇ | Branches based on a variable value | "Are you a student? → Yes / No" |
| **Calculator** | ∑ | Computes a value from variables | `subtotal * 1.12` (add 12% VAT) |
| **Payment** | $ | Charges the respondent via gateway | Amount due via PayPal/Xendit |
| **Summary** | ≡ | Shows a confirmation/receipt | "Thanks! Your order total is $120.00" |
| **Redirect** | ↗ | Sends the respondent to a URL | Redirect after form completion |

### 3.2 Edge (Connection) Rules

Edges are **directed connections** between nodes. They control step ordering and branching.

| Node Type | Required Outgoing Edges | Notes |
|---|---|---|
| **Start** | Exactly 1 | First step of the flow |
| **Form Field** | Exactly 1 | Linear progression |
| **Group** | Exactly 1 | Linear progression |
| **Calculator** | Exactly 1 | Auto-advances after computation |
| **Decision** | ≥ number of branches | Each branch value needs its own edge. Edges carry a `matchValue` in metadata |
| **Payment** | 1 (success) or 2 (success + failure) | First edge = success path, second edge = failure path |
| **Summary** | 0 | Terminal node — no outgoing edges allowed |
| **Redirect** | 0 | Terminal node — no outgoing edges allowed |

### 3.3 Node Configurations

**Form Field:**
```json
{
  "fieldType": "text",        // One of the 17 field types
  "label": "Your Name",
  "placeholder": "Enter name",
  "required": true,
  "options": [...],           // For select/checkbox/radio
  "bindToVariable": "name"    // Maps to a declared flow variable
}
```

**Group:** Renders multiple fields on a single step.
```json
{
  "fields": [
    {
      "id": "g1",             // Stable client-side ID for keying inputs
      "fieldType": "text",
      "label": "Street",
      "required": true,
      "bindToVariable": "street"
    }
  ]
}
```

**Decision:** Branches based on a variable's value.
```json
{
  "sourceVariable": "plan_type",
  "branches": [
    { "value": "full", "label": "Full Payment" },
    { "value": "installment", "label": "Installment" }
  ]
}
```

**Calculator:** Evaluates an expression and stores the result.
```json
{
  "targetVariable": "total_cost",
  "expression": "{{subtotal}} * 1.12",
  "label": "Total with VAT"
}
```

**Payment:** Charges a computed amount.
```json
{
  "amountVariable": "total_cost",
  "currency": "PHP",
  "gatewayId": null           // Gateway resolved at checkout from connected gateways
}
```

**Summary:** Displays a dynamic confirmation template.
```json
{
  "title": "Order Confirmation",
  "template": "Thanks {{name}}! Total: ₱{{total_cost}}"
}
```

**Redirect:** Sends respondent to a URL (supports variable interpolation).
```json
{
  "urlTemplate": "https://example.com/dashboard?order={{order_id}}"
}
```

---

## 4. The Flow Engine — Runtime Mechanics

The `FlowEngine` (in `src/lib/flow-engine/FlowEngine.ts`) drives step-by-step execution:

### 4.1 Lifecycle

```
Constructor(flowDef) → getCurrentStep() → advance(input) → getCurrentStep() → ...
                                                                           → isComplete() === true
```

### 4.2 Key Behaviors

- **Auto-advance through Calculators:** When the next node is a Calculator, the engine auto-advances through it immediately (no user interaction needed).
- **Terminal auto-completion:** Reaching a Summary or Redirect node sets `completed = true`.
- **Variable coercion:** Raw string inputs are coerced to the declared variable type:
  - `number` / `money` → parsed via `parseFloat()`
  - `boolean` → converted from `"true"` / `"1"` / `"yes"`
  - `money` results are rounded to 2 decimal places after calculator evaluation
- **Money type:** Stored in smallest currency unit (cents/centavos). ₱1,500.00 = `150000`.
- **Back navigation:** `goBack()` pops the history stack (requires at least 2 entries).
- **Resume after payment redirect:** `FlowEngine.restore()` rebuilds the engine at the payment node position with preserved variables and history.

### 4.3 Decision Routing

When advancing from a Decision node:
1. Uses `input.decisionValue` if provided, otherwise falls back to `variableValues[sourceVariable]`
2. Finds the outgoing edge whose `metadata.matchValue` matches the selected value
3. Falls through to the first edge if no match

### 4.4 Payment Routing

When advancing from a Payment node:
- `paymentResult.success === true` → follows the **first** outgoing edge (success path)
- `paymentResult.success === false` → follows the **second** outgoing edge (failure path), or first if no failure edge
- Stores `payment_ref` variable with `gatewayPaymentId`

### 4.5 Execution Persistence

`getSnapshot()` returns a serializable `FlowExecutionContext`:
```ts
{
  executionId, flowId, status,
  currentNodeId, variables, history
}
```
Persisted to DB via `startFlowExecution()`, `advanceExecution()`, `completeExecution()` server functions.

---

## 5. Variables System

### 5.1 Variable Types

| Type | Stores | Example |
|---|---|---|
| `string` | Text | `"Juan Dela Cruz"` |
| `number` | Plain numbers | `5`, `100`, `0.5` |
| `money` | Currency (smallest unit) | `150000` = ₱1,500.00 |
| `boolean` | True/false | `true`, `false` |
| `date` | Date values | ISO date strings |
| `time` | Time values | Time strings |
| `datetime` | Date + time values | ISO datetime strings |

### 5.2 Variable Lifecycle

```
  Declare ──→ Assign (by form field) ──→ Transform (by calculator) ──→ Use (payment/template)
```

1. **Declare** in the Variables Manager (per flow)
2. **Assign** when a form field binds to it (`bindToVariable`)
3. **Transform** via Calculator nodes
4. **Use** in Payment nodes (amount), Summary templates, and Redirect URLs

### 5.3 Best Practices

- Name variables in `snake_case` (e.g., `full_name`, `total_cost`)
- Declare all variables **before** configuring nodes that reference them
- Money variables: use integers, never decimals
- Check for undefined variables in Calculator expressions — missing variables throw errors

---

## 6. Expression & Calculator Language

The calculator uses a **custom safe expression parser** (`ExpressionEvaluator` + `safe-expression.ts`) — it never executes raw JavaScript.

### 6.1 Syntax

- Variable substitution: `{{variable_name}}`
- Arithmetic: `+`, `-`, `*`, `/`, `%`, `^` (exponentiation)
- Comparison: `>`, `>=`, `<`, `<=`, `==`, `!=`
- Logical: `and`, `or`, `not` (also `&&`, `||`, `!`)
- Ternary: `condition ? valueIfTrue : valueIfFalse`
- Grouping: Parentheses `()`

### 6.2 Built-in Functions

| Function | Signature | Description |
|---|---|---|
| `if(cond, then, else)` | `if(any, any, any) → any` | Conditional selection |
| `contains(value, search)` | `contains(string\|array, string) → boolean` | Check inclusion (arrays or substrings) |
| `round(value, decimals?)` | `round(number, number?) → number` | Round to N decimal places (default 0) |
| `sum(...values)` | `sum(number...) → number` | Sum all arguments |
| `min(...values)` | `min(number...) → number` | Minimum of arguments |
| `max(...values)` | `max(number...) → number` | Maximum of arguments |
| `abs(value)` | `abs(number) → number` | Absolute value |
| `equalText(left, right)` | `equalText(string, string) → boolean` | String equality check |

### 6.3 Common Patterns

```js
// Basic arithmetic
{{subtotal}} * 1.12                    // Add 12% VAT

// Conditional
{{plan}} == "premium" ? 5000 : 2000    // Premium vs basic pricing

// Multi-step (chain calculators)
// Calc 1: total = {{quantity}} * {{price}}
// Calc 2: final = {{total}} * 1.12

// Complex pricing
({{item_a}} * {{price_a}}) + ({{item_b}} * {{price_b}})
```

### 6.4 Safety Constraints

| Constraint | Limit |
|---|---|
| Max expression length | 10,000 characters |
| Max tokens | 1,000 |
| Max parse depth | 100 |
| Max AST nodes | 500 |
| Reserved names | `add`, `subtract`, `multiply`, `divide`, `mod`, `pow`, `and`, `or`, `not`, etc. |

---

## 7. Payment System

### 7.1 Gateway Model

Bring-your-own-gateway — no platform fees. Money goes directly to your PayPal/Xendit account.

| Gateway | Currencies | Features |
|---|---|---|
| **PayPal** | Most major (USD, EUR, GBP, etc.) | One-time payments |
| **Xendit** | PHP only | One-time + subscriptions (MIT/recurring) |

### 7.2 Payment Flow

```
  Calculator (compute total) → Payment Node → Gateway Checkout → Return → Summary/Receipt
```

### 7.3 Payment Statuses

| Status | Meaning |
|---|---|
| `pending` | Awaiting confirmation (e.g., bank transfer) |
| `completed` | Payment successful |
| `failed` | Declined or expired |
| `refunded` | Refunded to customer |

### 7.4 Payment Node (Flow Builder)

- Requires a declared variable for the amount (`amountVariable`)
- Currency configurable per node
- Gateway resolved dynamically from connected gateways at checkout
- Respondent sees amount + available payment methods + "Pay Now" button
- Success/failure routing via edges

### 7.5 Payment Node (Page Builder - Legacy)

- Page-level payment toggle (`hasPayment`)
- `PaymentComputation` determines the amount:
  - `field` — bind to a single field's value
  - `sum_priced_options` — sum option prices from a field
  - `sum_number_fields` — sum all number-type fields on the page
  - `fixed` — constant amount
  - `formula` — reference-based adjustments

### 7.6 Payment Tracking

- **Payments tab** on form editor (`/forms/{formId}/payments`)
- Columns: Invoice #, Date, Amount, Status, Gateway, Channel, Reference
- Detail dialog: Full payment info + raw gateway response
- **Responses tab**: Each submission row shows payment status badge
- **Payment Events**: Webhook events stored in `payment_events` table for traceability

---

## 8. Subscription System

### 8.1 Page-Builder Subscriptions (Xendit only)

Available on page-builder forms (flow-builder subscriptions planned separately).

**Configuration:**
1. Add **Name** and **Email** fields before the payment page
2. Enable payment on a later page, select **Subscription**
3. Select Xendit (currency fixed to **PHP**)
4. Map customer name/email fields
5. Choose billing interval: `weekly`, `monthly`, `quarterly`, `semiannual`, `annual`
6. Optional: trial period (0–365 days), max cycles

### 8.2 Subscription Lifecycle

- **Completion:** Form response considered complete when checkout session is completed + recurring plan is active
- **Cycles:** Each automatic debit recorded as its own `subscription_cycles` row via Xendit webhooks
- **Cancellation:** Managed in Xendit dashboard in phase 1. PonkoForm reflects inactive/cancelled state
- **Reconciliation:** Active subscriptions periodically reconciled against Xendit to recover missed webhooks

### 8.3 Subscription Config Shape

```ts
{
  enabled: true,
  interval: 'monthly',
  intervalUnit: 'MONTH',
  intervalCount: 1,
  trialPeriodDays: 0,
  maxCycles: null | number,
  customerNameField: 'bind_name',
  customerEmailField: 'bind_email'
}
```

---

## 9. Page Builder Mechanics

### 9.1 Pages

- Forms contain one or more **pages** (`formPages` table)
- Each page has `position` (ordering), `title`, `description`
- **Final page:** `isFinal = true` — shows a completion template or redirects, optionally processes payment
- Final page config: `finalTemplate` (HTML), `finalRedirectUrl`

### 9.2 Page Fields

Each page field (`formPageFields` table):
- `fieldType`: One of the 17 field types
- `bindVariable`: Maps collected value to a variable key for later computation/display
- `width`: `'full'` or `'half'` — responsive column layout
- `validationRules`: See [Validation Rules](#12-validation-rules)
- `conditions`: Conditional visibility rules (see [Field Conditions](#10-field-conditions-showhide-logic))

### 9.3 Computation Field (Page Builder)

The computation field type supports multiple modes:

| Mode | Description |
|---|---|
| `sum_priced_options` | Sum the `price` values from selected options of another field |
| `sum_number_fields` | Sum values from multiple number-type fields |
| `formula` | Custom formula with terms (add, subtract, multiply, divide, percent, concat) from fields, references, or fixed values |
| `expression` | Safe expression (same syntax as flow Calculator) |

Can be hidden from respondent (`visible: false`) while still computing server-side and being stored for downstream use.

### 9.4 Page Payment Computation

Payment amounts can be computed via:

| Mode | Description |
|---|---|
| `field` | Use a single field's bound value |
| `sum_priced_options` | Total from option prices |
| `sum_number_fields` | Total from number fields |
| `fixed` | Constant amount |
| `formula` | Adjustments using references (add/subtract/multiply) |

---

## 10. Field Conditions (Show/Hide Logic)

Page-builder fields support conditional visibility via `fieldConditions`:

| Operator | Description |
|---|---|
| `equals` | Value equals |
| `not_equals` | Value not equals |
| `contains` | Value contains substring |
| `greater_than` | Value is greater than |
| `less_than` | Value is less than |
| `is_empty` | Value is empty/null |
| `is_not_empty` | Value is not empty/null |

| Action | Description |
|---|---|
| `show` | Show field when condition is met |
| `hide` | Hide field when condition is met |

Each condition references a `sourceFieldBinding` (another field's bind variable) and targets a specific `fieldId`.

---

## 11. Form References

Form-level key-value store (`formReferences` table) for constants used in computations:

| Type | Description |
|---|---|
| `number` | Numeric constant |
| `percentage` | Percentage value |
| `text` | Text constant |
| `boolean` | Boolean flag |

Used in:
- **Payment computations** (adjustments via `referenceKey`)
- **Option pricing** (`priceReference` on options — dynamic pricing from reference values)
- **Field computations** (formula terms from `reference` source)

Pricing options support two sources:
- `direct` — hardcoded price value
- `reference` — dynamically resolved from a form reference

---

## 12. Validation Rules

Per-field validation configuration (`FieldValidationRules`):

| Rule | Description |
|---|---|
| `required` | Field must be non-empty |
| `email` | Valid email regex (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) |
| `number` | Must be a valid number (`!isNaN()`) |
| `minLength` | Minimum character length |
| `maxLength` | Maximum character length |
| `minValue` | Minimum numeric value |
| `maxValue` | Maximum numeric value |
| `allowedCharacters` | `'any'`, `'letters'`, `'numbers'`, `'alphanumeric'`, `'custom'` |
| `customPattern` | Custom regex pattern (used when `allowedCharacters = 'custom'`) |
| `addressRequired` | Per sub-field required flags (currentAddress, apartment, city, stateProvince, zipPostalCode, country) |
| `uploadAccept` | File type filter: `'any'`, `'image'`, `'document'`, `'custom'` |
| `uploadAcceptCustom` | Custom MIME types string |
| `uploadMultiple` | Allow multiple file uploads |
| `satisfaction` | Must match a valid option value |
| `computation` | Field computation config |
| `optionPricesEnabled` | Options have prices |
| `message` | Custom error message |

---

## 13. Invoicing & Email System

### 13.1 Email Types

| Kind | Trigger | Recipient |
|---|---|---|
| **Invoice** | Payment completed | Respondent (configured `respondentEmailField`) |
| **Confirmation** | Form submitted (optionally with payment) | Respondent |

### 13.2 Invoice Configuration

Per-form invoice settings (`formInvoiceConfigs`):
- **Enabled/Disabled** toggle
- **Email field** — which form field holds the respondent's email
- **Templates** — HTML (`bodyTemplate`) and plaintext (`bodyTemplatePlain`) with `{{variable}}` interpolation
- **Branding** — `logoUrl`, `accentColor`, `fromName`
- **Numbering** — `invoicePrefix` (e.g., `"INV-"`), `invoiceStartNumber`, auto-incrementing `nextInvoiceNumber`
- **Payment details** — toggle `includePaymentDetails`, `includeLineItems`
- **Line items** — `lineItemFields` array mapping form data to invoice line items

### 13.3 Confirmation Configuration

Per-form confirmation settings (`formConfirmationConfigs`):
- Similar to invoice but simpler — no invoice numbering, no line items, no payment details
- Subject and body templates with variable interpolation

### 13.4 Delivery Tracking

`emailDeliveryLogs` table tracks every email sent:
- Status: `pending`, `sent`, `failed`, `bounced`
- Provider, message ID, error messages, attempt count
- Template snapshot preserved at send time

### 13.5 Email Survey Invitations

Special email survey flow (`emailSurveyInvitations`):
- Generates rating links with `tokenHash` for security
- Prefills rating values on the form via `surveyToken` + `rating` URL params
- Tracks expiration (`expiresAt`) and usage (`usedAt`)

---

## 14. Submission & Response System

### 14.1 Submission Statuses

| Status | Description |
|---|---|
| `incomplete` | Started but not finished |
| `pending_payment` | Awaiting payment confirmation |
| `payment_failed` | Payment was declined/expired |
| `completed` | Fully submitted and paid (if applicable) |

### 14.2 Page Submission Sessions

`formSubmissionSessions` tracks in-progress form filling:
- `currentPageIndex` — which page the user is on
- `collectedData` — JSON blob of all collected field values, keyed by `bindVariable`
- `status` — session-level status (`in_progress`, `payment_pending`, `payment_failed`, `completed`, `cancelled`)
- `clientToken` — for anonymous/public access

### 14.3 Response Columns

Responses are mapped to columns from three sources:
1. **Pages** — `pageId` + `fieldId` + `bindVariable`
2. **Flows** — `flowId` + `nodeId` + variable bindings
3. **Legacy** — original `formFields` system

### 14.4 CSV Export

- Columns: `#` (submission ID), `Submitted` (date)
- Formula injection prevention: cells starting with `=+-@` are prefixed with `'`
- Cells containing `,`, `"`, newlines are properly escaped
- Response values are extracted from the `formData` JSON blob using column sources

---

## 15. Dashboard & Analytics

### 15.1 Analytics Metrics

Per-form metrics (`FormAnalyticsRecord`):
- `submissionCount` — total submissions
- `completedCount` — completed submissions
- `paymentCount` — total payments
- `completedPaymentCount` — successful payments
- `revenue` — total revenue from completed payments
- `lastSubmissionAt` — timestamp of most recent submission

### 15.2 Time Series

- `fillDashboardDateGaps()` fills in missing days with zero values for continuous charts
- Date key format: `YYYY-MM-DD`

---

## 16. Public Form Experience

### 16.1 Entry Points

| Route | Description |
|---|---|
| `/forms/submit/$publicId` | Standalone public form page |
| `/forms/embed/$publicId` | Embeddable form (transparent background, responsive to iframe container) |
| `/forms/payment-return` | Payment gateway return URL handler |

### 16.2 Rendering Logic

`PublicFormView` detects form type and renders the appropriate component:
- **Flow forms** → `FlowExecutionContainer` (lazy loaded)
- **Page-builder forms** → `PageFormView` (lazy loaded)
- **Theme support:** `FormTheme` (accent, background, corners) applied via CSS custom properties
- **Embed mode:** No centered max-width, transparent background, minimal vertical padding

### 16.3 Email Survey Prefill

When `emailSurveyToken` + `emailSurveyRating` URL params are present:
- Validates token via `getEmailSurveyPrefill()`
- Prefills the satisfaction/rating field on the form
- Used for email-based CSAT/NPS surveys

---

## 17. Data Model Reference

### Core Tables

| Table | Purpose |
|---|---|
| `profiles` | User profiles (1:1 with Clerk) |
| `integrationSettings` | Per-user payment/SMTP credentials |
| `forms` | Form definitions (title, status, theme, publicId) |
| `formPages` | Page-builder pages (title, payment config, subscription config) |
| `formPageFields` | Fields on pages (type, label, options, validation, bindings) |
| `formFields` | Legacy flat form fields |
| `formReferences` | Form-scoped key-value constants |
| `formTemplates` | Reusable form templates (built-in + custom) |

### Flow Tables

| Table | Purpose |
|---|---|
| `flows` | Flow definitions (linked to form) |
| `flowNodes` | Nodes in the flow graph (type, label, config JSON, position) |
| `flowEdges` | Directed edges (source → target + metadata) |
| `flowVariables` | Typed variables scoped to a flow |
| `flowExecutions` | Persisted execution state (status, currentNode, variables, history) |

### Payment Tables

| Table | Purpose |
|---|---|
| `paymentGateways` | Gateway definitions (PayPal, Xendit) |
| `formPaymentConfigs` | Per-form payment settings |
| `payments` | Payment records (amount, status, gateway response, subscription fields) |
| `subscriptionCycles` | Individual billing cycles for subscriptions |
| `paymentEvents` | Webhook/callback event log |

### Submission Tables

| Table | Purpose |
|---|---|
| `formSubmissions` | Completed submissions (formData JSON, status, timestamps) |
| `formSubmissionSessions` | In-progress fill sessions (collectedData, currentPageIndex) |
| `emailSurveyInvitations` | Email survey tokens and tracking |
| `emailDeliveryLogs` | All email sends (invoice, confirmation, status tracking) |
| `fieldConditions` | Conditional visibility rules per field |

### Other Tables

| Table | Purpose |
|---|---|
| `formInvoiceConfigs` | Per-form invoice template & settings |
| `formConfirmationConfigs` | Per-form confirmation email settings |
| `integrations` | Third-party integrations (provider, config, webhook key) |

---

## 18. Route Structure

### Authenticated Routes (form creators)

| Route | Description |
|---|---|
| `/dashboard` | Form dashboard with analytics |
| `/forms` | Form listing |
| `/forms/new` | Create new form |
| `/forms/$formId/*` | Form editor (build, responses, payments, settings) |
| `/settings` | Account settings (gateways, profile) |
| `/settings/integrations` | Third-party integrations |
| `/flow/$executionId/*` | Flow execution detail |
| `/integrations` | Integration management |
| `/docs` | Documentation |

### Public Routes (no auth)

| Route | Description |
|---|---|
| `/forms/submit/$publicId` | Public form submission |
| `/forms/embed/$publicId` | Embedded form |
| `/forms/payment-return` | Payment gateway callback |
| `/sign-in/$` | Clerk sign-in |
| `/sign-up/$` | Clerk sign-up |

### API Routes

| Route | Description |
|---|---|
| `/api/*` | Webhook endpoints (Xendit, etc.) |
| `/mcp` | MCP (Model Context Protocol) handler |

---

## 19. Safety Limits & Constraints

### Expression Engine Limits

| Constraint | Limit |
|---|---|
| Max expression length | 10,000 characters |
| Max tokens per expression | 1,000 |
| Max parse nesting depth | 100 |
| Max AST nodes | 500 |
| Result must be finite number | Error if `NaN` or `Infinity` |

### Flow Validation Rules

- Exactly **one Start node** required
- All nodes must be **reachable** from Start (BFS check)
- **No cycles** allowed (DFS with tricolor algorithm — must be a DAG)
- Start, FormField, Group, Calculator → exactly **1 outgoing edge**
- Payment → **1 or 2 outgoing edges**
- Decision → **≥ number of branch values** outgoing edges
- Summary, Redirect → **0 outgoing edges** (terminal)
- Calculator: `targetVariable` must exist in variables
- Payment: `amountVariable` must exist in variables
- Decision: `sourceVariable` must exist in variables
- Group: each field's `bindToVariable` must exist in variables

### UI Palette

| Section | Items |
|---|---|
| **Fields** | 10 types: Text, Email, Number, Long Text, Dropdown, Checkboxes, Radio, Date, Time, Date & Time |
| **Logic** | 6 types: Field Group, Decision, Calculator, Payment, Summary, Redirect |

Not in the palette but available in-editor (pre-configured): Content, Media, Address, File Upload, Satisfaction, Computation, reCAPTCHA.

---

## Quick Reference Card

```
FORM FIELDS (17):  text | email | number | textarea | select | checkbox | radio
                   date | time | datetime | content | media | address | computation
                   file_upload | satisfaction | recaptcha | payment

FLOW NODES (8):    start | form_field | group | decision | calculator | payment
                   summary | redirect

VARIABLE TYPES (7): string | number | money | boolean | date | time | datetime

SUBMISSION STATUS: incomplete | pending_payment | payment_failed | completed

PAYMENT STATUS:    pending | completed | failed | refunded

GATEWAYS:          PayPal (multi-currency) | Xendit (PHP, incl. subscriptions)

SUBSCRIPTION:      weekly | monthly | quarterly | semiannual | annual (Xendit/PHP only)
```
