import { BriefcaseBusiness, Building2, Headphones, MessageSquareText } from 'lucide-react'
import type { FormTemplateRecord } from '../../lib/form-templates/types'

const categoryIcon = {
  contact: MessageSquareText,
  support: Headphones,
  sales: BriefcaseBusiness,
  general: Building2,
  custom: Building2,
}

export function TemplateCard({ template, onClick }: { template: FormTemplateRecord; onClick: () => void }) {
  const Icon = categoryIcon[template.category as keyof typeof categoryIcon] ?? Building2
  const fieldCount = template.pagesData.reduce((total, page) => total + page.fields.length, 0)
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-56 flex-col rounded-xl border border-[#dedbd5] bg-white p-5 text-left shadow-[0_1px_2px_rgba(20,20,19,0.03)] transition hover:-translate-y-0.5 hover:border-[#cc785c]/60 hover:shadow-[0_14px_35px_-24px_rgba(20,20,19,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2"
    >
      <div className="flex items-start justify-between gap-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f3eee7] text-[#6f6258] transition group-hover:bg-[#cc785c]/15 group-hover:text-[#a9583e]">
          <Icon size={19} strokeWidth={1.8} />
        </span>
        <span className="rounded-full border border-[#e4e0da] bg-[#faf9f5] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#77736c]">
          {template.category}
        </span>
      </div>
      <h2 className="mt-5 text-lg font-semibold tracking-tight text-[#141413]">{template.name}</h2>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#6c6a64]">{template.description}</p>
      <div className="mt-auto flex items-center justify-between border-t border-[#eeeae4] pt-4 text-xs text-[#817d75]">
        <span>{template.pagesData.length} pages · {fieldCount} fields</span>
        <span className="font-semibold text-[#a9583e]">Use template →</span>
      </div>
    </button>
  )
}
