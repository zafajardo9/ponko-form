import type { SortState } from "./DataTableTypes"

interface DataTableHeaderProps {
  header: React.ReactNode
  sortable?: boolean
  sortKey?: string
  currentSort: SortState | null
  onSort: (key: string) => void
  width?: string
  align?: "left" | "center" | "right"
}

export function DataTableHeader({
  header,
  sortable,
  sortKey,
  currentSort,
  onSort,
  width,
  align = "left",
}: DataTableHeaderProps) {
  const isActive = currentSort?.key === sortKey
  const direction = isActive ? currentSort?.dir : null

  const alignClass =
    align === "center"
      ? "text-center"
      : align === "right"
        ? "text-right"
        : "text-left"

  if (!sortable || !sortKey) {
    return (
      <th
        className={`px-4 py-4 ${alignClass} text-[13px] font-semibold uppercase tracking-[0.02em] text-[#716d66]`}
        style={width ? { width } : undefined}
      >
        {header}
      </th>
    )
  }

  return (
    <th
      className={`px-4 py-4 ${alignClass} text-[13px] font-semibold uppercase tracking-[0.02em] text-[#716d66]`}
      style={width ? { width } : undefined}
      aria-sort={isActive ? (direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex select-none items-center gap-1 rounded-sm transition-colors hover:text-[#141413] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]"
        aria-label={`Sort by ${typeof header === "string" ? header : sortKey}`}
      >
        {header}
        <span className="text-xs text-[#8e8b82]" aria-hidden="true">
          {isActive ? (direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  )
}
