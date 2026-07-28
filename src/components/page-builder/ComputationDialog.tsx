import type {
  FieldComputation,
  FormReference,
  PageField,
} from '../../lib/page-builder/types'
import {
  Calculator,
  CheckSquare,
  Eye,
  EyeOff,
  Hash,
  List,
  ListPlus,
  Sparkles,
  Type,
} from 'lucide-react'
import { FieldDialog, inputClass } from './Shared'
import {
  checkComputationBlock,
  computationOutputChoice,
  computationPreview,
  computationSourceFields,
  ComputationResultConsole,
  ExpressionBuilder,
  ExpressionPreview,
  FormulaComposer,
  FormulaPreview,
} from './ExpressionBuilder'
import {
  FormulaAdjustmentsEditor,
  PaymentFieldChecklist,
} from './PageSettings'

type ComputationOutputChoice = 'automatic' | 'integer' | 'decimal' | 'text'





export function ComputationDialog({
  field,
  fields,
  references,
  computation,
  onClose,
  onChange,
}: {
  field: PageField
  fields: PageField[]
  references: FormReference[]
  computation: FieldComputation
  onClose: () => void
  onChange: (computation: FieldComputation) => void
}) {
  const outputChoice = computationOutputChoice(computation)
  const mode = computation.outputMode === 'text' ? 'expression' : computation.mode ?? 'expression'
  const editorMode = computation.editorMode ??
    (computation.expression?.trim() ? 'syntax' : 'visual')
  const numericReferences = references.filter((reference) => reference.type === 'number' || reference.type === 'percentage')
  const availableFields = computationSourceFields(fields, field.id, mode)
  const selectedBindings = computation.fieldBindings ?? []
  const computationCheck = checkComputationBlock(computation, field, fields, references)
  const preview = computationPreview(computation, field, fields, references)

  function update(patch: Partial<FieldComputation>) {
    onChange({ ...computation, ...patch })
  }

  function selectOutput(choice: ComputationOutputChoice) {
    const text = choice === 'text'
    const nextTerms = (computation.terms ?? []).map((term, index) => ({
      ...term,
      operator: index === 0 ? 'set' as const : text ? 'concat' as const : term.operator === 'concat' ? 'add' as const : term.operator,
      fixedValue: text
        ? String(term.fixedValue ?? '')
        : term.source === 'fixed'
          ? Number(term.fixedValue ?? 0)
          : term.fixedValue,
    }))
    update({
      outputMode: text ? 'text' : 'number',
      numericType: text ? computation.numericType : choice,
      decimalPlaces: choice === 'decimal' ? computation.decimalPlaces ?? 2 : computation.decimalPlaces,
      mode: text ? 'expression' : mode,
      terms: nextTerms,
    })
  }

  function selectMode(nextMode: FieldComputation['mode']) {
    update({
      mode: nextMode,
      fieldBindings: nextMode === mode ? computation.fieldBindings : [],
      adjustments: nextMode === 'formula' ? computation.adjustments ?? [] : computation.adjustments,
    })
  }

  function toggleBinding(binding: string, checked: boolean) {
    const current = new Set(computation.fieldBindings ?? [])
    if (checked) current.add(binding)
    else current.delete(binding)
    update({ fieldBindings: [...current] })
  }

  return (
    <FieldDialog
      title="Calculation studio"
      subtitle={field.label || 'Calculated value'}
      onClose={onClose}
      wide
    >
      <div className="bg-[#f5f0e8]">
        <div className="border-b border-[#ded6cd] bg-white px-4 py-5 sm:px-6">
          <div className="mx-auto max-w-5xl">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#2f3933] text-white">
                <Calculator size={19} />
              </span>
              <div>
                <h3 className="text-base font-semibold text-[#24211e]">What should this field produce?</h3>
                <p className="mt-1 text-sm leading-6 text-[#746f68]">
                  Choose the saved result first. Ponko will show only compatible variables and operations.
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4" role="radiogroup" aria-label="Calculation output type">
              {([
                ['automatic', Hash, 'Number', 'Keep the calculated precision.'],
                ['integer', List, 'Whole number', 'Round the result to an integer.'],
                ['decimal', Calculator, 'Decimal', 'Float/double-style decimal value.'],
                ['text', Type, 'Text', 'Combine written answers and values.'],
              ] as const).map(([choice, Icon, title, description]) => {
                const selected = outputChoice === choice
                return (
                  <button
                    key={choice}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => selectOutput(choice)}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] ${
                      selected
                        ? 'border-[#b8654d] bg-[#fff5ef] shadow-[0_0_0_1px_#b8654d]'
                        : 'border-[#ded6cd] bg-[#faf9f5] hover:border-[#c5b7aa] hover:bg-white'
                    }`}
                  >
                    <span className={`mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg ${selected ? 'bg-[#b8654d] text-white' : 'bg-[#ece7e1] text-[#6f6861]'}`}>
                      <Icon size={15} />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-[#302c28]">{title}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-[#7d766f]">{description}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            {outputChoice === 'decimal' && (
              <div className="mt-3 flex flex-col gap-2 rounded-lg border border-[#ead9cf] bg-[#fff9f5] p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-[#3d3935]">Decimal precision</p>
                  <p className="mt-0.5 text-xs text-[#7d766f]">Round the saved value to this many places.</p>
                </div>
                <select
                  aria-label="Decimal places"
                  value={computation.decimalPlaces ?? 2}
                  onChange={(event) => update({ decimalPlaces: Number(event.target.value) })}
                  className={`${inputClass} sm:w-36`}
                >
                  {[0, 1, 2, 3, 4, 5, 6].map((places) => (
                    <option key={places} value={places}>{places} {places === 1 ? 'place' : 'places'}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.09em] text-[#7d766f]">Calculation method</p>
            <div className={`mt-2 grid grid-cols-1 gap-2 ${computation.outputMode === 'text' ? 'sm:max-w-md' : 'sm:grid-cols-2 xl:grid-cols-4'}`}>
              {([
                ['expression', Sparkles, computation.outputMode === 'text' ? 'Combine text' : 'Build a formula', computation.outputMode === 'text' ? 'Join text variables and fixed words.' : 'Use visual steps or formula syntax.'],
                ['sum_number_fields', ListPlus, 'Sum numbers', 'Add selected number variables.'],
                ['sum_priced_options', CheckSquare, 'Total selected prices', 'Add prices from chosen options.'],
                ['formula', Calculator, 'Price with adjustments', 'Start with prices, then apply fees or rates.'],
              ] as const)
                .filter(([method]) => computation.outputMode !== 'text' || method === 'expression')
                .map(([method, Icon, title, description]) => {
                  const selected = mode === method
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => selectMode(method)}
                      className={`rounded-xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] ${
                        selected ? 'border-[#39463f] bg-[#39463f] text-white' : 'border-[#d9d0c5] bg-white text-[#302c28] hover:border-[#a99d91]'
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <Icon size={15} className={selected ? 'text-[#efb79f]' : 'text-[#a9583e]'} />
                        {title}
                      </span>
                      <span className={`mt-1.5 block text-xs leading-5 ${selected ? 'text-[#d5ddd8]' : 'text-[#7d766f]'}`}>{description}</span>
                    </button>
                  )
                })}
            </div>
          </section>

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
            <main className="min-w-0 space-y-4">
              {mode === 'expression' ? (
                <>
                  <div className="flex flex-col gap-3 rounded-xl border border-[#d9d0c5] bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#302c28]">Choose how you want to build</p>
                      <p className="mt-0.5 text-xs text-[#7d766f]">You can switch editors without losing either version.</p>
                    </div>
                    <div className="grid grid-cols-2 rounded-lg bg-[#efebe6] p-1" role="tablist" aria-label="Formula editor">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={editorMode === 'visual'}
                        onClick={() => update({ editorMode: 'visual' })}
                        className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors ${editorMode === 'visual' ? 'bg-white text-[#302c28] shadow-sm' : 'text-[#746f68] hover:text-[#302c28]'}`}
                      >
                        Visual steps
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={editorMode === 'syntax'}
                        onClick={() => update({ editorMode: 'syntax' })}
                        className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors ${editorMode === 'syntax' ? 'bg-white text-[#302c28] shadow-sm' : 'text-[#746f68] hover:text-[#302c28]'}`}
                      >
                        Formula syntax
                      </button>
                    </div>
                  </div>
                  <ExpressionPreview
                    field={field}
                    expression={editorMode === 'syntax' ? computation.expression : null}
                    terms={editorMode === 'visual' ? computation.terms ?? [] : []}
                    fields={fields}
                  />
                  {editorMode === 'syntax' ? (
                    <FormulaComposer
                      field={field}
                      fields={fields}
                      references={references}
                      expression={computation.expression ?? ''}
                      outputMode={computation.outputMode ?? 'number'}
                      onChange={(expression) => update({ expression, editorMode: 'syntax' })}
                    />
                  ) : (
                    <ExpressionBuilder
                      field={field}
                      fields={fields}
                      references={references}
                      terms={computation.terms ?? []}
                      outputMode={computation.outputMode ?? 'number'}
                      onChange={(terms) => update({ terms, editorMode: 'visual' })}
                    />
                  )}
                </>
              ) : (
                <>
                  <div className="rounded-xl border border-[#d9d0c5] bg-white p-4">
                    <h4 className="text-sm font-semibold text-[#302c28]">
                      {mode === 'sum_number_fields' ? 'Choose number variables' : 'Choose priced answer fields'}
                    </h4>
                    <p className="mt-1 text-xs leading-5 text-[#7d766f]">
                      {mode === 'sum_number_fields'
                        ? 'Every selected number is added to the result. Numeric calculated fields can be included too.'
                        : 'The prices attached to each respondent’s selected options are added automatically.'}
                    </p>
                    <div className="mt-4">
                      <PaymentFieldChecklist
                        fields={availableFields}
                        selected={selectedBindings}
                        emptyText={
                          mode === 'sum_number_fields'
                            ? 'No numeric fields are available yet. Add a number or numeric calculated field first.'
                            : 'No priced choices are available yet. Enable prices on a checkbox, radio, or dropdown field.'
                        }
                        onToggle={toggleBinding}
                      />
                    </div>
                  </div>
                  <FormulaPreview
                    sourceFields={availableFields}
                    selectedBindings={selectedBindings}
                    adjustments={mode === 'formula' ? computation.adjustments ?? [] : []}
                    references={numericReferences}
                  />
                  {mode === 'formula' && (
                    <FormulaAdjustmentsEditor
                      references={numericReferences}
                      adjustments={computation.adjustments ?? []}
                      onChange={(adjustments) => update({ adjustments })}
                    />
                  )}
                </>
              )}

              <section className="rounded-xl border border-[#d9d0c5] bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#f0ebe5] text-[#6d655e]">
                      {computation.visible === false || computation.showBreakdown === false ? <EyeOff size={16} /> : <Eye size={16} />}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[#302c28]">Show this result on the form</p>
                      <p className="mt-1 text-xs leading-5 text-[#7d766f]">
                        Hidden calculations still run and remain available to logic, payments, submissions, and exports.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={computation.visible !== false && computation.showBreakdown !== false}
                    onClick={() => {
                      const nextVisible = !(computation.visible !== false && computation.showBreakdown !== false)
                      update({ visible: nextVisible ? undefined : false, showBreakdown: nextVisible })
                    }}
                    className={`relative mt-1 h-6 w-11 flex-none rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] ${
                      computation.visible !== false && computation.showBreakdown !== false ? 'bg-[#b8654d]' : 'bg-[#c9c2ba]'
                    }`}
                  >
                    <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      computation.visible !== false && computation.showBreakdown !== false ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              </section>
            </main>

            <ComputationResultConsole
              field={field}
              computation={computation}
              preview={preview}
              check={computationCheck}
            />
          </div>
        </div>
      </div>
    </FieldDialog>
  )
}
