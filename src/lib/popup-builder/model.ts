import { z } from 'zod'

/**
 * Pure zod models for the popup feature. Kept free of server-function
 * imports so tests (and any client bundle) can use them directly — the same
 * split as `payment-links/model.ts`.
 */

export const triggerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('on-load'), delayMs: z.number().int().min(0).max(600_000) }),
  z.object({ type: z.literal('exit-intent') }),
  z.object({ type: z.literal('scroll-depth'), percent: z.number().int().min(1).max(100) }),
  z.object({ type: z.literal('click-element'), selector: z.string().min(1).max(200) }),
])

export const placementSchema = z.enum([
  'center',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'fullscreen',
])

export const frequencySchema = z.enum(['every-visit', 'once-per-session', 'once-per-day', 'once-per-week'])

const localTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
export const popupScheduleSchema = z.object({
  startAt: z.iso.datetime().optional(),
  endAt: z.iso.datetime().optional(),
  dailyStart: localTimeSchema.optional(),
  dailyEnd: localTimeSchema.optional(),
}).superRefine((schedule, context) => {
  if (schedule.startAt && schedule.endAt && Date.parse(schedule.endAt) <= Date.parse(schedule.startAt)) {
    context.addIssue({ code: 'custom', path: ['endAt'], message: 'End date must be after the start date.' })
  }
  if (Boolean(schedule.dailyStart) !== Boolean(schedule.dailyEnd)) {
    context.addIssue({ code: 'custom', path: ['dailyEnd'], message: 'Set both daily start and end times.' })
  }
})

export const popupStyleSchema = z.object({
  fontFamily: z.enum(['sans', 'serif', 'mono']).optional(),
  backgroundColor: z.string().max(32).optional(),
  backgroundImage: z.string().max(2_000).optional(),
  backgroundImageSize: z.enum(['cover', 'contain']).optional(),
  backgroundImagePosition: z.enum(['center', 'top', 'bottom', 'left', 'right']).optional(),
  backgroundImageOverlayColor: z.string().max(32).optional(),
  backgroundImageOverlayOpacity: z.number().min(0).max(0.9).optional(),
  overlayColor: z.string().max(32).optional(),
  overlayOpacity: z.number().min(0).max(0.9).optional(),
  animation: z.enum(['fade', 'zoom', 'slide-up', 'none']).optional(),
  closable: z.boolean().optional(),
  closeOnOverlayClick: z.boolean().optional(),
  borderRadius: z.number().min(0).max(64).optional(),
})

const rectSchema = z.object({
  x: z.number().min(-2000).max(4000),
  y: z.number().min(-2000).max(4000),
  width: z.number().min(1).max(4000),
  height: z.number().min(1).max(4000),
})

const elementBaseSchema = rectSchema.extend({
  id: z.string().min(1).max(64),
  zIndex: z.number().int().min(0).max(999),
  opacity: z.number().min(0).max(1),
  rotation: z.number().min(-360).max(360),
})

const fontWeightSchema = z.enum(['normal', 'medium', 'semibold', 'bold'])
const alignSchema = z.enum(['left', 'center', 'right'])
const verticalAlignSchema = z.enum(['top', 'middle', 'bottom'])

export const elementSchema = z.discriminatedUnion('type', [
  elementBaseSchema.extend({
    type: z.literal('heading'),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    text: z.string().max(2_000),
    color: z.string().max(32),
    fontSize: z.number().min(8).max(120),
    fontWeight: fontWeightSchema,
    align: alignSchema,
    autoHeight: z.boolean().optional(),
    verticalAlign: verticalAlignSchema.optional(),
  }),
  elementBaseSchema.extend({
    type: z.literal('text'),
    text: z.string().max(10_000),
    color: z.string().max(32),
    fontSize: z.number().min(8).max(80),
    lineHeight: z.number().min(0.8).max(3),
    align: alignSchema,
    autoHeight: z.boolean().optional(),
    verticalAlign: verticalAlignSchema.optional(),
  }),
  elementBaseSchema.extend({
    type: z.literal('image'),
    src: z.string().max(2_000),
    alt: z.string().max(500),
    fit: z.enum(['cover', 'contain']),
    widthMode: z.enum(['fixed', 'canvas']).optional(),
    heightMode: z.enum(['fixed', 'canvas']).optional(),
    radius: z.number().min(0).max(200),
  }),
  elementBaseSchema.extend({
    type: z.literal('button'),
    label: z.string().max(500),
    bgColor: z.string().max(32),
    textColor: z.string().max(32),
    radius: z.number().min(0).max(200),
    link: z.string().max(2_000),
    openInNewTab: z.boolean(),
    fontWeight: fontWeightSchema,
    fontSize: z.number().min(8).max(60),
    borderColor: z.string().max(32).optional(),
    borderWidth: z.number().min(0).max(12).optional(),
    textAlign: alignSchema.optional(),
    verticalAlign: verticalAlignSchema.optional(),
    fontStyle: z.enum(['normal', 'italic']).optional(),
    letterSpacing: z.number().min(-2).max(12).optional(),
    textTransform: z.enum(['none', 'uppercase']).optional(),
    paddingX: z.number().min(0).max(80).optional(),
    paddingY: z.number().min(0).max(40).optional(),
    shadow: z.enum(['none', 'soft', 'strong']).optional(),
    hoverEffect: z.enum(['none', 'lift', 'glow']).optional(),
    hoverBgColor: z.string().max(32).optional(),
    hoverTextColor: z.string().max(32).optional(),
    icon: z.enum(['none', 'arrow-right', 'external-link', 'mail', 'sparkles']).optional(),
    iconPosition: z.enum(['left', 'right']).optional(),
  }),
  elementBaseSchema.extend({
    type: z.literal('divider'),
    color: z.string().max(32),
    thickness: z.number().min(1).max(40),
    lineStyle: z.enum(['solid', 'dashed', 'dotted']),
  }),
  elementBaseSchema.extend({
    type: z.literal('html'),
    html: z.string().max(50_000),
  }),
])

export const savePopupSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().trim().min(1).max(255),
  width: z.number().int().min(120).max(4000),
  height: z.number().int().min(120).max(4000),
  placement: placementSchema,
  trigger: triggerSchema,
  frequency: frequencySchema,
  // Default keeps older open builder tabs compatible when this field was not
  // yet part of their autosave payload.
  schedule: popupScheduleSchema.default({}),
  style: popupStyleSchema,
  elements: z.array(elementSchema).max(100),
})

export const createPopupSchema = z.object({
  title: z.string().trim().min(1).max(255),
})

export const setPopupStatusSchema = z.object({
  id: z.number().int().positive(),
  status: z.enum(['draft', 'published']),
})

export const popupPublicIdSchema = z.object({
  publicId: z.string().min(1).max(32),
})

export type TriggerInput = z.infer<typeof triggerSchema>
export type SavePopupInput = z.infer<typeof savePopupSchema>
