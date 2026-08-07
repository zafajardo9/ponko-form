import { BriefcaseBusiness, Building2, Headphones, MessageSquareText, Plus, Smile } from 'lucide-react'
import type { FormTemplateRecord } from '../../lib/form-templates/types'

const categoryIcon = {
  contact: MessageSquareText,
  support: Headphones,
  sales: BriefcaseBusiness,
  survey: Smile,
  general: Building2,
  custom: Building2,
}

const cardClass = 'group flex min-h-52 flex-col rounded-lg border border-[#dedbd5] bg-white p-5 text-left transition-colors hover:border-[#cc785c]/70 hover:bg-[#fdfbf8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2'

export function ScratchTemplateCard({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cardClass}>
      <div className="flex items-start justify-between gap-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-[#cc785c]/55 bg-[#cc785c]/8 text-[#a9583e]">
          <Plus size={20} strokeWidth={1.8} />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8e8b82]">
          Blank
        </span>
      </div>
      <h2 className="mt-5 text-lg font-semibold tracking-tight text-[#141413]">Start from scratch</h2>
      <p className="mt-2 text-sm leading-6 text-[#6c6a64]">
        Begin with a blank form and add only the pages and fields you need.
      </p>
      <div className="mt-auto border-t border-[#eeeae4] pt-4 text-xs text-[#817d75]">
        Blank form
      </div>
    </button>
  )
}

export function TemplateCard({ template, onClick }: { template: FormTemplateRecord; onClick: () => void }) {
  const Icon = categoryIcon[template.category as keyof typeof categoryIcon] ?? Building2
  const fieldCount = template.pagesData.reduce((total, page) => total + page.fields.length, 0)
  const hasPayment = template.pagesData.some((page) => page.hasPayment)
  return (
    <button
      type="button"
      onClick={onClick}
      className={cardClass}
    >
      <div className="flex items-start justify-between gap-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f3eee7] text-[#6f6258] transition-colors group-hover:bg-[#cc785c]/15 group-hover:text-[#a9583e]">
          <Icon size={19} strokeWidth={1.8} />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8e8b82]">
          {template.category}
        </span>
      </div>
      <h2 className="mt-5 text-lg font-semibold tracking-tight text-[#141413]">{template.name}</h2>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#6c6a64]">{template.description}</p>
      <div className="mt-auto border-t border-[#eeeae4] pt-4 text-xs text-[#817d75]">
        <span>{template.pagesData.length} pages · {fieldCount} fields{hasPayment ? ' · Payment' : ''}</span>
      </div>
    </button>
  )
}
