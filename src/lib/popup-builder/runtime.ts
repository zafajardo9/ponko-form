import type { PopupFrequency, PopupPlacement, PopupRect, PopupSchedule } from './types'
import { POPUP_MAX_HEIGHT, POPUP_MAX_WIDTH, POPUP_MIN_HEIGHT, POPUP_MIN_WIDTH } from './defaults'

/**
 * Pure helpers shared by the popup runtime, loader script, and builder
 * canvas. No DOM access — everything here is testable in isolation.
 */

/** Min element size on the canvas (px). */
export const MIN_ELEMENT_SIZE = 24

export interface PopupAlignmentGuides {
  /** X coordinate of the vertical guide. */
  vertical?: number
  /** Y coordinate of the horizontal guide. */
  horizontal?: number
}

/**
 * Scale factor that fits a design canvas into a host viewport. Fullscreen
 * placement never scales (the loader stretches it); otherwise the canvas is
 * scaled down — never up — to fit `viewportW` minus a 16px gutter.
 */
export function scaleToFit(width: number, viewportW: number, placement: PopupPlacement): number {
  if (placement === 'fullscreen') return 1
  if (width <= 0 || viewportW <= 0) return 1
  return Math.min(1, (viewportW - 16) / width)
}

/** Storage key for the "last shown at" timestamp used by frequency gating. */
export function frequencyKey(popupId: string, frequency: PopupFrequency): string {
  switch (frequency) {
    case 'every-visit':
      // No persistence — a fresh key per call keeps callers uniform.
      return `ponkoform:popup:${popupId}:ephemeral-${Math.random().toString(36).slice(2)}`
    case 'once-per-session':
      return `ponkoform:popup:${popupId}:session`
    case 'once-per-day':
    case 'once-per-week':
      return `ponkoform:popup:${popupId}:lastShown`
  }
}

const FREQUENCY_DAYS: Partial<Record<PopupFrequency, number>> = {
  'once-per-day': 1,
  'once-per-week': 7,
}

/**
 * Frequency gate. `lastShown` is the previously persisted timestamp (0 when
 * never shown); `now` is injectable for tests. `every-visit` and
 * `once-per-session` are decided by the caller's storage layer (session
 * storage presence), so they are only allowed here.
 */
export function isFrequencyAllowed(
  lastShown: number,
  frequency: PopupFrequency,
  now = Date.now(),
): boolean {
  const days = FREQUENCY_DAYS[frequency]
  if (days == null) return true
  if (!lastShown) return true
  return now - lastShown >= days * 86_400_000
}

/** Campaign and recurring daily-window gate. Daily times use visitor-local time. */
export function isScheduleAllowed(schedule: PopupSchedule | undefined, now = new Date()): boolean {
  if (!schedule) return true
  const timestamp = now.getTime()
  const starts = schedule.startAt ? Date.parse(schedule.startAt) : Number.NaN
  const ends = schedule.endAt ? Date.parse(schedule.endAt) : Number.NaN
  if (Number.isFinite(starts) && timestamp < starts) return false
  if (Number.isFinite(ends) && timestamp >= ends) return false

  if (!schedule.dailyStart || !schedule.dailyEnd) return true
  const toMinutes = (value: string) => {
    const [hours, minutes] = value.split(':').map(Number)
    return hours * 60 + minutes
  }
  const current = now.getHours() * 60 + now.getMinutes()
  const start = toMinutes(schedule.dailyStart)
  const end = toMinutes(schedule.dailyEnd)
  if (start === end) return true
  return start < end
    ? current >= start && current < end
    : current >= start || current < end
}

/**
 * Snap a moving element's left/center/right and top/middle/bottom anchors to
 * the canvas or neighbouring element anchors. The caller may retain its grid
 * snap on an axis where no alignment guide is close enough.
 */
export function snapRectToAlignmentGuides(
  rect: PopupRect,
  canvas: { width: number; height: number },
  neighbours: PopupRect[],
  threshold = 6,
): { rect: PopupRect; guides: PopupAlignmentGuides } {
  const xTargets = [0, canvas.width / 2, canvas.width]
  const yTargets = [0, canvas.height / 2, canvas.height]
  for (const neighbour of neighbours) {
    xTargets.push(neighbour.x, neighbour.x + neighbour.width / 2, neighbour.x + neighbour.width)
    yTargets.push(neighbour.y, neighbour.y + neighbour.height / 2, neighbour.y + neighbour.height)
  }

  const xMatch = closestAlignment(rect.x, [0, rect.width / 2, rect.width], xTargets, threshold)
  const yMatch = closestAlignment(rect.y, [0, rect.height / 2, rect.height], yTargets, threshold)
  return {
    rect: {
      ...rect,
      x: xMatch?.position ?? rect.x,
      y: yMatch?.position ?? rect.y,
    },
    guides: {
      ...(xMatch ? { vertical: xMatch.guide } : {}),
      ...(yMatch ? { horizontal: yMatch.guide } : {}),
    },
  }
}

function closestAlignment(
  position: number,
  anchorOffsets: number[],
  targets: number[],
  threshold: number,
): { position: number; guide: number } | undefined {
  let closest: { position: number; guide: number; distance: number } | undefined
  for (const guide of targets) {
    for (const offset of anchorOffsets) {
      const candidate = guide - offset
      const distance = Math.abs(candidate - position)
      if (distance <= threshold && (!closest || distance < closest.distance)) {
        closest = { position: candidate, guide, distance }
      }
    }
  }
  return closest
}

/** Clamp a rect so it stays fully inside the canvas (and above min size). */
export function clampToCanvas(
  rect: PopupRect,
  canvas: { width: number; height: number },
): PopupRect {
  const width = Math.max(MIN_ELEMENT_SIZE, Math.min(rect.width, canvas.width))
  const height = Math.max(MIN_ELEMENT_SIZE, Math.min(rect.height, canvas.height))
  return {
    width,
    height,
    x: Math.max(0, Math.min(rect.x, canvas.width - width)),
    y: Math.max(0, Math.min(rect.y, canvas.height - height)),
  }
}

/** Clamp popup canvas dimensions to the persisted bounds. */
export function clampCanvasSize(width: number, height: number): { width: number; height: number } {
  return {
    width: Math.round(Math.max(POPUP_MIN_WIDTH, Math.min(POPUP_MAX_WIDTH, width))),
    height: Math.round(Math.max(POPUP_MIN_HEIGHT, Math.min(POPUP_MAX_HEIGHT, height))),
  }
}
