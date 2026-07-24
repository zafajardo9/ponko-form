import { describe, expect, it } from 'vitest'
import {
  applyComputedFieldValues,
  buildReferenceMap,
  calculateFieldComputation,
  calculatePagePayment,
  optionPrice,
  parseReferenceValue,
} from './references'
import type { FormPage, FormReference, PageField } from './types'

const references: FormReference[] = [
  {
    id: 1,
    formId: 1,
    key: 'nbi_price',
    type: 'number',
    value: '450',
    label: 'NBI price',
    description: null,
    position: 0,
  },
  {
    id: 2,
    formId: 1,
    key: 'vat_rate',
    type: 'percentage',
    value: '12%',
    label: 'VAT',
    description: null,
    position: 1,
  },
  {
    id: 3,
    formId: 1,
    key: 'enabled',
    type: 'boolean',
    value: 'true',
    label: null,
    description: null,
    position: 2,
  },
  {
    id: 4,
    formId: 1,
    key: 'processing_fee',
    type: 'number',
    value: '50',
    label: 'Processing fee',
    description: null,
    position: 3,
  },
  {
    id: 5,
    formId: 1,
    key: 'account_prefix',
    type: 'text',
    value: 'Customer',
    label: 'Account prefix',
    description: null,
    position: 4,
  },
]

const servicesField = {
  id: 10,
  pageId: 1,
  fieldType: 'checkbox',
  label: 'Services',
  placeholder: null,
  required: false,
  bindVariable: 'services',
  position: 0,
  width: 'full',
  validationRules: { optionPricesEnabled: true },
  conditions: [],
  options: [
    { label: 'Identity Check', value: 'identity', priceReference: 'nbi_price', additionalPriceReference: 'processing_fee' },
    { label: 'Address Check', value: 'address', price: 200 },
  ],
} satisfies PageField

describe('page-builder references', () => {
  it('parses typed reference values', () => {
    expect(parseReferenceValue(references[0])).toBe(450)
    expect(parseReferenceValue(references[1])).toBe(0.12)
    expect(parseReferenceValue(references[2])).toBe(true)
    expect(buildReferenceMap(references)).toMatchObject({ nbi_price: 450, vat_rate: 0.12, enabled: true })
  })

  it('resolves direct and referenced option prices', () => {
    const map = buildReferenceMap(references)
    expect(optionPrice({ label: 'A', value: 'a', price: 99 }, map)).toEqual({ value: 99, base: 99, additional: 0 })
    expect(optionPrice({ label: 'B', value: 'b', priceReference: 'nbi_price', additionalPrice: 25 }, map)).toEqual({
      value: 475,
      base: 450,
      additional: 25,
    })
    expect(optionPrice({ label: 'C', value: 'c', priceReference: 'missing_price' }, map)).toEqual({
      value: 0,
      base: 0,
      additional: 0,
      missing: 'missing_price',
    })
  })

  it('calculates selected option totals and formula adjustments', () => {
    const page = {
      paymentAmountVariable: null,
      paymentComputation: {
        mode: 'formula',
        fieldBindings: ['services'],
        adjustments: [{ type: 'multiply', referenceKey: 'vat_rate' }],
        showBreakdown: true,
      },
    } satisfies Pick<FormPage, 'paymentAmountVariable' | 'paymentComputation'>

    const result = calculatePagePayment(
      page,
      [servicesField],
      { services: ['identity', 'address'] },
      references,
    )

    expect(result.subtotal).toBe(700)
    expect(result.amount).toBe(784)
    expect(result.breakdown).toContainEqual({ label: 'Identity Check additional', amount: 50, kind: 'adjustment' })
    expect(result.breakdown.map((line) => line.label)).toContain('Total')
    expect(result.missingReferences).toEqual([])
  })

  it('applies computation field values to the submission data scope', () => {
    const totalField = {
      id: 11,
      pageId: 1,
      fieldType: 'computation',
      label: 'Total',
      placeholder: null,
      required: false,
      bindVariable: 'total_due',
      position: 1,
      width: 'full',
      options: null,
      conditions: [],
      validationRules: {
        computation: {
          mode: 'formula',
          fieldBindings: ['services'],
          adjustments: [{ type: 'multiply', referenceKey: 'vat_rate' }],
          showBreakdown: true,
        },
      },
    } satisfies PageField

    const data = applyComputedFieldValues(
      [servicesField, totalField],
      { services: ['identity', 'address'] },
      references,
    )

    expect(data.total_due).toBe(784)
  })

  it('keeps computation breakdown when payment uses a computation amount field', () => {
    const totalField = {
      id: 11,
      pageId: 1,
      fieldType: 'computation',
      label: 'Total Due',
      placeholder: null,
      required: false,
      bindVariable: 'total_due',
      position: 1,
      width: 'full',
      options: null,
      conditions: [],
      validationRules: {
        computation: {
          mode: 'formula',
          fieldBindings: ['services'],
          adjustments: [{ type: 'multiply', referenceKey: 'vat_rate' }],
          showBreakdown: true,
        },
      },
    } satisfies PageField

    const data = applyComputedFieldValues(
      [servicesField, totalField],
      { services: ['identity', 'address'] },
      references,
    )
    const result = calculatePagePayment(
      {
        paymentAmountVariable: 'total_due',
        paymentComputation: { mode: 'field', fieldBindings: ['total_due'], showBreakdown: true },
      },
      [servicesField, totalField],
      data,
      references,
    )

    expect(result.amount).toBe(784)
    expect(result.breakdown).toContainEqual({ label: 'Identity Check', amount: 450, kind: 'item' })
    expect(result.breakdown).toContainEqual({ label: 'Address Check', amount: 200, kind: 'item' })
    expect(result.breakdown.map((line) => line.label)).toContain('Multiply by VAT')
  })

  it('layers expression computation blocks and preserves payment breakdown', () => {
    const subtotalField = {
      id: 11,
      pageId: 1,
      fieldType: 'computation',
      label: 'Subtotal',
      placeholder: null,
      required: false,
      bindVariable: 'subtotal',
      position: 1,
      width: 'full',
      options: null,
      conditions: [],
      validationRules: {
        computation: {
          mode: 'expression',
          expression: '{{services}}',
          showBreakdown: true,
        },
      },
    } satisfies PageField
    const totalField = {
      id: 12,
      pageId: 1,
      fieldType: 'computation',
      label: 'Total Due',
      placeholder: null,
      required: false,
      bindVariable: 'total_due',
      position: 2,
      width: 'full',
      options: null,
      conditions: [],
      validationRules: {
        computation: {
          mode: 'expression',
          expression: '{{subtotal}} +% {{vat_rate}}',
          showBreakdown: true,
        },
      },
    } satisfies PageField
    const fields = [servicesField, subtotalField, totalField]
    const data = applyComputedFieldValues(fields, { services: ['identity', 'address'] }, references)
    const result = calculatePagePayment(
      {
        paymentAmountVariable: 'total_due',
        paymentComputation: { mode: 'field', fieldBindings: ['total_due'], showBreakdown: true },
      },
      fields,
      data,
      references,
    )

    expect(data.subtotal).toBe(700)
    expect(data.total_due).toBe(784)
    expect(result.amount).toBe(784)
    expect(result.breakdown).toContainEqual({ label: 'Identity Check', amount: 450, kind: 'item' })
    expect(result.breakdown).toContainEqual({ label: 'Address Check', amount: 200, kind: 'item' })
    expect(result.breakdown).toContainEqual({ label: 'Add percent VAT', amount: 84, kind: 'adjustment' })
  })

  it('concatenates fields, text references, literal spacing, and nested text calculations', () => {
    const firstName = {
      id: 20,
      pageId: 1,
      fieldType: 'text',
      label: 'First name',
      placeholder: null,
      required: false,
      bindVariable: 'first_name',
      position: 0,
      width: 'full',
      options: null,
      validationRules: null,
      conditions: [],
    } satisfies PageField
    const displayName = {
      id: 21,
      pageId: 1,
      fieldType: 'computation',
      label: 'Display name',
      placeholder: null,
      required: false,
      bindVariable: 'display_name',
      position: 1,
      width: 'full',
      options: null,
      validationRules: {
        computation: {
          mode: 'expression',
          outputMode: 'text',
          expression: '{{account_prefix}} concat ": " concat {{first_name}}',
        },
      },
      conditions: [],
    } satisfies PageField
    const greeting = {
      id: 22,
      pageId: 1,
      fieldType: 'computation',
      label: 'Greeting',
      placeholder: null,
      required: false,
      bindVariable: 'greeting',
      position: 2,
      width: 'full',
      options: null,
      validationRules: {
        computation: {
          mode: 'expression',
          outputMode: 'text',
          terms: [
            { operator: 'set', source: 'fixed', fixedValue: 'Hello, ' },
            { operator: 'concat', source: 'field', fieldBinding: 'display_name' },
            { operator: 'concat', source: 'fixed', fixedValue: '!' },
          ],
        },
      },
      conditions: [],
    } satisfies PageField

    const data = applyComputedFieldValues(
      [firstName, greeting, displayName],
      { first_name: 'Ada' },
      references,
    )

    expect(data.display_name).toBe('Customer: Ada')
    expect(data.greeting).toBe('Hello, Customer: Ada!')
  })

  it('supports whole-number and decimal numeric outputs', () => {
    const base = {
      mode: 'expression',
      editorMode: 'syntax',
      expression: '10 / 3',
      outputMode: 'number',
    } as const

    expect(calculateFieldComputation(
      { ...base, numericType: 'integer' },
      [],
      {},
      [],
    ).value).toBe(3)
    expect(calculateFieldComputation(
      { ...base, numericType: 'decimal', decimalPlaces: 2 },
      [],
      {},
      [],
    ).value).toBe(3.33)
  })

  it('preserves syntax and visual formulas while evaluating the selected editor', () => {
    const visual = calculateFieldComputation(
      {
        mode: 'expression',
        editorMode: 'visual',
        expression: '100',
        outputMode: 'number',
        terms: [
          { operator: 'set', source: 'fixed', fixedValue: 8 },
          { operator: 'multiply', source: 'fixed', fixedValue: 2 },
        ],
      },
      [],
      {},
      [],
    )
    const syntax = calculateFieldComputation(
      {
        mode: 'expression',
        editorMode: 'syntax',
        expression: '100',
        outputMode: 'number',
        terms: [
          { operator: 'set', source: 'fixed', fixedValue: 8 },
          { operator: 'multiply', source: 'fixed', fixedValue: 2 },
        ],
      },
      [],
      {},
      [],
    )

    expect(visual.value).toBe(16)
    expect(syntax.value).toBe(100)
  })
})
