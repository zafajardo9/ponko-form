import type { ReactNode } from 'react'
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
    <div className="rounded-xl border border-[#ded7ce] bg-[#faf9f5] p-3 sm:p-4">
      <div className="mb-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#141413]">Options</p>
          <p className="mt-1 max-w-xl text-xs leading-5 text-[#7d7972]">
            Labels are shown to respondents. Values are used by logic and submissions.
            {showPrices ? ' Prices can be used by payment and calculated totals.' : ''}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {options.map((option, index) => (
          <div
            key={index}
            className="rounded-lg border border-[#e1dbd2] bg-white p-3 shadow-[0_1px_2px_rgba(20,20,19,0.025)] sm:p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-[#f2ece4] px-1.5 text-[11px] font-semibold text-[#7b6459]">
                {index + 1}
              </span>
              <button
                type="button"
                onClick={() => removeOption(index)}
                disabled={options.length <= 1}
                className="flex h-8 w-8 items-center justify-center rounded-md text-[#b84b42] transition-colors hover:bg-[#fff1ed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c64545]/30 disabled:cursor-not-allowed disabled:opacity-35"
                aria-label={`Remove ${option.label || 'option'}`}
                title="Remove option"
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="min-w-0">
                <span className="mb-1.5 block text-xs font-semibold text-[#55514b]">
                  Label
                </span>
                <input
                  value={option.label}
                  onChange={(e) => updateOption(index, { label: e.target.value })}
                  className={inputClass}
                />
                <span className="mt-1.5 block text-[11px] leading-4 text-[#918c84]">
                  What respondents see
                </span>
              </label>

              <label className="min-w-0">
                <span className="mb-1.5 flex items-center justify-between gap-2 text-xs font-semibold text-[#55514b]">
                  <span>Value</span>
                  <span className="font-normal text-[#918c84]">Used in logic</span>
                </span>
                <input
                  value={option.value}
                  onChange={(e) => updateOption(index, { value: slugForOptionValue(e.target.value) })}
                  className={`${inputClass} font-mono text-[13px]`}
                />
                <span className="mt-1.5 block truncate font-mono text-[11px] leading-4 text-[#918c84]">
                  Saved as: {option.value || '—'}
                </span>
              </label>
            </div>

            {showPrices && (
              <div className="mt-4 grid gap-3 border-t border-[#eee9e2] pt-4 md:grid-cols-2">
                <PriceSetting
                  title="Base price"
                  description="Added when this option is selected."
                >
                  <select
                    aria-label={`Base price mode for ${option.label || `option ${index + 1}`}`}
                    value={option.priceReference != null ? 'reference' : 'direct'}
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
                    <option value="reference" disabled={references.length === 0}>Reference</option>
                  </select>
                  {option.priceReference != null ? (
                    <ReferencePricePicker
                      ariaLabel={`Base price reference for ${option.label || `option ${index + 1}`}`}
                      value={option.priceReference}
                      references={references}
                      onChange={(value) => updateOption(index, { priceReference: value })}
                    />
                  ) : (
                    <input
                      aria-label={`Base price amount for ${option.label || `option ${index + 1}`}`}
                      type="number"
                      min={0}
                      step="0.01"
                      value={option.price ?? ''}
                      onChange={(e) => updateOption(index, { price: e.target.value === '' ? null : Number(e.target.value), priceReference: null })}
                      className={inputClass}
                    />
                  )}
                </PriceSetting>

                <PriceSetting
                  title="Additional price"
                  description="Optional extra amount added to the base price."
                >
                  <select
                    aria-label={`Additional price mode for ${option.label || `option ${index + 1}`}`}
                    value={option.additionalPriceReference != null ? 'reference' : 'direct'}
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
                    <option value="reference" disabled={references.length === 0}>Reference</option>
                  </select>
                  {option.additionalPriceReference != null ? (
                    <ReferencePricePicker
                      ariaLabel={`Additional price reference for ${option.label || `option ${index + 1}`}`}
                      value={option.additionalPriceReference}
                      references={references}
                      onChange={(value) => updateOption(index, { additionalPriceReference: value })}
                    />
                  ) : (
                    <input
                      aria-label={`Additional price amount for ${option.label || `option ${index + 1}`}`}
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
                </PriceSetting>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addOption}
        className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#cfc5ba] bg-white text-sm font-medium text-[#6c5a51] transition-[border-color,background-color,color,transform] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:border-[#cc785c] hover:bg-[#fff7f3] hover:text-[#a9583e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]/30 active:scale-[0.995] motion-reduce:transform-none motion-reduce:transition-none"
      >
        <Plus size={16} aria-hidden="true" />
        Add option
      </button>
    </div>
  )
}

function ReferencePricePicker({
  ariaLabel,
  value,
  references,
  onChange,
}: {
  ariaLabel: string
  value: string
  references: FormReference[]
  onChange: (value: string | null) => void
}) {
  const selectedReference = references.find((reference) => reference.key === value)

  return (
    <div className="min-w-0">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value || null)}
        className={inputClass}
      >
        <option value="">Select reference...</option>
        {!selectedReference && value && <option value={value}>{value} (missing)</option>}
        {references.map((reference) => (
          <option key={reference.id} value={reference.key}>
            {reference.label || reference.key} = {reference.value}
          </option>
        ))}
      </select>
      {selectedReference ? (
        <div className="mt-1.5 text-[11px] font-medium text-[#65756c]" role="status">
          <p className="truncate">
            Active value: {selectedReference.value} from {'{{'}{selectedReference.key}{'}}'}
          </p>
          {selectedReference.type === 'percentage' && (
            <p className="mt-1 leading-4 text-[#7b6a61]">
              In a calculated field, use this option after <span className="font-mono">+%</span> to apply the rate to the running amount.
            </p>
          )}
        </div>
      ) : value ? (
        <p className="mt-1.5 text-[11px] font-medium text-[#b84b42]" role="alert">
          This reference no longer exists. Select another reference.
        </p>
      ) : null}
    </div>
  )
}

function PriceSetting({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="rounded-lg bg-[#faf8f4] p-3">
      <p className="text-xs font-semibold text-[#55514b]">{title}</p>
      <p className="mt-0.5 text-[11px] leading-4 text-[#918c84]">{description}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
        {children}
      </div>
    </div>
  )
}
