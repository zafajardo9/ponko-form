import type {
  ButtonElement,
  DividerElement,
  HeadingElement,
  HtmlElement,
  ImageElement,
  PopupElement,
  PopupElementType,
  PopupStyle,
  PopupTextAlign,
  PopupTriggerConfig,
  TextElement,
} from './types'

/**
 * Seed content and factories for the popup builder. New popups start from the
 * sample layout below; palette drops use the per-type factories so every
 * element enters the canvas with sane, visible defaults.
 */

export const DEFAULT_POPUP_WIDTH = 420
export const DEFAULT_POPUP_HEIGHT = 380

export const POPUP_MIN_WIDTH = 280
export const POPUP_MAX_WIDTH = 1200
export const POPUP_MIN_HEIGHT = 200
export const POPUP_MAX_HEIGHT = 1600

export function defaultTrigger(): PopupTriggerConfig {
  return { type: 'on-load', delayMs: 0 }
}

export function defaultStyle(): PopupStyle {
  return {
    fontFamily: 'sans',
    backgroundColor: '#ffffff',
    overlayColor: '#141413',
    overlayOpacity: 0.5,
    animation: 'fade',
    closable: true,
    closeOnOverlayClick: true,
    borderRadius: 16,
  }
}

function elementId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `el-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

const DEFAULT_ALIGN: PopupTextAlign = 'left'

/** Factory per element type — used by palette drops and duplicate. */
export function createElement(type: PopupElementType, zIndex: number): PopupElement {
  const base = { id: elementId(), zIndex, opacity: 1, rotation: 0 }

  switch (type) {
    case 'heading':
      return {
        ...base,
        type: 'heading',
        x: 24,
        y: 24,
        width: 300,
        height: 48,
        level: 2,
        text: 'Add a headline',
        color: '#141413',
        fontSize: 28,
        fontWeight: 'semibold',
        align: DEFAULT_ALIGN,
        autoHeight: true,
        verticalAlign: 'top',
      } satisfies HeadingElement
    case 'text':
      return {
        ...base,
        type: 'text',
        x: 24,
        y: 88,
        width: 300,
        height: 80,
        text: 'Write a short supporting line that tells visitors what to do.',
        color: '#3d3d3a',
        fontSize: 15,
        lineHeight: 1.5,
        align: DEFAULT_ALIGN,
        autoHeight: true,
        verticalAlign: 'top',
      } satisfies TextElement
    case 'image':
      return {
        ...base,
        type: 'image',
        x: 24,
        y: 24,
        width: 200,
        height: 120,
        src: '',
        alt: '',
        fit: 'cover',
        radius: 8,
      } satisfies ImageElement
    case 'button':
      return {
        ...base,
        type: 'button',
        x: 24,
        y: 250,
        width: 220,
        height: 48,
        label: 'Click me',
        bgColor: '#cc785c',
        textColor: '#ffffff',
        radius: 10,
        link: '',
        openInNewTab: false,
        fontWeight: 'medium',
        fontSize: 15,
        borderColor: '#a9583e',
        borderWidth: 0,
        textAlign: 'center',
        verticalAlign: 'middle',
        fontStyle: 'normal',
        letterSpacing: 0,
        textTransform: 'none',
        paddingX: 20,
        paddingY: 10,
        shadow: 'soft',
        hoverEffect: 'lift',
        hoverBgColor: '#a9583e',
        hoverTextColor: '#ffffff',
        icon: 'arrow-right',
        iconPosition: 'right',
      } satisfies ButtonElement
    case 'divider':
      return {
        ...base,
        type: 'divider',
        x: 24,
        y: 200,
        width: 300,
        height: 8,
        color: '#e6dfd8',
        thickness: 1,
        lineStyle: 'solid',
      } satisfies DividerElement
    case 'html':
      return {
        ...base,
        type: 'html',
        x: 24,
        y: 24,
        width: 300,
        height: 120,
        html: '<p style="margin:0;font-family:inherit">Paste any markup here.</p>',
      } satisfies HtmlElement
  }
}

export function duplicateElement(element: PopupElement): PopupElement {
  return {
    ...element,
    id: elementId(),
    // Nudge the copy so it lands visibly beside the original, clamped later
    // by the canvas when the drop is applied.
    x: element.x + 16,
    y: element.y + 16,
  }
}

/**
 * The starter layout — a "join our newsletter" lead popup with a button that
 * the creator wires to an existing form link.
 */
export function sampleElements(): PopupElement[] {
  return [
    {
      id: elementId(),
      type: 'heading',
      x: 32,
      y: 44,
      width: 356,
      height: 62,
      zIndex: 1,
      opacity: 1,
      rotation: 0,
      level: 2,
      text: 'Get 10% off your first order',
      color: '#141413',
      fontSize: 30,
      fontWeight: 'semibold',
      align: 'center',
      autoHeight: true,
      verticalAlign: 'top',
    },
    {
      id: elementId(),
      type: 'text',
      x: 40,
      y: 124,
      width: 340,
      height: 76,
      zIndex: 2,
      opacity: 1,
      rotation: 0,
      text: 'Join the newsletter and we\u2019ll send you a code. One email a week, no noise.',
      color: '#3d3d3a',
      fontSize: 15,
      lineHeight: 1.55,
      align: 'center',
      autoHeight: true,
      verticalAlign: 'top',
    },
    {
      id: elementId(),
      type: 'button',
      x: 110,
      y: 232,
      width: 200,
      height: 48,
      zIndex: 3,
      opacity: 1,
      rotation: 0,
      label: 'Join the newsletter',
      bgColor: '#cc785c',
      textColor: '#ffffff',
      radius: 10,
      link: '',
      openInNewTab: false,
      fontWeight: 'medium',
      fontSize: 15,
      borderColor: '#a9583e',
      borderWidth: 0,
      textAlign: 'center',
      verticalAlign: 'middle',
      fontStyle: 'normal',
      letterSpacing: 0,
      textTransform: 'none',
      paddingX: 20,
      paddingY: 10,
      shadow: 'soft',
      hoverEffect: 'lift',
      hoverBgColor: '#a9583e',
      hoverTextColor: '#ffffff',
      icon: 'arrow-right',
      iconPosition: 'right',
    },
  ]
}
