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
        className={`px-4 py-3 ${alignClass} font-medium text-[#6c6a64]`}
        style={width ? { width } : undefined}
      >
        {header}
      </th>
    )
  }

  return (
    <th
      className={`px-4 py-3 ${alignClass} font-medium text-[#6c6a64] cursor-pointer select-none hover:text-[#141413] transition-colors`}
      style={width ? { width } : undefined}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {header}
        <span className="text-xs text-[#8e8b82]">
          {isActive ? (direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </span>
    </th>
  )
}
