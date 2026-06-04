# Flow Builder — Requirements

## REQ-1: Data Model

### REQ-1.1 Flow Data
The system must store a "flow" linked to a form, containing:
- A list of nodes (the steps)
- A list of edges/connections between nodes
- A set of variable declarations with types and default values

### REQ-1.2 Node Types
The system must support these node types:

| Node Type | Purpose | Configurable Properties |
|---|---|---|
| **Start** | Entry point of the flow (auto-created) | — |
| **FormField** | Present a form input to the user | field type (all existing types), label, placeholder, required, options, binds-to-variable |
| **Decision** | Branch based on user input | source-variable, branches (value → target node) |
| **Calculator** | Compute a variable from an expression | target-variable, expression (formula) |
| **Payment** | Trigger a payment via a gateway | amount-variable, currency, gateway-id, success-node, failure-node |
| **Summary** | Display a dynamic result page | template with variable interpolation |
| **Redirect** | Send user to an external URL | URL template with variable interpolation |

### REQ-1.3 Variables
Variables must have:
- A unique name (snake_case)
- A type (string, number, boolean, money)
- An optional default value
- Scope: accessible from any downstream node

### REQ-1.4 Expressions
Calculator expressions must support:
- Arithmetic: `+`, `-`, `*`, `/`, `%`
- Variable references: `{{variable_name}}`
- Functions: `SUM(vat_amount + subtotal)`, `ROUND(value, 2)`
- Constants: numeric literals, string literals

## REQ-2: Flow Builder UI (Creator Experience)

### REQ-2.1 Visual Canvas
- A node-based flowchart editor (like a simplified Retool workflow or n8n)
- Drag nodes from a palette onto the canvas
- Connect nodes by drawing edges from output ports to input ports
- Pan and zoom the canvas
- Each node shows its type icon, a short label, and configuration status

### REQ-2.2 Node Configuration Panel
- Clicking a node opens a properties panel on the right
- Each node type has a tailored configuration form
- Variable references show a selector dropdown of available variables
- Calculator expressions have a formula builder with variable picker + function list

### REQ-2.3 Variables Manager
- Sidebar or modal listing all declared variables
- Add/edit/delete variables with type and default value
- Visual indicators showing which nodes read/write each variable

### REQ-2.4 Flow Validation
- Detect disconnected branches (nodes not reachable from Start)
- Detect missing required configurations (e.g., empty expression, unmapped payment gateway)
- Detect variable type mismatches
- Show validation errors as badges on the affected nodes

### REQ-2.5 Flow Preview
- Users can "test-run" the flow from the builder
- A side panel or modal steps through each node interactively
- Shows variable values at each step
- Payments are simulated (no real charge)

## REQ-3: Flow Execution (End User Experience)

### REQ-3.1 Runtime Engine
- Execute the flow step-by-step starting from the Start node
- Present each FormField node as a form step
- At Decision nodes, evaluate the source variable and route to the matching branch
- At Calculator nodes, evaluate the expression and store the result
- At Payment nodes, initiate payment with the current variable values
- At Summary nodes, render the template with interpolated variables
- At Redirect nodes, navigate to the constructed URL

### REQ-3.2 Multi-Step Form UI
- Each FormField node is rendered one at a time (not all at once)
- Smooth transitions between steps
- Progress indicator showing current step / total steps
- Back navigation allowed unless the step is a payment

### REQ-3.3 Payment Integration
- At a Payment node, show an inline payment form (or redirect to gateway)
- On success, continue to the success-node
- On failure, show error and optionally retry or go to failure-node
- Store payment reference in the flow execution context

### REQ-3.4 Completion
- Summary node renders a customizable "thank you" / receipt page
- All variables at completion are available for display
- Redirect node sends the user to an external URL (e.g., course access page)
- Submission record stores all variable values and execution path

## REQ-4: Existing Form Backward Compatibility

### REQ-4.1 Legacy Forms
- Existing linear forms (created before Flow Builder) continue to work
- They render as a single-step form as they do today
- No migration required unless the creator opts into Flow Builder

### REQ-4.2 Opt-In Upgrade
- A "Convert to Flow" button on existing forms creates a basic linear flow automatically
- Each existing field becomes a FormField node in sequence
- Creator can then extend with decisions, calculators, payments

## REQ-5: Performance & Technical

### REQ-5.1 Execution Context
- Each flow run has its own execution context containing:
  - Current node position
  - All variable values (shared across all nodes)
  - Payment reference IDs
  - Execution path history (which nodes were visited)

### REQ-5.2 Expression Safety
- Calculator expressions must be sandboxed — no access to `eval`, `Function`, `window`, `document`, or network
- Use a safe expression parser (e.g., math.js or expr-eval)

### REQ-5.3 Persistence
- Partial flow execution state may be saved to resume later (optional, Phase 2)
- Completed executions store full context for receipt/history

## User Stories Mapping

| US ID | Story | Requirements |
|---|---|---|
| US-1.1 | As a creator, I want to build a multi-step flow by adding and connecting nodes on a canvas | REQ-2.1, REQ-2.2 |
| US-1.2 | As a creator, I want to declare variables and use them in calculators | REQ-1.3, REQ-2.3 |
| US-1.3 | As a creator, I want to create decision branches based on dropdown/radio selections | REQ-1.2 (Decision node) |
| US-1.4 | As a creator, I want to add a calculator that computes VAT, totals, or monthly payments | REQ-1.4, REQ-2.2 (Calculator config) |
| US-1.5 | As a creator, I want to connect a Payment node to collect money via PayPal/Xendit | REQ-1.2 (Payment node), REQ-3.3 |
| US-1.6 | As a creator, I want to preview/test my flow before publishing | REQ-2.5 |
| US-1.7 | As a creator, I want to show a dynamic receipt after payment | REQ-1.2 (Summary node) |
| US-2.1 | As an end user, I want to fill out a multi-step form that adapts to my answers | REQ-3.1, REQ-3.2 |
| US-2.2 | As an end user, I want to see calculated prices update based on my selections | REQ-3.1 (Calculator runtime) |
| US-2.3 | As an end user, I want to pay and see a confirmation with my order details | REQ-3.3, REQ-3.4 |
