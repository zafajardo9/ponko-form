import { useState } from "react"
import type { DataTableColumn } from "./DataTableTypes"
import { DataTableColumnToggle } from "./DataTableColumnToggle"
import { DataTableFilterPanel } from "./DataTableFilterPanel"

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
  bulkActions?: { label: string; action: (rows: T[]) => void }[]
  onBulkAction?: (action: { label: string; action: (rows: T[]) => void }) => void
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
  bulkActions,
  onBulkAction,
}: DataTableToolbarProps<T>) {
  const [showColumns, setShowColumns] = useState(false)
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null)

  const filterableColumns = columns.filter((c) => c.filterable)

  const filterLabels: Record<string, string> = {}
  for (const col of filterableColumns) {
    if (col.filterOptions && activeFilters[col.key]) {
      const opt = col.filterOptions.find((o) => o.value === activeFilters[col.key])
      filterLabels[col.key] = opt?.label ?? String(activeFilters[col.key])
    } else if (activeFilters[col.key]) {
      const val = activeFilters[col.key]
      if (typeof val === "object" && val !== null && "from" in val) {
        const range = val as { from: string; to: string }
        filterLabels[col.key] = `${range.from || "…"} – ${range.to || "…"}`
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
        <div className="flex items-center gap-3 rounded-lg border border-[#e6dfd8] bg-[#f5f0e8] px-4 py-2 mb-3">
          <span className="text-sm text-[#6c6a64]">
            {selectedCount} selected
          </span>
          <div className="flex items-center gap-2">
            {bulkActions.map((action) => (
              <button
                key={action.label}
                onClick={() => onBulkAction?.(action)}
                className="rounded-md border border-[#e6dfd8] bg-white px-3 py-1 text-xs text-[#141413] hover:bg-[#efe9de]"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar row */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {/* Global search */}
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search all fields..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-10 w-full rounded-md border border-[#e6dfd8] bg-white pl-9 pr-3 text-sm text-[#141413] outline-none placeholder:text-[#8e8b82] focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/20"
          />
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8e8b82]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* Filters button */}
        {filterableColumns.length > 0 && (
          <div className="relative">
            <button
              onClick={() =>
                setActiveFilterColumn(
                  activeFilterColumn ? null : filterableColumns[0].key,
                )
              }
              className={`flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm ${
                hasActiveFilters
                  ? "border-[#cc785c] bg-[#fdf0f0] text-[#cc785c]"
                  : "border-[#e6dfd8] bg-white text-[#6c6a64] hover:bg-[#f5f0e8]"
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              Filters
              {hasActiveFilters && (
                <span className="ml-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#cc785c] px-1 text-[10px] font-bold text-white">
                  {Object.keys(activeFilters).length}
                </span>
              )}
            </button>

            {activeFilterColumn && (
              <DataTableFilterPanel
                column={filterableColumns.find((c) => c.key === activeFilterColumn)!}
                value={activeFilters[activeFilterColumn] as string | undefined}
                onChange={onFilterChange}
                onClose={() => setActiveFilterColumn(null)}
              />
            )}
          </div>
        )}

        {/* Columns toggle */}
        <div className="relative">
          <button
            onClick={() => setShowColumns((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-[#e6dfd8] bg-white px-3 py-2 text-sm text-[#6c6a64] hover:bg-[#f5f0e8]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 10h16M4 14h16M4 18h16"
              />
            </svg>
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
            onClick={onExportCsv}
            className="flex items-center gap-1.5 rounded-md border border-[#e6dfd8] bg-white px-3 py-2 text-sm text-[#6c6a64] hover:bg-[#f5f0e8]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Export CSV
          </button>
        )}
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
