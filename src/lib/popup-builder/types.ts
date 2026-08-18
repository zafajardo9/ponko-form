/**
 * Popup builder content model (FT-026).
 *
 * A popup is a free-position design canvas of `width × height` px. Every
 * element carries its own rect (x/y/width/height from the top-left), so the
 * same model drives the builder canvas and the public runtime verbatim
 * (WYSIWYG). The union is discriminated on `type`; new element types are
 * purely additive.
 */

/** Position/size on the design canvas (px, top-left origin). */
export interface PopupRect {
  x: number
  y: number
  width: number
  height: number
}

export type PopupElementType = 'heading' | 'text' | 'image' | 'button' | 'divider' | 'html'

export type PopupFontWeight = 'normal' | 'medium' | 'semibold' | 'bold'

export type PopupTextAlign = 'left' | 'center' | 'right'

export type PopupVerticalAlign = 'top' | 'middle' | 'bottom'

export type PopupButtonIcon = 'none' | 'arrow-right' | 'external-link' | 'mail' | 'sparkles'

interface PopupElementBase extends PopupRect {
  /** Stable client-generated id (crypto.randomUUID()). */
  id: string
  type: PopupElementType
  zIndex: number
  /** 0–1. */
  opacity: number
  /** Degrees — cheap Canva flair. */
  rotation: number
}

export interface HeadingElement extends PopupElementBase {
  type: 'heading'
  level: 1 | 2 | 3
  text: string
  color: string
  fontSize: number
  fontWeight: PopupFontWeight
  align: PopupTextAlign
  /** Defaults to true for legacy elements; the builder measures wrapped copy. */
  autoHeight?: boolean
  /** Alignment inside a fixed-height heading box. Defaults to top. */
  verticalAlign?: PopupVerticalAlign
}

export interface TextElement extends PopupElementBase {
  type: 'text'
  text: string
  color: string
  fontSize: number
  lineHeight: number
  align: PopupTextAlign
  /** Defaults to true for legacy elements; the builder measures wrapped copy. */
  autoHeight?: boolean
  /** Alignment inside a fixed-height text box. Defaults to top. */
  verticalAlign?: PopupVerticalAlign
}

export interface ImageElement extends PopupElementBase {
  type: 'image'
  src: string
  alt: string
  fit: 'cover' | 'contain'
  /** px. */
  radius: number
}

export interface ButtonElement extends PopupElementBase {
  type: 'button'
  label: string
  bgColor: string
  textColor: string
  /** px. */
  radius: number
  /** Manual lead connection — paste any URL (e.g. an existing form link). */
  link: string
  openInNewTab: boolean
  fontWeight: PopupFontWeight
  fontSize: number
  /** Optional appearance controls defaulted by the runtime for legacy buttons. */
  borderColor?: string
  borderWidth?: number
  textAlign?: PopupTextAlign
  verticalAlign?: PopupVerticalAlign
  fontStyle?: 'normal' | 'italic'
  letterSpacing?: number
  textTransform?: 'none' | 'uppercase'
  paddingX?: number
  paddingY?: number
  shadow?: 'none' | 'soft' | 'strong'
  hoverEffect?: 'none' | 'lift' | 'glow'
  hoverBgColor?: string
  hoverTextColor?: string
  icon?: PopupButtonIcon
  iconPosition?: 'left' | 'right'
}

export interface DividerElement extends PopupElementBase {
  type: 'divider'
  color: string
  /** px. */
  thickness: number
  lineStyle: 'solid' | 'dashed' | 'dotted'
}

export interface HtmlElement extends PopupElementBase {
  type: 'html'
  /** Raw markup; <iframe> allowed — the manual-connect escape hatch. */
  html: string
}

export type PopupElement =
  | HeadingElement
  | TextElement
  | ImageElement
  | ButtonElement
  | DividerElement
  | HtmlElement

// ── Behavior & look ──

export type PopupTriggerConfig =
  | { type: 'on-load'; delayMs: number }
  | { type: 'exit-intent' }
  | { type: 'scroll-depth'; percent: number }
  | { type: 'click-element'; selector: string }

export type PopupPlacement =
  | 'center'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'fullscreen'

export type PopupFrequency = 'every-visit' | 'once-per-session' | 'once-per-day' | 'once-per-week'

export interface PopupSchedule {
  /** Absolute campaign bounds, stored as ISO-8601 UTC timestamps. */
  startAt?: string
  endAt?: string
  /** Optional recurring window interpreted in each visitor's local time. */
  dailyStart?: string
  dailyEnd?: string
}

export interface PopupStyle {
  fontFamily?: 'sans' | 'serif' | 'mono'
  backgroundColor?: string
  overlayColor?: string
  /** 0–0.9. */
  overlayOpacity?: number
  animation?: 'fade' | 'zoom' | 'slide-up' | 'none'
  closable?: boolean
  closeOnOverlayClick?: boolean
  /** px. */
  borderRadius?: number
}

/** Design-canvas bounds as persisted on the popup row. */
export interface PopupCanvasSize {
  width: number
  height: number
}
