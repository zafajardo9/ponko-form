import { describe, expect, it } from 'vitest'
import { BUILTIN_FORM_TEMPLATES } from './catalog'

describe('built-in form templates', () => {
  it('defines the built-in templates', () => {
    expect(BUILTIN_FORM_TEMPLATES.map((template) => template.name)).toEqual([
      'Customer Satisfaction Survey',
      'Contact Intake',
      'Support Ticket',
      'Deal Qualification',
      'Account Intake',
      'Task Request',
    ])
  })

  it.each(BUILTIN_FORM_TEMPLATES)('$name has ordered pages, unique bindings, and one final page', (template) => {
    expect(template.pagesData.filter((page) => page.isFinal)).toHaveLength(1)
    expect(template.pagesData.at(-1)?.isFinal).toBe(true)
    expect(template.pagesData.map((page) => page.position)).toEqual(
      template.pagesData.map((_, index) => index),
    )
    const bindings = template.pagesData.flatMap((page) => page.fields.map((field) => field.bindVariable))
    expect(new Set(bindings).size).toBe(bindings.length)
    expect(bindings.every((binding) => /^[a-z][a-z0-9_]*$/.test(binding))).toBe(true)
  })

  it('includes selectable options wherever the field type requires them', () => {
    const selectFields = BUILTIN_FORM_TEMPLATES.flatMap((template) =>
      template.pagesData.flatMap((page) => page.fields.filter((field) => field.fieldType === 'select')),
    )
    expect(selectFields.length).toBeGreaterThan(0)
    expect(selectFields.every((field) => (field.options?.length ?? 0) >= 2)).toBe(true)
  })

  it('includes a ready-to-use satisfaction survey with numeric rating options', () => {
    const survey = BUILTIN_FORM_TEMPLATES.find((template) => template.name === 'Customer Satisfaction Survey')
    const ratings = survey?.pagesData.flatMap((page) =>
      page.fields.filter((field) => field.fieldType === 'satisfaction'),
    ) ?? []

    expect(survey?.category).toBe('survey')
    expect(ratings).toHaveLength(2)
    expect(ratings.every((field) => field.required)).toBe(true)
    expect(ratings.every((field) =>
      (field.options?.length ?? 0) >= 2 && field.options?.every((option) => Number.isFinite(Number(option.value))),
    )).toBe(true)
  })
})
