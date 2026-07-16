import { Link } from '@tanstack/react-router'
import { BarChart3, CreditCard, FileEdit, ReceiptText } from 'lucide-react'

export type FormSection = 'build' | 'responses' | 'payments' | 'invoicing'

const sections = [
  { id: 'build', label: 'Build', to: '/forms/$formId/edit', icon: FileEdit },
  { id: 'responses', label: 'Responses', to: '/forms/$formId/submissions', icon: BarChart3 },
  { id: 'payments', label: 'Payments', to: '/forms/$formId/payments', icon: CreditCard },
  { id: 'invoicing', label: 'Invoicing', to: '/forms/$formId/invoicing', icon: ReceiptText },
] as const

export function FormSectionNav({ formId, active }: { formId: string; active: FormSection }) {
  return (
    <nav aria-label="Form sections" className="max-w-full overflow-x-auto">
      <div className="flex w-max rounded-lg border border-[#e6dfd8] bg-[#f5f0e8] p-0.5 text-sm">
        {sections.map((section) => {
          const Icon = section.icon
          const selected = active === section.id
          return (
            <Link
              key={section.id}
              to={section.to}
              params={{ formId }}
              aria-current={selected ? 'page' : undefined}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] ${
                selected
                  ? 'bg-white font-medium text-[#141413] shadow-sm'
                  : 'text-[#6c6a64] hover:text-[#141413]'
              }`}
            >
              <Icon size={14} aria-hidden="true" className={selected ? 'text-[#cc785c]' : ''} />
              {section.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
