import type { DataTableColumn } from "./DataTableTypes"

interface DataTableColumnToggleProps<T> {
  columns: DataTableColumn<T>[]
  visibleColumns: Set<string>
  onToggle: (key: string) => void
  onReset: () => void
}

export function DataTableColumnToggle<T>({
  columns,
  visibleColumns,
  onToggle,
  onReset,
}: DataTableColumnToggleProps<T>) {
  const hideableColumns = columns.filter((c) => c.hideable)

  if (hideableColumns.length === 0) return null

  return (
    <div className="absolute right-0 top-full z-30 mt-1 min-w-[200px] rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-3 shadow-lg">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8e8b82]">
        Columns
      </p>
      <div className="max-h-64 overflow-y-auto space-y-1">
        {hideableColumns.map((col) => (
          <label
            key={col.key}
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-[#141413] hover:bg-[#f5f0e8]"
          >
            <input
              type="checkbox"
              checked={visibleColumns.has(col.key)}
              onChange={() => onToggle(col.key)}
              className="h-4 w-4 rounded border-[#e6dfd8] text-[#cc785c] focus:ring-[#cc785c]/20"
            />
            {typeof col.header === "string" ? col.header : col.key}
          </label>
        ))}
      </div>
      <button
        onClick={onReset}
        className="mt-2 w-full text-left text-xs text-[#8e8b82] hover:text-[#6c6a64]"
      >
        Reset to Default
      </button>
    </div>
  )
}
