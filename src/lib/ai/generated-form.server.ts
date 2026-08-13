import sanitizeHtml from 'sanitize-html'
import { z } from 'zod'
import type { GeneratedFormCandidate, GeneratedPageCandidate } from './contracts'

const safeFieldTypes = [
  'text', 'email', 'number', 'textarea', 'select', 'checkbox', 'radio',
  'date', 'time', 'datetime', 'content', 'address', 'satisfaction',
] as const

const rawFieldSchema = z.object({
  fieldType: z.enum(safeFieldTypes),
  label: z.string().trim().min(1).max(255),
  placeholder: z.string().max(2_000).nullish(),
  required: z.boolean().optional(),
  options: z.array(z.string().trim().min(1).max(120)).min(2).max(20).nullish(),
  bindVariable: z.string().trim().max(80).optional(),
  width: z.enum(['full', 'half']).optional(),
  validationRules: z.object({
    minLength: z.number().int().min(0).max(10_000).optional(),
    maxLength: z.number().int().min(1).max(10_000).optional(),
    minValue: z.number().finite().optional(),
    maxValue: z.number().finite().optional(),
    message: z.string().trim().max(255).optional(),
  }).strict().nullish(),
}).strict()

const rawPageSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().max(1_000).nullish(),
  isFinal: z.boolean(),
  finalTemplate: z.string().max(2_000).nullish(),
  fields: z.array(rawFieldSchema).max(20),
}).strict()

const rawGenerationSchema = z.object({
  message: z.string().trim().min(1).max(1_000),
  candidate: z.object({ pages: z.array(rawPageSchema).min(2).max(8) }).strict(),
}).strict()

export const FORM_RESPONSE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    message: { type: 'string' },
    candidate: {
      type: 'object',
      additionalProperties: false,
      properties: {
        pages: {
          type: 'array', minItems: 2, maxItems: 8,
          items: {
            type: 'object', additionalProperties: false,
            properties: {
              title: { type: 'string' },
              description: { type: ['string', 'null'] },
              isFinal: { type: 'boolean' },
              finalTemplate: { type: ['string', 'null'] },
              fields: {
                type: 'array', maxItems: 20,
                items: {
                  type: 'object', additionalProperties: false,
                  properties: {
                    fieldType: { type: 'string', enum: safeFieldTypes },
                    label: { type: 'string' },
                    placeholder: { type: ['string', 'null'] },
                    required: { type: 'boolean' },
                    options: { type: ['array', 'null'], items: { type: 'string' } },
                    bindVariable: { type: 'string' },
                    width: { type: 'string', enum: ['full', 'half'] },
                    validationRules: {
                      type: ['object', 'null'], additionalProperties: false,
                      properties: {
                        minLength: { type: 'integer' }, maxLength: { type: 'integer' },
                        minValue: { type: 'number' }, maxValue: { type: 'number' },
                        message: { type: 'string' },
                      },
                    },
                  },
                  required: ['fieldType', 'label', 'placeholder', 'required', 'options', 'bindVariable', 'width', 'validationRules'],
                },
              },
            },
            required: ['title', 'description', 'isFinal', 'finalTemplate', 'fields'],
          },
        },
      },
      required: ['pages'],
    },
  },
  required: ['message', 'candidate'],
} as const

function bindingFor(label: string, requested: string | undefined, used: Set<string>) {
  if (requested) {
    if (!/^[a-z][a-z0-9_]{0,79}$/.test(requested)) {
      throw new Error(`${requested} is not a valid field binding`)
    }
    if (used.has(requested)) throw new Error(`${requested} is used by more than one field`)
    used.add(requested)
    return requested
  }
  let base = (requested || label)
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64)
  if (!base || !/^[a-z]/.test(base)) base = 'field'
  let candidate = base
  let suffix = 2
  while (used.has(candidate)) candidate = `${base}_${suffix++}`
  used.add(candidate)
  return candidate
}

function optionValue(label: string, index: number) {
  return label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60)
    || `option_${index + 1}`
}

function safeContent(value: string | null | undefined) {
  if (!value) return null
  return sanitizeHtml(value, {
    allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li'],
    allowedAttributes: {},
  }).slice(0, 2_000) || null
}

export function parseGeneratedForm(value: unknown): { message: string; candidate: GeneratedFormCandidate } {
  const parsed = rawGenerationSchema.parse(value)
  const finalPages = parsed.candidate.pages.filter((page) => page.isFinal)
  const editablePages = parsed.candidate.pages.filter((page) => !page.isFinal)
  if (finalPages.length !== 1 || editablePages.length === 0) {
    throw new Error('Generated form must contain editable pages and exactly one final page')
  }

  const used = new Set<string>()
  let totalFields = 0
  const pages: GeneratedPageCandidate[] = [...editablePages, finalPages[0]].map((page) => {
    if (page.isFinal && page.fields.length > 0) throw new Error('The final page cannot contain fields')
    totalFields += page.fields.length
    const fields = page.fields.map((field) => {
      const needsOptions = ['select', 'checkbox', 'radio', 'satisfaction'].includes(field.fieldType)
      if (needsOptions && (!field.options || field.options.length < 2)) {
        throw new Error(`${field.label} needs at least two options`)
      }
      if (!needsOptions && field.options?.length) throw new Error(`${field.label} does not support options`)
      const optionLabels = field.options ?? []
      if (new Set(optionLabels.map((option) => option.toLowerCase())).size !== optionLabels.length) {
        throw new Error(`${field.label} has duplicate options`)
      }
      const options = needsOptions
        ? optionLabels.map((label, index) => ({
            label,
            value: field.fieldType === 'satisfaction'
              ? String(index + 1)
              : optionValue(label, index),
          })).filter((option, index, all) => all.findIndex((item) => item.value === option.value) === index)
        : null
      if (needsOptions && options!.length !== optionLabels.length) {
        throw new Error(`${field.label} has options that resolve to duplicate values`)
      }
      const rules = field.validationRules ?? null
      if (rules?.minLength != null && rules.maxLength != null && rules.minLength > rules.maxLength) {
        throw new Error(`${field.label} has invalid length limits`)
      }
      if (rules?.minValue != null && rules.maxValue != null && rules.minValue > rules.maxValue) {
        throw new Error(`${field.label} has invalid number limits`)
      }
      return {
        fieldType: field.fieldType,
        label: field.label,
        placeholder: field.fieldType === 'content' ? safeContent(field.placeholder) : field.placeholder?.slice(0, 255) ?? null,
        required: field.fieldType === 'content' ? false : Boolean(field.required),
        options,
        bindVariable: bindingFor(field.label, field.bindVariable, used),
        width: field.width ?? 'full',
        validationRules: rules,
      }
    })
    return {
      title: page.title,
      description: page.isFinal ? null : page.description ?? null,
      isFinal: page.isFinal,
      finalTemplate: page.isFinal ? safeContent(page.finalTemplate) ?? 'Your response has been recorded.' : null,
      fields,
    }
  })
  if (totalFields > 30) throw new Error('Generated form contains too many fields')
  return { message: parsed.message, candidate: { pages } }
}
