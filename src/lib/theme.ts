import type { CSSProperties } from 'react'

/**
 * Per-form theming.
 *
 * A form's `theme` lets a creator match the respondent-facing form to their
 * brand. It is applied by setting CSS custom properties (`--ponko-*`) on the
 * form's root wrapper via {@link themeVars}; the themeable components read those
 * vars through arbitrary-value Tailwind classes with the current palette as the
 * fallback — so an un-themed form (and the whole builder/dashboard) look exactly
 * as before.
 */
export interface FormTheme {
  /** Brand accent — buttons, progress, selected states, focus rings, links. */
  primaryColor?: string
  /** Page/surface background. */
  backgroundColor?: string
  /** Corner roundness of inputs, buttons, and cards. */
  radius?: 'sharp' | 'rounded' | 'pill'
}

export const DEFAULT_THEME: Required<FormTheme> = {
  primaryColor: '#cc785c',
  backgroundColor: '#faf9f5',
  radius: 'rounded',
}

/** Curated accent swatches for one-click theming. */
export const ACCENT_PRESETS = [
  '#cc785c', // house terracotta
  '#2563eb', // blue
  '#0f766e', // teal
  '#7c3aed', // violet
  '#db2777', // pink
  '#ea580c', // orange
  '#16a34a', // green
  '#111827', // near-black
]

/** Light background swatches (text stays dark for readability). */
export const BG_PRESETS = ['#faf9f5', '#ffffff', '#f8fafc', '#f5f3ff', '#f0fdf4', '#fff7ed']

export const RADIUS_OPTIONS: { value: NonNullable<FormTheme['radius']>; label: string }[] = [
  { value: 'sharp', label: 'Sharp' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'pill', label: 'Pill' },
]

const RADIUS_VALUES: Record<NonNullable<FormTheme['radius']>, [control: string, card: string]> = {
  sharp: ['2px', '4px'],
  rounded: ['8px', '16px'],
  pill: ['9999px', '24px'],
}

// ── Color helpers (pure; support #rgb and #rrggbb) ──

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return null
  const n = parseInt(h, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function toHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => clampByte(v).toString(16).padStart(2, '0')).join('')
}

/** Is a string a usable hex color (#rgb or #rrggbb)? */
export function isHexColor(value: string): boolean {
  return parseHex(value) !== null
}

/** Darken a hex color toward black by `amount` (0–1). */
export function darken(hex: string, amount: number): string {
  const c = parseHex(hex)
  if (!c) return hex
  return toHex(c.r * (1 - amount), c.g * (1 - amount), c.b * (1 - amount))
}

/** Return `hex` with an alpha channel (0–1) as an 8-digit hex. */
export function withAlpha(hex: string, alpha: number): string {
  const c = parseHex(hex)
  if (!c) return hex
  const a = clampByte(alpha * 255).toString(16).padStart(2, '0')
  return toHex(c.r, c.g, c.b) + a
}

/** A card/surface shade derived from the page background. */
export function deriveSurface(bgHex: string): string {
  return darken(bgHex, 0.05)
}

/**
 * Build the inline-style CSS custom properties for a theme. Spread onto a
 * wrapper's `style`; descendants inherit the vars. Missing fields fall back to
 * the house defaults so the result always reproduces today's look when empty.
 */
export function themeVars(theme?: FormTheme | null): CSSProperties {
  const primary = theme?.primaryColor || DEFAULT_THEME.primaryColor
  const bg = theme?.backgroundColor || DEFAULT_THEME.backgroundColor
  const [control, card] = RADIUS_VALUES[theme?.radius ?? 'rounded'] ?? RADIUS_VALUES.rounded
  const style: Record<string, string> = {
    '--ponko-primary': primary,
    '--ponko-primary-active': darken(primary, 0.18),
    '--ponko-primary-soft': withAlpha(primary, 0.16),
    '--ponko-bg': bg,
    '--ponko-surface': deriveSurface(bg),
    '--ponko-radius': control,
    '--ponko-radius-card': card,
  }
  return style as CSSProperties
}
