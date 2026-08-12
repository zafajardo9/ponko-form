import { useState } from 'react'
import {
  buildReferenceMap,
  calculateFieldComputation,
} from '../../lib/page-builder/references'
import { parseSafeExpression } from '../../lib/flow-engine/safe-expression'
import type {
  FieldComputation,
  FormulaOperator,
  FormulaTermSource,
  FormReference,
  PageField,
} from '../../lib/page-builder/types'
import {
  Calculator,
  Check,
  Info,
  ListPlus,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Variable,
} from 'lucide-react'
import { FieldGroup, inputClass } from './Shared'

export function tempId() {
  return -Math.floor(Date.now() + Math.random() * 100000)
}

export function formulaToken(label: string, tone: 'source' | 'reference' | 'operator' | 'total' = 'source', key?: string) {
  const toneClass = {
    source: 'border-[#e6dfd8] bg-white text-[#141413]',
    reference: 'border-[#d8c8b7] bg-[#fff8ef] text-[#7a4b35]',
    operator: 'border-transparent bg-transparent px-0 text-[#8e8b82]',
    total: 'border-[#cc785c] bg-[#fff3ef] text-[#9d4f38]',
  }[tone]
  return (
    <span key={key ?? `${tone}-${label}`} className={`inline-flex min-h-8 items-center rounded-md border px-2.5 text-sm font-medium ${toneClass}`}>
      {label}
    </span>
  )
}

export function FormulaPreview({
  sourceFields,
  selectedBindings,
  adjustments,
  references,
}: {
  sourceFields: PageField[]
  selectedBindings: string[]
  adjustments: FieldComputation['adjustments']
  references: FormReference[]
}) {
  const selected = selectedBindings.length > 0
    ? sourceFields.filter((field) => selectedBindings.includes(field.bindVariable))
    : sourceFields
  const referencesByKey = new Map(references.map((reference) => [reference.key, reference]))
  const sourceLabel = selected.length === 0
    ? 'selected items'
    : selected.length === 1
      ? selected[0].label || selected[0].bindVariable
      : `${selected.length} selected fields`

  return (
    <div className="rounded-xl border border-[#e6dfd8] bg-white p-4">
      <p className="mb-3 text-xs font-medium uppercase text-[#8e8b82]">Formula</p>
      <div className="flex flex-wrap items-center gap-2">
        {formulaToken('Total', 'total', 'total')}
        {formulaToken('=', 'operator', 'equals')}
        {formulaToken(sourceLabel, 'source', 'source')}
        {(adjustments ?? []).map((adjustment, index) => {
          const reference = referencesByKey.get(adjustment.referenceKey)
          const label = reference?.label || reference?.key || adjustment.referenceKey || 'reference'
          if (adjustment.type === 'multiply') {
            return (
              <span key={`${adjustment.referenceKey}-${index}`} className="contents">
                {formulaToken('+', 'operator', `operator-${index}`)}
                {formulaToken(`(${index === 0 ? 'subtotal' : 'running total'} x ${label})`, 'reference', `reference-${index}`)}
              </span>
            )
          }
          return (
            <span key={`${adjustment.referenceKey}-${index}`} className="contents">
              {formulaToken(adjustment.type === 'subtract' ? '-' : '+', 'operator', `operator-${index}`)}
              {formulaToken(label, 'reference', `reference-${index}`)}
            </span>
          )
        })}
      </div>
      <p className="mt-3 text-xs text-[#8e8b82]">
        Percent references such as VAT are added as a percentage of the current running total.
      </p>
    </div>
  )
}

export function computationSourceFields(fields: PageField[], currentFieldId: number, mode: FieldComputation['mode']) {
  if (mode === 'sum_number_fields') {
    return fields.filter((field) =>
      field.id !== currentFieldId &&
      (field.fieldType === 'number' ||
        (field.fieldType === 'computation' && field.validationRules?.computation?.outputMode !== 'text')),
    )
  }
  return fields.filter((field) =>
    field.id !== currentFieldId &&
    ['select', 'checkbox', 'radio'].includes(field.fieldType) &&
    field.validationRules?.optionPricesEnabled &&
    field.options?.some((option) =>
      Number(option.price ?? 0) > 0 ||
      Number(option.additionalPrice ?? 0) > 0 ||
      Boolean(option.priceReference) ||
      Boolean(option.additionalPriceReference),
    ),
  )
}

export function computationFormulaFields(
  fields: PageField[],
  currentField: PageField,
  outputMode: FieldComputation['outputMode'] = 'number',
) {
  return fields.filter((field) =>
    field.id !== currentField.id &&
    (outputMode === 'text' ? fieldCanProvideTextValue(field) : fieldCanProvideFormulaValue(field)),
  )
}

export function formulaOperatorSymbol(operator: FormulaOperator) {
  if (operator === 'set') return '='
  if (operator === 'add') return '+'
  if (operator === 'subtract') return '-'
  if (operator === 'multiply') return 'x'
  if (operator === 'divide') return '/'
  if (operator === 'concat') return 'combine'
  return '+%'
}

export function formulaTermLabel(
  term: NonNullable<FieldComputation['terms']>[number],
  fields: PageField[],
) {
  if (term.source === 'field') {
    const field = fields.find((item) => item.bindVariable === term.fieldBinding)
    return field ? `{{${field.bindVariable}}}` : '{{field}}'
  }
  if (term.source === 'reference') return term.referenceKey ? `{{${term.referenceKey}}}` : '{{reference}}'
  return String(term.fixedValue ?? 0)
}

export function ExpressionPreview({
  field,
  expression,
  terms,
  fields,
}: {
  field: PageField
  expression?: string | null
  terms: NonNullable<FieldComputation['terms']>
  fields: PageField[]
}) {
  const expressionTokens = expression?.trim()
  return (
    <div className="rounded-xl border border-[#e6dfd8] bg-white p-4">
      <p className="mb-3 text-xs font-medium uppercase text-[#8e8b82]">Formula</p>
      <div className="flex flex-wrap items-center gap-2">
        {formulaToken(`{{${field.bindVariable}}}`, 'total', 'target')}
        {formulaToken('=', 'operator', 'equals')}
        {expressionTokens ? (
          <span className="rounded-md border border-[#e6dfd8] bg-white px-2.5 py-1.5 font-mono text-sm text-[#141413]">
            {expressionTokens}
          </span>
        ) : terms.length === 0 ? (
          formulaToken('Add fields or references', 'source', 'empty')
        ) : (
          terms.map((term, index) => (
            <span key={term.id ?? index} className="contents">
              {index > 0 && formulaToken(formulaOperatorSymbol(term.operator), 'operator', `operator-${index}`)}
              {formulaToken(formulaTermLabel(term, fields), term.source === 'reference' ? 'reference' : 'source', `term-${index}`)}
            </span>
          ))
        )}
      </div>
    </div>
  )
}

export function FormulaComposer({
  field,
  fields,
  references,
  expression,
  outputMode,
  onChange,
}: {
  field: PageField
  fields: PageField[]
  references: FormReference[]
  expression: string
  outputMode: FieldComputation['outputMode']
  onChange: (expression: string) => void
}) {
  const [variableSearch, setVariableSearch] = useState('')
  const availableFields = computationFormulaFields(fields, field, outputMode)
  const availableReferences = references.filter((reference) =>
    outputMode === 'text' || reference.type === 'number' || reference.type === 'percentage',
  )
  const variableItems = [
    ...availableFields.map((item) => ({
      key: `field-${item.id}`,
      label: item.label || item.bindVariable,
      binding: item.bindVariable,
      kind: item.fieldType === 'computation' ? 'Calculated' : item.fieldType === 'number' ? 'Number' : item.fieldType === 'email' ? 'Email' : 'Answer',
      source: item.fieldType === 'computation' ? 'Calculated values' : 'Form answers',
      token: `{{${item.bindVariable}}}`,
    })),
    ...availableReferences.map((reference) => ({
      key: `reference-${reference.id}`,
      label: reference.label || reference.key,
      binding: reference.key,
      kind: reference.type === 'percentage' ? 'Percent' : reference.type === 'number' ? 'Number' : reference.type === 'boolean' ? 'True/false' : 'Text',
      source: 'References',
      token: `{{${reference.key}}}`,
    })),
  ].filter((item) => {
    const query = variableSearch.trim().toLowerCase()
    return !query || `${item.label} ${item.binding} ${item.kind}`.toLowerCase().includes(query)
  })

  function append(value: string) {
    onChange(`${expression}${expression.trim() ? ' ' : ''}${value}`.trimStart())
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#d9d0c5] bg-white">
      <div className="border-b border-[#e6dfd8] bg-[#faf9f5] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#141413]">Formula syntax</p>
            <p className="mt-1 text-xs leading-5 text-[#746f68]">
          {outputMode === 'text'
            ? <>Combine bindings like {`{{first_name}}`} with quoted text such as <span className="font-mono">" "</span>.</>
            : <>Use bindings like {`{{subtotal}}`} and references like {`{{vat_rate}}`}.</>}
            </p>
          </div>
          <span className="rounded-full border border-[#d9d0c5] bg-white px-2.5 py-1 font-mono text-[11px] text-[#746f68]">
            {outputMode === 'text' ? 'text formula' : 'numeric formula'}
          </span>
        </div>
      </div>
      <div className="p-4">
        <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[#746f68]" htmlFor={`formula-${field.id}`}>
          Formula
        </label>
        <textarea
          id={`formula-${field.id}`}
          value={expression}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          spellCheck={false}
          className="mt-2 min-h-28 w-full resize-y rounded-xl border border-[#d9d0c5] bg-[#1f2421] px-4 py-3 font-mono text-sm leading-7 text-[#f8f3ea] outline-none transition-shadow placeholder:text-[#89908a] focus:border-[#cc785c] focus:ring-4 focus:ring-[#cc785c]/15"
          placeholder={outputMode === 'text'
            ? '{{first_name}} concat " " concat {{last_name}}'
            : '({{subtotal}} +% {{vat_rate}}) + {{processing_fee}}'}
        />
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Formula operators">
          {(outputMode === 'text'
            ? [['concat', 'Combine text']]
            : [
                ['+', 'Add'],
                ['-', 'Subtract'],
                ['*', 'Multiply'],
                ['/', 'Divide'],
                ['+%', 'Add percent'],
              ]).map(([symbol, label]) => (
            <button
              key={symbol}
              type="button"
              onClick={() => append(symbol)}
              className="rounded-md border border-[#ded6cd] bg-[#faf9f5] px-2.5 py-1.5 text-xs font-medium text-[#4f4a44] transition-colors hover:border-[#cc785c] hover:bg-[#fff6f0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]"
            >
              <span className="font-mono text-[#a9583e]">{symbol}</span>
              <span className="ml-1.5">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-[#e6dfd8] bg-[#faf9f5] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#141413]">Insert a variable</p>
            <p className="mt-0.5 text-xs text-[#746f68]">Only variables compatible with this output are shown.</p>
          </div>
          <label className="relative block sm:w-64">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8e8b82]" />
            <span className="sr-only">Search variables</span>
            <input
              value={variableSearch}
              onChange={(event) => setVariableSearch(event.target.value)}
              placeholder="Search variables"
              className="h-9 w-full rounded-lg border border-[#ded6cd] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/15"
            />
          </label>
        </div>
        {variableItems.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-[#d9d0c5] bg-white px-4 py-6 text-center">
            <Variable size={18} className="mx-auto text-[#b2aca4]" />
            <p className="mt-2 text-sm font-medium text-[#5f5a53]">No matching variables</p>
            <p className="mt-1 text-xs text-[#8e8b82]">Add a compatible field or clear the search.</p>
          </div>
        ) : (
          <div className="mt-3 grid max-h-56 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {variableItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => append(item.token)}
                className="group flex min-w-0 items-center gap-3 rounded-lg border border-[#e1d9d0] bg-white px-3 py-2.5 text-left transition-colors hover:border-[#cc785c] hover:bg-[#fff8f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]"
              >
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-[#f3ece5] text-[#a9583e]">
                  {item.source === 'Calculated values' ? <Calculator size={15} /> : item.source === 'References' ? <Variable size={15} /> : <ListPlus size={15} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-[#2e2b28]">{item.label}</span>
                  <span className="block truncate font-mono text-[11px] text-[#8e8b82]">{`{{${item.binding}}}`}</span>
                </span>
                <span className="flex-none rounded-full bg-[#f1efeb] px-2 py-0.5 text-[10px] font-medium text-[#746f68]">{item.kind}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function checkFormulaExpression(
  expression: string,
  currentField: PageField,
  fields: PageField[],
  references: FormReference[],
  outputMode: FieldComputation['outputMode'] = 'number',
) {
  const errors: string[] = []
  const warnings: string[] = []
  const trimmed = expression.trim()
  const fieldBindings = new Set(fields.map((item) => item.bindVariable))
  const referencesByKey = new Map(references.map((reference) => [reference.key, reference]))
  const textMode = outputMode === 'text'
  const tokenPattern = textMode
    ? /\{\{\s*[a-z][a-z0-9_]*\s*\}\}|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\bconcat\b|\+/gi
    : /\+%|\{\{\s*[a-z][a-z0-9_]*\s*\}\}|[()+\-*/]|-?\d+(?:\.\d+)?/gi
  const tokens = trimmed.match(tokenPattern) ?? []

  if (!trimmed) {
    warnings.push(textMode
      ? 'Add at least one field, reference, or quoted text value.'
      : 'Add at least one field, reference, or fixed number.')
    return { errors, warnings }
  }

  const leftovers = trimmed.replace(tokenPattern, '').replace(/\s+/g, '')
  if (leftovers) {
    errors.push(`Unsupported text in formula: "${leftovers}".`)
  }

  let expectingValue = true
  let valueCount = 0
  let lastOperator = ''
  for (const token of tokens) {
    if (!textMode && (token === '(' || token === ')')) continue
    const isOperator = textMode
      ? token === '+' || token.toLowerCase() === 'concat'
      : ['+', '-', '*', '/', '+%'].includes(token)
    if (isOperator) {
      if (expectingValue) {
        errors.push(`Operator "${token}" needs a value before it.`)
      }
      expectingValue = true
      lastOperator = token
      continue
    }

    if (!expectingValue) {
      errors.push(`Missing an operator before "${token}".`)
    }
    expectingValue = false
    valueCount += 1

    const bindingMatch = token.match(/^\{\{\s*([a-z][a-z0-9_]*)\s*\}\}$/i)
    if (bindingMatch) {
      const key = bindingMatch[1]
      if (key === currentField.bindVariable) {
        errors.push(`This formula cannot reference itself: {{${key}}}.`)
      } else if (!fieldBindings.has(key) && !referencesByKey.has(key)) {
        errors.push(`Unknown field or reference: {{${key}}}.`)
      } else {
        const reference = referencesByKey.get(key)
        if (!textMode && reference && !['number', 'percentage'].includes(reference.type)) {
          errors.push(`Reference {{${key}}} is ${reference.type}; formulas need number or percentage references.`)
        }
      }
      continue
    }

    if (textMode) continue
    const numberValue = Number(token)
    if (!Number.isFinite(numberValue)) {
      errors.push(`Invalid number: ${token}.`)
    }
    if (lastOperator === '/' && numberValue === 0) {
      errors.push('Formula divides by zero.')
    }
  }

  if (valueCount === 0) {
    errors.push('Formula needs at least one value.')
  }
  if (expectingValue && tokens.length > 0) {
    errors.push('Formula ends with an operator.')
  }

  if (!textMode && !leftovers) {
    try {
      parseSafeExpression(trimmed.replace(/\{\{\s*[a-z][a-z0-9_]*\s*\}\}/gi, '1'))
    } catch (error) {
      errors.push(`Invalid formula: ${error instanceof Error ? error.message : 'Check the parentheses and operators'}.`)
    }
  }

  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] }
}

export function fieldCanProvideFormulaValue(field: PageField) {
  return field.fieldType === 'number' ||
    field.fieldType === 'satisfaction' ||
    (field.fieldType === 'computation' && field.validationRules?.computation?.outputMode !== 'text') ||
    (['select', 'checkbox', 'radio'].includes(field.fieldType) && Boolean(field.validationRules?.optionPricesEnabled))
}

export function fieldCanProvideTextValue(field: PageField) {
  return !['content', 'media', 'address', 'recaptcha', 'file_upload'].includes(field.fieldType)
}

export function expressionFieldBindings(expression: string) {
  return [...expression.matchAll(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/gi)].map((match) => match[1])
}

export function computationFieldDependencies(field: PageField) {
  const computation = field.validationRules?.computation
  if (!computation) return []
  const useSyntax = computation.editorMode === 'syntax' ||
    (computation.editorMode == null && Boolean(computation.expression?.trim()))
  if (computation.mode === 'expression' && useSyntax && computation.expression?.trim()) {
    return expressionFieldBindings(computation.expression)
  }
  if (computation.mode === 'expression') {
    return (computation.terms ?? [])
      .flatMap((term) =>
        term.source === 'field' && term.fieldBinding ? [term.fieldBinding] : [],
      )
  }
  return computation.fieldBindings ?? []
}

export function hasComputationCycle(currentField: PageField, fields: PageField[]) {
  const byBinding = new Map(fields.map((field) => [field.bindVariable, field]))

  function visit(binding: string, seen: Set<string>): boolean {
    if (binding === currentField.bindVariable) return true
    if (seen.has(binding)) return false
    const field = byBinding.get(binding)
    if (!field || field.fieldType !== 'computation') return false
    const nextSeen = new Set(seen)
    nextSeen.add(binding)
    return computationFieldDependencies(field).some((nextBinding) => visit(nextBinding, nextSeen))
  }

  return computationFieldDependencies(currentField).some((binding) => visit(binding, new Set([currentField.bindVariable])))
}

export function checkComputationBlock(
  computation: FieldComputation,
  currentField: PageField,
  fields: PageField[],
  references: FormReference[],
) {
  const errors: string[] = []
  const warnings: string[] = []
  const mode = computation.mode ?? 'expression'
  const compatibleFormulaFields = computationFormulaFields(fields, currentField, computation.outputMode)
  const compatiblePricedFields = computationSourceFields(fields, currentField.id, 'sum_priced_options')
  const compatibleNumberFields = computationSourceFields(fields, currentField.id, 'sum_number_fields')
  const fieldByBinding = new Map(fields.map((field) => [field.bindVariable, field]))
  const referenceByKey = new Map(references.map((reference) => [reference.key, reference]))

  if (!currentField.bindVariable) {
    errors.push('This computation block needs a binding so other fields and payment can reference it.')
  }

  if (mode === 'expression') {
    const useSyntax = computation.editorMode === 'syntax' ||
      (computation.editorMode == null && Boolean(computation.expression?.trim()))
    if (useSyntax && computation.expression?.trim()) {
      const expressionCheck = checkFormulaExpression(
        computation.expression,
        currentField,
        compatibleFormulaFields,
        references,
        computation.outputMode,
      )
      errors.push(...expressionCheck.errors)
      warnings.push(...expressionCheck.warnings)
    } else if (useSyntax) {
      warnings.push(computation.outputMode === 'text'
        ? 'Write a formula using variables and quoted text.'
        : 'Write a formula using variables, references, or numbers.')
    } else {
      const terms = computation.terms ?? []
      if (terms.length === 0) {
        errors.push('Add a formula, formula row, field, reference, or fixed number.')
      }
      for (const [index, term] of terms.entries()) {
        if (index > 0 && !term.operator) errors.push(`Formula row ${index + 1} needs an operation.`)
        if (term.source === 'field') {
          if (!term.fieldBinding) {
            errors.push(`Formula row ${index + 1} needs a field binding.`)
          } else if (term.fieldBinding === currentField.bindVariable) {
            errors.push(`Formula row ${index + 1} cannot reference this computation block itself.`)
          } else {
            const field = fieldByBinding.get(term.fieldBinding)
            if (!field) errors.push(`Formula row ${index + 1} references missing field {{${term.fieldBinding}}}.`)
            else if (computation.outputMode === 'text'
              ? !fieldCanProvideTextValue(field)
              : !fieldCanProvideFormulaValue(field)) {
              errors.push(computation.outputMode === 'text'
                ? `Formula row ${index + 1} uses {{${term.fieldBinding}}}, but that field cannot provide text.`
                : `Formula row ${index + 1} uses {{${term.fieldBinding}}}, but that field cannot provide a numeric value.`)
            }
          }
        }
        if (term.source === 'reference') {
          if (!term.referenceKey) {
            errors.push(`Formula row ${index + 1} needs a reference.`)
          } else {
            const reference = referenceByKey.get(term.referenceKey)
            if (!reference) errors.push(`Formula row ${index + 1} references missing reference {{${term.referenceKey}}}.`)
            else if (computation.outputMode !== 'text' && !['number', 'percentage'].includes(reference.type)) {
              errors.push(`Formula row ${index + 1} uses {{${term.referenceKey}}}, but formulas need number or percentage references.`)
            }
          }
        }
        if (computation.outputMode !== 'text' && term.source === 'fixed' && !Number.isFinite(Number(term.fixedValue ?? 0))) {
          errors.push(`Formula row ${index + 1} has an invalid fixed number.`)
        }
        if (computation.outputMode !== 'text' && term.operator === 'divide' && term.source === 'fixed' && Number(term.fixedValue ?? 0) === 0) {
          errors.push(`Formula row ${index + 1} divides by zero.`)
        }
        if (computation.outputMode === 'text' && index > 0 && term.operator !== 'concat' && term.operator !== 'add') {
          errors.push(`Text row ${index + 1} must use Combine.`)
        }
      }
    }
  }

  if (mode === 'sum_priced_options' || mode === 'formula') {
    const selected = computation.fieldBindings ?? []
    if (compatiblePricedFields.length === 0) {
      errors.push('No priced option fields are available. Enable option prices on a checkbox, radio, or dropdown field first.')
    }
    for (const binding of selected) {
      const field = fieldByBinding.get(binding)
      if (!field) errors.push(`Selected priced field {{${binding}}} no longer exists.`)
      else if (!compatiblePricedFields.some((item) => item.bindVariable === binding)) {
        errors.push(`Selected field {{${binding}}} is not a priced option field.`)
      }
    }
    if (selected.length === 0 && compatiblePricedFields.length > 0) {
      warnings.push('No specific priced fields selected; this block will use all available priced option fields.')
    }
  }

  if (mode === 'sum_number_fields') {
    const selected = computation.fieldBindings ?? []
    if (compatibleNumberFields.length === 0) {
      errors.push('No number or computation fields are available to sum.')
    }
    for (const binding of selected) {
      const field = fieldByBinding.get(binding)
      if (!field) errors.push(`Selected number field {{${binding}}} no longer exists.`)
      else if (!compatibleNumberFields.some((item) => item.bindVariable === binding)) {
        errors.push(`Selected field {{${binding}}} is not a number or computation field.`)
      }
    }
    if (selected.length === 0 && compatibleNumberFields.length > 0) {
      warnings.push('No specific number fields selected; this block will use all available number and computation fields.')
    }
  }

  if (mode === 'formula') {
    for (const adjustment of computation.adjustments ?? []) {
      const reference = referenceByKey.get(adjustment.referenceKey)
      if (!adjustment.referenceKey) errors.push('Formula adjustment needs a reference.')
      else if (!reference) errors.push(`Formula adjustment references missing reference {{${adjustment.referenceKey}}}.`)
      else if (!['number', 'percentage'].includes(reference.type)) {
        errors.push(`Formula adjustment {{${adjustment.referenceKey}}} must be a number or percentage reference.`)
      }
    }
  }

  if (hasComputationCycle(currentField, fields)) {
    errors.push('This computation has a circular dependency with another computation block.')
  }

  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] }
}

export function ExpressionBuilder({
  field,
  fields,
  references,
  terms,
  outputMode,
  onChange,
}: {
  field: PageField
  fields: PageField[]
  references: FormReference[]
  terms: NonNullable<FieldComputation['terms']>
  outputMode: FieldComputation['outputMode']
  onChange: (terms: NonNullable<FieldComputation['terms']>) => void
}) {
  const availableFields = computationFormulaFields(fields, field, outputMode)
  const availableReferences = references.filter((reference) =>
    outputMode === 'text' || reference.type === 'number' || reference.type === 'percentage',
  )

  function updateTerm(index: number, patch: Partial<NonNullable<FieldComputation['terms']>[number]>) {
    onChange(terms.map((term, termIndex) => (termIndex === index ? { ...term, ...patch } : term)))
  }

  function addTerm() {
    onChange([
      ...terms,
      {
        id: tempId().toString(),
        operator: terms.length === 0 ? 'set' : outputMode === 'text' ? 'concat' : 'add',
        source: availableFields.length > 0 ? 'field' : availableReferences.length > 0 ? 'reference' : 'fixed',
        fieldBinding: availableFields[0]?.bindVariable ?? null,
        referenceKey: availableFields.length === 0 ? availableReferences[0]?.key ?? null : null,
        fixedValue: outputMode === 'text' ? '' : 0,
      },
    ])
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#d9d0c5] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#e6dfd8] bg-[#faf9f5] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#141413]">Visual formula</p>
          <p className="mt-1 text-xs leading-5 text-[#746f68]">
            Build the result one step at a time. Each row continues from the value above it.
          </p>
        </div>
        <button
          type="button"
          onClick={addTerm}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#2f3933] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#202923] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] sm:self-auto"
        >
          <Plus size={14} /> Add step
        </button>
      </div>

      {terms.length === 0 ? (
        <button
          type="button"
          onClick={addTerm}
          className="m-4 flex w-[calc(100%-2rem)] flex-col items-center rounded-xl border border-dashed border-[#cfc5ba] bg-[#faf9f5] px-5 py-10 text-center transition-colors hover:border-[#cc785c] hover:bg-[#fff8f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#efe6de] text-[#a9583e]">
            <Sparkles size={19} />
          </span>
          <span className="mt-3 text-sm font-semibold text-[#3d3935]">Start with a value</span>
          <span className="mt-1 max-w-sm text-xs leading-5 text-[#7d766f]">
            Choose a form answer, another calculated value, a reference, or a fixed {outputMode === 'text' ? 'piece of text' : 'number'}.
          </span>
        </button>
      ) : (
        <div className="flex flex-col gap-3 p-4">
          {terms.map((term, index) => (
            <div key={term.id ?? index} className="relative rounded-xl border border-[#e1d9d0] bg-[#faf9f5] p-3 pl-12 sm:p-4 sm:pl-14">
              <span className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-[#2f3933] text-xs font-semibold text-white sm:left-4 sm:top-4">
                {index + 1}
              </span>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[130px_150px_minmax(0,1fr)_40px] lg:items-end">
                <FieldGroup label={index === 0 ? 'Begin with' : 'Operation'}>
                  <select
                    aria-label={`Step ${index + 1} operation`}
                    value={index === 0 ? 'set' : term.operator}
                    onChange={(e) => updateTerm(index, { operator: e.target.value as FormulaOperator })}
                    disabled={index === 0}
                    className={inputClass}
                  >
                    <option value="set">Start</option>
                    {outputMode === 'text' ? (
                      <option value="concat">Combine with</option>
                    ) : (
                      <>
                        <option value="add">Add</option>
                        <option value="subtract">Subtract</option>
                        <option value="multiply">Multiply by</option>
                        <option value="divide">Divide by</option>
                        <option value="percent">Add percent</option>
                      </>
                    )}
                  </select>
                </FieldGroup>
                <FieldGroup label="Value source">
                  <select
                    aria-label={`Step ${index + 1} source`}
                    value={term.source}
                    onChange={(e) => {
                      const source = e.target.value as FormulaTermSource
                      updateTerm(index, {
                        source,
                        fieldBinding: source === 'field' ? availableFields[0]?.bindVariable ?? null : null,
                        referenceKey: source === 'reference' ? availableReferences[0]?.key ?? null : null,
                        fixedValue: source === 'fixed' ? term.fixedValue ?? (outputMode === 'text' ? '' : 0) : null,
                      })
                    }}
                    className={inputClass}
                  >
                    <option value="field">Form variable</option>
                    <option value="reference">Reference</option>
                    <option value="fixed">{outputMode === 'text' ? 'Fixed text' : 'Fixed number'}</option>
                  </select>
                </FieldGroup>
                <FieldGroup label={term.source === 'field' ? 'Variable' : term.source === 'reference' ? 'Reference' : outputMode === 'text' ? 'Text' : 'Number'}>
                  {term.source === 'field' ? (
                    <select
                      aria-label={`Step ${index + 1} variable`}
                      value={term.fieldBinding ?? ''}
                      onChange={(e) => updateTerm(index, { fieldBinding: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">Select a compatible variable...</option>
                      {availableFields.map((item) => (
                        <option key={item.id} value={item.bindVariable}>
                          {item.label || item.bindVariable} {`{{${item.bindVariable}}}`}
                        </option>
                      ))}
                    </select>
                  ) : term.source === 'reference' ? (
                    <select
                      aria-label={`Step ${index + 1} reference`}
                      value={term.referenceKey ?? ''}
                      onChange={(e) => updateTerm(index, { referenceKey: e.target.value })}
                      className={inputClass}
                    >
                      <option value="">Select a compatible reference...</option>
                      {availableReferences.map((reference) => (
                        <option key={reference.id} value={reference.key}>
                          {reference.label || reference.key} {`{{${reference.key}}}`} = {reference.value}
                        </option>
                      ))}
                    </select>
                  ) : outputMode === 'text' ? (
                    <input
                      type="text"
                      aria-label={`Step ${index + 1} fixed text`}
                      value={String(term.fixedValue ?? '')}
                      placeholder="Text to combine"
                      onChange={(e) => updateTerm(index, { fixedValue: e.target.value })}
                      className={inputClass}
                    />
                  ) : (
                    <input
                      type="number"
                      aria-label={`Step ${index + 1} fixed number`}
                      step="any"
                      value={term.fixedValue ?? 0}
                      onChange={(e) => updateTerm(index, { fixedValue: Number(e.target.value) })}
                      className={inputClass}
                    />
                  )}
                </FieldGroup>
                <button
                  type="button"
                  onClick={() => onChange(terms.filter((_, termIndex) => termIndex !== index))}
                  className="flex h-10 w-full items-center justify-center rounded-lg text-[#b24b42] transition-colors hover:bg-[#fff0ec] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c64545] lg:w-10"
                  aria-label={`Remove step ${index + 1}`}
                  title="Remove step"
                >
                  <Trash2 size={16} />
                  <span className="ml-2 text-xs font-medium lg:hidden">Remove step</span>
                </button>
              </div>
              {index < terms.length - 1 && (
                <span className="absolute -bottom-3 left-[25px] h-3 w-px bg-[#cfc5ba] sm:left-[29px]" aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export type ComputationOutputChoice = 'automatic' | 'integer' | 'decimal' | 'text'

export function computationOutputChoice(computation: FieldComputation): ComputationOutputChoice {
  if (computation.outputMode === 'text') return 'text'
  return computation.numericType ?? 'automatic'
}

export function sampleValueForField(field: PageField): unknown {
  if (field.fieldType === 'number') return 12.5
  if (field.fieldType === 'satisfaction') return Number(field.options?.[0]?.value ?? 5)
  if (field.fieldType === 'checkbox') return field.options?.[0] ? [field.options[0].value] : []
  if (field.fieldType === 'select' || field.fieldType === 'radio') return field.options?.[0]?.value ?? ''
  if (field.fieldType === 'email') return 'alex@example.com'
  if (field.fieldType === 'date') return '2026-07-24'
  if (field.fieldType === 'time') return '09:30'
  if (field.fieldType === 'datetime') return '2026-07-24T09:30'
  if (field.fieldType === 'text' || field.fieldType === 'textarea') return field.label ? `Sample ${field.label.toLowerCase()}` : 'Sample text'
  return ''
}

export function computationPreview(
  computation: FieldComputation,
  currentField: PageField,
  fields: PageField[],
  references: FormReference[],
) {
  const sampleData = Object.fromEntries(
    fields
      .filter((item) => item.id !== currentField.id && item.fieldType !== 'computation')
      .map((item) => [item.bindVariable, sampleValueForField(item)]),
  )
  const scope = { ...buildReferenceMap(references), ...sampleData }
  return calculateFieldComputation(
    computation,
    fields,
    scope,
    references,
    [currentField.bindVariable],
  )
}

export function ComputationResultConsole({
  field,
  computation,
  preview,
  check,
}: {
  field: PageField
  computation: FieldComputation
  preview: ReturnType<typeof computationPreview>
  check: { errors: string[]; warnings: string[] }
}) {
  const isText = computation.outputMode === 'text'
  const numericValue = Number(preview.value)
  const displayValue = isText
    ? String(preview.value || 'Your text result')
    : Number.isFinite(numericValue)
      ? new Intl.NumberFormat(undefined, {
          minimumFractionDigits: computation.numericType === 'decimal' ? computation.decimalPlaces ?? 2 : 0,
          maximumFractionDigits: computation.numericType === 'integer' ? 0 : computation.numericType === 'decimal' ? computation.decimalPlaces ?? 2 : 10,
        }).format(numericValue)
      : '0'
  const outputLabel = isText
    ? 'Text'
    : computation.numericType === 'integer'
      ? 'Whole number'
      : computation.numericType === 'decimal'
        ? `Decimal · ${computation.decimalPlaces ?? 2} places`
        : 'Number · automatic precision'

  return (
    <aside className="space-y-4 lg:sticky lg:top-0">
      <section className="overflow-hidden rounded-xl border border-[#36423b] bg-[#26312b] text-white shadow-[0_16px_40px_rgba(35,43,38,0.12)]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-[#efb79f]" />
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#d9dfdb]">Result preview</p>
          </div>
          <span className={`h-2 w-2 rounded-full ${check.errors.length > 0 ? 'bg-[#f08b78]' : 'bg-[#8bc48d]'}`} />
        </div>
        <div className="p-5">
          <p className="text-xs text-[#aeb8b2]">Illustrative result</p>
          <p className={`mt-2 break-words font-semibold tracking-tight ${isText ? 'text-2xl leading-8' : 'text-4xl tabular-nums'}`}>
            {displayValue}
          </p>
          <div className="mt-5 space-y-2 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-[#aeb8b2]">Saved as</span>
              <span className="font-medium text-white">{outputLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-[#aeb8b2]">Variable</span>
              <code className="max-w-[65%] truncate rounded bg-white/10 px-2 py-1 text-[#f7d8c9]">{`{{${field.bindVariable || 'calculated_value'}}}`}</code>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[#ddd4ca] bg-white p-4">
        <p className="text-sm font-semibold text-[#292622]">Calculation health</p>
        <div className={`mt-3 flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs leading-5 ${
          check.errors.length > 0
            ? 'bg-[#fff0ec] text-[#9f3f35]'
            : check.warnings.length > 0
              ? 'bg-[#fff8e8] text-[#765b2d]'
              : 'bg-[#eef8ed] text-[#3f7042]'
        }`}>
          {check.errors.length > 0 ? <Info size={15} className="mt-0.5 flex-none" /> : <Check size={15} className="mt-0.5 flex-none" />}
          <div>
            <p className="font-semibold">
              {check.errors.length > 0 ? `${check.errors.length} item${check.errors.length === 1 ? '' : 's'} to fix` : check.warnings.length > 0 ? 'Ready with a note' : 'Ready to calculate'}
            </p>
            <p className="mt-0.5">
              {check.errors[0] ?? check.warnings[0] ?? 'The result updates whenever a source answer changes.'}
            </p>
          </div>
        </div>
        {check.errors.length + check.warnings.length > 1 && (
          <ul className="mt-3 space-y-1.5 text-xs leading-5 text-[#746f68]">
            {[...check.errors.slice(1), ...check.warnings.slice(check.errors.length > 0 ? 0 : 1)].map((message) => (
              <li key={message} className="flex gap-2">
                <span className="mt-2 h-1 w-1 flex-none rounded-full bg-[#b2aaa2]" />
                <span>{message}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="px-1 text-xs leading-5 text-[#8e8b82]">
        Preview uses example answers and your current reference values. The published form recalculates with each respondent’s answers.
      </p>
    </aside>
  )
}
