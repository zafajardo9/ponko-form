import { Check, ChevronRight } from 'lucide-react'
import { StarIcon } from '../ui/StarIcon'
import { ratingFaceIcon, SVG_STAR_MARKER, TEXT_ONLY_MARKER } from '../../lib/page-builder/satisfaction'
import type { FormTemplateRecord } from '../../lib/form-templates/types'

export function TemplatePreview({ template }: { template: FormTemplateRecord }) {
  return (
    <div className="rounded-xl border border-[#dedbd5] bg-white">
      <div className="border-b border-[#e8e4de] px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8e8b82]">Template structure</p>
      </div>
      <div className="divide-y divide-[#eeeae4]">
        {[...template.pagesData].sort((a, b) => a.position - b.position).map((page, index) => (
          <div key={`${page.title}-${index}`} className="p-5">
            <div className="flex items-center gap-3">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${page.isFinal ? 'bg-[#eef7ef] text-[#357143]' : 'bg-[#f3eee7] text-[#6f6258]'}`}>
                {page.isFinal ? <Check size={14} /> : index + 1}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-[#141413]">{page.title}</h3>
                <p className="mt-0.5 text-xs text-[#8e8b82]">
                  {page.isFinal ? 'Confirmation page' : page.hasPayment ? paymentStepLabel(page) : `${page.fields.length} fields`}
                </p>
              </div>
            </div>
            {!page.isFinal && page.fields.length > 0 && (
              <div className="mt-4 grid gap-2 pl-10 sm:grid-cols-2">
                {[...page.fields].sort((a, b) => a.position - b.position).map((field) => {
                  const options = field.options ?? []
                  const usesSvgStars = options.length > 0 && options.every((opt) => (opt.emoji?.trim() ?? '') === SVG_STAR_MARKER)
                  return (
                  <div key={field.bindVariable} className={field.fieldType === 'satisfaction' ? 'sm:col-span-2' : ''}>
                    <div className="flex items-center gap-2 text-xs text-[#6c6a64]">
                      <ChevronRight size={12} className="text-[#b0aaa1]" />
                      <span>{field.label}</span>
                      {field.required && <span className="text-[#b75b47]">Required</span>}
                    </div>
                    {field.fieldType === 'satisfaction' && (
                      <div className="mt-2 flex gap-1.5 pl-5" aria-label={`${field.label} rating preview`}>
                        {usesSvgStars ? (
                          <span className="flex gap-0.5">
                            {[...Array(options.length)].map((_, i) => (
                              <StarIcon key={i} size={16} filled={i < 3} className="text-[#cc785c]" />
                            ))}
                          </span>
                        ) : options.map((option) => (
                          <span
                            key={option.value}
                            title={option.label}
                            className="flex min-h-9 min-w-9 items-center justify-center rounded-md border border-[#e6dfd8] bg-[#faf9f5] px-2 text-sm text-[#6c6a64]"
                          >
                            {option.emoji === TEXT_ONLY_MARKER
                              ? option.label
                              : ratingFaceIcon(option.emoji)
                                ? '☺'
                                : option.emoji || option.value}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )})}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function paymentStepLabel(page: FormTemplateRecord['pagesData'][number]) {
  const computation = page.paymentComputation
  if (computation?.mode === 'fixed' && Number(computation.fixedAmount) > 0) {
    return `Payment · ${page.paymentCurrency ?? 'USD'} ${computation.fixedAmount}`
  }
  if (computation?.mode === 'sum_priced_options') {
    return 'Payment · total of selected options'
  }
  return 'Payment step'
}
