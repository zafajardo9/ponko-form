import { useState } from "react"
import type { DataTableColumn } from "./DataTableTypes"

type FilterValue =
  | string
  | { from: string; to: string }
  | { min: number; max: number }

interface DataTableFilterPanelProps<T> {
  column: DataTableColumn<T>
  value: FilterValue | undefined
  onChange: (key: string, value: FilterValue | null) => void
  onClose: () => void
}

export function DataTableFilterPanel<T>({
  column,
  value,
  onChange,
  onClose,
}: DataTableFilterPanelProps<T>) {
  const filterType = column.filterType ?? "text"
  const headerLabel =
    typeof column.header === "string" ? column.header : column.key

  const [localValue, setLocalValue] = useState<FilterValue | undefined>(value)

  const apply = () => {
    if (localValue !== undefined && localValue !== "") {
      onChange(column.key, localValue)
    } else {
      onChange(column.key, null)
    }
    onClose()
  }

  const clear = () => {
    setLocalValue(undefined)
    onChange(column.key, null)
    onClose()
  }

  return (
    <div className="absolute right-0 top-full z-30 mt-1 min-w-[240px] rounded-lg border border-[#e6dfd8] bg-[#faf9f5] p-4 shadow-lg">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8e8b82]">
        Filter: {headerLabel}
      </p>

      {filterType === "text" && (
        <input
          type="text"
          placeholder="Contains..."
          value={(localValue as string) ?? ""}
          onChange={(e) =>
            setLocalValue(e.target.value ? e.target.value : undefined)
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") apply()
          }}
          className="h-10 w-full rounded-md border border-[#e6dfd8] bg-white px-3 text-sm text-[#141413] outline-none focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/20"
        />
      )}

      {filterType === "select" && column.filterOptions && (
        <select
          value={(localValue as string) ?? ""}
          onChange={(e) =>
            setLocalValue(e.target.value ? e.target.value : undefined)
          }
          className="h-10 w-full rounded-md border border-[#e6dfd8] bg-white px-3 text-sm text-[#141413] outline-none focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/20"
        >
          <option value="">All</option>
          {column.filterOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {filterType === "date-range" && (
        <div className="space-y-2">
          <div>
            <label className="mb-1 block text-xs text-[#6c6a64]">From</label>
            <input
              type="date"
              value={
                localValue && typeof localValue === "object" && "from" in localValue
                  ? localValue.from
                  : ""
              }
              onChange={(e) =>
                setLocalValue((prev) => ({
                  ...(prev && typeof prev === "object" && "from" in prev ? prev : {}),
                  from: e.target.value,
                  to:
                    prev && typeof prev === "object" && "to" in prev
                      ? prev.to
                      : "",
                }))
              }
              className="h-10 w-full rounded-md border border-[#e6dfd8] bg-white px-3 text-sm text-[#141413] outline-none focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#6c6a64]">To</label>
            <input
              type="date"
              value={
                localValue && typeof localValue === "object" && "to" in localValue
                  ? localValue.to
                  : ""
              }
              onChange={(e) =>
                setLocalValue((prev) => ({
                  ...(prev && typeof prev === "object" && "from" in prev ? prev : {}),
                  from:
                    prev && typeof prev === "object" && "from" in prev
                      ? prev.from
                      : "",
                  to: e.target.value,
                }))
              }
              className="h-10 w-full rounded-md border border-[#e6dfd8] bg-white px-3 text-sm text-[#141413] outline-none focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/20"
            />
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={clear}
          className="text-xs text-[#8e8b82] hover:text-[#6c6a64]"
        >
          Clear
        </button>
        <button
          onClick={apply}
          className="rounded-md bg-[#cc785c] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#a9583e]"
        >
          Apply
        </button>
      </div>
    </div>
  )
}
