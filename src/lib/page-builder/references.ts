import type {
  FieldComputation,
  FormulaOperator,
  FormPage,
  FormReference,
  PageField,
  PageFieldOption,
  ReferenceMap,
  ReferenceValue,
} from './types'
import { evaluateSafeExpression, parseSafeExpression } from '../flow-engine/safe-expression'

export interface PaymentBreakdownLine {
  label: string
  amount: number
  kind: 'item' | 'subtotal' | 'adjustment' | 'total'
}

export interface PaymentCalculation {
  amount: number
  subtotal: number
  breakdown: PaymentBreakdownLine[]
  missingReferences: string[]
}

export interface PaymentReceiptDetail {
  binding: string
  label: string
  value: string
}

export interface ComputedFieldResult {
  value: number | string
  breakdown: PaymentBreakdownLine[]
  missingReferences: string[]
}

export function isReferenceKey(value: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(value)
}

export function parseReferenceValue(reference: Pick<FormReference, 'type' | 'value'>): ReferenceValue {
  if (reference.type === 'number') {
    const parsed = Number(reference.value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (reference.type === 'percentage') {
    const parsed = Number(reference.value.replace('%', '').trim())
    return Number.isFinite(parsed) ? parsed / 100 : 0
  }
  if (reference.type === 'boolean') return reference.value === 'true'
  return reference.value
}

export function buildReferenceMap(references: FormReference[] = []): ReferenceMap {
  return Object.fromEntries(references.map((reference) => [reference.key, parseReferenceValue(reference)]))
}

export function resolveReferenceToken(value: string | null | undefined, references: ReferenceMap): unknown {
  if (!value) return value ?? ''
  const match = value.trim().match(/^\{\{\s*([a-z][a-z0-9_]*)\s*\}\}$/)
  if (!match) return value
  return references[match[1]] ?? ''
}

export function resolveConditionExpected(value: string | null | undefined, references: ReferenceMap = {}): string {
  const resolved = resolveReferenceToken(value, references)
  return String(resolved ?? '')
}

export function referenceNumber(referenceKey: string | null | undefined, references: ReferenceMap): {
  value: number
  missing?: string
} {
  if (!referenceKey) return { value: 0 }
  const raw = references[referenceKey]
  if (raw === undefined || raw === null) return { value: 0, missing: referenceKey }
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return { value: 0, missing: referenceKey }
  return { value: parsed }
}

function selectedSet(value: unknown): Set<string> {
  if (Array.isArray(value)) return new Set(value.filter((item): item is string => typeof item === 'string'))
  if (value == null) return new Set()
  return new Set([String(value)])
}

function receiptValue(field: PageField, raw: unknown): string {
  if (raw == null) return ''
  const optionLabels = new Map((field.options ?? []).map((option) => [option.value, option.label]))
  if (Array.isArray(raw)) {
    return raw
      .map((item) => optionLabels.get(String(item)) || String(item))
      .filter(Boolean)
      .join(', ')
  }
  if (typeof raw === 'object') {
    return Object.values(raw as Record<string, unknown>)
      .flatMap((value) => Array.isArray(value) ? value : [value])
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
      .join(', ')
  }
  if (typeof raw === 'boolean') return raw ? 'Yes' : 'No'
  return optionLabels.get(String(raw)) || String(raw)
}

export function buildPaymentReceiptDetails(
  fields: PageField[],
  dataScope: Record<string, unknown>,
  bindings: string[] = [],
): PaymentReceiptDetail[] {
  return bindings.flatMap((binding) => {
    const field = fields.find((item) => item.bindVariable === binding)
    if (!field) return []
    const value = receiptValue(field, dataScope[binding]).trim()
    if (!value) return []
    return [{ binding, label: field.label || binding, value }]
  })
}

interface OptionPriceResult {
  value: number
  base: number
  additional: number
  missing?: string
}

export function optionPrice(option: PageFieldOption, references: ReferenceMap): OptionPriceResult {
  let base = 0
  if (option.priceReference) {
    const resolved = referenceNumber(option.priceReference, references)
    if (resolved.missing) return { value: 0, base: 0, additional: 0, missing: resolved.missing }
    base = resolved.value
  } else {
    base = Number(option.price ?? 0)
    if (!Number.isFinite(base)) base = 0
  }
  let additional = 0
  if (option.additionalPriceReference) {
    const resolved = referenceNumber(option.additionalPriceReference, references)
    if (resolved.missing) return { value: base, base, additional: 0, missing: resolved.missing }
    additional = resolved.value
  } else {
    additional = Number(option.additionalPrice ?? 0)
    if (!Number.isFinite(additional)) additional = 0
  }
  return { value: base + additional, base, additional }
}

function applyFormulaOperator(current: number, operator: FormulaOperator, value: number) {
  if (operator === 'set') return value
  if (operator === 'add') return current + value
  if (operator === 'subtract') return current - value
  if (operator === 'multiply') return current * value
  if (operator === 'divide') return value === 0 ? current : current / value
  if (operator === 'percent') return current + current * value
  return current
}

function formatNumericComputationValue(value: number, computation: FieldComputation) {
  if (!Number.isFinite(value)) return 0
  if (computation.numericType === 'integer') return Math.round(value)
  if (computation.numericType === 'decimal') {
    const places = Math.min(10, Math.max(0, Math.round(Number(computation.decimalPlaces ?? 2))))
    const factor = 10 ** places
    return Math.round((value + Number.EPSILON) * factor) / factor
  }
  return value
}

function formulaOperatorLabel(operator: FormulaOperator) {
  if (operator === 'set') return ''
  if (operator === 'add') return 'Add'
  if (operator === 'subtract') return 'Subtract'
  if (operator === 'multiply') return 'Multiply by'
  if (operator === 'divide') return 'Divide by'
  if (operator === 'concat') return 'Combine with'
  return 'Add percent'
}

function adjustmentLabel(
  type: 'add' | 'subtract' | 'multiply',
  reference: FormReference | undefined,
  key: string,
) {
  const label = reference?.label || reference?.key || key
  if (type === 'add') return `Add ${label}`
  if (type === 'subtract') return `Subtract ${label}`
  return `Multiply by ${label}`
}

function parseFormulaExpression(expression: string): NonNullable<FieldComputation['terms']> {
  const tokens = expression.match(/\+%|\{\{\s*[a-z][a-z0-9_]*\s*\}\}|[+\-*/]|-?\d+(?:\.\d+)?/gi) ?? []
  const terms: NonNullable<FieldComputation['terms']> = []
  let pendingOperator: FormulaOperator = 'set'

  for (const token of tokens) {
    if (token === '+') {
      pendingOperator = 'add'
      continue
    }
    if (token === '-') {
      pendingOperator = 'subtract'
      continue
    }
    if (token === '*') {
      pendingOperator = 'multiply'
      continue
    }
    if (token === '/') {
      pendingOperator = 'divide'
      continue
    }
    if (token.toLowerCase() === '+%') {
      pendingOperator = 'percent'
      continue
    }

    const referenceMatch = token.match(/^\{\{\s*([a-z][a-z0-9_]*)\s*\}\}$/i)
    if (referenceMatch) {
      terms.push({
        operator: terms.length === 0 ? 'set' : pendingOperator,
        source: 'field',
        fieldBinding: referenceMatch[1],
      })
      pendingOperator = 'add'
      continue
    }

    const fixedValue = Number(token)
    if (Number.isFinite(fixedValue)) {
      terms.push({
        operator: terms.length === 0 ? 'set' : pendingOperator,
        source: 'fixed',
        fixedValue,
      })
      pendingOperator = 'add'
    }
  }

  return terms
}

function unquoteTextLiteral(value: string) {
  const quote = value[0]
  const inner = value.slice(1, -1)
  return inner.replace(/\\(['"\\nrt])/g, (_match, escaped: string) => {
    if (escaped === 'n') return '\n'
    if (escaped === 'r') return '\r'
    if (escaped === 't') return '\t'
    return escaped === quote || escaped === '\\' ? escaped : `\\${escaped}`
  })
}

function parseTextExpression(expression: string): NonNullable<FieldComputation['terms']> {
  const tokenPattern = /\{\{\s*[a-z][a-z0-9_]*\s*\}\}|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\bconcat\b|\+/gi
  const tokens = expression.match(tokenPattern) ?? []
  const terms: NonNullable<FieldComputation['terms']> = []

  for (const token of tokens) {
    if (token === '+' || token.toLowerCase() === 'concat') continue
    const bindingMatch = token.match(/^\{\{\s*([a-z][a-z0-9_]*)\s*\}\}$/i)
    terms.push(bindingMatch
      ? {
          operator: terms.length === 0 ? 'set' : 'concat',
          source: 'field',
          fieldBinding: bindingMatch[1],
        }
      : {
          operator: terms.length === 0 ? 'set' : 'concat',
          source: 'fixed',
          fixedValue: unquoteTextLiteral(token),
        })
  }

  return terms
}

export function calculatePagePayment(
  page: Pick<FormPage, 'paymentAmountVariable' | 'paymentComputation'>,
  fields: PageField[],
  dataScope: Record<string, unknown>,
  references: FormReference[] = [],
): PaymentCalculation {
  const referenceMap = buildReferenceMap(references)
  const referencesByKey = new Map(references.map((reference) => [reference.key, reference]))
  const computation = page.paymentComputation
  const missingReferences = new Set<string>()
  const breakdown: PaymentBreakdownLine[] = []

  if (!computation || computation.mode === 'field') {
    const binding = page.paymentAmountVariable ?? computation?.fieldBindings?.[0] ?? null
    const field = fields.find((item) => item.bindVariable === binding)
    if (field?.fieldType === 'computation') {
      const computed = calculateFieldComputation(field.validationRules?.computation, fields, dataScope, references)
      const numValue = Number(computed.value)
      return {
        amount: Number.isFinite(numValue) ? numValue : 0,
        subtotal: computed.breakdown.find((line) => line.kind === 'subtotal')?.amount ?? numValue,
        breakdown: computed.breakdown.length > 0
          ? computed.breakdown
          : [{ label: field.label || 'Amount', amount: Number.isFinite(numValue) ? numValue : 0, kind: 'total' }],
        missingReferences: computed.missingReferences,
      }
    }
    if (
      field &&
      ['select', 'checkbox', 'radio'].includes(field.fieldType) &&
      field.validationRules?.optionPricesEnabled
    ) {
      let amount = 0
      const selected = selectedSet(dataScope[field.bindVariable])
      for (const option of field.options ?? []) {
        if (!selected.has(option.value)) continue
        const resolved = optionPrice(option, referenceMap)
        if (resolved.missing) missingReferences.add(resolved.missing)
        amount += resolved.value
        breakdown.push({
          label: option.label || field.label || binding || 'Selected option',
          amount: resolved.base,
          kind: 'item',
        })
        if (resolved.additional > 0) {
          breakdown.push({
            label: `${option.label || field.label || binding} additional`,
            amount: resolved.additional,
            kind: 'adjustment',
          })
        }
      }
      return {
        amount,
        subtotal: amount,
        breakdown: [...breakdown, { label: 'Total', amount, kind: 'total' }],
        missingReferences: [...missingReferences],
      }
    }
    if (!field && binding && referencesByKey.has(binding)) {
      const resolved = referenceNumber(binding, referenceMap)
      const reference = referencesByKey.get(binding)
      return {
        amount: resolved.value,
        subtotal: resolved.value,
        breakdown: [{
          label: reference?.label || reference?.key || binding,
          amount: resolved.value,
          kind: 'total',
        }],
        missingReferences: resolved.missing ? [resolved.missing] : [],
      }
    }
    const raw = binding ? dataScope[binding] : undefined
    const amount = Number(raw ?? 0)
    const safeAmount = Number.isFinite(amount) ? amount : 0
    return {
      amount: safeAmount,
      subtotal: safeAmount,
      breakdown: [{ label: field?.label || 'Amount', amount: safeAmount, kind: 'total' }],
      missingReferences: [],
    }
  }

  if (computation.mode === 'fixed') {
    const amount = Number(computation.fixedAmount ?? 0)
    const safeAmount = Number.isFinite(amount) ? amount : 0
    return {
      amount: safeAmount,
      subtotal: safeAmount,
      breakdown: [{ label: 'Fixed amount', amount: safeAmount, kind: 'total' }],
      missingReferences: [],
    }
  }

  const bindings = computation.fieldBindings ?? []
  let subtotal = 0

  if (computation.mode === 'sum_number_fields') {
    const numberBindings = bindings.length > 0
      ? bindings
      : fields
          .filter((field) => field.fieldType === 'number' || field.fieldType === 'computation')
          .map((field) => field.bindVariable)
    for (const binding of numberBindings) {
      const field = fields.find((item) => item.bindVariable === binding)
      if (field?.fieldType === 'computation') {
        const computed = calculateFieldComputation(field.validationRules?.computation, fields, dataScope, references)
        const numValue = Number(computed.value)
        const safeNum = Number.isFinite(numValue) ? numValue : 0
        subtotal += safeNum
        breakdown.push({ label: field.label || binding, amount: safeNum, kind: 'item' })
        computed.missingReferences.forEach((key) => missingReferences.add(key))
      } else {
        const raw = dataScope[binding]
        const value = Number(raw ?? 0)
        const safeValue = Number.isFinite(value) ? value : 0
        subtotal += safeValue
        breakdown.push({ label: field?.label || binding, amount: safeValue, kind: 'item' })
      }
    }
  } else if (computation.mode === 'sum_priced_options' || computation.mode === 'formula') {
    const pricedBindings = bindings.length > 0
      ? bindings
      : fields
          .filter((field) =>
            ['select', 'checkbox', 'radio'].includes(field.fieldType) &&
            field.validationRules?.optionPricesEnabled
          )
          .map((field) => field.bindVariable)
    for (const binding of pricedBindings) {
      const field = fields.find((item) => item.bindVariable === binding)
      if (!field) continue
      const selected = selectedSet(dataScope[binding])
      for (const option of field.options ?? []) {
        if (!selected.has(option.value)) continue
        const resolved = optionPrice(option, referenceMap)
        if (resolved.missing) missingReferences.add(resolved.missing)
        subtotal += resolved.value
        breakdown.push({ label: option.label || field.label || binding, amount: resolved.base, kind: 'item' })
        if (resolved.additional > 0) {
          breakdown.push({
            label: `${option.label || field.label || binding} additional`,
            amount: resolved.additional,
            kind: 'adjustment',
          })
        }
      }
    }
  }

  breakdown.push({ label: 'Subtotal', amount: subtotal, kind: 'subtotal' })
  let amount = subtotal

  if (computation.mode === 'formula') {
    for (const adjustment of computation.adjustments ?? []) {
      const resolved = referenceNumber(adjustment.referenceKey, referenceMap)
      if (resolved.missing) missingReferences.add(resolved.missing)
      let delta = resolved.value
      if (adjustment.type === 'multiply') {
        delta = amount * resolved.value
        amount += delta
      } else if (adjustment.type === 'subtract') {
        amount -= resolved.value
        delta = -resolved.value
      } else {
        amount += resolved.value
      }
      const reference = referencesByKey.get(adjustment.referenceKey)
      breakdown.push({
        label: adjustmentLabel(
          adjustment.type,
          reference,
          adjustment.referenceKey,
        ),
        amount: delta,
        kind: 'adjustment',
      })
    }
  }

  return {
    amount,
    subtotal,
    breakdown: [...breakdown, { label: 'Total', amount, kind: 'total' }],
    missingReferences: [...missingReferences],
  }
}

export function calculateFieldComputation(
  computation: FieldComputation | null | undefined,
  fields: PageField[],
  dataScope: Record<string, unknown>,
  references: FormReference[] = [],
  stack: string[] = [],
): ComputedFieldResult {
  if (!computation) return { value: 0, breakdown: [], missingReferences: [] }

  // ── Text mode: concatenate string values from bound fields ──
  if (computation.outputMode === 'text') {
    const useSyntax = computation.editorMode === 'syntax' ||
      (computation.editorMode == null && Boolean(computation.expression?.trim()))
    const terms = useSyntax && computation.expression?.trim()
      ? parseTextExpression(computation.expression)
      : computation.terms ?? []
    const referenceMap = buildReferenceMap(references)
    const referencesByKey = new Map(references.map((reference) => [reference.key, reference]))
    const missingReferences = new Set<string>()

    let result = ''
    for (const term of terms) {
      let value = ''
      if (term.source === 'field') {
        const binding = term.fieldBinding ?? ''
        const field = fields.find((item) => item.bindVariable === binding)
        const reference = referencesByKey.get(binding)
        if (field?.fieldType === 'computation' && !stack.includes(binding)) {
          const nested = calculateFieldComputation(
            field.validationRules?.computation,
            fields,
            dataScope,
            references,
            [...stack, binding],
          )
          value = String(nested.value ?? '')
          nested.missingReferences.forEach((key) => missingReferences.add(key))
        } else if (reference) {
          value = String(referenceMap[binding] ?? '')
        } else if (field || Object.hasOwn(dataScope, binding)) {
          const raw = dataScope[binding]
          value = Array.isArray(raw) ? raw.join(', ') : String(raw ?? '')
        } else {
          missingReferences.add(binding)
        }
      } else if (term.source === 'reference') {
        const key = term.referenceKey ?? ''
        if (referencesByKey.has(key)) value = String(referenceMap[key] ?? '')
        else if (key) missingReferences.add(key)
      } else if (term.source === 'fixed') {
        value = term.fixedValue != null ? String(term.fixedValue) : ''
      }
      result = term.operator === 'set' ? value : result + value
    }
    return { value: result, breakdown: [], missingReferences: [...missingReferences] }
  }

  // ── Number mode: existing logic ──
  if (computation.mode === 'expression') {
    const referenceMap = buildReferenceMap(references)
    const referencesByKey = new Map(references.map((reference) => [reference.key, reference]))
    const missingReferences = new Set<string>()
    const breakdown: PaymentBreakdownLine[] = []
    let amount = 0

    const useSyntax = computation.editorMode === 'syntax' ||
      (computation.editorMode == null && Boolean(computation.expression?.trim()))
    if (useSyntax && computation.expression?.includes('(')) {
      const variables: Record<string, number> = {}
      let variableIndex = 0
      const normalizedExpression = computation.expression.replace(
        /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/gi,
        (_match, binding: string) => {
          const variableName = `__ponko_calc_${variableIndex++}`
          const field = fields.find((item) => item.bindVariable === binding)
          const reference = referencesByKey.get(binding)
          let value = 0

          if (field?.fieldType === 'computation') {
            if (!stack.includes(field.bindVariable)) {
              const nested = calculateFieldComputation(
                field.validationRules?.computation,
                fields,
                dataScope,
                references,
                [...stack, field.bindVariable],
              )
              value = Number(nested.value)
              nested.missingReferences.forEach((key) => missingReferences.add(key))
            }
          } else if (
            field &&
            ['select', 'checkbox', 'radio'].includes(field.fieldType) &&
            field.validationRules?.optionPricesEnabled
          ) {
            const selected = selectedSet(dataScope[field.bindVariable])
            for (const option of field.options ?? []) {
              if (!selected.has(option.value)) continue
              const resolved = optionPrice(option, referenceMap)
              if (resolved.missing) missingReferences.add(resolved.missing)
              value += resolved.value
            }
          } else if (!field && reference) {
            const resolved = referenceNumber(binding, referenceMap)
            if (resolved.missing) missingReferences.add(resolved.missing)
            value = resolved.value
          } else if (field || Object.hasOwn(dataScope, binding)) {
            value = Number(dataScope[binding] ?? 0)
          } else {
            missingReferences.add(binding)
          }

          variables[variableName] = Number.isFinite(value) ? value : 0
          return variableName
        },
      )

      let evaluated = 0
      try {
        const result = evaluateSafeExpression(parseSafeExpression(normalizedExpression), variables)
        evaluated = typeof result === 'number' && Number.isFinite(result) ? result : 0
      } catch {
        evaluated = 0
      }
      const safeAmount = formatNumericComputationValue(Math.max(0, evaluated), computation)
      return {
        value: safeAmount,
        breakdown: [{ label: 'Formula result', amount: safeAmount, kind: 'total' }],
        missingReferences: [...missingReferences],
      }
    }
    const terms = useSyntax && computation.expression?.trim()
      ? parseFormulaExpression(computation.expression)
      : computation.terms ?? []
    for (const [index, term] of terms.entries()) {
      const operator = index === 0 ? 'set' : term.operator
      let value = 0
      let label = 'Value'
      let nestedBreakdown: PaymentBreakdownLine[] = []

      if (term.source === 'field') {
        const field = fields.find((item) => item.bindVariable === term.fieldBinding)
        const reference = referencesByKey.get(term.fieldBinding ?? '')
        label = field?.label || reference?.label || term.fieldBinding || 'Field'
        if (field?.fieldType === 'computation') {
          if (stack.includes(field.bindVariable)) {
            value = 0
          } else {
            const nested = calculateFieldComputation(
              field.validationRules?.computation,
              fields,
              dataScope,
              references,
              [...stack, field.bindVariable],
            )
            value = Number(nested.value)
            nestedBreakdown = nested.breakdown.filter((line) => line.kind !== 'total')
            nested.missingReferences.forEach((key) => missingReferences.add(key))
          }
        } else if (
          field &&
          ['select', 'checkbox', 'radio'].includes(field.fieldType) &&
          field.validationRules?.optionPricesEnabled
        ) {
          const selected = selectedSet(dataScope[field.bindVariable])
          for (const option of field.options ?? []) {
            if (!selected.has(option.value)) continue
            const resolved = optionPrice(option, referenceMap)
            if (resolved.missing) missingReferences.add(resolved.missing)
            value += resolved.value
            if (operator !== 'percent') {
              breakdown.push({ label: option.label || field.label || field.bindVariable, amount: resolved.base, kind: 'item' })
            }
            if (resolved.additional > 0 && operator !== 'percent') {
              breakdown.push({
                label: `${option.label || field.label || field.bindVariable} additional`,
                amount: resolved.additional,
                kind: 'adjustment',
              })
            }
          }
        } else if (!field && reference) {
          const resolved = referenceNumber(term.fieldBinding, referenceMap)
          if (resolved.missing) missingReferences.add(resolved.missing)
          value = resolved.value
        } else {
          value = Number(dataScope[term.fieldBinding ?? ''] ?? 0)
        }
      } else if (term.source === 'reference') {
        const resolved = referenceNumber(term.referenceKey, referenceMap)
        if (resolved.missing) missingReferences.add(resolved.missing)
        value = resolved.value
        const reference = referencesByKey.get(term.referenceKey ?? '')
        label = reference?.label || reference?.key || term.referenceKey || 'Reference'
      } else {
        value = Number(term.fixedValue ?? 0)
        label = 'Fixed amount'
      }

      const safeValue = Number.isFinite(value) ? value : 0
      const before = amount
      amount = applyFormulaOperator(amount, operator, safeValue)
      const displayedAmount = operator === 'percent'
        ? amount - before
        : operator === 'subtract'
          ? -safeValue
          : safeValue

      if (operator === 'set' && nestedBreakdown.length > 0) {
        breakdown.push(...nestedBreakdown)
      } else if (!(
        term.source === 'field' &&
        operator !== 'percent' &&
        fields.find((item) => item.bindVariable === term.fieldBinding)?.validationRules?.optionPricesEnabled &&
        ['select', 'checkbox', 'radio'].includes(fields.find((item) => item.bindVariable === term.fieldBinding)?.fieldType ?? '')
      )) {
        breakdown.push({
          label: operator === 'set' ? label : `${formulaOperatorLabel(operator)} ${label}`,
          amount: displayedAmount,
          kind: operator === 'set' ? 'item' : 'adjustment',
        })
      }
    }

    const safeAmount = formatNumericComputationValue(
      Number.isFinite(amount) ? Math.max(0, amount) : 0,
      computation,
    )
    if (breakdown.length > 0) {
      breakdown.push({ label: 'Total', amount: safeAmount, kind: 'total' })
    }
    return {
      value: safeAmount,
      breakdown,
      missingReferences: [...missingReferences],
    }
  }

  const calculation = calculatePagePayment(
    {
      paymentAmountVariable: null,
      paymentComputation: {
        mode: computation.mode,
        fieldBindings: computation.fieldBindings,
        adjustments: computation.adjustments,
        showBreakdown: computation.showBreakdown,
      },
    },
    fields,
    dataScope,
    references,
  )
  return {
    value: formatNumericComputationValue(calculation.amount, computation),
    breakdown: calculation.breakdown,
    missingReferences: calculation.missingReferences,
  }
}

export function applyComputedFieldValues(
  fields: PageField[],
  data: Record<string, unknown>,
  references: FormReference[] = [],
): Record<string, unknown> {
  const next = { ...data }
  const referenceMap = buildReferenceMap(references)
  const computationFields = fields.filter((field) => field.fieldType === 'computation')

  for (const field of computationFields) {
    const scope = { ...referenceMap, ...next }
    const result = calculateFieldComputation(field.validationRules?.computation, fields, scope, references)
    next[field.bindVariable] = result.value
  }

  return next
}
