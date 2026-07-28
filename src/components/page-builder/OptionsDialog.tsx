import type { FormReference, PageFieldOption } from '../../lib/page-builder/types'
import { Plus, Trash2 } from 'lucide-react'
import { FieldDialog, inputClass } from './Shared'
import type { EditablePageField } from './PageBuilderTypes'
import {
  optionValueForLabel,
  slugForOptionValue,
} from './PageBuilderUtils'

export function OptionsDialog({
  field,
  references,
  showPrices,
  onClose,
  onChange,
}: {
  field: EditablePageField
  references: FormReference[]
  showPrices: boolean
  onClose: () => void
  onChange: (options: PageFieldOption[]) => void
}) {
  return (
    <FieldDialog title={field.label || 'Untitled field'} subtitle="Options" onClose={onClose}>
      <OptionsEditor
        options={field.options ?? []}
        showPrices={showPrices}
        references={references}
        onChange={onChange}
      />
    </FieldDialog>
  )
}

export function OptionsEditor({
  options,
  showPrices,
  references,
  onChange,
}: {
  options: PageFieldOption[]
  showPrices: boolean
  references: FormReference[]
  onChange: (options: PageFieldOption[]) => void
}) {
  function updateOption(index: number, patch: Partial<PageFieldOption>) {
    const next = options.map((option, optionIndex) => {
      if (optionIndex !== index) return option
      const updated = { ...option, ...patch }
      if (patch.label != null && patch.value == null) {
        updated.value = optionValueForLabel(patch.label, options, index)
      }
      return updated
    })
    onChange(next)
  }

  function addOption() {
    const label = `Option ${options.length + 1}`
    onChange([
      ...options,
      {
        label,
        value: optionValueForLabel(label, options, options.length),
        price: showPrices ? 0 : null,
        priceReference: null,
        additionalPrice: null,
        additionalPriceReference: null,
      },
    ])
  }

  function removeOption(index: number) {
    onChange(options.filter((_, optionIndex) => optionIndex !== index))
  }

  return (
    <div className="rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#141413]">Options</p>
          <p className="mt-0.5 text-xs text-[#8e8b82]">
            Labels are shown to respondents. Values are used by logic and submissions.
            {showPrices ? ' Prices can be used by payment totals.' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={addOption}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#e6dfd8] bg-white px-2.5 text-xs font-medium text-[#3d3d3a] hover:border-[#cc785c] hover:text-[#141413]"
        >
          <Plus size={13} /> Add
        </button>
      </div>

      <div className="overflow-x-auto">
      <div className={`grid min-w-[980px] ${showPrices ? 'grid-cols-[220px_190px_150px_150px_150px_150px_auto]' : 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]'} gap-2 px-1 pb-1 text-xs font-medium uppercase text-[#8e8b82]`}>
        <span>Label</span>
        <span>Value</span>
        {showPrices && <span>Base mode</span>}
        {showPrices && <span>Base amount</span>}
        {showPrices && <span>Additional mode</span>}
        {showPrices && <span>Additional amount</span>}
        <span className="sr-only">Remove</span>
      </div>
      <div className="flex flex-col gap-2">
        {options.map((option, index) => (
          <div key={index} className={`grid min-w-[980px] ${showPrices ? 'grid-cols-[220px_190px_150px_150px_150px_150px_auto]' : 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]'} gap-2`}>
            <input
              value={option.label}
              onChange={(e) => updateOption(index, { label: e.target.value })}
              className={inputClass}
            />
            <input
              value={option.value}
              onChange={(e) => updateOption(index, { value: slugForOptionValue(e.target.value) })}
              className={inputClass}
            />
            {showPrices && (
              <>
                <select
                  value={option.priceReference ? 'reference' : 'direct'}
                  onChange={(e) =>
                    updateOption(
                      index,
                      e.target.value === 'reference'
                        ? { priceReference: references[0]?.key ?? '', price: null }
                        : { priceReference: null, price: option.price ?? 0 },
                    )
                  }
                  className={inputClass}
                >
                  <option value="direct">Direct price</option>
                  <option value="reference">Reference</option>
                </select>
                {option.priceReference ? (
                  <select
                    value={option.priceReference}
                    onChange={(e) => updateOption(index, { priceReference: e.target.value || null })}
                    className={inputClass}
                  >
                    <option value="">Select reference...</option>
                    {references.map((reference) => (
                      <option key={reference.id} value={reference.key}>
                        {reference.label || reference.key} = {reference.value}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={option.price ?? ''}
                    onChange={(e) => updateOption(index, { price: e.target.value === '' ? null : Number(e.target.value), priceReference: null })}
                    className={inputClass}
                  />
                )}
                <select
                  value={option.additionalPriceReference ? 'reference' : 'direct'}
                  onChange={(e) =>
                    updateOption(
                      index,
                      e.target.value === 'reference'
                        ? { additionalPriceReference: references[0]?.key ?? '', additionalPrice: null }
                        : { additionalPriceReference: null, additionalPrice: option.additionalPrice ?? 0 },
                    )
                  }
                  className={inputClass}
                >
                  <option value="direct">Direct extra</option>
                  <option value="reference">Reference</option>
                </select>
                {option.additionalPriceReference ? (
                  <select
                    value={option.additionalPriceReference}
                    onChange={(e) => updateOption(index, { additionalPriceReference: e.target.value || null })}
                    className={inputClass}
                  >
                    <option value="">Select reference...</option>
                    {references.map((reference) => (
                      <option key={reference.id} value={reference.key}>
                        {reference.label || reference.key} = {reference.value}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={option.additionalPrice ?? ''}
                    placeholder="Optional"
                    onChange={(e) =>
                      updateOption(index, {
                        additionalPrice: e.target.value === '' ? null : Number(e.target.value),
                        additionalPriceReference: null,
                      })
                    }
                    className={inputClass}
                  />
                )}
              </>
            )}
            <button
              type="button"
              onClick={() => removeOption(index)}
              disabled={options.length <= 1}
              className="flex h-10 w-10 items-center justify-center rounded-md text-[#c64545] hover:bg-[#fff3ef] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={`Remove ${option.label || 'option'}`}
              title="Remove option"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
      </div>
    </div>
  )
}
