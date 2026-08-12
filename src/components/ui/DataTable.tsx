import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { DataTableProps, SortState } from "./DataTableTypes";
import { DataTableHeader } from "./DataTableHeader";
import { DataTableRow } from "./DataTableRow";
import { DataTablePagination } from "./DataTablePagination";
import { DataTableToolbar } from "./DataTableToolbar";
import { DataTableEmpty } from "./DataTableEmpty";
import { DataTableSkeleton } from "./DataTableSkeleton";
import { Check, Minus } from "lucide-react";

export {
  type DataTableProps,
  type DataTableColumn,
  type SortState,
} from "./DataTableTypes";

function getRowKey<T>(
  row: T,
  index: number,
  keyField: DataTableProps<T>["keyField"],
): string | number {
  if (typeof keyField === "function") return keyField(row, index);
  return String(row[keyField]);
}

export function DataTable<T>({
  columns,
  data,
  keyField,
  totalCount,
  page: serverPage,
  pageSize = 50,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  onFilterChange,
  loading = false,
  emptyMessage,
  onRowClick,
  onExportCsv,
  bulkActions,
  selectionLabel = "row",
  clientSort = false,
  clientFilter = false,
  initialSort,
  initialFilters,
  searchValue: externalSearchValue,
  onSearchChange: externalOnSearchChange,
  className,
}: DataTableProps<T>) {
  // Sort state
  const [sortState, setSortState] = useState<SortState | null>(
    initialSort ?? null,
  );

  // Filter state
  const [filters, setFilters] = useState<Record<string, unknown>>(
    initialFilters ?? {},
  );

  // Client-side page (only used when server-driven pagination is off)
  const [clientPage, setClientPage] = useState(1);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const col of columns) {
      if (!col.hideable || !col.defaultHidden) {
        initial.add(col.key);
      }
    }
    return initial;
  });
  const knownColumnKeys = useRef(new Set(columns.map((column) => column.key)));

  useEffect(() => {
    const newlyAvailable = columns.filter(
      (column) => !knownColumnKeys.current.has(column.key),
    );
    if (newlyAvailable.length === 0) return;
    setVisibleColumns((previous) => {
      const next = new Set(previous);
      for (const column of newlyAvailable) {
        if (!column.defaultHidden) next.add(column.key);
        knownColumnKeys.current.add(column.key);
      }
      return next;
    });
  }, [columns]);

  // Search
  const [internalSearchValue, setInternalSearchValue] = useState("");
  const searchValue =
    externalSearchValue !== undefined
      ? externalSearchValue
      : internalSearchValue;
  function handleSearchChange(value: string) {
    if (externalOnSearchChange) externalOnSearchChange(value);
    else setInternalSearchValue(value);
    setClientPage(1);
  }

  // Row selection
  const [selectedRows, setSelectedRows] = useState<Set<string | number>>(
    new Set(),
  );

  const isServerDriven = !!onSortChange || !!onFilterChange;

  // Apply client-side sort and filter
  const processedData = useMemo(() => {
    let result = [...data];

    // Client-side filter
    if (clientFilter) {
      // Global search
      if (searchValue.trim()) {
        const term = searchValue.toLowerCase();
        result = result.filter((row) => {
          return columns.some((col) => {
            const cell = col.accessor(row, 0);
            if (cell == null) return false;
            return String(cell).toLowerCase().includes(term);
          });
        });
      }

      // Column filters
      for (const [key, value] of Object.entries(filters)) {
        if (value == null || value === "") continue;
        result = result.filter((row) => {
          const col = columns.find((c) => c.key === key);
          if (!col) return true;
          const cell = col.accessor(row, 0);
          const cellStr = cell != null ? String(cell).toLowerCase() : "";

          if (col.filterType === "select" || col.filterType === "text") {
            if (col.filterType === "select") {
              return cellStr === String(value).toLowerCase();
            }
            return cellStr.includes(String(value).toLowerCase());
          }
          return true;
        });
      }
    }

    // Client-side sort
    if (clientSort && sortState) {
      const { key, dir } = sortState;
      const col = columns.find((c) => c.key === key || c.sortKey === key);
      if (col) {
        result.sort((a, b) => {
          const aVal = col.accessor(a, 0);
          const bVal = col.accessor(b, 0);
          const aStr = aVal != null ? String(aVal) : "";
          const bStr = bVal != null ? String(bVal) : "";
          const cmp = aStr.localeCompare(bStr, undefined, { numeric: true });
          return dir === "asc" ? cmp : -cmp;
        });
      }
    }

    return result;
  }, [
    data,
    columns,
    sortState,
    filters,
    searchValue,
    clientSort,
    clientFilter,
  ]);

  // Compute pagination values
  const effectiveTotalCount =
    totalCount ?? (isServerDriven ? data.length : processedData.length);
  const clientTotalPages = Math.max(
    1,
    Math.ceil(effectiveTotalCount / pageSize),
  );
  const effectiveClientPage = Math.min(clientPage, clientTotalPages);

  const displayData = useMemo(() => {
    if (isServerDriven) return data;
    const start = (effectiveClientPage - 1) * pageSize;
    return processedData.slice(start, start + pageSize);
  }, [isServerDriven, data, processedData, effectiveClientPage, pageSize]);

  const displayPage = serverPage ?? effectiveClientPage;

  useEffect(() => {
    const availableKeys = new Set(
      displayData.map((row, index) => getRowKey(row, index, keyField)),
    );
    setSelectedRows((previous) => {
      const next = new Set(
        [...previous].filter((key) => availableKeys.has(key)),
      );
      if (next.size === previous.size) return previous;
      return next;
    });
  }, [displayData, keyField]);

  const handleSort = useCallback(
    (key: string) => {
      const col = columns.find((c) => c.key === key || c.sortKey === key);
      if (!col?.sortable) return;
      const sortKey = col.sortKey ?? col.key;

      const newDir: "asc" | "desc" =
        sortState?.key === sortKey && sortState.dir === "asc" ? "desc" : "asc";

      setSortState({ key: sortKey, dir: newDir });
      if (onSortChange) {
        onSortChange(sortKey, newDir);
      }
    },
    [columns, sortState, onSortChange],
  );

  const handleFilterChange = useCallback(
    (key: string, value: unknown) => {
      setFilters((prev) => {
        const next = { ...prev };
        if (value == null || value === "") {
          delete next[key];
        } else {
          next[key] = value;
        }
        return next;
      });
      if (onFilterChange) {
        const next = { ...filters };
        if (value == null || value === "") {
          delete next[key];
        } else {
          next[key] = value;
        }
        onFilterChange(next);
      }
      // Reset to page 1 on filter change
      if (!onPageChange) setClientPage(1);
    },
    [filters, onFilterChange, onPageChange],
  );

  const handleClearAllFilters = useCallback(() => {
    setFilters({});
    handleSearchChange("");
    if (onFilterChange) onFilterChange({});
    if (!onPageChange) setClientPage(1);
  }, [onFilterChange, onPageChange, handleSearchChange]);

  const handlePageChange = useCallback(
    (page: number) => {
      if (onPageChange) {
        onPageChange(page);
      } else {
        setClientPage(page);
      }
      setSelectedRows(new Set());
    },
    [onPageChange],
  );

  const handleRowSelect = useCallback((key: string | number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedRows((prev) => {
      if (prev.size === displayData.length) return new Set();
      const next = new Set<string | number>();
      displayData.forEach((row, i) => {
        next.add(getRowKey(row, i, keyField));
      });
      return next;
    });
  }, [displayData, keyField]);

  const handleBulkAction = useCallback(
    (action: {
      label: string;
      action: (rows: T[]) => void;
      tone?: "default" | "danger";
    }) => {
      const selected = displayData.filter((row, i) =>
        selectedRows.has(getRowKey(row, i, keyField)),
      );
      action.action(selected);
    },
    [displayData, selectedRows, keyField],
  );

  const visibleColumnList = columns.filter((c) => visibleColumns.has(c.key));
  const hasBulk = bulkActions && bulkActions.length > 0;
  const allRowsSelected =
    displayData.length > 0 && selectedRows.size === displayData.length;
  const someRowsSelected = selectedRows.size > 0 && !allRowsSelected;

  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      <DataTableToolbar
        searchValue={searchValue}
        onSearchChange={handleSearchChange}
        columns={columns}
        visibleColumns={visibleColumns}
        onToggleColumn={(key) =>
          setVisibleColumns((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
          })
        }
        onResetColumns={() => {
          const initial = new Set<string>();
          for (const col of columns) {
            if (!col.hideable || !col.defaultHidden) {
              initial.add(col.key);
            }
          }
          setVisibleColumns(initial);
        }}
        activeFilters={filters}
        onFilterChange={handleFilterChange}
        onClearAllFilters={handleClearAllFilters}
        onExportCsv={onExportCsv}
        selectedCount={hasBulk ? selectedRows.size : undefined}
        selectionLabel={selectionLabel}
        bulkActions={bulkActions}
        onBulkAction={handleBulkAction}
        onClearSelection={() => setSelectedRows(new Set())}
      />

      {loading ? (
        <DataTableSkeleton />
      ) : displayData.length === 0 ? (
        <DataTableEmpty
          message={
            emptyMessage ??
            (Object.keys(filters).length > 0 || searchValue
              ? "No results match your filters."
              : "No data yet.")
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#e1d9cf] bg-[#faf9f5] shadow-[0_1px_2px_rgba(20,20,19,0.03)]">
          <table className="w-max min-w-full table-fixed text-[15px]">
            <thead className="border-b border-[#e6dfd8] bg-[#f5f0e8]">
              <tr>
                {hasBulk && (
                  <th className="w-14 px-3.5 py-4 text-left">
                    <SelectionCheckbox
                      checked={allRowsSelected}
                      mixed={someRowsSelected}
                      label={`Select all ${selectionLabel}s on this page`}
                      onChange={handleSelectAll}
                    />
                  </th>
                )}
                {visibleColumnList.map((col) => (
                  <DataTableHeader
                    key={col.key}
                    header={col.header}
                    sortable={col.sortable}
                    sortKey={col.sortKey ?? col.key}
                    currentSort={sortState}
                    onSort={handleSort}
                    width={col.width}
                    align={col.align}
                  />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6dfd8] bg-[#faf9f5]">
              {displayData.map((row, index) => {
                const rowKey = getRowKey(row, index, keyField);
                return (
                  <DataTableRow
                    key={rowKey}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    selected={selectedRows.has(rowKey)}
                  >
                    {hasBulk && (
                      <td className="w-14 px-3.5 py-4">
                        <SelectionCheckbox
                          checked={selectedRows.has(rowKey)}
                          label={`Select ${selectionLabel} ${index + 1}`}
                          onChange={() => handleRowSelect(rowKey)}
                        />
                      </td>
                    )}
                    {visibleColumnList.map((col) => {
                      const cellAlign =
                        col.align === "center"
                          ? "text-center"
                          : col.align === "right"
                            ? "text-right"
                            : "text-left";
                      return (
                        <td
                          key={col.key}
                          className={`px-4 py-4 align-middle leading-5 ${cellAlign} ${
                            col.key === "submittedAt" ||
                            col.key === "actions"
                              ? ""
                              : "truncate whitespace-nowrap"
                          }`}
                          style={
                            col.key === "number"
                              ? { color: "#8e8b82" }
                              : undefined
                          }
                        >
                          {col.accessor(row, index)}
                        </td>
                      );
                    })}
                  </DataTableRow>
                );
              })}
            </tbody>
          </table>

          <DataTablePagination
            page={displayPage}
            pageSize={pageSize}
            totalCount={effectiveTotalCount}
            onPageChange={handlePageChange}
            onPageSizeChange={onPageSizeChange}
            loading={loading}
          />
        </div>
      )}
    </div>
  );
}

function SelectionCheckbox({
  checked,
  mixed = false,
  label,
  onChange,
}: {
  checked: boolean;
  mixed?: boolean;
  label: string;
  onChange: () => void;
}) {
  const active = checked || mixed;

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={mixed ? "mixed" : checked}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onChange();
      }}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-[background-color,border-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] focus-visible:ring-offset-2 ${
        active
          ? "border-[#cc785c] bg-[#cc785c] text-white shadow-[0_2px_6px_rgba(204,120,92,0.25)]"
          : "border-[#d7cec5] bg-white text-transparent hover:border-[#bb8b79] hover:bg-[#fff8f4]"
      }`}
    >
      {mixed ? (
        <Minus size={15} strokeWidth={3} aria-hidden="true" />
      ) : (
        <Check size={15} strokeWidth={3} aria-hidden="true" />
      )}
    </button>
  );
}
