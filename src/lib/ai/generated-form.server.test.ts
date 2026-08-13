import { describe, expect, it } from 'vitest'
import { parseGeneratedForm } from './generated-form.server'

function validGeneration() {
  return {
    message: 'A concise contact form is ready.',
    candidate: {
      pages: [
        {
          title: 'Contact details',
          description: 'Tell us how to reach you.',
          isFinal: false,
          finalTemplate: null,
          fields: [
            {
              fieldType: 'text',
              label: 'Full name',
              placeholder: 'Jane Doe',
              required: true,
              options: null,
              bindVariable: 'full_name',
              width: 'half',
              validationRules: { minLength: 2, maxLength: 80 },
            },
            {
              fieldType: 'radio',
              label: 'Preferred contact',
              placeholder: null,
              required: true,
              options: ['Email', 'Phone'],
              bindVariable: 'preferred_contact',
              width: 'half',
              validationRules: null,
            },
          ],
        },
        {
          title: 'Thank you',
          description: null,
          isFinal: true,
          finalTemplate: '<p>We will be in touch.</p><script>alert(1)</script>',
          fields: [],
        },
      ],
    },
  }
}

describe('parseGeneratedForm', () => {
  it('normalizes safe fields and sanitizes generated content', () => {
    const result = parseGeneratedForm(validGeneration())
    expect(result.candidate.pages[0].fields[1].options).toEqual([
      { label: 'Email', value: 'email' },
      { label: 'Phone', value: 'phone' },
    ])
    expect(result.candidate.pages[1].finalTemplate).toBe('<p>We will be in touch.</p>')
  })

  it('rejects unsupported fields and unknown properties', () => {
    const input = validGeneration()
    input.candidate.pages[0].fields[0].fieldType = 'payment'
    expect(() => parseGeneratedForm(input)).toThrow()
  })

  it('rejects duplicate bindings, invalid options, and malformed page topology', () => {
    const duplicate = validGeneration()
    duplicate.candidate.pages[0].fields[1].bindVariable = 'full_name'
    expect(() => parseGeneratedForm(duplicate)).toThrow(/more than one field/)

    const options = validGeneration()
    options.candidate.pages[0].fields[1].options = ['Email', 'email']
    expect(() => parseGeneratedForm(options)).toThrow(/duplicate options/)

    const topology = validGeneration()
    topology.candidate.pages[1].isFinal = false
    expect(() => parseGeneratedForm(topology)).toThrow(/exactly one final page/)
  })
})
