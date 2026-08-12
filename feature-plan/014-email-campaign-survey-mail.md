# FT-014: Satisfaction Rating Field — Emoji & Scale Survey Questions

> **Feature Plan** — Add a new `'satisfaction'` field type to the page builder. Form creators can add a visual 1–5 rating scale (happy-to-sad emojis, stars, or numeric) that respondents tap to express their satisfaction level. The field value is stored as a number (1–5), making it usable in computations, analytics, and dashboards.

**Status:** ✅ **Implemented** — satisfaction field, rating presets, respondent renderer, validation, migration, and survey template added

**Dependencies:**
- ✅ **FT-007 (Page Builder)** — The satisfaction field is a new `PageFieldType` that integrates directly into the existing page builder architecture. It follows the same pattern as all existing field types (`text`, `select`, `radio`, etc.) — field palette entry → field config → FieldRenderer → server-side persistence.
- ✅ **Existing `fieldTypeEnum` + `FieldRenderer`** — The field extends the proven field type system already supporting 16 types. No new infrastructure needed.
- ⬜ **FT-006 (Table View / Submissions)** — The submissions table should show satisfaction values with visual indicators (emoji/star icons) rather than raw numbers. This is a future enhancement, not a blocker.
- ⬜ **FT-008 (Form Constants)** — Satisfaction scores could be used as constants for thresholds (e.g., "alert if average < 3"). Future enhancement.

---

## 1. User Story & Problem

### 1.1 Current State

The page builder supports 16 field types (`text`, `email`, `number`, `textarea`, `select`, `checkbox`, `radio`, `date`, `time`, `datetime`, `address`, `file_upload`, `computation`, `content`, `media`, `payment`). None of these are purpose-built for satisfaction surveys or sentiment capture.

To collect satisfaction data today, a creator must:
- Use a `select` dropdown with options "Very Satisfied", "Satisfied", "Neutral", "Dissatisfied", "Very Dissatisfied" — functional but visually cold
- Use a `radio` group with the same labels — slightly better but still text-heavy
- Use a `number` field — no visual guidance, respondents don't know what 1 vs. 5 means

None of these feel like a survey. The result is lower completion rates and less accurate sentiment data.

### 1.2 What the User Wants

> *"I want to add a field where I can have happy-to-sad survey questions like a 1–5 scale. I'll add the assets for that. I just want to get satisfaction levels from respondents."*

The user envisions:
- A visual, emoji-based scale (😄 happy → 😢 sad) — not a sterile dropdown
- A 1-to-5 rating system that's immediately intuitive
- The ability to use custom assets (their own emoji images)
- A field that feels like a modern survey tool, not a generic form field

### 1.3 Solution

Add a **`'satisfaction'`** field type that renders as a visual, tappable rating scale:

```
┌──────────────────────────────────────────────────────────────┐
│  How satisfied are you with our service?              *      │
│                                                              │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐          │
│  │ 😡   │  │ 😕   │  │ 😐   │  │ 😊   │  │ 😍   │          │
│  │      │  │      │  │      │  │      │  │      │          │
│  │Very  │  │Dissat│  │Neut- │  │Satis-│  │Very  │          │
│  │dissat│  │isfied│  │ral   │  │fied  │  │satis-│          │
│  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘          │
│    1          2          3          4          5              │
└──────────────────────────────────────────────────────────────┘
```

The selected option highlights with the theme accent color. The value stored is the numeric rating (1–5).

---

## 2. System Design — No Schema Changes Required

### 2.1 Why No New Columns

The satisfaction field **reuses the existing `formPageFields` table structure**:

| Column | How It's Used for Satisfaction |
|---|---|
| `field_type` | Set to `'satisfaction'` (new enum value) |
| `label` | "How satisfied are you with our service?" |
| `placeholder` | Optional help text below the scale |
| `required` | Standard required flag |
| `options` (JSONB) | Stores the scale configuration — see below |
| `bind_variable` | Standard variable binding (e.g., `satisfaction_score`) |
| `position`, `width` | Standard layout fields |
| `validation_rules` | Not used (satisfaction is always a valid 1–5 selection) |

### 2.2 Options JSONB Shape for Satisfaction

The `options` column stores the scale configuration as an array of option objects:

```json
[
  {
    "label": "Very dissatisfied",
    "value": "1",
    "emoji": "😡"
  },
  {
    "label": "Dissatisfied",
    "value": "2",
    "emoji": "😕"
  },
  {
    "label": "Neutral",
    "value": "3",
    "emoji": "😐"
  },
  {
    "label": "Satisfied",
    "value": "4",
    "emoji": "😊"
  },
  {
    "label": "Very satisfied",
    "value": "5",
    "emoji": "😍"
  }
]
```

This reuses the existing `PageFieldOption` interface shape (`label`, `value`) — no type changes needed. The `emoji` field is an extension that the satisfaction renderer reads; other field types ignore it.

### 2.3 Value Storage

The respondent's selection is stored as a **string number** (`"1"`, `"2"`, ..., `"5"`) in `collectedData` under the field's `bindVariable`. This is consistent with how `select` and `radio` fields store their values. When used in computations, it can be parsed as a number.

### 2.4 Architecture — Where Changes Go

```
Field Palette (PageBuilderWorkspace.tsx, lines 83-100)
  └── Add { type: 'satisfaction', label: 'Satisfaction', icon: <Smile /> }
        │
        ▼
Field Settings Panel (PageBuilderWorkspace.tsx, lines 1689-1696)
  └── 'satisfaction' appears in the type dropdown
  └── New config section: scale preset picker, emoji picker per level
        │
        ▼
savePageForm() (page-forms.ts, line 507+)
  └── No change needed — field_type 'satisfaction' is valid once added to enum
  └── ensurePageBuilderFieldTypes() adds 'satisfaction' to Postgres enum
        │
        ▼
FieldRenderer (FieldRenderer.tsx, starts line 80)
  └── New case: field.type === 'satisfaction' → render rating scale UI
        │
        ▼
PageFormView (PageFormView.tsx)
  └── No change needed — FieldValue already includes string, number
```

---

## 3. UI Design

### 3.1 Field Palette Entry

In `src/components/page-builder/PageBuilderWorkspace.tsx`, add to the `FIELD_ITEMS` array (after line 98):

```tsx
{ type: 'satisfaction', label: 'Satisfaction', icon: <Smile size={14} /> },
```

Import `Smile` from `lucide-react`.

### 3.2 Field Renderer — Respondent View

New section in `src/components/form-builder/fields/FieldRenderer.tsx`, after the `radio` case (line 351):

```tsx
if (field.type === 'satisfaction') {
  const selectedValue = Number(strValue) || 0
  return (
    <div className="flex flex-col gap-1.5">
      {field.label && (
        <label className="text-sm font-medium text-[#141413]">
          {field.label}
          {field.required && <span className="ml-0.5 text-[#c64545]">*</span>}
        </label>
      )}
      {field.placeholder && (
        <p className="text-xs text-[#8e8b82]">{field.placeholder}</p>
      )}
      <div
        className="mt-1 grid gap-2"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
        role="radiogroup"
        aria-label={field.label}
      >
        {options.map((opt) => {
          const numValue = Number(opt.value)
          const isSelected = selectedValue === numValue
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={readOnly}
              onClick={() => onChange(String(numValue))}
              className={[
                'flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-4 transition-all',
                'focus:outline-none focus:ring-2 focus:ring-[var(--ponko-primary-soft,#cc785c29)]',
                isSelected
                  ? 'border-[var(--ponko-primary,#cc785c)] bg-[var(--ponko-primary-soft,#cc785c14)] shadow-sm scale-105'
                  : 'border-[#e6dfd8] bg-[#faf9f5] hover:border-[#cfc4b8] hover:bg-white',
                readOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
              ].join(' ')}
            >
              <span className="text-2xl leading-none" aria-hidden="true">
                {opt.emoji ?? opt.label}
              </span>
              <span className="text-xs font-medium text-[#6c6a64] text-center leading-tight">
                {opt.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

**Rendering notes:**
- Each option is a tappable card with emoji + label
- Selected option gets the accent border + subtle background tint + slight scale-up
- Responsive: cards distribute evenly using CSS grid with `minmax(0, 1fr)`
- On mobile (< 400px), 5 cards in a row may be too tight — use `sm:gap-3` and smaller padding
- The `emoji` field can be a native emoji character, an emoji shortcode, or a URL to a custom image
- If no emoji is provided, just show the label text centered

### 3.3 Field Settings Panel — Creator Configuration

In `FieldSettings` function (line 1622+), after the type-specific sections, add a satisfaction config section:

```
┌──────────────────────────────────────────────┐
│  Field settings                              │
│  How satisfied are you?                      │
│                                              │
│  Label    [How satisfied are you? _______]   │
│  Type     [Satisfaction           ▾]         │
│  Move to  [Page 1                  ▾]         │
│                                              │
│  ── SCALE PRESET ──────────────────────      │
│  ○ 5-Point Satisfaction (😄→😢)              │
│  ○ Net Promoter Score (0–10)                 │
│  ○ Star Rating (⭐⭐⭐⭐⭐)                      │
│  ○ Custom                                    │
│                                              │
│  ── SCALE LEVELS ──────────────────────      │
│                                              │
│  Level 1  Emoji [😡]  Label [Very dissat_]   │
│  Level 2  Emoji [😕]  Label [Dissatisfied]   │
│  Level 3  Emoji [😐]  Label [Neutral _____]  │
│  Level 4  Emoji [😊]  Label [Satisfied ___]  │
│  Level 5  Emoji [😍]  Label [Very satis__]   │
│                                              │
│  ── ADVANCED ────────────────────────────    │
│  Help text  [Optional hint below field ___]  │
│  Required   [✓]                              │
│                                              │
│  [Move to page ▾]  [Delete field]            │
└──────────────────────────────────────────────┘
```

**Scale presets:**
1. **5-Point Satisfaction** (default): 😡 Very dissatisfied → 😍 Very satisfied (5 levels)
2. **Net Promoter Score**: 0–10 numeric scale with labels at 0 (Not likely), 5 (Neutral), 10 (Extremely likely)
3. **Star Rating**: ⭐ to ⭐⭐⭐⭐⭐ (5 stars)
4. **Custom**: Creator configures each level's emoji and label manually

When a preset is selected, the level fields auto-populate. Switching to "Custom" preserves the current values and lets the creator edit freely.

**Emoji input:** A text input that accepts:
- Native emoji (pasted or typed via emoji keyboard)
- A URL to a custom image (the renderer detects URLs and renders an `<img>` tag)
- An SVG data URI for custom icons

### 3.4 Public Form View — Integration

In `PageFormView`, the `FieldRenderer` component is already called for every field on the page. The `fieldConfig()` helper (lines 45-54) passes `field.options` to the renderer. No changes needed — the satisfaction options flow through the existing pipeline.

The `FieldValue` type already includes `string`, so the numeric value `"3"` is valid.

### 3.5 Submissions Table — Visual Display (Future Enhancement)

Currently, the submissions table in `getSubmissions()` (submissions.ts) shows raw values. For satisfaction fields, the value `"4"` could be displayed as `😊 Satisfied (4/5)`. This is a **future enhancement** for FT-006 and not part of this plan.

---

## 4. Code Changes — Field Type Registration

### 4.1 TypeScript Type (`src/lib/page-builder/types.ts`)

Add `'satisfaction'` to the `PageFieldType` union (line 1):

```ts
export type PageFieldType =
  | 'text'
  | 'email'
  // ... existing types ...
  | 'file_upload'
  | 'satisfaction'  // ← NEW
```

### 4.2 Drizzle Schema (`src/db/schema.ts`)

Add `'satisfaction'` to the `fieldTypeEnum` (line 17):

```ts
export const fieldTypeEnum = pgEnum('field_type', [
  'text',
  // ... existing types ...
  'file_upload',
  'satisfaction',  // ← NEW
])
```

### 4.3 DB Migration Helper (`src/lib/server-fns/page-forms.ts`)

Add a new `IF NOT EXISTS` block to `ensurePageBuilderFieldTypes()` (after line 179):

```ts
IF NOT EXISTS (
  SELECT 1
  FROM pg_enum e
  JOIN pg_type t ON t.oid = e.enumtypid
  WHERE t.typname = 'field_type' AND e.enumlabel = 'satisfaction'
) THEN
  ALTER TYPE "public"."field_type" ADD VALUE 'satisfaction';
END IF;
```

### 4.4 FieldRenderer Type (`src/components/form-builder/fields/FieldRenderer.tsx`)

Add `'satisfaction'` to the `FieldConfig.type` union (line 31):

```ts
export interface FieldConfig {
  id: number
  type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'payment' | 'date' | 'time' | 'datetime' | 'content' | 'media' | 'address' | 'computation' | 'file_upload' | 'satisfaction'
  // ... rest unchanged
}
```

Also extend the `FieldOption` interface to include an optional `emoji` field (line 20):

```ts
export interface FieldOption {
  label: string
  value: string
  price?: number | null
  priceReference?: string | null
  additionalPrice?: number | null
  additionalPriceReference?: string | null
  emoji?: string | null  // ← NEW: emoji character or image URL for satisfaction field
}
```

### 4.5 Field Palette (`src/components/page-builder/PageBuilderWorkspace.tsx`)

Add to `FIELD_ITEMS` array (line 83), import `Smile` from lucide-react:

```tsx
import { ..., Smile } from 'lucide-react'

const FIELD_ITEMS: FieldPaletteItem[] = [
  // ... existing items ...
  { type: 'satisfaction', label: 'Satisfaction', icon: <Smile size={14} /> },
]
```

### 4.6 Add Field Defaults

In `addFieldLocal()` (line 418+), add default options for the satisfaction field:

```tsx
function addFieldLocal(item: FieldPaletteItem) {
  if (!currentPage || currentPage.isFinal) return
  const fieldType = item.type

  // Default options for satisfaction field
  const defaultOptions = fieldType === 'satisfaction'
    ? [
        { label: 'Very dissatisfied', value: '1', emoji: '😡' },
        { label: 'Dissatisfied',      value: '2', emoji: '😕' },
        { label: 'Neutral',           value: '3', emoji: '😐' },
        { label: 'Satisfied',         value: '4', emoji: '😊' },
        { label: 'Very satisfied',     value: '5', emoji: '😍' },
      ]
    : null

  // ... rest of the function, pass defaultOptions as options
}
```

### 4.7 Field Settings Panel

In `FieldSettings` (line 1622+), add configuration for satisfaction fields after existing type-specific sections (after the `content`, `media`, `file_upload` blocks):

```tsx
{field.fieldType === 'satisfaction' && (
  <>
    <Field label="Scale preset">
      <select
        value={satisfactionPreset}
        onChange={(e) => applySatisfactionPreset(e.target.value)}
        className={inputClass}
      >
        <option value="5-point">5-Point Satisfaction</option>
        <option value="nps">Net Promoter Score (0–10)</option>
        <option value="stars">Star Rating</option>
        <option value="custom">Custom</option>
      </select>
    </Field>
    <FieldGroup label="Scale levels">
      {(field.options ?? satisfactionDefaults).map((opt, index) => (
        <div key={opt.value} className="flex items-center gap-2">
          <span className="w-6 text-xs text-[#8e8b82]">{index + 1}</span>
          <input
            value={opt.emoji ?? ''}
            onChange={(e) => updateSatisfactionOption(index, 'emoji', e.target.value)}
            className={`${inputClass} w-16`}
            placeholder="😊"
          />
          <input
            value={opt.label}
            onChange={(e) => updateSatisfactionOption(index, 'label', e.target.value)}
            className={inputClass}
            placeholder="Label"
          />
        </div>
      ))}
    </FieldGroup>
    <Field label="Help text">
      <input
        value={field.placeholder ?? ''}
        onChange={(e) => onUpdate({ placeholder: e.target.value || null })}
        className={inputClass}
        placeholder="Optional hint displayed below the question"
      />
    </Field>
  </>
)}
```

---

## 5. Server Functions — No New Functions Needed

The satisfaction field works entirely within the existing save/load pipeline:

- **`savePageForm()`** — Already accepts any `fieldType` string that matches the enum. Once `'satisfaction'` is added to the enum + types, it saves without any code changes.
- **`hydratePages()`** — Reads `formPageFields` rows and returns them as `PageField[]`. No changes needed.
- **`getSubmissions()`** — Shows `bindVariable` values in the submissions table. Satisfaction values appear as `"3"`, `"5"`, etc.
- **Validation** — `validateFieldRules()` in `complete-submission.ts` already handles required field checks generically. No special satisfaction validation needed.

---

## 6. Satisfaction Scale Presets

| Preset | Levels | Emojis | Labels | Values |
|---|---|---|---|---|
| **5-Point Satisfaction** (default) | 5 | 😡 😕 😐 😊 😍 | Very dissatisfied, Dissatisfied, Neutral, Satisfied, Very satisfied | 1–5 |
| **Net Promoter Score** | 11 | — 🔴 ... 🟡 ... 🟢 — | Not likely (0), ..., Neutral (5), ..., Extremely likely (10) | 0–10 |
| **Star Rating** | 5 | ⭐ ⭐ ⭐ ⭐ ⭐ | 1 star, 2 stars, ..., 5 stars | 1–5 |
| **Custom** | Configurable | User-defined | User-defined | Sequential |

For NPS (0–10), the renderer adjusts to 11 buttons. On mobile, this may require horizontal scrolling or a 2-row layout.

### Preset Application Logic

```tsx
const SATISFACTION_PRESETS: Record<string, PageFieldOption[]> = {
  '5-point': [
    { label: 'Very dissatisfied', value: '1', emoji: '😡' },
    { label: 'Dissatisfied',      value: '2', emoji: '😕' },
    { label: 'Neutral',           value: '3', emoji: '😐' },
    { label: 'Satisfied',         value: '4', emoji: '😊' },
    { label: 'Very satisfied',    value: '5', emoji: '😍' },
  ],
  'nps': [
    { label: '0', value: '0', emoji: '🔴' },
    { label: '1', value: '1', emoji: '' },
    { label: '2', value: '2', emoji: '' },
    { label: '3', value: '3', emoji: '' },
    { label: '4', value: '4', emoji: '' },
    { label: '5', value: '5', emoji: '🟡' },
    { label: '6', value: '6', emoji: '' },
    { label: '7', value: '7', emoji: '' },
    { label: '8', value: '8', emoji: '' },
    { label: '9', value: '9', emoji: '' },
    { label: '10', value: '10', emoji: '🟢' },
  ],
  'stars': [
    { label: '1 star',  value: '1', emoji: '⭐' },
    { label: '2 stars', value: '2', emoji: '⭐' },
    { label: '3 stars', value: '3', emoji: '⭐' },
    { label: '4 stars', value: '4', emoji: '⭐' },
    { label: '5 stars', value: '5', emoji: '⭐' },
  ],
}
```

---

## 7. File Change Summary

| File | Purpose |
|---|---|
| `src/lib/page-builder/types.ts` | Add `'satisfaction'` to `PageFieldType` union (line 2) |
| `src/db/schema.ts` | Add `'satisfaction'` to `fieldTypeEnum` (line 17) |
| `src/lib/server-fns/page-forms.ts` | Add `'satisfaction'` to `ensurePageBuilderFieldTypes()` (after line 179) |
| `src/components/form-builder/fields/FieldRenderer.tsx` | Add `'satisfaction'` to `FieldConfig.type` union (line 31); add `emoji` to `FieldOption` (line 20+); add satisfaction render case (after line 351) |
| `src/components/page-builder/PageBuilderWorkspace.tsx` | Import `Smile`; add to `FIELD_ITEMS` (line 83-100); add default options in `addFieldLocal()` (line 418+); add satisfaction config section in `FieldSettings` (line 1622+) |
| `src/components/page-builder/SatisfactionPresets.ts` | **NEW** — `SATISFACTION_PRESETS` constant and preset application helpers |

---

## 8. Step-by-Step Tasks

### Task 1: Register the New Field Type
- Add `'satisfaction'` to `PageFieldType` in `src/lib/page-builder/types.ts` (line 2)
- Add `'satisfaction'` to `fieldTypeEnum` in `src/db/schema.ts` (line 17)
- Add `'satisfaction'` to `ensurePageBuilderFieldTypes()` in `src/lib/server-fns/page-forms.ts` (after line 179, following the existing pattern)
- Add `'satisfaction'` to `FieldConfig.type` union in `src/components/form-builder/fields/FieldRenderer.tsx` (line 31)
- Add optional `emoji?: string | null` to `FieldOption` interface in `FieldRenderer.tsx` (line 20+)
- Run `pnpm run db:generate` → `pnpm run db:migrate`
- Verify the app loads without TypeScript errors

### Task 2: Add to Field Palette
- Import `Smile` from `lucide-react` in `src/components/page-builder/PageBuilderWorkspace.tsx`
- Add `{ type: 'satisfaction', label: 'Satisfaction', icon: <Smile size={14} /> }` to `FIELD_ITEMS` array (after line 98)
- In `addFieldLocal()`, add default 5-point satisfaction options when `fieldType === 'satisfaction'`
- Verify the "Satisfaction" item appears in the field palette

### Task 3: Build the Satisfaction Field Renderer
- In `src/components/form-builder/fields/FieldRenderer.tsx`, add a new `if (field.type === 'satisfaction')` block after the `radio` case (after line 351)
- Render a row of tappable cards, one per option in `field.options`
- Each card: emoji (large, centered) + label (small, below)
- Selected card: accent border + background tint + slight scale-up (`scale-105`)
- Use `role="radiogroup"` and `aria-checked` for accessibility
- Responsive: CSS grid with `minmax(0, 1fr)`, collapse to smaller padding on mobile
- Handle edge case: 10-level NPS scale renders horizontally scrollable on mobile
- Handle custom image URLs: if `emoji` starts with `http`, render `<img>` instead of text emoji

### Task 4: Build Satisfaction Presets
- Create `src/components/page-builder/SatisfactionPresets.ts` with the 4 presets defined in Section 6
- Export `SATISFACTION_PRESETS` constant and an `applySatisfactionPreset(preset: string)` helper
- The helper returns `PageFieldOption[]` with the correct emoji + label + value for each preset

### Task 5: Add Field Settings Configuration
- In `FieldSettings` (line 1622+), add a `satisfaction` config section after existing type-specific blocks
- Add scale preset dropdown (5-Point / NPS / Stars / Custom)
- When a preset is selected, update `field.options` with the preset's levels
- Add per-level editor: emoji input + label input for each level
- Add help text field (maps to `placeholder`)
- Ensure switching presets preserves user customizations when switching to "Custom"
- Test: change a level's emoji, switch presets, switch back to Custom — customizations are preserved

### Task 6: Test Public Form Rendering
- Create a form with a satisfaction field
- Preview the form → verify emoji scale renders correctly
- Click each level → verify selection highlights with accent color
- Verify the selected value is stored in collectedData
- Test required validation: if required, submitting without selection shows error
- Test on mobile: verify 5-level scale fits on small screens

### Task 7: Test Submission & Dashboard
- Submit a form with a satisfaction rating
- Verify the value appears in the submissions table (as "3", "5", etc.)
- Verify the value is included in CSV export
- Verify the value appears in formData JSON
- Test with NPS (0–10) preset: 11 buttons should render and values 0–10 save correctly

### Task 8: Accessibility & Polish
- Verify keyboard navigation: Tab to the satisfaction group, arrow keys navigate between options, Enter/Space selects
- Verify `role="radiogroup"` and `role="radio"` with `aria-checked` on each option
- Add focus ring styling consistent with existing field types
- Verify screen reader announces: "How satisfied are you? Radio group, 1 of 5, Very dissatisfied"
- Add transition animations on selection (the existing `transition-all` class handles this)
- Test with custom emoji images (URLs): verify `<img>` renders with `alt` text from the label

---

## 9. Risks & Open Questions

| Risk | Mitigation |
|---|---|
| **Emoji rendering differs across OS/browsers** — Native emojis render differently on iOS (Apple emoji), Android (Google emoji), Windows, and macOS | Use Unicode emoji characters. Different renderings are acceptable — the meaning is consistent. For creators who want pixel-identical rendering, support custom image URLs in the emoji field. |
| **NPS scale (11 buttons) doesn't fit on mobile** | On screens < 400px, reduce button padding to `px-2 py-3` and emoji size to `text-lg`. For extreme cases, allow horizontal scroll within the scale with `overflow-x-auto`. Add a note in the field settings that NPS is best for desktop-first surveys. |
| **PostgreSQL enum migration for `'satisfaction'`** | Postgres `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block. The `ensurePageBuilderFieldTypes()` function uses a PL/pgSQL `DO $$` block with `IF NOT EXISTS` checks, which is the correct pattern. Follow the exact same structure as `'content'`, `'media'`, etc. |
| **`FieldOption.emoji` field ignored by other renderers** | The `emoji` field is optional and only read by the satisfaction renderer. `select`, `checkbox`, and `radio` renderers ignore unknown fields on options. No breaking changes. |
| **Satisfaction value (`"3"`) is a string, not a number** | This is consistent with how `select` and `radio` store values. Computations (`computation` field type) parse the string to a number. The `references` system handles this too. |

---

## 10. Validation / Testing

- [ ] "Satisfaction" appears in the field palette with a smile icon
- [ ] Dragging satisfaction field onto a page creates it with 5 default levels (😡→😍)
- [ ] Field settings show scale preset dropdown (4 options)
- [ ] Selecting "Star Rating" preset updates options to ⭐ 1–5
- [ ] Selecting "NPS" preset updates options to 0–10 with colored indicators
- [ ] Custom emoji input accepts native emoji characters
- [ ] Custom emoji input accepts image URLs (http/https)
- [ ] Public form renders satisfaction field with 5 tappable cards
- [ ] Tapping a card selects it with accent border + background tint
- [ ] Required validation: submitting without selection shows error
- [ ] Selecting "Neutral" (3) and submitting stores value `"3"` in collectedData
- [ ] Value appears in submissions table as `"3"`
- [ ] Value appears in CSV export
- [ ] NPS scale (0–10) renders 11 buttons on desktop
- [ ] NPS scale is usable on mobile (buttons tappable)
- [ ] Keyboard navigation works: Tab → arrow keys → Enter to select
- [ ] Screen reader announces satisfaction field correctly
- [ ] Custom image emoji renders as `<img>` with `alt` text
- [ ] Deleting a form with satisfaction fields cascades correctly (no orphan data)
- [ ] Zero TypeScript errors after all changes
