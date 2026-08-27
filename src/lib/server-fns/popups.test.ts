import { describe, expect, it } from 'vitest'
import {
  createPopupSchema,
  elementSchema,
  popupScheduleSchema,
  popupStyleSchema,
  savePopupSchema,
  triggerSchema,
} from '../popup-builder/model'
import { createElement, sampleElements } from '../popup-builder/defaults'

const validBase = {
  id: 'element-1',
  x: 24,
  y: 32,
  width: 200,
  height: 48,
  zIndex: 1,
  opacity: 1,
  rotation: 0,
}

describe('popup trigger validation', () => {
  it('accepts every trigger shape', () => {
    expect(triggerSchema.parse({ type: 'on-load', delayMs: 0 })).toEqual({ type: 'on-load', delayMs: 0 })
    expect(triggerSchema.parse({ type: 'exit-intent' })).toEqual({ type: 'exit-intent' })
    expect(triggerSchema.parse({ type: 'scroll-depth', percent: 50 })).toEqual({ type: 'scroll-depth', percent: 50 })
    expect(triggerSchema.parse({ type: 'click-element', selector: '#open-offer' })).toEqual({
      type: 'click-element',
      selector: '#open-offer',
    })
  })

  it('rejects out-of-range and unknown triggers', () => {
    expect(triggerSchema.safeParse({ type: 'on-load', delayMs: -1 }).success).toBe(false)
    expect(triggerSchema.safeParse({ type: 'on-load', delayMs: 700_000 }).success).toBe(false)
    expect(triggerSchema.safeParse({ type: 'scroll-depth', percent: 0 }).success).toBe(false)
    expect(triggerSchema.safeParse({ type: 'scroll-depth', percent: 101 }).success).toBe(false)
    expect(triggerSchema.safeParse({ type: 'click-element', selector: '' }).success).toBe(false)
    expect(triggerSchema.safeParse({ type: 'on-hover' }).success).toBe(false)
  })
})

describe('popup element validation', () => {
  it('accepts every element produced by the builder factories', () => {
    for (const type of ['heading', 'text', 'image', 'button', 'divider', 'html'] as const) {
      const element = createElement(type, 1)
      expect(elementSchema.safeParse(element).success).toBe(true)
    }
  })

  it('accepts the seeded sample layout', () => {
    for (const element of sampleElements()) {
      expect(elementSchema.safeParse(element).success).toBe(true)
    }
  })

  it('accepts rich button appearance controls and bounds them', () => {
    const button = createElement('button', 1)
    expect(elementSchema.safeParse({
      ...button,
      borderColor: '#141413',
      borderWidth: 2,
      textAlign: 'left',
      verticalAlign: 'middle',
      fontStyle: 'italic',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      paddingX: 24,
      paddingY: 12,
      shadow: 'strong',
      hoverEffect: 'glow',
      hoverBgColor: '#222222',
      hoverTextColor: '#ffffff',
      icon: 'sparkles',
      iconPosition: 'left',
    }).success).toBe(true)
    expect(elementSchema.safeParse({ ...button, borderWidth: 20 }).success).toBe(false)
    expect(elementSchema.safeParse({ ...button, hoverEffect: 'bounce' }).success).toBe(false)
  })

  it('accepts images pinned to either canvas axis', () => {
    const image = createElement('image', 1)
    expect(elementSchema.safeParse({
      ...image,
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
      widthMode: 'canvas',
      heightMode: 'canvas',
    }).success).toBe(true)
    expect(elementSchema.safeParse({ ...image, widthMode: 'viewport' }).success).toBe(false)
  })

  it('rejects unknown element types and degenerate geometry', () => {
    expect(elementSchema.safeParse({ ...validBase, type: 'video' }).success).toBe(false)
    expect(elementSchema.safeParse({
      ...validBase,
      type: 'button',
      label: 'Go',
      bgColor: '#cc785c',
      textColor: '#ffffff',
      radius: 8,
      link: '',
      openInNewTab: false,
      fontWeight: 'medium',
      fontSize: 15,
      width: 0,
    }).success).toBe(false)
    expect(elementSchema.safeParse({
      ...validBase,
      type: 'button',
      label: 'Go',
      bgColor: '#cc785c',
      textColor: '#ffffff',
      radius: 8,
      link: 'javascript:alert(1)',
      openInNewTab: false,
      fontWeight: 'medium',
      fontSize: 15,
      opacity: 2,
    }).success).toBe(false)
  })
})

describe('popup style + save validation', () => {
  it('bounds overlay opacity and radius', () => {
    expect(popupStyleSchema.safeParse({ overlayOpacity: 0.9 }).success).toBe(true)
    expect(popupStyleSchema.safeParse({ overlayOpacity: 1 }).success).toBe(false)
    expect(popupStyleSchema.safeParse({ borderRadius: 64 }).success).toBe(true)
    expect(popupStyleSchema.safeParse({ borderRadius: 65 }).success).toBe(false)
  })

  it('accepts bounded canvas background artwork controls', () => {
    expect(popupStyleSchema.safeParse({
      backgroundImage: 'https://images.example.com/launch.jpg',
      backgroundImageSize: 'cover',
      backgroundImagePosition: 'top',
      backgroundImageOverlayColor: '#141413',
      backgroundImageOverlayOpacity: 0.35,
    }).success).toBe(true)
    expect(popupStyleSchema.safeParse({ backgroundImageSize: 'stretch' }).success).toBe(false)
    expect(popupStyleSchema.safeParse({ backgroundImageOverlayOpacity: 1 }).success).toBe(false)
  })

  it('saves a full popup config built from the seed layout', () => {
    const input = {
      id: 7,
      title: 'Newsletter popup',
      width: 420,
      height: 380,
      placement: 'center',
      trigger: { type: 'exit-intent' },
      frequency: 'once-per-day',
      schedule: {},
      style: { backgroundColor: '#ffffff', animation: 'zoom' },
      elements: sampleElements(),
    }
    expect(savePopupSchema.safeParse(input).success).toBe(true)
    expect(savePopupSchema.parse({ ...input, schedule: undefined }).schedule).toEqual({})

    expect(savePopupSchema.safeParse({ ...input, width: 100 }).success).toBe(false)
    expect(savePopupSchema.safeParse({ ...input, height: 9_999 }).success).toBe(false)
    expect(savePopupSchema.safeParse({ ...input, placement: 'middle' }).success).toBe(false)
    expect(savePopupSchema.safeParse({ ...input, frequency: 'once-per-month' }).success).toBe(false)
    expect(savePopupSchema.safeParse({ ...input, title: '   ' }).success).toBe(false)
  })

  it('validates campaign dates and complete daily time windows', () => {
    expect(popupScheduleSchema.safeParse({
      startAt: '2026-08-18T01:00:00.000Z',
      endAt: '2026-08-19T01:00:00.000Z',
      dailyStart: '09:00',
      dailyEnd: '17:00',
    }).success).toBe(true)
    expect(popupScheduleSchema.safeParse({
      startAt: '2026-08-19T01:00:00.000Z',
      endAt: '2026-08-18T01:00:00.000Z',
    }).success).toBe(false)
    expect(popupScheduleSchema.safeParse({ dailyStart: '09:00' }).success).toBe(false)
    expect(popupScheduleSchema.safeParse({ dailyStart: '25:00', dailyEnd: '17:00' }).success).toBe(false)
  })

  it('requires a non-empty title on create', () => {
    expect(createPopupSchema.safeParse({ title: 'Lead popup' }).success).toBe(true)
    expect(createPopupSchema.safeParse({ title: '' }).success).toBe(false)
  })
})
