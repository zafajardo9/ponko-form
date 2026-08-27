import { describe, expect, it } from 'vitest'
import {
  MIN_ELEMENT_SIZE,
  clampCanvasSize,
  clampToCanvas,
  frequencyKey,
  isFrequencyAllowed,
  isScheduleAllowed,
  scaleToFit,
  snapRectToAlignmentGuides,
} from './runtime'

const DAY = 86_400_000

describe('scaleToFit', () => {
  it('scales a canvas down so it fits a narrow viewport with a gutter', () => {
    expect(scaleToFit(420, 320, 'center')).toBeCloseTo((320 - 16) / 420)
  })

  it('never scales a canvas up', () => {
    expect(scaleToFit(420, 1200, 'center')).toBe(1)
  })

  it('never scales fullscreen placement', () => {
    expect(scaleToFit(420, 200, 'fullscreen')).toBe(1)
  })

  it('degrades safely for degenerate sizes', () => {
    expect(scaleToFit(0, 320, 'center')).toBe(1)
    expect(scaleToFit(420, 0, 'center')).toBe(1)
  })
})

describe('frequencyKey', () => {
  it('namespaced keys per popup', () => {
    expect(frequencyKey('abc', 'once-per-session')).toBe('ponkoform:popup:abc:session')
    expect(frequencyKey('abc', 'once-per-day')).toBe('ponkoform:popup:abc:lastShown')
    expect(frequencyKey('abc', 'once-per-week')).toBe('ponkoform:popup:abc:lastShown')
  })
})

describe('isFrequencyAllowed', () => {
  const now = 1_800_000_000_000

  it('allows day frequency after 24h and blocks before', () => {
    expect(isFrequencyAllowed(now - DAY - 1, 'once-per-day', now)).toBe(true)
    expect(isFrequencyAllowed(now - DAY + 1, 'once-per-day', now)).toBe(false)
  })

  it('allows week frequency after 7 days and blocks before', () => {
    expect(isFrequencyAllowed(now - 7 * DAY - 1, 'once-per-week', now)).toBe(true)
    expect(isFrequencyAllowed(now - 7 * DAY + 1, 'once-per-week', now)).toBe(false)
  })

  it('allows when never shown', () => {
    expect(isFrequencyAllowed(0, 'once-per-day', now)).toBe(true)
    expect(isFrequencyAllowed(0, 'once-per-week', now)).toBe(true)
  })

  it('delegates every-visit and once-per-session to the storage layer', () => {
    expect(isFrequencyAllowed(now, 'every-visit', now)).toBe(true)
    expect(isFrequencyAllowed(now, 'once-per-session', now)).toBe(true)
  })
})

describe('isScheduleAllowed', () => {
  it('enforces optional campaign start and end instants', () => {
    const schedule = {
      startAt: '2026-08-18T02:00:00.000Z',
      endAt: '2026-08-20T02:00:00.000Z',
    }
    expect(isScheduleAllowed(schedule, new Date('2026-08-18T01:59:59.999Z'))).toBe(false)
    expect(isScheduleAllowed(schedule, new Date('2026-08-19T02:00:00.000Z'))).toBe(true)
    expect(isScheduleAllowed(schedule, new Date('2026-08-20T02:00:00.000Z'))).toBe(false)
  })

  it('uses the visitor local clock for same-day daily hours', () => {
    const schedule = { dailyStart: '09:00', dailyEnd: '17:00' }
    expect(isScheduleAllowed(schedule, new Date(2026, 7, 18, 8, 59))).toBe(false)
    expect(isScheduleAllowed(schedule, new Date(2026, 7, 18, 9, 0))).toBe(true)
    expect(isScheduleAllowed(schedule, new Date(2026, 7, 18, 17, 0))).toBe(false)
  })

  it('supports daily windows that cross midnight', () => {
    const schedule = { dailyStart: '22:00', dailyEnd: '06:00' }
    expect(isScheduleAllowed(schedule, new Date(2026, 7, 18, 23, 30))).toBe(true)
    expect(isScheduleAllowed(schedule, new Date(2026, 7, 19, 5, 59))).toBe(true)
    expect(isScheduleAllowed(schedule, new Date(2026, 7, 19, 12, 0))).toBe(false)
  })

  it('treats an empty schedule and equal daily times as always active', () => {
    expect(isScheduleAllowed({}, new Date())).toBe(true)
    expect(isScheduleAllowed({ dailyStart: '09:00', dailyEnd: '09:00' }, new Date(2026, 7, 18, 2, 0))).toBe(true)
  })
})

describe('clampToCanvas', () => {
  const canvas = { width: 420, height: 380 }

  it('keeps an in-bounds rect unchanged', () => {
    expect(clampToCanvas({ x: 24, y: 32, width: 100, height: 50 }, canvas))
      .toEqual({ x: 24, y: 32, width: 100, height: 50 })
  })

  it('pulls overhanging elements back inside the canvas', () => {
    expect(clampToCanvas({ x: 400, y: 360, width: 100, height: 50 }, canvas))
      .toEqual({ x: 320, y: 330, width: 100, height: 50 })
  })

  it('enforces the minimum element size', () => {
    const clamped = clampToCanvas({ x: -10, y: -10, width: 4, height: 4 }, canvas)
    expect(clamped.width).toBe(MIN_ELEMENT_SIZE)
    expect(clamped.height).toBe(MIN_ELEMENT_SIZE)
    expect(clamped.x).toBe(0)
    expect(clamped.y).toBe(0)
  })
})

describe('snapRectToAlignmentGuides', () => {
  const canvas = { width: 420, height: 380 }

  it('centers an element on both canvas axes inside the snap threshold', () => {
    const result = snapRectToAlignmentGuides(
      { x: 113, y: 142, width: 200, height: 100 },
      canvas,
      [],
    )
    expect(result.rect).toEqual({ x: 110, y: 140, width: 200, height: 100 })
    expect(result.guides).toEqual({ vertical: 210, horizontal: 190 })
  })

  it('aligns element edges and centers with neighbouring elements', () => {
    const result = snapRectToAlignmentGuides(
      { x: 153, y: 72, width: 50, height: 40 },
      canvas,
      [{ x: 100, y: 70, width: 50, height: 40 }],
    )
    expect(result.rect.x).toBe(150)
    expect(result.rect.y).toBe(70)
    expect(result.guides).toEqual({ vertical: 150, horizontal: 70 })
  })

  it('leaves axes unchanged when no target is close enough', () => {
    const rect = { x: 77, y: 91, width: 50, height: 40 }
    expect(snapRectToAlignmentGuides(rect, canvas, [], 4)).toEqual({ rect, guides: {} })
  })
})

describe('clampCanvasSize', () => {
  it('clamps popup canvas dimensions to the persisted bounds', () => {
    expect(clampCanvasSize(100, 50)).toEqual({ width: 120, height: 120 })
    expect(clampCanvasSize(5000, 5000)).toEqual({ width: 4000, height: 4000 })
    expect(clampCanvasSize(1920, 1080)).toEqual({ width: 1920, height: 1080 })
    expect(clampCanvasSize(420.4, 380.6)).toEqual({ width: 420, height: 381 })
  })
})
