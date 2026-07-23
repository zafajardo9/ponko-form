# FT-016: Modern Star SVG Icon — Design System Asset for Ratings & Highlights

> **Feature Plan** — Create a polished, design-system-aligned SVG star icon at `src/lib/icons/star.svg` that can be imported as a React component or used as an asset URL throughout the codebase. This replaces the current Unicode `★` character used in the satisfaction field's "stars" preset and serves as a general-purpose rating/accent icon anywhere a star is needed.

**Status:** 🚧 **Planned** — not yet implemented

**Dependencies:**
- ✅ **FT-014 (Satisfaction Rating Field)** — The satisfaction field in `FieldRenderer.tsx` (lines 360-394) currently renders U[<h1 data-tsd-source="/src/components..." class="mt-7 max-w-xl f...">Build forms that keep every response—and payment—connected.</h1> in HeroSection (at /src/components/homepage/HomePage.tsx) in HomePage (at /src/components/homepage/HomePage.tsx) in Lazy in MatchInnerImpl (@tanstack/react-router) in SafeFragment (@tanstack/react-router) in MatchView (@tanstack/react-router) in MatchImpl (@tanstack/react-router) in OutletImpl (@tanstack/react-router) in MatchInnerImpl (@tanstack/react-router) in SafeFragment (@tanstack/react-router) in @clerk/shared in ClerkProviderBase (@clerk/react) in Hoc (@clerk/react) in @clerk/tanstack-react-start in /src/integrations/clerk/provider.tsx]nicode `★` characters with a hardcoded `text-[#d59b25]` gold color for the "stars" preset. This is the primary consumer of the new SVG star — it replaces the plain-text emoji with a proper vector graphic that matches the design system.
- ✅ **Existing icon infrastructure** — `lucide-react` is the primary icon library used across the app (imported in 20+ component files). The new star SVG follows a similar consumable pattern but as a standalone custom asset since Lucide's `Star` icon may not match the desired modern aesthetic.
- ⬜ **FT-005 (Precreated Field Groups)** — If any field group template uses star/rating markers, it would benefit from this SVG asset.
- ⬜ **FT-006 (Table View / Submissions)** — Submissions table could display satisfaction scores with the star SVG for visual indicators.

---

## 1. User Story & Problem

### 1.1 Current State

The satisfaction field type (FT-014, implemented) offers three rating presets: `five-point` (emoji faces), `stars` (Unicode star characters), and `nps` (numeric scale). The "stars" preset uses plain Unicode characters:

```typescript
// src/lib/page-builder/satisfaction.ts, lines 13-18
stars: [
  { label: '1 star',  value: '1', emoji: '★' },
  { label: '2 stars', value: '2', emoji: '★★' },
  { label: '3 stars', value: '3', emoji: '★★★' },
  { label: '4 stars', value: '4', emoji: '★★★★' },
  { label: '5 stars', value: '5', emoji: '★★★★★' },
],
```

These are rendered via `FieldRenderer.tsx` (lines 388-393) as raw text:

```tsx
<span aria-hidden="true" className="whitespace-nowrap text-xl leading-none text-[#d59b25] sm:text-2xl">
  {visual}
</span>
```

**Problems with the current Unicode approach:**
1. The `#d59b25` gold color is hardcoded and doesn't adapt to the form's theme (coral `#cc785c`)
2. Unicode stars (`★`) have inconsistent rendering across operating systems and fonts (macOS renders them differently from Windows/Linux)
3. The Unicode character can't be animated, gradient-filled, or scaled with consistent quality
4. No hover/press interactive states beyond opacity
5. The star shape isn't customizable — there's only one "look"

### 1.2 What the User Wants

> *"I want you to create a STAR ICON SVG file that is very modern updated and very close to the design of the system. I want it to be put in `src/lib/icons/star.svg` that we can use in the codebase easily like calling it like a component."*

### 1.3 Usage Scenarios

| Scenario | How the star SVG is used |
|---|---|
| **Satisfaction rating — "stars" preset** | Replaces the Unicode `★` in the 1–5 star rating options. The SVG can use `currentColor` so it inherits the form's accent color (coral `#cc785c` by default, or the form's custom `primaryColor`) |
| **Dashboard — highlighted forms** | A "featured" or "popular" badge next to a form card in the dashboard |
| **Template cards** | Templates with high usage could show star ratings |
| **Flow builder — calculator/expression hints** | As a visual indicator for "recommended" or "favorite" expressions |
| **Public form — rating display** | When showing submitted ratings in read-only view |

---

## 2. Technical Design — SVG Asset Architecture

### 2.1 File Location & Structure

```
src/lib/icons/star.svg
```

The `src/lib/icon/` directory already exists but is empty. The user specifically requested `src/lib/icons/` (plural), so we create that directory with one file:

```
src/lib/
├── icon/          # existing (empty)
└── icons/         # NEW — custom SVG icon library
    └── star.svg   # the star SVG
```

### 2.2 SVG Design Decisions

The SVG is a **standalone, self-contained vector graphic** designed to match PonkoForm's warm, craft-oriented aesthetic:

| Design Property | Value | Rationale |
|---|---|---|
| **ViewBox** | `0 0 24 24` | Matches Lucide's standard sizing — keeps the star consistent with all other icons in the app when used at `size={16}`, `size={20}`, `className="h-5 w-5"`, etc. |
| **Shape** | 5-point star with rounded inner corners | Modern, friendly, not sharp/aggressive. The rounded inner vertices echo the border-radius philosophy in `DESIGN.md` |
| **Fill** | `currentColor` | Inherits text color from parent, making it theme-aware. When used inside a themed form, the coral accent (`--ponko-primary`) flows through automatically |
| **Stroke** | None or 0.5px `currentColor` for subtle outline | Optional — depends on whether outline or filled stars look better in the app context |
| **Gradient (optional)** | Linear gradient from coral `#cc785c` to amber `#e8a55a` | Uses PonkoForm's signature warm palette. If using gradient, the SVG defines its own `<linearGradient>` with a unique ID |
| **Size hint** | `width="24" height="24"` on root element | Explicit sizing prevents layout shift during load |

### 2.3 SVGs for Each Use Case (1-star through 5-star variants)

The satisfaction field currently shows concatenated Unicode stars (`★`, `★★`, `★★★`, etc.). For the SVG upgrade:

**Option A (recommended):** A single `star.svg` with `fill="currentColor"` that can be repeated N times in JSX:

```tsx
// Usage in satisfaction field
{[...Array(rating)].map((_, i) => (
  <StarIcon key={i} className="h-6 w-6 text-[var(--ponko-primary,#cc785c)]" />
))}
```

**Option B:** Five separate SVGs (`star-1.svg` through `star-5.svg`) with pre-grouped stars — simpler to use as `emoji` replacements in the `SATISFACTION_PRESETS` config but less flexible.

**Decision: Option A** — one SVG, repeated by count. This is more maintainable, theme-aware, and aligns with how Lucide icons work across the codebase.

### 2.4 SVG Source Sketch

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
     fill="currentColor" stroke="none" stroke-linecap="round" stroke-linejoin="round">
  <!-- 5-point star path with softened inner vertices -->
  <path d="M12 2
           L14.5 8.5 L21 9
           L16 13.5 L17.5 20.5
           L12 17 L6.5 20.5
           L8 13.5 L3 9
           L9.5 8.5
           Z" />
</svg>
```

**Refined path** (with inner corner rounding for a softer, more modern look):

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
     fill="currentColor" class="ponko-star-icon">
  <path d="M12 2.5l2.3 5.9c.08.2.26.34.47.37l6.1.5-4.6 3.9c-.16.13-.22.35-.16.55l1.4 6-5.3-3.3c-.18-.12-.42-.12-.6 0l-5.3 3.3 1.4-6c.06-.2 0-.42-.16-.55L2.5 9.27l6.1-.5c.21-.03.39-.17.47-.37L12 2.5z"
        stroke="currentColor" stroke-width="0.3"/>
</svg>
```

### 2.5 Import & Component Pattern

Vite supports importing SVGs as React components via the `@vitejs/plugin-react` (already in `vite.config.ts`). The recommended pattern is:

```tsx
// Option 1: Import as asset URL (for <img> tags)
import starUrl from '#/lib/icons/star.svg'
// <img src={starUrl} alt="" className="h-6 w-6" />

// Option 2: Import as React component (requires ?react suffix or vite-plugin-svgr)
// This is the cleaner pattern matching the user's request to "call it like a component"
import StarIcon from '#/lib/icons/star.svg?react'
// <StarIcon className="h-6 w-6 text-[var(--ponko-primary,#cc785c)]" />
```

Since the project doesn't currently use `vite-plugin-svgr`, the simpler approach is **import as asset URL** for the initial implementation, paired with a small React wrapper component:

```tsx
// src/components/ui/StarIcon.tsx  — NEW thin wrapper component
import starSvg from '#/lib/icons/star.svg'

interface StarIconProps {
  className?: string
  size?: number
  filled?: boolean
}

export function StarIcon({ className, size = 24, filled = true }: StarIconProps) {
  return (
    <img
      src={starSvg}
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ opacity: filled ? 1 : 0.3 }}
      aria-hidden="true"
    />
  )
}
```

This gives the user exactly what they asked for: a star that can be "called like a component."

---

## 3. UI Integration Points

### 3.1 Primary: Satisfaction Field "Stars" Preset

**File:** `src/components/form-builder/fields/FieldRenderer.tsx` (lines 360-394)
**File:** `src/lib/page-builder/satisfaction.ts` (lines 13-18)

The `FieldRenderer` satisfaction render loop passes `opt.emoji` as a visual string. Currently, `isImageUrl()` (line 81) only matches `http`/`https` URLs, so an SVG import path wouldn't be caught. Two approaches:

**Approach A — Extend `isImageUrl` + store SVG as emoji value:**
Update `isImageUrl` to also match local SVG imports, then store a reference value in the `emoji` field. This lets the satisfaction preset data stay declarative.

**Approach B — Special-case satisfaction rendering:**
In the `FieldRenderer`, when `field.type === 'satisfaction'` and the preset is `'stars'`, render `<StarIcon />` N times instead of the visual string. This is cleaner because it doesn't mix SVG URLs with emoji text.

**Decision: Approach B** — Special-case the stars preset to use `<StarIcon />` directly. The `five-point` emoji preset continues to use emoji strings, and the `nps` preset continues to use numbers. Only the `stars` preset gets the SVG treatment.

Updated `FieldRenderer` satisfaction block (lines 366-393 to be modified):

```tsx
{options.map((opt) => {
  const selected = strValue === opt.value
  const ratingValue = Number(opt.value)

  return (
    <label
      key={opt.value}
      title={opt.label}
      className={`group flex min-h-11 min-w-0 cursor-pointer items-center justify-center rounded-full p-1 text-center transition-all focus-within:ring-2 focus-within:ring-[var(--ponko-primary-soft,#cc785c29)] sm:min-h-14 sm:p-2 ${
        selected
          ? 'scale-110 opacity-100 drop-shadow-sm'
          : 'opacity-65 hover:scale-105 hover:opacity-100'
      } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <input
        type="radio"
        name={`field-${field.id}`}
        value={opt.value}
        checked={selected}
        disabled={readOnly}
        onChange={() => onChange(opt.value)}
        className="peer sr-only"
      />
      {satisfactionPreset === 'stars' ? (
        <span aria-hidden="true" className="flex gap-1">
          {[...Array(ratingValue)].map((_, i) => (
            <StarIcon
              key={i}
              size={20}
              className="text-[var(--ponko-primary,#cc785c)] sm:size-6"
              filled={i < ratingValue}
            />
          ))}
        </span>
      ) : isImageUrl(visual) ? (
        <img src={visual} alt="" className="h-7 w-7 object-contain sm:h-9 sm:w-9" />
      ) : (
        <span aria-hidden="true" className="whitespace-nowrap text-xl leading-none sm:text-2xl" style={{ color: 'var(--ponko-primary, #d59b25)' }}>
          {visual}
        </span>
      )}
      <span className="sr-only">{opt.label}</span>
    </label>
  )
})}
```

### 3.2 Secondary: Template Cards

**File:** `src/components/forms/TemplateCard.tsx`

Template cards show name, description, and usage count. If a template has high usage, a small star icon could appear as a "popular" indicator:

```tsx
{template.usageCount > 50 && (
  <span className="flex items-center gap-1 text-xs text-[#cc785c]">
    <StarIcon size={12} className="text-[#cc785c]" />
    Popular
  </span>
)}
```

### 3.3 Tertiary: Dashboard Form Cards

**File:** `src/components/dashboard/FormCard.tsx`

Forms with high submission counts could optionally show a star badge (future enhancement, not for initial implementation).

---

## 4. Design System Alignment

### 4.1 Color Strategy

The star SVG uses `currentColor` so it inherits color from its parent context:

| Context | Color Source | Result |
|---|---|---|
| **Satisfaction field (default)** | `text-[var(--ponko-primary,#cc785c)]` | Coral `#cc785c` — matches the house accent |
| **Satisfaction field (themed form)** | `text-[var(--ponko-primary)]` | The form creator's chosen accent color — brand-matching |
| **Selected state** | Inherited + `.selected` scale | Full opacity, slightly scaled up |
| **Unselected state** | Inherited + `opacity-65` | Muted, same color |
| **Amber accent usage** | `text-[#e8a55a]` | Warm gold for special highlights |
| **Dark surfaces** | `text-[#faf9f5]` | Cream-white on `bg-[#181715]` |

### 4.2 Sizing Scale

The SVG at `viewBox="0 0 24 24"` works naturally with Tailwind sizing:

| Tailwind Class | Rendered Size | Use Case |
|---|---|---|
| `h-4 w-4` | 16px | Inline with text, badges |
| `h-5 w-5` | 20px | Button icons, list items |
| `h-6 w-6` | 24px | Default icon size (matches Lucide) |
| `h-8 w-8` | 32px | Hero/featured elements |
| `sm:h-6` → `sm:h-8` | Responsive | Satisfaction field (larger on mobile) |

### 4.3 Border Radius Philosophy

The star's inner vertices should have a slight rounding to match the design system's corner philosophy:

- `DESIGN.md` corner scale: **Sharp** (2px), **Rounded** (8px), **Pill** (9999px)
- For the star SVG, inner corners should feel **Rounded** — not mathematically sharp, but not pill-soft either. This means the SVG path should use subtle curve commands (`Q` or `C`) at inner vertices rather than sharp `L` commands.

---

## 5. How It Connects to Other Systems

### 5.1 Satisfaction Field — `FieldRenderer.tsx` Injection

**Existing code** (`src/components/form-builder/fields/FieldRenderer.tsx`, lines 360-393):
- Renders satisfaction options as radio-button labels
- Uses `opt.emoji` as the visual string
- Falls back to `opt.value` if no emoji
- Detects image URLs via `isImageUrl()` (line 81) and renders `<img>` for them

**Injection point:** After line 360 (`{field.type === 'satisfaction' && (`), before the options `.map()` — determine if the satisfaction preset is `'stars'` and pass that flag into the rendering logic. The `<StarIcon />` component replaces the emoji-based visual for the stars preset only.

### 5.2 Utility — `satisfaction.ts`

**Existing code** (`src/lib/page-builder/satisfaction.ts`, lines 13-18):
- The `stars` preset still uses `emoji: '★★★'` strings
- These can remain as-is for backward compatibility — the rendering layer (FieldRenderer) decides whether to use SVG stars or fall back to emoji text

### 5.3 Theme — `theme.ts`

**Existing code** (`src/lib/theme.ts`):
- CSS custom properties (`--ponko-primary`, `--ponko-primary-active`) are set by `themeVars()`
- The star SVG component should use `var(--ponko-primary, #cc785c)` as its default color — ensuring themed forms get the creator's chosen accent

---

## 6. File Change Summary

| File | Purpose |
|---|---|
| `src/lib/icons/` (new directory) | Container for custom SVG icon assets |
| `src/lib/icons/star.svg` (new) | The 5-point modern star SVG — single source of truth |
| `src/components/ui/StarIcon.tsx` (new) | Thin React wrapper component for importing and rendering the star SVG — the "call it like a component" interface |
| `src/components/form-builder/fields/FieldRenderer.tsx` (modify, lines 360-394) | Inject SVG star rendering for the satisfaction `stars` preset; also update the hardcoded `text-[#d59b25]` to use `var(--ponko-primary, #cc785c)` for all satisfaction visuals |
| `src/lib/page-builder/satisfaction.ts` (optional modify) | Optionally update `emoji` values to reference SVG paths instead of Unicode — optional, can skip since FieldRenderer handles it |

---

## 7. Step-by-Step Tasks

### Task 1: Create the star SVG asset
- Create directory `src/lib/icons/`
- Design and write `src/lib/icons/star.svg`:
  - 24×24 viewBox (matching Lucide standard)
  - 5-point star path with slightly rounded inner vertices
  - Uses `fill="currentColor"` for theme inheritance
  - Optional subtle stroke for definition at small sizes
  - Test visually against the design system palette (coral `#cc785c`, amber `#e8a55a`, ink `#141413`, cream `#faf9f5`)
- Test the SVG renders correctly in a browser at 16px, 24px, and 32px

### Task 2: Create the StarIcon React wrapper component
- Create `src/components/ui/StarIcon.tsx`
- Import the SVG: `import starSvg from '#/lib/icons/star.svg'`
- Render as `<img src={starSvg}>` with configurable `size`, `className`, and `filled` props
- Export as named export
- The component should pass through any additional HTML attributes via `...rest`

### Task 3: Integrate into the satisfaction field renderer
- In `src/components/form-builder/fields/FieldRenderer.tsx`:
  - Import `StarIcon` and satisfaction preset detection
  - Determine the preset (stars vs. five-point vs. nps) from the field options
  - For the `stars` preset: render N `<StarIcon />` components instead of the emoji visual
  - For other presets: keep existing emoji/number rendering
  - Replace hardcoded `text-[#d59b25]` gold with `var(--ponko-primary, #cc785c)` on all satisfaction visuals
- Update `FieldRenderer.test.tsx` to cover the new star rendering path

### Task 4: Update satisfaction preset data (optional — backward compatible)
- In `src/lib/page-builder/satisfaction.ts`, lines 13-18:
  - Optionally replace `emoji: '★'` with `emoji: 'star-svg'` or similar marker
  - This is optional since Task 3 handles it at the render layer
  - Keep the current data if Task 3 uses preset inference (checking option labels vs. known presets)

### Task 5: Visual QA across contexts
- Test the star in a satisfaction field on a published form (both default and themed)
- Test at all rating levels (1–5 stars)
- Test selected vs. unselected states
- Test hover states
- Test on mobile (touch targets, sizing)
- Test with dark form themes (e.g., dark background with light accent)
- Test in the satisfaction field on a read-only form (submission view)

### Task 6: Documentation
- Add a brief usage note in `src/lib/icons/` explaining the star SVG's design intent
- Document the `StarIcon` component props inline
- Update the star preset comment in `satisfaction.ts` to note that SVG stars are rendered by the FieldRenderer

---

## 8. Risks & Open Questions

| Risk / Question | Mitigation / Answer |
|---|---|
| **SVG rendering at very small sizes (12–14px)** | The 24×24 viewBox scales down cleanly to 16px (the smallest expected size). If 12px is needed, add a simplified path with fewer points or a bolder stroke. The satisfaction field uses 20px minimum, so this is not a concern for the primary use case. |
| **`currentColor` doesn't inherit through nested wrappers** | The `<img>` approach doesn't support `currentColor` — only inline `<svg>` does. If exact color inheritance is needed, the `StarIcon` wrapper should use `filter` or inline `style` to apply colors. Alternatively, accept `color` as a prop and apply it as a CSS filter. For the initial implementation, use explicit Tailwind `text-*` classes on the wrapper. |
| **Vite SVG import may require plugin configuration** | The current `vite.config.ts` doesn't have explicit SVG-as-component handling. Using `import starSvg from '...'` works as an asset URL (the default Vite behavior for `.svg` files). The `<img src={...}>` approach needs no additional config. If you want `import StarIcon from './star.svg?react'` (inline `<svg>`), add `vite-plugin-svgr` — not needed for initial implementation. |
| **The satisfaction field already works with emoji — why change it?** | The user explicitly requested a modern SVG star. The emoji approach stays as a fallback for all presets except `stars`, where the SVG provides better visual quality, theme support, and cross-platform consistency. |
| **Should the star have a filled + outline variant?** | The initial SVG should be filled-only. An outline variant can be added later as `star-outline.svg` if needed (e.g., for "favorite" toggles where you toggle between filled/outline stars). The `<StarIcon filled={false}>` prop can switch between the two SVGs. |

---

## 9. Validation / Testing

- [ ] **Visual check**: Star SVG renders at 24px, 20px, 16px without pixelation or clipping
- [ ] **Color test**: Star inherits `text-[#cc785c]`, `text-[#e8a55a]`, `text-[#141413]`, `text-[#faf9f5]` correctly
- [ ] **Theme test**: Star renders with `var(--ponko-primary, #cc785c)` on themed forms
- [ ] **Satisfaction field test**: Stars preset shows 1–5 SVG stars in the form builder FieldRenderer
- [ ] **Satisfaction field test — public form**: Stars preset works correctly in the respondent-facing `PublicFormView`
- [ ] **Interaction test**: Star options in satisfaction field respond to hover (scale), click (select), and keyboard (focus ring)
- [ ] **Mobile test**: Satisfaction field with star preset works on touch devices (min 44px touch target area)
- [ ] **Accessibility**: Star labels have proper `aria-hidden` on visuals and `sr-only` text on labels
- [ ] **Backward compatibility**: Existing forms using the `stars` satisfaction preset continue to render correctly (emoji fallback or SVG upgrade)
- [ ] **StarIcon component**: Can be imported and used as `<StarIcon size={20} className="text-[#cc785c]" />` anywhere in the codebase
