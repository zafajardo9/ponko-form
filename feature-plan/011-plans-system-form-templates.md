# FT-011: Form Templates — Prebuilt Complete Forms

> **Feature Plan** — When users click "New Form," they choose between starting from scratch or selecting a pre-built template (Contact Intake, Support Ticket, Deal Qualification, etc.). Templates are complete forms with pages and fields, seeded on first use, saving users from rebuilding common form patterns from zero.

**Status:** ✅ **Implemented** — built-in catalog, clone-on-create flow, migration, deployment seed, and `/forms/new` selection UI are complete

**Dependencies:**
- ✅ **FT-007 (Form Builder Revision — Pages)** — This feature relies on the page-based form architecture (pages + fields per page). Templates are composed of form pages with pre-configured fields. Since FT-007 is marked as planned, FT-011's template data must align with FT-007's schema and migration.
- ⬜ **FT-005 (Precreated Field Groups)** — Distinct but related. FT-005 creates reusable *field groups* within the flow builder. FT-011 creates entire *form templates* (title, pages, fields). No dependency, but the UX patterns (template cards, "built-in" badge, usage tracking) should be consistent.
- ✅ **Existing `forms` / `formPages` / `formPageFields` schema** — Templates clone directly into these tables. Must match the current Drizzle schema exactly.

---

## 1. User Story & Problem

### 1.1 Current State

Today, clicking **"New Form"** (`/forms/new`, lines 45-47 in `src/routes/forms/index.tsx`) takes the user directly to a blank form: a title + description input, then straight into the editor with two empty pages (Page 1 + Thank You). Every form starts from zero — there's no way to skip the repetitive work of setting up common form structures.

### 1.2 What Users Want

> *"I create Contact Intake forms, Support Ticket forms, and Deal Qualification forms all the time. Every one starts with the same fields — name, email, company, issue description, priority dropdown. I want to pick a template and get a head start instead of rebuilding the same form structure over and over."*

### 1.3 The Gap

The app already has:
- **`createForm`** (`src/lib/server-fns/forms.ts`, lines 83-111): creates a form + 2 default pages
- **Form builder** with pages, fields, conditions, themes
- **Field Group Templates** (FT-005, planned): reusable groups *within* the builder

What's missing is a **form-level template system** — a catalog of pre-built forms that a user can select and clone in one click. This is distinct from FT-005: FT-005 is about field groups you drop into an *existing* form's pages. FT-011 is about *entire forms* you start with.

### 1.4 Template Catalog (User's Request)

| Template | Pages | Key Fields |
|---|---|---|
| **Contact Intake** | Contact Info → Thank You | Name, Email, Phone, Company, Message |
| **Support Ticket** | Ticket Details → Thank You | Issue Title, Description, Priority (select), Category (select), Attachments note |
| **Deal Qualification** | Deal Info → Contact → Thank You | Company Name, Deal Size, Stage (select), Contact Name, Contact Email, Notes |
| **Account Intake** | Company Info → Contact → Thank You | Company Name, Industry, Employee Count, Website, Primary Contact Name, Primary Contact Email |
| **Task Request** | Task Details → Thank You | Task Title, Description, Assignee, Due Date (date), Priority (select) |

---

## 2. System Design — DB Schema & Architecture

### 2.1 New Table: `form_templates`

Each template is a serialized snapshot of a complete form — title, description, and all pages with their fields. Templates can be **built-in** (shipped with the app, `profile_id IS NULL`) or **user-created** (saved from an existing form, `profile_id = owner`).

```sql
CREATE TABLE form_templates (
  id            SERIAL PRIMARY KEY,
  profile_id    INTEGER REFERENCES profiles(id) ON DELETE CASCADE,  -- NULL = built-in
  name          VARCHAR(255) NOT NULL,                               -- "Contact Intake"
  description   TEXT,                                                -- "Standard contact form with name, email, message"
  category      VARCHAR(50) NOT NULL DEFAULT 'general',              -- 'contact', 'support', 'sales', 'general', 'custom'
  pages_data    JSONB NOT NULL DEFAULT '[]',                         -- Serialized form pages + fields
  is_builtin    BOOLEAN NOT NULL DEFAULT FALSE,                      -- TRUE = system-provided
  usage_count   INTEGER NOT NULL DEFAULT 0,                          -- How many forms created from this template
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX form_templates_profile_id_idx ON form_templates(profile_id);
CREATE INDEX form_templates_category_idx ON form_templates(category);
```

### 2.2 Drizzle Schema

```ts
// In src/db/schema.ts — add after the formPageFields definition (~line 237)

export const formTemplates = pgTable(
  'form_templates',
  {
    id: serial().primaryKey(),
    profileId: integer('profile_id').references(() => profiles.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    category: varchar('category', { length: 50 }).notNull().default('general'),
    pagesData: jsonb('pages_data').$type<TemplatePageData[]>().notNull().default([]),
    isBuiltin: boolean('is_builtin').notNull().default(false),
    usageCount: integer('usage_count').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('form_templates_profile_id_idx').on(table.profileId),
    index('form_templates_category_idx').on(table.category),
  ],
)
```

### 2.3 TypeScript Types

```ts
// In src/lib/server-fns/forms.ts — new types

interface TemplateFieldData {
  fieldType: PageFieldType              // from src/lib/page-builder/types.ts
  label: string
  placeholder?: string | null
  required: boolean
  options?: { label: string; value: string }[] | null
  bindVariable: string                  // snake_case identifier
  position: number
  width?: 'full' | 'half'
}

interface TemplatePageData {
  title: string
  description?: string | null
  position: number
  isFinal: boolean
  finalTemplate?: string | null         // only for final pages
  fields: TemplateFieldData[]
}

interface FormTemplate {
  id: number
  profileId: number | null
  name: string
  description: string | null
  category: 'contact' | 'support' | 'sales' | 'general' | 'custom'
  pagesData: TemplatePageData[]
  isBuiltin: boolean
  usageCount: number
}
```

### 2.4 Architecture — How Templates Become Forms

```
User lands on /forms/new
        │
        ├── Clicks "Start from scratch"
        │       └── Existing flow: title + description → createForm() → editor
        │
        └── Clicks a template card
                └── createFormFromTemplate(templateId, title?)
                        │
                        ├── 1. Read template from form_templates
                        ├── 2. Create form row (title = template.name or user override)
                        ├── 3. For each page in pages_data:
                        │       ├── Insert formPages row
                        │       └── For each field in page.fields:
                        │               Insert formPageFields row
                        ├── 4. Increment template.usage_count
                        └── 5. Return form → navigate to /forms/$formId/edit
```

This is a **clone-on-create** pattern. Templates are read-only references; the form gets its own independent copy of pages and fields. There's no ongoing link between the template and the created form.

---

## 3. UI Design — Template Selection Screen

### 3.1 Where It Lives

The existing `/forms/new` page (`src/routes/forms/new.tsx`) is redesigned to show a **two-step flow**:

**Step 1: Template Selection** — Choose a template or start from scratch.
**Step 2: Name & Create** — (Optional) Customize the form title, then create.

This keeps it on a single page with a state toggle rather than splitting across routes. The "Start from scratch" path is the existing form (lines 43-89).

### 3.2 Page Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Create a new form                                                │
│  Start from scratch or pick a template to get a head start.       │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  🪶  Start from Scratch                                      │ │
│  │      Blank form with empty pages. You build everything.       │ │
│  │                                                    [Select →]│ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌─ Templates ──────────────────────────────────────────────────┐ │
│  │                                                               │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │ │
│  │  │ 📋 Contact   │  │ 🎫 Support   │  │ 💼 Deal       │        │ │
│  │  │ Intake       │  │ Ticket       │  │ Qualification │        │ │
│  │  │              │  │              │  │               │        │ │
│  │  │ 5 fields     │  │ 5 fields     │  │ 3 pages       │        │ │
│  │  │ 2 pages      │  │ 2 pages      │  │ 6 fields      │        │ │
│  │  │ contact      │  │ support      │  │ sales         │        │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘        │ │
│  │                                                               │ │
│  │  ┌──────────────┐  ┌──────────────┐                          │ │
│  │  │ 🏢 Account   │  │ ✅ Task      │                          │ │
│  │  │ Intake       │  │ Request      │                          │ │
│  │  │              │  │              │                          │ │
│  │  │ 3 pages      │  │ 5 fields     │                          │ │
│  │  │ 6 fields     │  │ 2 pages      │                          │ │
│  │  │ general      │  │ general      │                          │ │
│  │  └──────────────┘  └──────────────┘                          │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 3.3 Template Card Component

Each card shows:
- **Category icon** (📋 contact, 🎫 support, 💼 sales, 🏢 general)
- **Template name** (e.g., "Contact Intake")
- **Page count + field count** (e.g., "2 pages · 5 fields")
- **Category badge** (e.g., "contact")

On hover: slight elevation change, accent border.

Clicking a template card opens the Title step:

```
┌──────────────────────────────────────────────────┐
│  Create from Template: Contact Intake             │
│                                                   │
│  Form title                                       │
│  ┌─────────────────────────────────────────────┐  │
│  │ Contact Intake                              │  │
│  └─────────────────────────────────────────────┘  │
│                                                   │
│  Template preview:                                │
│  Page 1: Contact Info                             │
│    • Full Name (text, required)                   │
│    • Email (email, required)                      │
│    • Phone (text)                                 │
│    • Company (text)                               │
│    • Message (textarea)                           │
│  Page 2: Thank You                                │
│    Final page with confirmation message           │
│                                                   │
│         [← Back to templates]  [Create Form →]    │
└──────────────────────────────────────────────────┘
```

### 3.4 Component Tree

```
NewFormPage (src/routes/forms/new.tsx)
├── TemplateSelectionView          ← NEW: Step 1 grid
│   ├── StartFromScratchCard       ← NEW: Always first option
│   └── TemplateCard[]             ← NEW: One per built-in template
│       └── CategoryBadge
└── TemplateConfirmView            ← NEW: Step 2 (shown after template click)
    ├── Input (title)
    ├── TemplatePreview            ← NEW: Shows pages + fields summary
    └── Button (Create Form)
```

### 3.5 Empty State / Edge Cases

- **First visit**: All 5 built-in templates are shown. No user-created templates yet (that's a future iteration).
- **No templates available** (should never happen with built-ins): Fall back to the current "Create a new form" page with just the title + description form.
- **After template selection → cancel**: Goes back to the template grid. No form is created.

---

## 4. Server Functions

### 4.1 New: `getFormTemplates`

Fetches all templates available to the user (built-in + user-created).

```ts
// In src/lib/server-fns/forms.ts

export const getFormTemplates = createServerFn({ method: 'GET' }).handler(async () => {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const profile = await ensureProfile(userId)

  // Return built-in templates (profile_id IS NULL) + user's own templates
  return db
    .select()
    .from(formTemplates)
    .where(
      or(
        isNull(formTemplates.profileId),
        eq(formTemplates.profileId, profile.id),
      ),
    )
    .orderBy(asc(formTemplates.category), desc(formTemplates.usageCount))
})
```

### 4.2 New: `createFormFromTemplate`

Creates a new form by cloning a template's pages and fields.

```ts
// In src/lib/server-fns/forms.ts

export const createFormFromTemplate = createServerFn({ method: 'POST' })
  .inputValidator((data: { templateId: number; title?: string }) => data)
  .handler(async ({ data }) => {
    const { userId } = await auth()
    if (!userId) throw new Error('Unauthorized')

    const profile = await ensureProfile(userId)

    // 1. Fetch the template
    const [template] = await db
      .select()
      .from(formTemplates)
      .where(eq(formTemplates.id, data.templateId))
      .limit(1)

    if (!template) throw new Error('Template not found')

    // 2. Create the form
    const publicId = await createUniquePublicId()
    const title = data.title?.trim() || template.name
    const [form] = await db
      .insert(forms)
      .values({
        profileId: profile.id,
        publicId,
        title,
        description: template.description,
      })
      .returning()

    // 3. Clone each page and its fields
    for (const pageData of template.pagesData) {
      const [page] = await db
        .insert(formPages)
        .values({
          formId: form.id,
          title: pageData.title,
          description: pageData.description ?? null,
          position: pageData.position,
          isFinal: pageData.isFinal,
          finalTemplate: pageData.finalTemplate ?? null,
        })
        .returning()

      if (pageData.fields && pageData.fields.length > 0) {
        await db.insert(formPageFields).values(
          pageData.fields.map((f) => ({
            pageId: page.id,
            fieldType: f.fieldType,
            label: f.label,
            placeholder: f.placeholder ?? null,
            required: f.required,
            options: f.options ?? null,
            bindVariable: f.bindVariable,
            position: f.position,
            width: f.width ?? 'full',
            validationRules: null,
          })),
        )
      }
    }

    // 4. Increment usage count
    await db
      .update(formTemplates)
      .set({ usageCount: sql`${formTemplates.usageCount} + 1` })
      .where(eq(formTemplates.id, template.id))

    return form
  })
```

### 4.3 Modified: `createForm` (Existing, No Change)

The existing `createForm` (`src/lib/server-fns/forms.ts`, lines 83-111) remains unchanged. It's used by the "Start from scratch" path. The new `createFormFromTemplate` is a separate function used by the template path. Both return a `Form` row.

### 4.4 Future: `saveFormAsTemplate` (User-Created Templates)

Not in scope for this plan, but the schema supports it. A future iteration would let a user save their existing form as a template:

```ts
export const saveFormAsTemplate = createServerFn({ method: 'POST' })
  .inputValidator((data: { formId: number; name: string; category?: string }) => data)
  .handler(async ({ data }) => {
    // Fetch form + pages + fields, serialize to pagesData, insert into form_templates
  })
```

This is explicitly a **future feature** — not part of this implementation.

---

## 5. Template Seed Data

### 5.1 Seed Script: `scripts/seed-form-templates.ts`

Runs at migration time to insert the 5 built-in templates (`profile_id = NULL`, `is_builtin = TRUE`).

```ts
// scripts/seed-form-templates.ts
import { db } from '../src/db/index'
import { formTemplates } from '../src/db/schema'

const BUILTIN_FORM_TEMPLATES = [
  // ── Contact Intake ──
  {
    profileId: null,
    name: 'Contact Intake',
    description: 'Collect contact inquiries with name, email, phone, company, and message.',
    category: 'contact',
    isBuiltin: true,
    pagesData: [
      {
        title: 'Contact Info',
        position: 0,
        isFinal: false,
        fields: [
          { fieldType: 'text', label: 'Full Name', required: true, bindVariable: 'full_name', position: 0, width: 'full' },
          { fieldType: 'email', label: 'Email', required: true, bindVariable: 'email', position: 1, width: 'full' },
          { fieldType: 'text', label: 'Phone', required: false, bindVariable: 'phone', position: 2, width: 'half' },
          { fieldType: 'text', label: 'Company', required: false, bindVariable: 'company', position: 3, width: 'half' },
          { fieldType: 'textarea', label: 'Message', required: false, bindVariable: 'message', position: 4, width: 'full' },
        ],
      },
      {
        title: 'Thank You',
        position: 1,
        isFinal: true,
        finalTemplate: 'Thank you for reaching out! We will get back to you shortly.',
        fields: [],
      },
    ],
  },

  // ── Support Ticket ──
  {
    profileId: null,
    name: 'Support Ticket',
    description: 'Capture support requests with issue details, priority, and category.',
    category: 'support',
    isBuiltin: true,
    pagesData: [
      {
        title: 'Ticket Details',
        position: 0,
        isFinal: false,
        fields: [
          { fieldType: 'text', label: 'Issue Title', required: true, bindVariable: 'issue_title', position: 0, width: 'full' },
          { fieldType: 'textarea', label: 'Description', required: true, bindVariable: 'description', position: 1, width: 'full' },
          {
            fieldType: 'select', label: 'Priority', required: true, bindVariable: 'priority', position: 2, width: 'half',
            options: [
              { label: 'Low', value: 'low' },
              { label: 'Medium', value: 'medium' },
              { label: 'High', value: 'high' },
              { label: 'Urgent', value: 'urgent' },
            ],
          },
          {
            fieldType: 'select', label: 'Category', required: true, bindVariable: 'category', position: 3, width: 'half',
            options: [
              { label: 'Bug Report', value: 'bug' },
              { label: 'Feature Request', value: 'feature' },
              { label: 'Account Issue', value: 'account' },
              { label: 'Billing', value: 'billing' },
              { label: 'Other', value: 'other' },
            ],
          },
          { fieldType: 'text', label: 'Attachment Link (optional)', required: false, bindVariable: 'attachment_link', position: 4, width: 'full', placeholder: 'Google Drive, Dropbox, etc.' },
        ],
      },
      {
        title: 'Thank You',
        position: 1,
        isFinal: true,
        finalTemplate: 'Your support ticket has been submitted. Our team will review it shortly.',
        fields: [],
      },
    ],
  },

  // ── Deal Qualification ──
  {
    profileId: null,
    name: 'Deal Qualification',
    description: 'Qualify sales deals with company info, deal size, stage, and contact details.',
    category: 'sales',
    isBuiltin: true,
    pagesData: [
      {
        title: 'Deal Information',
        position: 0,
        isFinal: false,
        fields: [
          { fieldType: 'text', label: 'Company Name', required: true, bindVariable: 'company_name', position: 0, width: 'full' },
          { fieldType: 'number', label: 'Deal Size (USD)', required: true, bindVariable: 'deal_size', position: 1, width: 'half' },
          {
            fieldType: 'select', label: 'Deal Stage', required: true, bindVariable: 'deal_stage', position: 2, width: 'half',
            options: [
              { label: 'Prospecting', value: 'prospecting' },
              { label: 'Qualification', value: 'qualification' },
              { label: 'Proposal', value: 'proposal' },
              { label: 'Negotiation', value: 'negotiation' },
              { label: 'Closed Won', value: 'closed_won' },
            ],
          },
        ],
      },
      {
        title: 'Contact Information',
        position: 1,
        isFinal: false,
        fields: [
          { fieldType: 'text', label: 'Contact Name', required: true, bindVariable: 'contact_name', position: 0, width: 'full' },
          { fieldType: 'email', label: 'Contact Email', required: true, bindVariable: 'contact_email', position: 1, width: 'full' },
          { fieldType: 'textarea', label: 'Additional Notes', required: false, bindVariable: 'notes', position: 2, width: 'full' },
        ],
      },
      {
        title: 'Thank You',
        position: 2,
        isFinal: true,
        finalTemplate: 'Deal submitted successfully. Your sales team will follow up.',
        fields: [],
      },
    ],
  },

  // ── Account Intake ──
  {
    profileId: null,
    name: 'Account Intake',
    description: 'Onboard new accounts with company details, industry, and primary contact.',
    category: 'general',
    isBuiltin: true,
    pagesData: [
      {
        title: 'Company Information',
        position: 0,
        isFinal: false,
        fields: [
          { fieldType: 'text', label: 'Company Name', required: true, bindVariable: 'company_name', position: 0, width: 'full' },
          { fieldType: 'text', label: 'Industry', required: true, bindVariable: 'industry', position: 1, width: 'half' },
          { fieldType: 'number', label: 'Employee Count', required: false, bindVariable: 'employee_count', position: 2, width: 'half' },
          { fieldType: 'text', label: 'Website', required: false, bindVariable: 'website', position: 3, width: 'full' },
        ],
      },
      {
        title: 'Primary Contact',
        position: 1,
        isFinal: false,
        fields: [
          { fieldType: 'text', label: 'Contact Name', required: true, bindVariable: 'contact_name', position: 0, width: 'full' },
          { fieldType: 'email', label: 'Contact Email', required: true, bindVariable: 'contact_email', position: 1, width: 'full' },
        ],
      },
      {
        title: 'Thank You',
        position: 2,
        isFinal: true,
        finalTemplate: 'Account information received. Welcome aboard!',
        fields: [],
      },
    ],
  },

  // ── Task Request ──
  {
    profileId: null,
    name: 'Task Request',
    description: 'Collect task requests with title, description, assignee, due date, and priority.',
    category: 'general',
    isBuiltin: true,
    pagesData: [
      {
        title: 'Task Details',
        position: 0,
        isFinal: false,
        fields: [
          { fieldType: 'text', label: 'Task Title', required: true, bindVariable: 'task_title', position: 0, width: 'full' },
          { fieldType: 'textarea', label: 'Description', required: true, bindVariable: 'description', position: 1, width: 'full' },
          { fieldType: 'text', label: 'Assignee', required: false, bindVariable: 'assignee', position: 2, width: 'half' },
          { fieldType: 'date', label: 'Due Date', required: true, bindVariable: 'due_date', position: 3, width: 'half' },
          {
            fieldType: 'select', label: 'Priority', required: true, bindVariable: 'priority', position: 4, width: 'half',
            options: [
              { label: 'Low', value: 'low' },
              { label: 'Medium', value: 'medium' },
              { label: 'High', value: 'high' },
              { label: 'Critical', value: 'critical' },
            ],
          },
        ],
      },
      {
        title: 'Thank You',
        position: 1,
        isFinal: true,
        finalTemplate: 'Task request submitted successfully. It will be reviewed shortly.',
        fields: [],
      },
    ],
  },
]

async function seed() {
  for (const t of BUILTIN_FORM_TEMPLATES) {
    await db.insert(formTemplates).values(t as any).onConflictDoNothing()
  }
  console.log(`Seeded ${BUILTIN_FORM_TEMPLATES.length} form templates`)
}

seed()
```

---

## 6. How It Connects to Other Feature Plans

| Feature Plan | Connection |
|---|---|
| **FT-007 (Page Builder)** | Templates mirror the page-based architecture. Each template has an array of `TemplatePageData` matching `formPages` + `formPageFields` shapes. If FT-007's schema changes (e.g., new columns on `formPages`), template seed data must be updated. |
| **FT-005 (Field Group Templates)** | Both use a "template card" UI pattern and "built-in" badge. FT-011's template cards should visually resemble FT-005's template cards for consistency. FT-005 templates are *field groups* for the flow builder; FT-011 templates are *entire forms*. The user never sees both in the same context. |
| **FT-001 (Onboarding)** | The onboarding flow (Step 2: "Create a Form") could reference form templates as part of the guided experience. When FT-011 is implemented, the onboarding should point users to the template selection screen. |
| **FT-008 (Form Constants)** | Templates could eventually include pre-configured constants (e.g., a "Tax Rate" constant in a Deal Qualification template). Not in v1 — constants would need to be added after form creation. |

---

## 7. File Change Summary

| File | Purpose |
|---|---|
| `src/db/schema.ts` | Add `formTemplates` table definition (~lines 237-260) |
| `src/lib/server-fns/forms.ts` | Add `getFormTemplates`, `createFormFromTemplate` server functions; import `formTemplates` from schema |
| `src/routes/forms/new.tsx` | Complete redesign: Template Selection view + Template Confirm view |
| `src/components/forms/TemplateCard.tsx` | **NEW** — Template card component with icon, name, fields/pages count, category badge |
| `src/components/forms/TemplatePreview.tsx` | **NEW** — Preview panel showing pages + fields when a template is selected |
| `scripts/seed-form-templates.ts` | **NEW** — Seed script for 5 built-in templates |
| `package.json` | Add `"db:seed-form-templates"` script entry |

---

## 8. Step-by-Step Tasks

### Task 1: DB Migration — `form_templates` Table
- Add `formTemplates` Drizzle definition to `src/db/schema.ts` (after line 237, the `formPageFields` definition)
- Run `npm run db:generate` to create migration
- Run `npm run db:migrate` to apply

### Task 2: Seed Built-in Templates
- Create `scripts/seed-form-templates.ts` with the 5 template definitions from Section 5
- Add `"db:seed-form-templates": "npx tsx scripts/seed-form-templates.ts"` to `package.json` scripts
- Run the seed script to populate the database
- Verify: `SELECT id, name, category FROM form_templates` returns 5 rows

### Task 3: Server Functions — Template Fetch & Clone
- Add `getFormTemplates` to `src/lib/server-fns/forms.ts` (fetch built-in + user templates)
- Add `createFormFromTemplate` to `src/lib/server-fns/forms.ts` (clone template into new form)
- Import `formTemplates`, `isNull`, `or`, `sql` in the server functions file
- Ensure both functions follow the existing pattern: `createServerFn` → `auth()` → `ensureProfile(userId)` → handler

### Task 4: TemplateCard Component
- Create `src/components/forms/TemplateCard.tsx`
- Props: `{ template: FormTemplate; onClick: () => void }`
- Shows: category icon (mapped from `category`), name, description, "N pages · M fields" count, category badge
- Uses project colors: `bg-[#efe9de]` card, `border-[#e6dfd8]`, hover accent with `border-[#cc785c]/30`
- Category icons: Use lucide-react icons (`MessageCircle` for contact, `Ticket` for support, `Briefcase` for sales, `Building2` for general)

### Task 5: TemplatePreview Component
- Create `src/components/forms/TemplatePreview.tsx`
- Props: `{ template: FormTemplate }`
- Shows: list of pages with fields summarized per page
- Used inside the TemplateConfirmView when a user clicks a template card

### Task 6: Redesign `/forms/new` Page
- Rewrite `src/routes/forms/new.tsx` with two states:
  1. **`TemplateSelectionView`**: Grid of `StartFromScratchCard` + `TemplateCard[]`
  2. **`TemplateConfirmView`**: Title input, `TemplatePreview`, Create/Cancel buttons
- `StartFromScratchCard`: Same card style as templates but distinct (gray, "Blank form" icon), clicking it shows the original title + description form
- "Start from scratch" path uses existing `createForm` server function
- Template path uses `createFormFromTemplate` server function
- Loading + error states for both paths
- Fetch templates with `useQuery({ queryKey: ['form-templates'], queryFn: () => getFormTemplates() })`

### Task 7: Polish & Edge Cases
- Skeleton loading state while templates fetch
- Empty template list fallback (shouldn't happen with built-ins, but handle gracefully)
- "Back" navigation from confirm view to template grid
- Ensure template page loads correctly after form creation (redirect to `/forms/$formId/edit`)
- Keyboard accessibility: template cards are focusable, Enter/Space selects

### Task 8: Validation & Testing
- Create a form from each of the 5 templates, verify pages + fields appear correctly in the editor
- Create a form from scratch, verify the existing flow still works
- Refresh the `/forms/new` page — templates should load from cache (React Query)
- Delete a template-created form — verify cascade works (no orphaned pages/fields)

---

## 9. Risks & Open Questions

| Risk | Mitigation |
|---|---|
| **FT-007 migration changes `formPages` / `formPageFields` columns** | Template seed data uses the current schema. If FT-007 adds/removes columns, update the seed data and `TemplateFieldData` type. This is a coordination risk — implement FT-011 after FT-007's migration is stable. |
| **`bindVariable` collisions** if user creates two template forms with overlapping variable names | Bind variables are scoped per form (they're in `formPageFields`, not a shared namespace). No collision risk. Each form gets its own independent copy. |
| **Large page/field JSON in `pages_data` column** | PostgreSQL JSONB handles this well. The largest template (Deal Qualification, 3 pages, 6 fields) is ~2KB — negligible. |
| **User expects to edit template after creation** | Clarify in UI: "Templates are starting points — your form is independent after creation." A future "Save as Template" feature (see Section 4.4) would address saving edits back. |
| **Template preview shows too much detail** | The preview is a simple list of pages with field labels. Keep it scannable — no need to show placeholder text, options, or validation rules. |

---

## 10. Validation / Testing

- [ ] Visit `/forms/new` → template grid renders with 5 templates + "Start from scratch"
- [ ] Click "Start from scratch" → title + description form appears → create form → lands in editor with 2 default pages
- [ ] Click "Contact Intake" template → confirm view shows form title "Contact Intake" + page/field preview → click Create → lands in editor with Contact Info page (5 fields) + Thank You page
- [ ] Repeat for Support Ticket, Deal Qualification, Account Intake, Task Request — each produces correct pages/fields
- [ ] Template cards are keyboard-accessible (Tab, Enter)
- [ ] Loading skeleton shows while templates fetch
- [ ] Click "Back to templates" in confirm view → returns to template grid
- [ ] Browser back button from confirm view → returns to template grid
- [ ] Form created from template can be edited, pages added/removed, published — behaves identically to scratch-created forms
- [ ] Delete a template-created form → no orphaned pages/fields remain
- [ ] `usage_count` increments when a template is used (verify in DB)
