import { z } from 'zod'
import type { FieldValidationRules, PageFieldOption, PageFieldType } from '../page-builder/types'

export const AI_MESSAGE_LIMIT = 12
export const AI_MESSAGE_LENGTH = 2_000

export type AIAssistantMode = 'guide' | 'generate'

export interface AIAssistantMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AIDraftContext {
  pages: Array<{
    title: string
    description: string | null
    isFinal: boolean
    fields: Array<{
      fieldType: PageFieldType
      label: string
      required: boolean
      bindVariable: string
    }>
  }>
  referenceKeys: string[]
}

export interface GeneratedFieldCandidate {
  fieldType: Extract<
    PageFieldType,
    | 'text'
    | 'email'
    | 'number'
    | 'textarea'
    | 'select'
    | 'checkbox'
    | 'radio'
    | 'date'
    | 'time'
    | 'datetime'
    | 'content'
    | 'address'
    | 'satisfaction'
  >
  label: string
  placeholder: string | null
  required: boolean
  options: PageFieldOption[] | null
  bindVariable: string
  width: 'full' | 'half'
  validationRules: Pick<
    FieldValidationRules,
    'minLength' | 'maxLength' | 'minValue' | 'maxValue' | 'message'
  > | null
}

export interface GeneratedPageCandidate {
  title: string
  description: string | null
  isFinal: boolean
  finalTemplate: string | null
  fields: GeneratedFieldCandidate[]
}

export interface GeneratedFormCandidate {
  pages: GeneratedPageCandidate[]
}

export type AIAssistantErrorCode =
  | 'not_configured'
  | 'unauthorized'
  | 'rate_limited'
  | 'invalid_output'
  | 'temporarily_unavailable'

export type AIAssistantResponse =
  | { kind: 'answer'; message: string }
  | { kind: 'generation'; message: string; candidate: GeneratedFormCandidate }
  | { kind: 'error'; code: AIAssistantErrorCode; message: string }

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(AI_MESSAGE_LENGTH),
}).strict()

const draftSchema = z.object({
  pages: z.array(z.object({
    title: z.string().max(255),
    description: z.string().max(1_000).nullable(),
    isFinal: z.boolean(),
    fields: z.array(z.object({
      fieldType: z.string().max(40),
      label: z.string().max(255),
      required: z.boolean(),
      bindVariable: z.string().max(80),
    }).strict()).max(30),
  }).strict()).min(1).max(8),
  referenceKeys: z.array(z.string().max(80)).max(50),
}).strict()

const safeRulesSchema = z.object({
  minLength: z.number().int().min(0).max(10_000).optional(),
  maxLength: z.number().int().min(1).max(10_000).optional(),
  minValue: z.number().finite().optional(),
  maxValue: z.number().finite().optional(),
  message: z.string().trim().max(255).optional(),
}).strict()

const normalizedOptionSchema = z.object({
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(80),
}).strict()

const generatedFieldSchema = z.object({
  fieldType: z.enum([
    'text', 'email', 'number', 'textarea', 'select', 'checkbox', 'radio',
    'date', 'time', 'datetime', 'content', 'address', 'satisfaction',
  ]),
  label: z.string().trim().min(1).max(255),
  placeholder: z.string().max(2_000).nullable(),
  required: z.boolean(),
  options: z.array(normalizedOptionSchema).min(2).max(20).nullable(),
  bindVariable: z.string().regex(/^[a-z][a-z0-9_]{0,79}$/),
  width: z.enum(['full', 'half']),
  validationRules: safeRulesSchema.nullable(),
}).strict()

const generatedPageSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().max(1_000).nullable(),
  isFinal: z.boolean(),
  finalTemplate: z.string().max(2_000).nullable(),
  fields: z.array(generatedFieldSchema).max(20),
}).strict()

export const generatedFormCandidateSchema = z.object({
  pages: z.array(generatedPageSchema).min(2).max(8),
}).strict()

export const assistantRequestSchema = z.object({
  formId: z.number().int().positive(),
  mode: z.enum(['guide', 'generate']),
  messages: z.array(messageSchema).min(1).max(AI_MESSAGE_LIMIT),
  draft: draftSchema,
  candidate: generatedFormCandidateSchema.optional(),
}).strict()

export type AIAssistantRequest = z.infer<typeof assistantRequestSchema>
