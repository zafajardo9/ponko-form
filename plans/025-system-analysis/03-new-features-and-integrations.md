# PonkoForm — New Features & Integrations: Actionable Proposals

**Date:** 2026-07-28
**Codebase:** `/Users/zafajardo/Documents/Development/ponkoform`
**Context:** Based on deep codebase analysis of payment gateways, email dispatch, credential storage, submission hooks, and template interpolation. All proposals reference real file paths and architectural patterns.

---

## 1. Near-Term Priorities — Build First

These are the two features to build now. Both leverage existing infrastructure heavily and deliver immediate competitive advantage.

### 1.1 ⭐ AI Form Generation — Chatbot Powered by Gemini + memory-ponko/

**Status:** New proposal. Top priority.
**Complexity:** Medium
**Lines of code:** ~800
**Files to touch:** 10
**Days to build:** 4–5 days

**Problem:** Building a form from scratch is friction. "I need a workshop registration form with name, email, payment, and session selection" takes 20 minutes of drag-and-drop. An AI assistant that understands PonkoForm's architecture, field types, node types, variable system, and payment configuration can generate a working form in seconds.

**The Vision — AI Chatbot That Knows PonkoForm:**

Instead of a one-shot "generate from prompt" button, build a **chatbot panel** inside the builder that:
1. Is fed the entire `memory-ponko/` documentation as its knowledge base (ARCHITECTURE.md, DATABASE.md, CONVENTIONS.md, FLOW-BUILDER.md)
2. Can answer questions like "How do I set up a payment flow with installments?" or "What field types support conditional logic?"
3. Can generate forms from natural language descriptions
4. Can suggest field types, node configurations, and expression patterns
5. Maintains conversation context so users can iterate ("Add a phone field too", "Change the currency to USD", "Remove the satisfaction survey")

**Why memory-ponko/ as Knowledge Base:**

The `memory-ponko/` documentation is the system's ground truth:
| File | Lines | What It Teaches the AI |
|---|---|---|
| `ARCHITECTURE.md` | 218 | System shape, runtime boundaries, page vs flow forms, integration status, deployment |
| `DATABASE.md` | 716 | Full schema (29 tables, 4 enums), relationships, JSONB shapes, migration patterns |
| `CONVENTIONS.md` | 284 | TypeScript patterns, server function conventions, design tokens, naming rules |
| `FLOW-BUILDER.md` | 361 | Node types, variables system, expression engine syntax + examples, payment integration, validation rules |

This gives the AI deep knowledge of:
- Every table, column, and relationship (so it knows `form_pages` hold page-form data, `flow_nodes` hold flow data)
- Every field type and which paradigm supports it (page vs flow)
- Every expression function (`sum()`, `if()`, `round()`, `contains()`, `equalText()`)
- The exact color tokens (`#cc785c`, `#faf9f5`, `#e6dfd8`) and UI patterns
- Payment architecture (how Xendit/PayPal checkout works, minor units, subscription cycles)
- Integration credential encryption pattern (AES-256-GCM)
- Flow validation rules (acyclic, exactly one Start node, terminal nodes)

**Implementation:**

```
┌─────────────────────────────────────────────────────────┐
│  Gemini AI (with memory-ponko/ as system prompt)        │
│  + conversation history + current form context          │
└──────────────┬──────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────┐
│  AIChatbot Server Function                              │
│  - Loads memory-ponko/ files as knowledge base          │
│  - Calls Gemini API with chat history                   │
│  - Parses structured responses (form generation JSON)   │
│  - Provides contextual answers (Q&A mode)               │
└──────────────┬──────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────┐
│  AIChatbotPanel UI Component                            │
│  - Chat panel in the form builder (collapsible sidebar) │
│  - Message bubbles (user + AI)                          │
│  - "Generate form" mode → produces FormStructure JSON   │
│  - "Q&A" mode → answers questions about PonkoForm       │
│  - "Suggest" mode → recommends next fields/nodes        │
└─────────────────────────────────────────────────────────┘
```

**Server Function — `src/lib/server-fns/ai-chatbot.ts`:**
```typescript
// Loads memory-ponko/ files at module init (they're static, bundled at build)
// Uses Gemini API with system prompt = concatenated memory-ponko/ docs
// Handles three modes:
//   1. 'generate' — "Build me a workshop registration form"
//   2. 'qa'       — "How do I set up conditional logic?"
//   3. 'suggest'  — "What fields should I add next?"

export const chatWithAI = createServerFn({ method: 'POST' })
  .validator((data: { messages: ChatMessage[], mode: 'generate'|'qa'|'suggest', formContext?: CurrentFormState }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    
    const config = await getIntegrationConfig<GeminiConfig>(profile.id, 'gemini')
    if (!config?.apiKey) return { error: 'Gemini not configured. Connect in Integrations Hub.' }
    
    const systemPrompt = buildSystemPrompt(data.mode, data.formContext)
    // systemPrompt = MEMORY_PONKO_DOCS + mode-specific instructions + current form state
    
    const response = await callGeminiChat({
      apiKey: config.apiKey,
      systemPrompt,
      messages: data.messages,
      responseSchema: data.mode === 'generate' ? FORM_STRUCTURE_SCHEMA : undefined
    })
    
    return { message: response.text, structured: response.structured }
  })
```

**Knowledge Base Loading — `src/lib/ai/knowledge-base.ts`:**
```typescript
// Uses Vite's import.meta.glob to bundle memory-ponko/ at build time
// (needed because Vercel serverless doesn't have filesystem access)
const memoryPonkoModules = import.meta.glob<string>(
  '../../../memory-ponko/*.md',
  { query: '?raw', import: 'default', eager: true }
)

export function getKnowledgeBase(): string {
  const sections: string[] = []
  for (const [path, content] of Object.entries(memoryPonkoModules)) {
    const filename = path.split('/').pop()!
    sections.push(`## ${filename}\n\n${content}`)
  }
  return sections.join('\n\n---\n\n')
}
```

**UI Component — `src/components/forms/AIChatbotPanel.tsx`:**
```tsx
// Collapsible right-side panel in the form editor
// Three tabs: Chat | Generate | Suggest
// Chat: conversational Q&A with context about the current form
// Generate: text area → "Build a {description}" → preview → accept
// Suggest: shows next-field/node recommendations based on current state

export function AIChatbotPanel({ formId, formContext, onApplyGeneratedForm }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: 'assistant',
    content: "Hi! I'm your PonkoForm assistant. I can help you build forms, answer questions, and suggest improvements. I know everything about PonkoForm's architecture, field types, flow builder, and payment system. What are you building today?"
  }])
  const [mode, setMode] = useState<'qa'|'generate'|'suggest'>('qa')
  
  // ... chat UI with message bubbles, typing indicator, mode tabs
}
```

**Form Structure Schema (for Gemini structured output):**
```typescript
interface GeneratedForm {
  title: string
  description?: string
  mode: 'page' | 'flow'
  
  // Page form output
  pages?: {
    title: string
    fields: {
      label: string
      fieldType: FieldType  // text|email|number|textarea|select|checkbox|radio|date|...
      placeholder?: string
      required?: boolean
      options?: string[]  // for select/checkbox/radio
      bindVariable?: string
      helperText?: string
    }[]
  }[]
  paymentConfig?: {
    amountType: 'fixed' | 'computation' | 'field_sum' | 'options'
    amount: number  // minor units
    currency: string
  }
  
  // Flow form output
  nodes?: {
    type: FlowNodeType  // start|form_field|group|decision|calculator|payment|summary
    label: string
    config: Record<string, unknown>
    edges: { targetLabel: string, matchValue?: string }[]
  }[]
  variables?: { name: string, type: FlowVariableType, defaultValue?: unknown }[]
}
```

**How Gemini interprets the prompt, using memory-ponko/ knowledge:**

User says: *"Build a workshop registration with early bird pricing"*

Gemini (with memory-ponko/ context) knows:
- "workshop" → flow form with decision node for pricing tiers
- "early bird pricing" → need a Decision node on a variable, likely a `select` field with "Early Bird" and "Regular" options
- Payment node needs `amountVariable` set to a calculator output
- Expression for early bird: `{{base_price}} * 0.8` (20% discount) or `{{base_price}} < 1000 ? 800 : 1000`
- Terminal node must be Summary or Redirect (from FLOW-BUILDER.md §2)
- Currency defaults to PHP, stored in minor units (from CONVENTIONS.md §4.3)

It generates:
```
Flow: Workshop Registration
Nodes:
  1. Start
  2. Form Field "Full Name" (text, bindToVariable: full_name)
  3. Form Field "Email" (email, bindToVariable: email)
  4. Form Field "Ticket Type" (select, options: ["Early Bird (20% off)", "Regular"], bindToVariable: ticket_type)
  5. Decision on ticket_type:
     - If "Early Bird" → Calculator "Early Bird Total" (expression: 800)
     - If "Regular" → Calculator "Regular Total" (expression: 1000)
  6. Both calculators → Payment Node (amountVariable: total_cost, currency: PHP)
  7. Summary "Registration Confirmed!"
```

**Files:**
| File | Action | Purpose |
|---|---|---|
| `src/lib/ai/knowledge-base.ts` | NEW | Load memory-ponko/ docs via import.meta.glob |
| `src/lib/ai/prompts/form-generation.ts` | NEW | System prompt templates for each mode |
| `src/lib/ai/form-schema-validator.ts` | NEW | Validate Gemini's generated JSON against real schema |
| `src/lib/server-fns/ai-chatbot.ts` | NEW | Server function: chat with Gemini (3 modes) |
| `src/components/forms/AIChatbotPanel.tsx` | NEW | Chat panel UI component |
| `src/components/forms/GeneratePreview.tsx` | NEW | Preview generated form before applying |
| `src/routes/forms/$formId/edit.tsx` | MODIFY | Add AI chatbot panel toggle |
| `src/lib/integrations/types.ts` | MODIFY | Add Gemini config type (if not present) |
| `src/lib/integrations/credentials.ts` | MODIFY | Register Gemini in `integrationMeta` |

**Key leverage:**
- Gemini integration config already exists in the hub (`getIntegrationConfig<GeminiConfig>` works)
- memory-ponko/ docs are authoritative and cover the entire system — perfect as AI knowledge base
- `import.meta.glob` with `?raw` bundles the docs at build time (no filesystem dependency on Vercel)
- The builder already has all the infrastructure to create forms from structured data (templates, seed scripts)
- Form structure is well-defined — the AI just needs to produce the right JSON shape

**User impact:** 🔴 Critical — "AI form builder" is a headline feature. An AI that actually knows PonkoForm's internals (not just generic form-building) is a genuine differentiator. Competitors have generic AI generation; none have an AI that knows their specific architecture.

---

### 1.2 FT-020: Webhooks & External Notifications

| Attribute | Detail |
|---|---|
| **Complexity** | Medium |
| **Files to touch** | ~10 |
| **New files** | `src/lib/server-fns/webhooks.ts`, `src/routes/forms/$formId/webhooks.tsx`, `src/components/forms/WebhookCard.tsx`, `src/components/forms/AddWebhookDialog.tsx`, `scripts/retry-webhooks.ts` |
| **Modifications** | `src/db/schema.ts` (2 new tables), `FormSectionNav.tsx` (+tab), `complete-submission.ts` (line 148 injection), `page-forms.ts` (payment hook) |
| **Lines of code** | ~800 |
| **Days to build** | 3–4 days |
| **Key leverage** | `completePageSubmissionRecord` (line 148) is the perfect injection point — already fires after submission + email. Webhook dispatch goes right after `dispatchSubmissionEmails`. HMAC signing reuses `safeEqual` from `src/lib/crypto.ts`. Retry pattern mirrors `emailDeliveryLogs` lease-based retry in `src/lib/invoicing/delivery.ts`. |
| **User impact** | 🔴 Critical — turns PonkoForm from data silo into event-driven platform. Enables Slack, Zapier, n8n, CRM integration. Biggest competitive gap vs Typeform/JotForm/Tally. |

---

### Near-Term Summary

| # | Feature | Days | LOC | Files | Why First |
|---|---|---|---|---|---|
| 1 | AI Form Generation (Chatbot + memory-ponko/) | 4–5 | ~800 | 10 | Headline AI feature. Differentiator — AI that knows PonkoForm internals. |
| 2 | Webhooks (FT-020) | 3–4 | ~800 | 10 | Platform foundation. Enables all external integrations. |

**Total: ~8-9 dev-days for the two highest-impact features.**

---

## 2. Other Planned Features — Build After Near-Term Priorities

These are the five detailed feature plans already spec'd out in `feature-plan/`. They ship after the AI chatbot and webhooks are live.

### 2.1 FT-021: Discount Codes & Coupons

| Attribute | Detail |
|---|---|
| **Complexity** | Medium |
| **Files to touch** | ~12 |
| **Lines of code** | ~1,000 |
| **Days to build** | 3–4 days |
| **Key leverage** | Atomic redemption via `UPDATE ... WHERE current_uses < max_uses RETURNING id` — PostgreSQL row-level locking handles race conditions for free. Reuses existing `calculatePagePayment` pipeline. |
| **User impact** | 🟡 High — essential for PH market (events, workshops, promos). |

### 2.2 FT-018: Payment Links (Standalone Checkout)

| Attribute | Detail |
|---|---|
| **Complexity** | Medium |
| **Files to touch** | ~15 |
| **Lines of code** | ~1,200 |
| **Days to build** | 4–5 days |
| **Key leverage** | Reuses entire payment gateway layer — `paymentRegistry.get(slug).createPayment()` already abstracted. |
| **User impact** | 🟡 High — enables donations, product sales, invoice payments without building a form. |

### 2.3 FT-017: Form Analytics Dashboard

| Attribute | Detail |
|---|---|
| **Complexity** | Medium |
| **Files to touch** | ~12 |
| **Lines of code** | ~800 |
| **Days to build** | 3–4 days |
| **Key leverage** | `formSubmissionSessions` already tracks page-by-page progress — page drop-off funnel is just a GROUP BY query. |
| **User impact** | 🟡 High — mission-critical for paid creators. Every competitor has this. |

### 2.4 FT-022: Conditional Email Automation

| Attribute | Detail |
|---|---|
| **Complexity** | High |
| **Files to touch** | ~15 |
| **Lines of code** | ~1,500 |
| **Days to build** | 5–7 days |
| **Key leverage** | Reuses entire email delivery pipeline. Template `{{variable}}` interpolation already handles all field types. |
| **User impact** | 🟡 Medium-High — "If satisfaction < 3, send apology email 24h later" is a killer feature no competitor offers natively. |

### 2.5 Payment Gateway Expansion (Future)

Stripe, PayMongo, and Maya payment gateways have UI configurations in the integrations hub but no actual gateway code. Each is ~300 lines via the `PaymentGateway` base class. These are postponed — the AI chatbot and webhooks deliver more immediate differentiation. When the market demands these gateways, they're quick wins (~1.5-2.5 days each).

---

## 3. Automation & Notification Features

### 3.1 Creator Email Notifications — *New Submissions Alert*

**Complexity:** Low | **Lines of code:** ~80 | **Files:** 4

When `completePageSubmissionRecord` fires, also send a notification to the form creator. Reuses `sendTransactionalEmail`. The creator's email is the Clerk-authenticated user's email. Zero new infrastructure. Every competitor has this — low-hanging fruit for later.

### 3.2 Native Slack Integration — *Direct Slack App*

**Complexity:** Medium | **Lines of code:** ~500 | **Files:** 8

Register Slack as an integration provider with OAuth. After submission, call `chat.postMessage` to the configured channel. Well-established integration hub pattern. Typeform charges for this — offering it free is competitive advantage.

### 3.3 SMS Notifications — *Twilio + Semaphore (PH)*

**Complexity:** Medium | **Lines of code:** ~400 | **Files:** 7

PH market needs SMS. Semaphore for PH numbers, Twilio fallback. Same encrypted credential storage + integration hub pattern.

### 3.4 Zapier Integration — *Public App on Zapier Platform*

**Complexity:** Medium-High | **Lines of code:** ~600 in-repo + Zapier app

Prerequisite: Webhooks (FT-020). Build a Zapier app with triggers (New Submission, New Payment) and actions. Opens PonkoForm to 5,000+ apps. "Integrates with Zapier" is the #1 checkbox in form builder comparisons.

---

## 4. API & Developer Platform Features

### 4.1 Public REST API — *Forms CRUD + Submissions + API Keys*

**Complexity:** High | **Lines of code:** ~2,000 | **Files:** 18

API key management with scopes (forms:read/write, submissions:read/write). REST endpoints at `/api/v1/forms`, `/api/v1/submissions`. Bearer token auth. OpenAPI/Swagger docs. All existing server functions are the backend — API layer is a thin auth + serialization wrapper.

### 4.2 Embed SDK — *JavaScript Events API*

**Complexity:** Low-Medium | **Lines of code:** ~300 | **Files:** 3

`postMessage` API from iframe to parent: `ponkoform:submitted`, `ponkoform:payment-completed`, etc. `PonkoformEmbed` JS class for host pages. The embed route already exists — just add the message bridge.

### 4.3 Webhook Signature Verification SDK — *npm Package*

**Complexity:** Low | **Lines of code:** ~150 | **Files:** 3 (npm package)

Publish `@ponkoform/webhooks` to npm. Export `verifyPonkoformSignature()` + TypeScript types. Signals serious developer platform.

### 4.4 GraphQL Endpoint

**Complexity:** Medium | **Lines of code:** ~800 | **Files:** 8

Alternative to REST at `POST /api/v1/graphql`. Resolvers delegate to existing server functions. Nice-to-have for developer experience.

---

## 5. AI-Powered Features (Beyond the Chatbot)

The AI chatbot (Section 1.1) is the foundation. These features build on it:

### 5.1 Smart Field Suggestions — *In-Builder Recommendations*

**Complexity:** Medium | **Lines of code:** ~400 | **Files:** 5

When a creator adds "Full Name", the AI suggests "Email" and "Phone" next. Uses the same Gemini integration and knowledge base. Works offline with pre-computed common pairings as fallback.

### 5.2 AI Response Sentiment Analysis — *Satisfaction Surveys*

**Complexity:** Low-Medium | **Lines of code:** ~300 | **Files:** 4

After submission, run sentiment analysis on open-text responses via Gemini. Store in `submission_ai_insights` JSONB table. Display sentiment badges + key themes in submissions view.

### 5.3 AI Spam Detection — *Beyond reCAPTCHA*

**Complexity:** Medium | **Lines of code:** ~350 | **Files:** 4

Classify submissions as spam/good via Gemini. Called async after submission (non-blocking). Cost-effective: only run on forms with text/textarea fields. Reduces manual spam cleanup by ~90%.

---

## 6. Team & Collaboration Features

### 6.1 Multi-User Workspaces — *Team Accounts*

**Complexity:** High | **Lines of code:** ~2,500 | **Files:** 25

Workspace-scoped forms, RBAC (Owner/Admin/Editor/Viewer), invitation flow. Clerk handles auth. Form ownership queries already filter by `profileId` — adding `workspaceId` is additive.

### 6.2 Form-Level Sharing — *Granular Permissions*

**Complexity:** Low-Medium | **Lines of code:** ~400 | **Files:** 8

Lighter than full workspaces. Share a single form with a colleague for editing or viewing. Ships in 2 days.

### 6.3 Submission Approval Workflows

**Complexity:** Medium | **Lines of code:** ~600 | **Files:** 10

"Leave request form → manager approves → HR processes." Magic link approvals (no login required), mirrors existing email survey token system.

### 6.4 Activity Log / Audit Trail

**Complexity:** Low-Medium | **Lines of code:** ~350 | **Files:** 5

Log all mutations: `form.created`, `field.added`, `payment_config.updated`. JSONB changes column with before/after diffs.

---

## 7. Monetization & Growth Features

### 7.1 Usage-Based Pricing Tiers — *Freemium Model*

**Complexity:** High | **Lines of code:** ~1,500 | **Files:** 20

Free (100 submissions/mo, 3 forms), Pro (₱499/mo, unlimited, custom domain), Business (₱1,999/mo, team features, priority support). Reuses Xendit subscription infrastructure for billing.

### 7.2 White-Label / Custom Domain

**Complexity:** Medium | **Lines of code:** ~500 | **Files:** 8

Custom domains (CNAME), remove PonkoForm branding, custom email sender. Per-form theming already exists — brand kits extend to profile-level.

### 7.3 Form Templates Marketplace

**Complexity:** Medium-High | **Lines of code:** ~800 | **Files:** 12

Creators publish templates → browse by category → clone into account. Extends existing `formTemplates` infrastructure. Growth flywheel.

### 7.4 Agency Mode — *Manage Multiple Client Accounts*

**Complexity:** Medium-High | **Lines of code:** ~1,200 | **Files:** 15

Agency dashboard, client switching, consolidated billing, white-label across all client forms. Extends workspace hierarchy.

---

## 8. Prioritized Implementation Roadmap

### Tier 1: Ship Now (Weeks 1–2) — ~9 dev-days

These are the two features that deliver the most differentiation and platform capability with the least risk. All leverage existing infrastructure heavily.

| # | Feature | Days | LOC | Category | Why First |
|---|---|---|---|---|---|
| 1 | **AI Form Generation (Chatbot + memory-ponko/)** | 4–5 | ~800 | AI | Headline AI feature. Differentiator no competitor has. |
| 2 | **Webhooks (FT-020)** | 3–4 | ~800 | Automation | Platform foundation. Enables all external integrations. |

### Tier 2: Competitive Parity (Weeks 3–6) — ~18 dev-days

| # | Feature | Days | LOC | Category |
|---|---|---|---|---|
| 3 | Discount Codes (FT-021) | 3–4 | ~1,000 | Payments |
| 4 | Payment Links (FT-018) | 4–5 | ~1,200 | Payments |
| 5 | Analytics Dashboard (FT-017) | 3–4 | ~800 | Analytics |
| 6 | Creator Email Notifications | 1 | ~80 | Automation |
| 7 | Native Slack Integration | 3 | ~500 | Automation |
| 8 | Smart Field Suggestions | 2.5 | ~400 | AI |

### Tier 3: Platform (Weeks 7–12) — ~40 dev-days

| # | Feature | Days | LOC | Category |
|---|---|---|---|---|
| 9 | Email Automation (FT-022) | 6 | ~1,500 | Automation |
| 10 | Public REST API | 8 | ~2,000 | Developer |
| 11 | Usage-Based Pricing Tiers | 6 | ~1,500 | Monetization |
| 12 | Multi-User Workspaces | 10 | ~2,500 | Team |
| 13 | Zapier Integration | 5 | ~600+ | Automation |
| 14 | Embed SDK (JS Events API) | 2 | ~300 | Developer |
| 15 | AI Spam Detection | 2 | ~350 | AI |

### Tier 4: Scale & Polish (Weeks 12+) — ~31 dev-days

| # | Feature | Days | LOC | Category |
|---|---|---|---|---|
| 16 | White-Label / Custom Domain | 3 | ~500 | Monetization |
| 17 | Form Templates Marketplace | 5 | ~800 | Growth |
| 18 | Submission Approval Workflows | 4 | ~600 | Team |
| 19 | Agency Mode | 6 | ~1,200 | Monetization |
| 20 | SMS Notifications (Twilio/Semaphore) | 3 | ~400 | Automation |
| 21 | AI Response Sentiment Analysis | 2 | ~300 | AI |
| 22 | Webhook SDK (npm package) | 1.5 | ~150 | Developer |
| 23 | Activity Log / Audit Trail | 2 | ~350 | Team |

---

### Grand Summary

| Tier | Weeks | Cumulative Days | Key Outcome |
|---|---|---|---|
| Tier 1 | 1–2 | 9 | AI chatbot + webhooks = differentiation + platform foundation |
| Tier 2 | 3–6 | +18 (27) | Competitive parity with Typeform/JotForm |
| Tier 3 | 7–12 | +40 (67) | Platform: API, monetization, teams, Zapier |
| Tier 4 | 12+ | +31 (98) | Polish: white-label, marketplace, agency mode |

**Total vision:** ~98 dev-days (~5 months solo, ~2 months with 3 developers).

---

## 9. Architecture Notes — Consistent Patterns Across All Features

### 9.1 Credential Storage
All integrations use `getIntegrationConfig<T>(profileId, provider)` → AES-256-GCM encrypted JSON from the `integrations` table.

### 9.2 Submission Hooks
`completePageSubmissionRecord` (line 148, `src/lib/page-builder/complete-submission.ts`) is THE injection point:
```typescript
await dispatchSubmissionEmails(submission.id).catch(...)     // existing
await dispatchWebhooks(formId, 'form.submitted', payload)    // FT-020
await sendCreatorNotification(form, submission)              // 3.1
await classifySubmissionSpam(formData)                       // 5.3
await runSentimentAnalysis(submissionId, formData)            // 5.2
```

### 9.3 Payment Gateway Pattern
New gateways extend `PaymentGateway` abstract class and register in `src/integrations/payments/index.ts`. Each ~300 lines.

### 9.4 Email Delivery
All email routes through `sendTransactionalEmail(profileId, message)` → Resend first, SMTP fallback.

### 9.5 AI Knowledge Base
memory-ponko/ docs bundled at build time via `import.meta.glob`. Gemini integration config already exists. System prompt = concatenated ARCHITECTURE.md + DATABASE.md + CONVENTIONS.md + FLOW-BUILDER.md.

### 9.6 Database
Drizzle ORM with PostgreSQL. Schema in `src/db/schema.ts`. JSONB for flexible data.

### 9.7 Routing
TanStack Start file-based routing. Form tabs at `src/routes/forms/$formId/*.tsx`. New tabs add entries to `FormSectionNav.tsx`.

### 9.8 Server Functions
All backend logic in `src/lib/server-fns/`. `createServerFn` with auth guards. Public-facing functions use `strict: false`.
