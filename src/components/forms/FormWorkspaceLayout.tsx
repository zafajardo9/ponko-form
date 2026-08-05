import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { FormSectionNav, type FormSection } from './FormSectionNav'

interface FormWorkspaceLayoutProps {
  formId: string
  formTitle?: string
  active: FormSection
  title: string
  count?: number
  description?: ReactNode
  titleAdornment?: ReactNode
  actions?: ReactNode
  wide?: boolean
  hasPayment?: boolean
  children: ReactNode
}

/**
 * Shared creator workspace frame for form-level sections. Each section keeps
 * its own tools and content, while navigation, hierarchy, and spacing remain
 * stable as creators move between pages.
 */
export function FormWorkspaceLayout({
  formId,
  formTitle,
  active,
  title,
  count,
  description,
  titleAdornment,
  actions,
  wide = false,
  hasPayment = false,
  children,
}: FormWorkspaceLayoutProps) {
  return (
    <main
      className={`mx-auto w-full px-4 py-8 sm:px-6 lg:px-8 lg:py-12 ${
        wide ? 'max-w-[1600px]' : 'max-w-7xl'
      }`}
    >
      <div className="mb-5">
        <FormSectionNav formId={formId} active={active} hasPayment={hasPayment} />
      </div>

      <nav
        aria-label="Breadcrumb"
        className="mb-1 flex min-w-0 items-center gap-2 overflow-hidden text-sm text-[#6c6a64]"
      >
        <Link to="/forms" className="flex-none hover:text-[#141413]">
          Forms
        </Link>
        <span aria-hidden="true">/</span>
        <Link
          to="/forms/$formId/edit"
          params={{ formId }}
          className="truncate hover:text-[#141413]"
        >
          {formTitle ?? 'Form'}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="flex-none text-[#141413]" aria-current="page">
          {title}
        </span>
      </nav>

      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-medium text-[#141413]">
              {title}
              {typeof count === 'number' && count > 0 ? (
                <span className="ml-2 text-base font-normal text-[#6c6a64]">
                  {' '}
                  ({count})
                </span>
              ) : null}
            </h1>
            {titleAdornment}
          </div>
          {description ? (
            <div className="mt-1 max-w-2xl text-sm text-[#6c6a64]">
              {description}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            {actions}
          </div>
        ) : null}
      </header>

      {children}
    </main>
  )
}
