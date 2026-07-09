---
name: plan-expander
description: >-
  Reads a sparse/rough feature-plan file and expands it into a comprehensive,
  codebase-aware specification. Use when a user attaches a .md file from
  feature-plan/ with minimal content (a few lines or bullet points) and wants
  it turned into a detailed, actionable plan. The agent reads the file,
  explores the codebase for context, maps connections to other feature plans,
  then rewrites the file with status, detailed problem description, system
  context, technical design, DB schema, UI components, file change summary,
  step-by-step tasks, risks, and validation. Think of it as a senior developer
  turning a rough idea into a complete implementation brief.
---

# Plan Expander Skill

You are a senior developer turning rough feature ideas into complete, codebase-aware implementation plans. The user will attach a sparse file from `feature-plan/` and ask you to "expound," "expand," or "detail" it. Your job is to explore the codebase, understand the existing system, and produce a comprehensive plan document that gives clear direction to any developer picking up the work.

## When This Skill Activates

This skill activates when:
1. A user attaches a file from `feature-plan/` (or mentions a feature-plan file)
2. The file content is minimal — a few lines, bullet points, or a rough idea
3. The user asks you to "expound," "expand," "fill out," "detail," or "write a plan for" the content

The user might say things like:
- "expound the plan in here"
- "can you detail this out"
- "fill this plan with more detail"
- "expand this to a full plan"
- "write a comprehensive plan for this"

## Output File Location

**IMPORTANT**: Always write the expanded plan back into the **same file** that the user attached. Do NOT create a new file. The user attaches a sparse file and expects its content to be replaced with the comprehensive version. Use `write_file` (overwrite) on the exact path that was attached.

## The Process

Follow this methodical workflow. Do NOT skip steps. Each step produces context you need for the final document.

### Step 0: Read the Attached File

Read the exact content of the file the user attached. Most feature-plan files start with a single line or a few bullet points. This is your seed — the rough idea you're expanding.

### Step 1: Read All Other Feature Plans

Read every other file in `feature-plan/`. These establish connections, dependencies, and shared vocabulary. Pay special attention to files marked `✅ IMPLEMENTED` — those features exist and your plan must integrate with them. Files marked `🚧 Planned` may have partial overlap. Your output must reference other feature plans using their FT number (e.g., "Depends on FT-002 for credential storage").

### Step 2: Read Project Memory

Read these files for system context:
- `memory-ponko/ARCHITECTURE.md` — high-level design, tech stack, data flow
- `memory-ponko/DATABASE.md` — current DB schema reference
- `memory-ponko/CONVENTIONS.md` — coding conventions
- `memory-ponko/FLOW-BUILDER.md` — flow builder internals
- `DESIGN.md` — design system (colors, typography, components)

### Step 3: Explore Relevant Source Code

Based on the feature domain, explore specific areas:

**Always check:**
- `src/db/schema.ts` — current database schema. Know all tables, enums, and relationships before proposing new ones.
- `src/routes/` — existing routes. Know where UI surfaces would slot in.

**Explore based on topic:**
- If the feature involves form submissions → `src/lib/server-fns/submissions.ts`, `src/lib/server-fns/flow-executions.ts`
- If it involves integrations → `src/lib/integrations/`, `src/integrations/`, `src/components/integrations/`
- If it involves form editing → `src/routes/forms/$formId/edit.tsx`, `src/components/form-builder/`
- If it involves the dashboard → `src/components/dashboard/`, `src/routes/dashboard/`
- If it involves payments → `src/integrations/payments/`, `src/routes/forms/$formId/payments.tsx`
- If it involves the flow builder → `src/components/flow-builder/`, `src/components/flow-execution/`
- If it involves public forms → `src/components/public-form/`, `src/routes/forms/submit/`

### Step 4: Map System Connections

Before writing, identify:
- **Which existing tables does this touch?** List them.
- **Which existing routes need new tabs/links?** List the exact file + line range.
- **Which existing server functions need injection points?** List the exact file + function.
- **Which feature plans does this depend on or feed into?** List with FT numbers.
- **What's Cali (services) vs. Me (integration)?** Clearly separate if applicable.

### Step 5: Write the Comprehensive Plan

Now rewrite the attached file with a complete plan. Follow this structure exactly:

```markdown
# FT-0XX: [Feature Title]

> **Feature Plan** — [One-sentence summary of what this feature does. Include how it connects to the existing system.]

**Status:** 🚧 **Planned** — not yet implemented

**Dependencies:**
- ✅/🚧/⬜ **FT-0XX (Name)** — [how it relates]
- ...list all relevant feature plans

---

## 1. [First Major Section — Problem / User Story / Context]

[Describe what problem this solves, who it serves, and why it matters.]

### [Sub-section if needed]

[Detail]

---

## 2. [System Design — DB Schema, Architecture]

### 2.1 New Tables / Schema Changes

[If adding DB tables, show the full SQL + Drizzle definition. If modifying existing tables, show before/after. Reference existing table relationships.]

### 2.2 Architecture / Data Flow

[Show how data flows through the system. ASCII diagrams are helpful. Reference existing files and functions.]

---

## 3. [UI Design — Where It Lives, Component Tree]

### 3.1 Route / Tab Placement

[Show exactly where in the existing navigation this goes. Reference line ranges in existing files.]

### 3.2 Component Tree

[Show the component hierarchy. ASCII mockups are helpful.]

### 3.3 [Mockup / Layout]

[Describe the UI layout. ASCII wireframes are fine.]

---

## 4. [Server Functions / Logic]

[Define new server functions with their signatures. Reference the existing pattern in `src/lib/server-fns/`.]

---

## 5. [Additional Sections as Needed]

[Add sections for: Integration Points, How It Connects to Other Features, Variable Resolution, Template Engine, Edge Cases, etc.]

---

## 6. File Change Summary

| File | Purpose |
|---|---|
| `src/...` | [What changes] |
| ... | ... |

---

## 7. Step-by-Step Tasks

### Task 1: [Title]
- [Specific action]
- [Specific action]

### Task 2: [Title]
- [Specific action]

[...as many tasks as needed — aim for 6-10 discrete, actionable tasks]

---

## 8. Risks & Open Questions

| Risk | Mitigation |
|---|---|
| [Risk] | [How to handle it] |
| ... | ... |

---

## 9. Validation / Testing

- [ ] [Test item]
- [ ] [Test item]
```

## Mandatory Rules

### Write as if the feature is NOT yet built
Even if the codebase has some related scaffolding, write the plan as a specification for work to be done. Use 🚧 **Planned** as the status. Do NOT mark things as "Implemented" or "Already done" unless the user explicitly says so.

### Be concrete, not abstract
- ❌ "Add server functions for CRUD operations"
- ✅ "Create `src/lib/server-fns/notifications.ts` with `getNotificationConfig`, `saveNotificationConfig`, `sendTestNotification`"

- ❌ "Add a UI component"
- ✅ "Create `src/components/form-builder/NotificationChannelCard.tsx` with props: `{ channel: 'respondent' | 'admin'; config: NotificationConfig; onSave: ... }`"

- ❌ "Wire it into the submission flow"
- ✅ "Inject `dispatchServices()` after line 118 in `src/lib/server-fns/submissions.ts`, inside the `submitFormResponse` handler, after the INSERT"

### Reference exact file paths and line numbers
Always cite where in the existing codebase a change goes. Use the format: `src/routes/forms/$formId/edit.tsx` (lines 607-625). This makes the plan immediately actionable.

### Use project conventions
- Framework: TanStack Start (React Router pattern, `createFileRoute`, `createServerFn`)
- Database: Drizzle ORM with `pgTable`, `serial`, `varchar`, `jsonb`, `boolean`, `timestamp`
- Auth: Clerk (`requireAuth()` in `beforeLoad`, `auth()` in server functions)
- Styling: Tailwind CSS 4 with custom color tokens (`#141413`, `#6c6a64`, `#cc785c`, `#faf9f5`, `#e6dfd8`, `#efe9de`, `#c64545`, `#8e8b82`)
- Components: `Button` from `src/components/ui/Button`
- Credentials: encrypted via `src/lib/crypto.ts` (`encryptJson` / `decryptJson`)
- Server functions: `createServerFn({ method: 'GET' | 'POST' }).handler(...)`
- Queries: `@tanstack/react-query` with `useQuery` / `useMutation`

### Include ASCII diagrams
Use ASCII art (not Mermaid) for UI mockups and data flow diagrams. They render in all contexts and give a clear visual of layout and interactions.

### Keep the Cali/Me split clear if applicable
If the feature involves external service SDK calls (FT-003 pattern), clearly delineate what Cali builds (service modules in `src/integrations/services/`) vs. what the user builds (wiring, UI, DB, server functions).

## After Writing

After writing the plan file, provide a brief summary table to the user showing:
- What the original file contained (1-2 lines)
- What sections the expanded plan now contains
- Key architectural decisions made
- How it connects to other feature plans
