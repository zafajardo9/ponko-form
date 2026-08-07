import { describe, expect, it } from 'vitest'
import {
  orderedTemplatePages,
  templateFieldInsertValues,
  templatePageInsertValues,
} from './create-plan'
import type { TemplatePageData } from './types'

const pages: TemplatePageData[] = [
  {
    title: 'Thank You',
    position: 9,
    isFinal: true,
    finalTemplate: null,
    fields: [
      {
        fieldType: 'text',
        label: 'Ignored final field',
        required: false,
        bindVariable: 'ignored',
        position: 0,
      },
    ],
  },
  {
    title: 'Contact',
    description: 'Tell us about yourself',
    position: 3,
    isFinal: false,
    fields: [
      {
        fieldType: 'email',
        label: 'Email',
        required: true,
        bindVariable: 'email',
        position: 4,
        width: 'half',
      },
      {
        fieldType: 'text',
        label: 'Name',
        required: false,
        bindVariable: 'name',
        position: 1,
      },
    ],
  },
]

describe('template creation plan', () => {
  it('orders pages without mutating the template data', () => {
    expect(orderedTemplatePages(pages).map((page) => page.title)).toEqual([
      'Contact',
      'Thank You',
    ])
    expect(pages.map((page) => page.title)).toEqual(['Thank You', 'Contact'])
  })

  it('normalizes page positions and supplies the default final message', () => {
    expect(templatePageInsertValues(42, pages)).toEqual([
      {
        formId: 42,
        title: 'Contact',
        description: 'Tell us about yourself',
        position: 0,
        isFinal: false,
        finalTemplate: null,
        hasPayment: false,
        paymentAmountVariable: null,
        paymentCurrency: 'USD',
        paymentComputation: null,
      },
      {
        formId: 42,
        title: 'Thank You',
        description: null,
        position: 1,
        isFinal: true,
        finalTemplate: 'Your response has been recorded.',
        hasPayment: false,
        paymentAmountVariable: null,
        paymentCurrency: 'USD',
        paymentComputation: null,
      },
    ])
  })

  it('maps fields to created pages, normalizes positions, and skips final-page fields', () => {
    expect(
      templateFieldInsertValues(
        [
          { id: 101, position: 0 },
          { id: 102, position: 1 },
        ],
        pages,
      ),
    ).toMatchObject([
      {
        pageId: 101,
        fieldType: 'text',
        label: 'Name',
        bindVariable: 'name',
        position: 0,
        width: 'full',
      },
      {
        pageId: 101,
        fieldType: 'email',
        label: 'Email',
        bindVariable: 'email',
        position: 1,
        width: 'half',
      },
    ])
  })

  it('fails before inserting fields when a created page is missing', () => {
    expect(() => templateFieldInsertValues([], pages)).toThrow(
      'Template page 1 was not created',
    )
  })

  it('carries payment configuration into a payment page', () => {
    const paymentPages: TemplatePageData[] = [
      {
        title: 'Payment',
        position: 0,
        isFinal: false,
        hasPayment: true,
        paymentCurrency: 'php',
        paymentComputation: {
          mode: 'fixed',
          fixedAmount: 500,
          showBreakdown: true,
        },
        fields: [],
      },
    ]
    expect(templatePageInsertValues(7, paymentPages)).toEqual([
      {
        formId: 7,
        title: 'Payment',
        description: null,
        position: 0,
        isFinal: false,
        finalTemplate: null,
        hasPayment: true,
        paymentAmountVariable: null,
        paymentCurrency: 'PHP',
        paymentComputation: {
          mode: 'fixed',
          fixedAmount: 500,
          showBreakdown: true,
        },
      },
    ])
  })

  it('clears payment configuration on non-payment pages', () => {
    expect(templatePageInsertValues(7, pages)).toEqual([
      {
        formId: 7,
        title: 'Contact',
        description: 'Tell us about yourself',
        position: 0,
        isFinal: false,
        finalTemplate: null,
        hasPayment: false,
        paymentAmountVariable: null,
        paymentCurrency: 'USD',
        paymentComputation: null,
      },
      {
        formId: 7,
        title: 'Thank You',
        description: null,
        position: 1,
        isFinal: true,
        finalTemplate: 'Your response has been recorded.',
        hasPayment: false,
        paymentAmountVariable: null,
        paymentCurrency: 'USD',
        paymentComputation: null,
      },
    ])
  })

  it('carries field validation rules such as option prices into the insert', () => {
    const pricedPages: TemplatePageData[] = [
      {
        title: 'Items',
        position: 0,
        isFinal: false,
        fields: [
          {
            fieldType: 'checkbox',
            label: 'Products',
            required: true,
            bindVariable: 'items',
            position: 0,
            validationRules: { optionPricesEnabled: true },
            options: [{ label: 'Starter', value: 'starter', price: 500 }],
          },
        ],
      },
    ]
    const fieldValues = templateFieldInsertValues([{ id: 201, position: 0 }], pricedPages)
    expect(fieldValues).toMatchObject([
      {
        pageId: 201,
        fieldType: 'checkbox',
        bindVariable: 'items',
        validationRules: { optionPricesEnabled: true },
      },
    ])
  })
})
