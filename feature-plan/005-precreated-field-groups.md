# FT-005: Precreated Field Groups

> **Feature Plan** — A reusable field group template library that lets form creators save commonly used field sets (like "Personal Details", "Shipping Address", "Contact Info") and insert them into any form as a pre-filled Group node — no rebuilding from scratch. Optionally powered by Gemini AI (FT-003) to suggest groups from a natural-language description.

**Status:** 🚧 **Planned** — not yet implemented

**Dependencies:**
- ✅ **FT-002 (Integrations Hub)** — Gemini API key must be configured before AI suggestions work
- 🚧 **FT-003 (Services Integration)** — Gemini service module generates field group suggestions from a prompt
- ✅ **Flow Builder (existing)** — the `group` node type and `GroupedField[]` config already exist; this feature builds on top of them

---

## 1. User Story

> *"I build registration forms for events, classes, and workshops. Every form needs the same 'Personal Details' group — name, email, phone, birth date. I don't want to rebuild it every time. I want to save it once and drop it into any new form in 2 clicks."*

### Stretch (with Gemini AI)

> *"I typed 'gym membership signup with emergency contact' and the AI suggested a perfect field group with name, phone, membership type, and emergency contact name + number. One click and it was in my flow."*

---

## 2. The Problem

Currently, the **Group node** (`config.fields: GroupedField[]`) in the flow builder requires the creator to manually add every field from scratch — type, label, placeholder, required flag, variable binding — every single time. This is tedious for field sets that are reused across forms ("Personal Details", "Contact Info", "Address", "Payment Info").

The builder has no concept of **saved templates** — every group starts empty.

### What "Precreated" Means

A **field group template** is a saved configuration containing:
- A name (e.g., "Personal Details")
- An optional description (e.g., "Standard name, email, phone fields")
- A category tag (e.g., "Contact", "Address", "Business", "Custom")
- The `GroupedField[]` array — the actual field definitions
- A `createdBy` reference (built-in system templates vs. user-created)

Templates are **global per profile** — saved once, insertable into any flow on any form.

---

## 3. DB Schema

### 3.1 New Table: `field_group_templates`

```sql
CREATE TABLE field_group_templates (
  id            SERIAL PRIMARY KEY,
  profile_id    INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,           -- "Personal Details"
  description   TEXT,                            -- "Standard name, email, phone, date of birth"
  category      VARCHAR(50) NOT NULL DEFAULT 'custom',  -- 'contact', 'address', 'business', 'custom'
  fields        JSONB NOT NULL DEFAULT '[]',     -- GroupedField[]
  is_builtin    BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE for system-provided templates
  usage_count   INTEGER NOT NULL DEFAULT 0,      -- how many times inserted (for sorting/relevance)
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX field_group_templates_profile_id_idx ON field_group_templates(profile_id);
```

### 3.2 Drizzle Schema

```ts
export const fieldGroupTemplates = pgTable('field_group_templates', {
  id: serial().primaryKey(),
  profileId: integer('profile_id').notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 50 }).notNull().default('custom'),
  fields: jsonb('fields').$type<GroupedField[]>().notNull().default([]),
  isBuiltin: boolean('is_builtin').notNull().default(false),
  usageCount: integer('usage_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [index('field_group_templates_profile_id_idx').on(table.profileId)])
```

### 3.3 Built-in Templates (Seed Data)

Shipped with the migration. Each new user gets these automatically (via `profileId = NULL` or a special system profile):

| Name | Category | Fields |
|---|---|---|
| Personal Details | `contact` | name (text), email (email), phone (text), date_of_birth (date) |
| Address | `address` | street (text), city (text), state (text), zip (text), country (text) |
| Contact Info | `contact` | full_name (text), email (email), phone (text), preferred_contact (select: Email/Phone) |
| Payment Details | `business` | card_holder (text), billing_address (text), amount (number) |
| Feedback | `business` | rating (select: 1-5 stars), comments (textarea), would_recommend (radio: Yes/No) |
| Event Registration | `business` | attendee_name (text), email (email), dietary_restrictions (textarea), tshirt_size (select: S/M/L/XL) |
| Job Application | `business` | full_name (text), email (email), resume_link (text), cover_letter (textarea), start_date (date) |

---

## 4. Architecture — How Templates Become Nodes

```
┌─────────────────────────────────────────────────────────────┐
│                    USER FLOW                                │
│                                                             │
│  1. CREATE: Build a group in any form's flow builder        │
│     → Click "Save as Template" in GroupConfig panel        │
│     → Name it, pick a category                             │
│     → Saved to field_group_templates                       │
│                                                             │
│  2. BROWSE: Templates panel in BuilderPalette               │
│     → See built-in + user templates grouped by category     │
│     → Search by name                                       │
│     → Preview fields in a hover/click tooltip              │
│                                                             │
│  3. INSERT: Click a template                                │
│     → Creates a new 'group' flow node                      │
│     → config.title = template.name                         │
│     → config.fields = template.fields (deep cloned)        │
│     → Node positioned after the currently selected node     │
│                                                             │
│  4. AI SUGGEST: Type a description                          │
│     → "gym membership with emergency contact"              │
│     → Calls Gemini (FT-003)                                │
│     → Returns suggested GroupedField[]                     │
│     → Creator reviews, edits, then saves or inserts        │
└─────────────────────────────────────────────────────────────┘
```

### 4.1 Deep Clone on Insert

When a template is inserted, the `fields` array is **deep cloned** — the new Group node gets independent copies of every `GroupedField`. This means:
- Editing the group's fields in the form does NOT modify the original template
- Each `id` in `GroupedField` is regenerated (new `crypto.randomUUID()`)
- The creator can customize the group after insertion without affecting the template

### 4.2 Usage Tracking

`usageCount` on the template row is incremented each time it's inserted. This powers:
- **"Most Used" sort order** in the templates panel
- **Relevance signals** for future AI suggestions

### 4.3 Variable Name Deduplication

When inserting a template into a flow that already uses variables like `name`, `email`, etc., the system warns about conflicts. The creator can:
- **Keep existing variables** — the group fields bind to them (shared state across the flow)
- **Auto-rename** — append `_2`, `_3` to conflicting bindings (e.g., `email` → `email_2`)

---

## 5. UI Design

### 5.1 Where It Lives — BuilderPalette

The existing `BuilderPalette` (lines 117-183 in `BuilderPalette.tsx`) has two sections: **Fields** and **Logic**. Add a third section: **Templates**.

```
┌──────────────────────────────┐
│  FIELDS                      │
│  [Text] [Email] [Number]     │
│  [Long Text] [Dropdown] ...  │
│                              │
│  LOGIC                       │
│  [Field Group] [Decision]    │
│  [Calculator] [Payment]      │
│  [Summary] [Redirect]        │
│                              │
│  TEMPLATES              [+AI]│  ← NEW section
│  ┌────────────────────────┐  │
│  │ 👤 Personal Details    │  │
│  │   4 fields · contact   │  │
│  │ 🏠 Address             │  │
│  │   5 fields · address   │  │
│  │ 💳 Payment Details     │  │
│  │   3 fields · business  │  │
│  │ 📋 Feedback            │  │
│  │   3 fields · business  │  │
│  │ [+ AI Generate]        │  │  ← opens Gemini prompt
│  └────────────────────────┘  │
│                              │
│  [Manage Templates ↗]        │  ← link to full templates page
└──────────────────────────────┘
```

### 5.2 Template Card

Each template in the palette shows:
- Icon (category-based)
- Name
- Field count + category badge
- Hover: expanded tooltip showing field list

Clicking a template card inserts a Group node with that template's fields immediately.

### 5.3 "Save as Template" — From GroupConfig

When editing a Group node (`GroupConfig.tsx`), add a **"Save as Template"** button at the bottom:

```
┌──────────────────────────────────┐
│  Group title  [Shipping Info]    │
│                                  │
│  Fields (4)                      │
│  ┌────────────────────────────┐  │
│  │ 📝 Street Address   text   │  │
│  │ 🏙 City            text   │  │
│  │ 📮 ZIP Code         text   │  │
│  │ 🌍 Country         select  │  │
│  │ [+ Add field]              │  │
│  └────────────────────────────┘  │
│                                  │
│  [Save as Template]  [Delete]    │  ← NEW button
└──────────────────────────────────┘
```

Clicking it opens a small modal:

```
┌──────────────────────────────────────┐
│  Save as Template                    │
│                                      │
│  Name  [Shipping Info ____________]  │
│  Category  [address  ▾]              │
│  Description (optional)              │
│  [Standard shipping address fields]  │
│                                      │
│  Preview:                            │
│  • Street Address (text)             │
│  • City (text)                       │
│  • ZIP Code (text)                   │
│  • Country (select)                  │
│                                      │
│       [Cancel]  [Save Template]      │
└──────────────────────────────────────┘
```

### 5.4 Full Templates Manager

Accessible via the "Manage Templates ↗" link in the palette, or as a standalone route `/dashboard/templates`:

```
┌──────────────────────────────────────────────────────────────┐
│  Field Group Templates                                       │
│                                                              │
│  [🔍 Search templates...]   [Category ▾]   [+ New Template]  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 👤 Personal Details                  built-in · 12 uses│  │
│  │ Standard name, email, phone, date of birth              │  │
│  │ Fields: name, email, phone, date_of_birth               │  │
│  │                                        [Edit] [Delete]  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 🏠 Address                            built-in · 8 uses│  │
│  │ Street, city, state, zip, country                       │  │
│  │ Fields: street, city, state, zip, country               │  │
│  │                                        [Edit] [Delete]  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 🎓 Class Registration                  custom · 3 uses │  │
│  │ My template for workshop signups                        │  │
│  │ Fields: student_name, email, class_select, comments     │  │
│  │                                        [Edit] [Delete]  │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 5.5 AI Generate Modal

The **[+AI]** button in the Templates section opens a Gemini-powered prompt:

```
┌──────────────────────────────────────┐
│  AI Field Group Generator            │
│                                      │
│  Describe the field group you need:  │
│  ┌────────────────────────────────┐  │
│  │ gym membership signup with     │  │
│  │ emergency contact info         │  │
│  │                                │  │
│  └────────────────────────────────┘  │
│                                      │
│  [Generate]                          │
│                                      │
│  ── Result ───────────────────────── │
│  👤 Gym Membership Signup            │
│  Fields:                             │
│  • full_name (text) ✎                │
│  • email (email) ✎                   │
│  • phone (text) ✎                    │
│  • membership_type (select) ✎        │
│  • emergency_contact_name (text) ✎   │
│  • emergency_contact_phone (text) ✎  │
│                                      │
│  [Insert into Flow]  [Save as Template] │
└──────────────────────────────────────┘
```

This calls `src/integrations/services/gemini.ts` (Cali's module from FT-003) with a structured prompt asking for `GroupedField[]` output.

---

## 6. Server Functions

New file: `src/lib/server-fns/field-group-templates.ts`

```ts
import { createServerFn } from '@tanstack/react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import { db } from '../../db/index'
import { fieldGroupTemplates, profiles } from '../../db/schema'
import { eq, and, desc, asc, sql } from 'drizzle-orm'
import type { GroupedField } from '../flow-engine/types'

// ── Read ──

/** Get all templates for the current user (including built-ins). */
export const getTemplates = createServerFn({ method: 'GET' }).handler(async () => {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  const [profile] = await db.select().from(profiles).where(eq(profiles.clerkId, userId)).limit(1)
  if (!profile) throw new Error('Profile not found')

  return db
    .select()
    .from(fieldGroupTemplates)
    .where(eq(fieldGroupTemplates.profileId, profile.id))
    .orderBy(desc(fieldGroupTemplates.usageCount), asc(fieldGroupTemplates.name))
})

// ── Create ──

export const createTemplate = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    name: string
    description?: string
    category: string
    fields: GroupedField[]
  }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    const [profile] = await db.select().from(profiles).where(eq(profiles.clerkId, userId)).limit(1)
    if (!profile) throw new Error('Profile not found')

    const [template] = await db
      .insert(fieldGroupTemplates)
      .values({
        profileId: profile.id,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        category: data.category,
        fields: data.fields,
      })
      .returning()
    return template
  })

// ── Update ──

export const updateTemplate = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    id: number
    name?: string
    description?: string
    category?: string
    fields?: GroupedField[]
  }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    const [profile] = await db.select().from(profiles).where(eq(profiles.clerkId, userId)).limit(1)
    if (!profile) throw new Error('Profile not found')

    const { id, ...patch } = data
    const [template] = await db
      .update(fieldGroupTemplates)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(fieldGroupTemplates.id, id), eq(fieldGroupTemplates.profileId, profile.id)))
      .returning()
    if (!template) throw new Error('Template not found')
    return template
  })

// ── Delete ──

export const deleteTemplate = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    const [profile] = await db.select().from(profiles).where(eq(profiles.clerkId, userId)).limit(1)
    if (!profile) throw new Error('Profile not found')

    // Only allow deleting custom templates (not built-ins)
    const [template] = await db
      .select()
      .from(fieldGroupTemplates)
      .where(and(eq(fieldGroupTemplates.id, data.id), eq(fieldGroupTemplates.profileId, profile.id)))
      .limit(1)
    if (!template) throw new Error('Template not found')
    if (template.isBuiltin) throw new Error('Cannot delete built-in templates')

    await db.delete(fieldGroupTemplates)
      .where(and(eq(fieldGroupTemplates.id, data.id), eq(fieldGroupTemplates.profileId, profile.id)))
    return { success: true }
  })

// ── Track usage ──

export const incrementTemplateUsage = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    await db
      .update(fieldGroupTemplates)
      .set({ usageCount: sql`usage_count + 1` })
      .where(eq(fieldGroupTemplates.id, data.id))
  })

// ── AI suggest ──

export const suggestTemplateFromAI = createServerFn({ method: 'POST' })
  .inputValidator((data: { prompt: string }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')
    // Calls Gemini service module (FT-003, Cali's scope)
    // Returns { name, description, category, fields: GroupedField[] }
  })
```

---

## 7. Seeding Built-in Templates

New seed script: `scripts/seed-field-group-templates.ts`

Runs at migration time or via `npm run db:seed-templates` to insert the 7 built-in templates. Each template has `is_builtin = true` and references a specific profile ID (or `profile_id = 1` for system). On new user signup, the built-in templates are copied to the user's profile.

```ts
// scripts/seed-field-group-templates.ts
import { db } from '../src/db/index'
import { fieldGroupTemplates } from '../src/db/schema'

const BUILTIN_TEMPLATES = [
  {
    profileId: 1, // system
    name: 'Personal Details',
    description: 'Standard name, email, phone, date of birth',
    category: 'contact',
    fields: [
      { id: 'f_name', fieldType: 'text', label: 'Full Name', required: true, bindToVariable: 'full_name' },
      { id: 'f_email', fieldType: 'email', label: 'Email', required: true, bindToVariable: 'email' },
      { id: 'f_phone', fieldType: 'text', label: 'Phone', required: false, bindToVariable: 'phone' },
      { id: 'f_dob', fieldType: 'date', label: 'Date of Birth', required: false, bindToVariable: 'date_of_birth' },
    ],
    isBuiltin: true,
  },
  // ... 6 more
]

async function seed() {
  for (const t of BUILTIN_TEMPLATES) {
    await db.insert(fieldGroupTemplates).values(t).onConflictDoNothing()
  }
  console.log(`Seeded ${BUILTIN_TEMPLATES.length} field group templates`)
}

seed()
```

---

## 8. Gemini AI Integration (FT-003 connection)

The `suggestTemplateFromAI` server function calls Cali's Gemini service module. The prompt engineering is important:

```ts
// Inside suggestTemplateFromAI handler
import { getIntegrationConfig } from '../integrations/credentials'
import { generateFieldGroup } from '../../integrations/services/gemini' // Cali's module

const geminiConfig = await getIntegrationConfig<GeminiConfig>(profile.id, 'gemini')
if (!geminiConfig) throw new Error('Gemini API key not configured. Set it up in Integrations Hub.')

const systemPrompt = `You are a form builder assistant. Given a description of a form field group, 
return a JSON array of field definitions. Each field has: id (string), fieldType (one of: text, email, 
number, textarea, select, checkbox, radio, date, time, datetime), label (string), placeholder (optional 
string), required (boolean), bindToVariable (snake_case string). Include 3-7 fields. Only return valid 
JSON — no explanation.`

const result = await generateFieldGroup(geminiConfig, {
  systemPrompt,
  userPrompt: `Create a field group for: ${data.prompt}`,
  temperature: 0.3,
})

// Parse result.text as JSON → GroupedField[]
```

If Gemini is not configured (no API key), the **[+AI]** button shows as disabled with a tooltip: "Set up Gemini in Integrations Hub to enable AI suggestions."

---

## 9. File Change Summary

| File | Purpose |
|---|---|
| `src/db/schema.ts` | Add `field_group_templates` table + index |
| `src/lib/server-fns/field-group-templates.ts` | **New** — CRUD server functions + AI suggest endpoint |
| `scripts/seed-field-group-templates.ts` | **New** — seed 7 built-in templates |
| `src/components/flow-builder/BuilderPalette.tsx` | Add "Templates" section below "Logic" with template list, [+AI] button, "Manage" link |
| `src/components/flow-builder/TemplateCard.tsx` | **New** — individual template card (name, fields count, category, hover tooltip) |
| `src/components/flow-builder/TemplateTooltip.tsx` | **New** — hover tooltip showing field list preview |
| `src/components/flow-builder/SaveTemplateModal.tsx` | **New** — "Save as Template" modal from GroupConfig |
| `src/components/flow-builder/AIGenerateModal.tsx` | **New** — Gemini prompt + result preview modal |
| `src/components/flow-builder/config-forms/GroupConfig.tsx` | Add "Save as Template" button below the fields editor |
| `src/routes/dashboard/templates.tsx` | **New** — full templates manager page |
| `src/routes/forms/$formId/edit.tsx` | Wire template insertion into `handleAddNode` / palette click (line ~444-493) |
| `package.json` | Add `db:seed-templates` script |

---

## 10. Step-by-Step Tasks

### Task 1: DB Migration — `field_group_templates` table
- Add table + index to `src/db/schema.ts`
- Run `npm run db:generate` + `db:migrate`
- Create `scripts/seed-field-group-templates.ts` with 7 built-in templates
- Run seed script

### Task 2: Server Functions — Template CRUD
- Build `src/lib/server-fns/field-group-templates.ts`
- Implement `getTemplates`, `createTemplate`, `updateTemplate`, `deleteTemplate`, `incrementTemplateUsage`
- Implement `suggestTemplateFromAI` (depends on Cali's Gemini module from FT-003)

### Task 3: TemplateCard + TemplateTooltip Components
- Build `TemplateCard.tsx` — clickable card with name, field count, category badge
- Build `TemplateTooltip.tsx` — hover preview showing field list
- Integrate with drag-to-canvas (same `FLOW_DND_MIME` as group nodes)

### Task 4: BuilderPalette — Add Templates Section
- Modify `BuilderPalette.tsx` — add third "Templates" section below "Logic"
- Fetch templates via `useQuery` + `getTemplates`
- On click: insert a Group node with template fields
- Handle variable name deduplication warning

### Task 5: Save as Template — From GroupConfig
- Build `SaveTemplateModal.tsx` — name, category, description, field preview
- Add "Save as Template" button to `GroupConfig.tsx`
- Wire to `createTemplate` server function

### Task 6: AI Generate Modal
- Build `AIGenerateModal.tsx` — prompt input, Gemini call, result preview, edit fields
- "Insert into Flow" and "Save as Template" actions
- Disable button if Gemini not configured

### Task 7: Templates Manager Page
- Create `src/routes/dashboard/templates.tsx` route
- Full CRUD UI: search, category filter, edit modal, delete with confirm
- Navigate from dashboard nav + "Manage Templates ↗" link in palette

### Task 8: On New User — Copy Built-in Templates
- On profile creation (via `ensureProfile` in `credentials.ts` line 26-35), copy built-in templates
- Or: built-in templates use `profileId = NULL` and are queryable by all users
- Decide: global system templates vs. per-user copies

### Task 9: Validation & Polish
- Prevent duplicate template names per user
- Confirm dialog before deleting a template
- Undo/remove inserted group if user immediately changes their mind
- Edge case: inserting a template when no flow exists yet (auto-create flow)

---

## 11. Risks & Open Questions

| Risk | Mitigation |
|---|---|
| **Built-in templates feel limiting** — users may not want preset variable names | All fields are editable after insertion. The template is a starting point, not a straitjacket. |
| **Gemini returns malformed JSON** | Wrap in try/catch, show a clear error: "AI couldn't generate a valid field group. Try rephrasing your prompt." |
| **Gemini API costs** — each suggestion costs tokens | Show estimated token count. Cache recent suggestions. Rate limit: max 10 AI suggestions per user per day (configurable). |
| **Template variable conflicts** — inserting a template with `email` binding when flow already has `email` variable | Show conflict dialog: "email already exists. Keep existing binding, auto-rename to email_2, or skip." |
| **Built-in vs. user templates** — should built-ins be deletable? | No. Built-ins (`is_builtin = true`) are read-only. Users can only edit/delete their own templates. |
| **Copy on insert vs. reference** — if a template is updated, should existing groups update? | No. Deep copy on insert. Templates are starting points, not live references. This avoids cascading side effects. |

---

## 12. Validation / Testing

- [ ] DB migration runs and `field_group_templates` table is created
- [ ] Seed script inserts 7 built-in templates
- [ ] `getTemplates` returns both built-in and user-created templates
- [ ] `createTemplate` via "Save as Template" from GroupConfig works
- [ ] Clicking a template card inserts a Group node with correct fields
- [ ] Inserted fields are deep-cloned (modifying them doesn't change the template)
- [ ] `deleteTemplate` only works for user-created templates (not built-ins)
- [ ] Variable conflict dialog appears when inserting a template with duplicate bindings
- [ ] AI Generate modal works when Gemini is configured (FT-003)
- [ ] AI Generate modal shows disabled state when Gemini is not configured
- [ ] Templates manager page: search, filter, edit, delete all work
- [ ] Drag-and-drop templates onto canvas works
- [ ] Template `usageCount` increments on insert
