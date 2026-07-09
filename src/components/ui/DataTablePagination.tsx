interface DataTablePaginationProps {
  page: number
  pageSize: number
  totalCount: number
  onPageChange: (page: number) => void
  loading?: boolean
}

export function DataTablePagination({
  page,
  pageSize,
  totalCount,
  onPageChange,
  loading,
}: DataTablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalCount)

  return (
    <div className="flex items-center justify-between border-t border-[#e6dfd8] px-4 py-3">
      <span className="text-sm text-[#6c6a64]">
        {totalCount > 0
          ? `${start}–${end} of ${totalCount}`
          : "No results"}
      </span>
      <div className="flex items-center gap-3">
        <button
          disabled={page <= 1 || loading}
          onClick={() => onPageChange(page - 1)}
          className="text-sm text-[#cc785c] disabled:opacity-40 hover:text-[#a9583e]"
        >
          ← Previous
        </button>
        <span className="text-sm text-[#6c6a64]">
          Page {page} of {totalPages}
        </span>
        <button
          disabled={page >= totalPages || loading}
          onClick={() => onPageChange(page + 1)}
          className="text-sm text-[#cc785c] disabled:opacity-40 hover:text-[#a9583e]"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
