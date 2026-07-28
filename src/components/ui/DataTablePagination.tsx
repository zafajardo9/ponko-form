import { ArrowLeft, ArrowRight } from 'lucide-react'
import {
  navigationBackIconClass,
  navigationForwardIconClass,
} from './Button'

interface DataTablePaginationProps {
  page: number
  pageSize: number
  totalCount: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  loading?: boolean
}

export function DataTablePagination({
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  loading,
}: DataTablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalCount)

  return (
    <div className="flex flex-col gap-3 border-t border-[#e6dfd8] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-[#6c6a64]">
        {totalCount > 0
          ? `${start}–${end} of ${totalCount}`
          : "No results"}
      </span>
      <div className="flex flex-wrap items-center gap-3">
        {onPageSizeChange && (
          <label className="flex items-center gap-2 text-sm text-[#6c6a64]">
            Rows
            <select
              aria-label="Rows per page"
              value={pageSize}
              disabled={loading}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="h-8 rounded-md border border-[#e6dfd8] bg-white px-2 text-sm text-[#141413] outline-none focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/20"
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>
        )}
        <button
          disabled={page <= 1 || loading}
          onClick={() => onPageChange(page - 1)}
          className="group/nav inline-flex h-8 items-center gap-1.5 rounded-md border border-[#dedbd5] bg-white px-2.5 text-sm font-medium text-[#57544d] transition-colors hover:border-[#c9b4a8] hover:bg-[#f7f2ec] hover:text-[#141413] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeft size={14} className={navigationBackIconClass} />
          Previous
        </button>
        <span className="text-sm text-[#6c6a64]">
          Page {page} of {totalPages}
        </span>
        <button
          disabled={page >= totalPages || loading}
          onClick={() => onPageChange(page + 1)}
          className="group/nav inline-flex h-8 items-center gap-1.5 rounded-md border border-[#dedbd5] bg-white px-2.5 text-sm font-medium text-[#57544d] transition-colors hover:border-[#c9b4a8] hover:bg-[#f7f2ec] hover:text-[#141413] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ArrowRight size={14} className={navigationForwardIconClass} />
        </button>
      </div>
    </div>
  )
}
