import { describe, expect, it } from 'vitest'
import {
  applyComputedFieldValues,
  buildReferenceMap,
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
})
