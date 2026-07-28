import { useState } from "react"
import type { DataTableColumn } from "./DataTableTypes"
import { DataTableColumnToggle } from "./DataTableColumnToggle"
import { DataTableFilterPanel } from "./DataTableFilterPanel"
import {
  CheckSquare2,
  Columns3,
  FileDown,
  ListFilter,
  Search,
  X,
} from "lucide-react"

interface DataTableToolbarProps<T> {
  searchValue: string
  onSearchChange: (value: string) => void
  columns: DataTableColumn<T>[]
  visibleColumns: Set<string>
  onToggleColumn: (key: string) => void
  onResetColumns: () => void
  activeFilters: Record<string, unknown>
  onFilterChange: (key: string, value: unknown) => void
  onClearAllFilters: () => void
  onExportCsv?: () => void
  selectedCount?: number
  selectionLabel?: string
  bulkActions?: {
    label: string
    action: (rows: T[]) => void
    tone?: "default" | "danger"
  }[]
  onBulkAction?: (action: {
    label: string
    action: (rows: T[]) => void
    tone?: "default" | "danger"
  }) => void
  onClearSelection?: () => void
}

export function DataTableToolbar<T>({
  searchValue,
  onSearchChange,
  columns,
  visibleColumns,
  onToggleColumn,
  onResetColumns,
  activeFilters,
  onFilterChange,
  onClearAllFilters,
  onExportCsv,
  selectedCount,
  selectionLabel = "row",
  bulkActions,
  onBulkAction,
  onClearSelection,
}: DataTableToolbarProps<T>) {
  const [showColumns, setShowColumns] = useState(false)
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null)

  const filterableColumns = columns.filter((c) => c.filterable)
  const activeFilterDefinition = activeFilterColumn
    ? filterableColumns.find((column) => column.key === activeFilterColumn)
    : undefined

  const filterLabels: Record<string, string> = {}
  for (const col of filterableColumns) {
    if (col.filterOptions && activeFilters[col.key]) {
      const opt = col.filterOptions.find(
        (o) => o.value === activeFilters[col.key],
      )
      filterLabels[col.key] = opt?.label ?? String(activeFilters[col.key])
    } else if (activeFilters[col.key]) {
      const val = activeFilters[col.key]
      if (typeof val === "object" && val !== null && "from" in val) {
        const range = val as { from: string; to: string }
        filterLabels[col.key] = `${range.from || "…"} – ${range.to || "…"}`
      } else if (
        typeof val === "object" &&
        val !== null &&
        ("min" in val || "max" in val)
      ) {
        const range = val as { min?: number; max?: number }
        filterLabels[col.key] = `${range.min ?? "…"} – ${range.max ?? "…"}`
      } else {
        filterLabels[col.key] = String(val)
      }
    }
  }

  const hasActiveFilters = Object.keys(activeFilters).length > 0

  return (
    <div>
      {/* Bulk action bar */}
      {selectedCount != null && selectedCount > 0 && bulkActions && (
        <div className="mb-3 flex flex-col gap-3 rounded-xl bg-[#24221f] px-4 py-3 text-white shadow-[0_10px_28px_rgba(20,20,19,0.12)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#cc785c] text-white">
              <CheckSquare2 size={16} aria-hidden="true" />
            </span>
            <span className="text-sm font-semibold text-white">
              {selectedCount} {selectionLabel}
              {selectedCount === 1 ? "" : "s"} selected
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {bulkActions.map((action) => (
              <button
                type="button"
                key={action.label}
                onClick={() => onBulkAction?.(action)}
                className={`inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#24221f] ${
                  action.tone === "danger"
                    ? "bg-[#c64545] text-white hover:bg-[#a33434]"
                    : "border border-[#4a4640] bg-[#35322e] text-white hover:bg-[#45413b]"
                }`}
              >
                {action.label}
              </button>
            ))}
            {onClearSelection ? (
              <button
                type="button"
                onClick={onClearSelection}
                aria-label={`Clear ${selectionLabel} selection`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#aaa39a] transition-colors hover:bg-[#35322e] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c]"
              >
                <X size={16} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* Toolbar row */}
      <div className="mb-3 grid grid-cols-1 gap-2 lg:grid-cols-[minmax(320px,1fr)_auto]">
        {/* Global search */}
        <div className="relative min-w-0">
          <input
            type="text"
            placeholder="Search all fields..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-10 w-full rounded-lg border border-[#ded6cc] bg-white pl-10 pr-3 text-sm text-[#141413] outline-none transition-[border-color,box-shadow] placeholder:text-[#8e8b82] focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/20"
          />
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8e8b82]"
            aria-hidden="true"
          />
        </div>

        <div className="grid grid-cols-3 gap-2 sm:flex sm:justify-end">
          {/* Filters button */}
          {filterableColumns.length > 0 && (
            <div className="relative">
              <button
                type="button"
                aria-expanded={showFilterMenu || activeFilterColumn != null}
                aria-haspopup="menu"
                onClick={() => {
                  setActiveFilterColumn(null)
                  setShowFilterMenu((visible) => !visible)
                }}
                className={`flex h-10 w-full items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${
                  hasActiveFilters
                    ? "border-[#cc785c] bg-[#fdf0f0] text-[#cc785c]"
                    : "border-[#e6dfd8] bg-white text-[#6c6a64] hover:bg-[#f5f0e8]"
                }`}
              >
                <ListFilter size={16} aria-hidden="true" />
                Filters
                {hasActiveFilters && (
                  <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#cc785c] px-1 text-[10px] font-bold text-white">
                    {Object.keys(activeFilters).length}
                  </span>
                )}
              </button>

              {showFilterMenu && (
                <div
                  role="menu"
                  aria-label="Choose a filter"
                  className="absolute right-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-lg border border-[#e6dfd8] bg-[#faf9f5] py-1 shadow-lg"
                >
                  <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[#8e8b82]">
                    Filter by
                  </p>
                  {filterableColumns.map((column) => {
                    const label =
                      typeof column.header === "string"
                        ? column.header
                        : column.key
                    const active =
                      activeFilters[column.key] != null &&
                      activeFilters[column.key] !== ""
                    return (
                      <button
                        key={column.key}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setShowFilterMenu(false)
                          setActiveFilterColumn(column.key)
                        }}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-[#141413] hover:bg-[#f5f0e8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#cc785c]"
                      >
                        <span>{label}</span>
                        {active && (
                          <span className="text-xs font-medium text-[#cc785c]">
                            Applied
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              {activeFilterColumn && activeFilterDefinition && (
                <DataTableFilterPanel
                  column={activeFilterDefinition}
                  value={
                    activeFilters[activeFilterColumn] as string | undefined
                  }
                  onChange={onFilterChange}
                  onClose={() => setActiveFilterColumn(null)}
                />
              )}
            </div>
          )}

          {/* Columns toggle */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowColumns((v) => !v)}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#e6dfd8] bg-white px-3 text-sm font-medium text-[#6c6a64] transition-colors hover:bg-[#f5f0e8]"
            >
              <Columns3 size={16} aria-hidden="true" />
              Columns
            </button>
            {showColumns && (
              <DataTableColumnToggle
                columns={columns}
                visibleColumns={visibleColumns}
                onToggle={(key) => {
                  onToggleColumn(key)
                }}
                onReset={() => {
                  onResetColumns()
                  setShowColumns(false)
                }}
              />
            )}
          </div>

          {/* Export CSV */}
          {onExportCsv && (
            <button
              type="button"
              onClick={onExportCsv}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#e6dfd8] bg-white px-3 text-sm font-medium text-[#6c6a64] transition-colors hover:bg-[#f5f0e8]"
            >
              <FileDown size={16} aria-hidden="true" />
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {Object.entries(filterLabels).map(([key, label]) => {
            const col = columns.find((c) => c.key === key)
            const colLabel =
              typeof col?.header === "string" ? col.header : key
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1 rounded-full border border-[#e6dfd8] bg-[#f5f0e8] px-2.5 py-0.5 text-xs text-[#6c6a64]"
              >
                {colLabel}: {label}
                <button
                  onClick={() => onFilterChange(key, null)}
                  className="ml-0.5 text-[#8e8b82] hover:text-[#c64545]"
                >
                  ✕
                </button>
              </span>
            )
          })}
          <button
            onClick={onClearAllFilters}
            className="text-xs text-[#cc785c] hover:text-[#a9583e]"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
