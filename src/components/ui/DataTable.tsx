import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { DataTableProps, SortState } from "./DataTableTypes";
import { DataTableHeader } from "./DataTableHeader";
import { DataTableRow } from "./DataTableRow";
import { DataTablePagination } from "./DataTablePagination";
import { DataTableToolbar } from "./DataTableToolbar";
import { DataTableEmpty } from "./DataTableEmpty";
import { DataTableSkeleton } from "./DataTableSkeleton";

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
  const handleSearchChange = externalOnSearchChange ?? setInternalSearchValue;

  // Row selection
  const [selectedRows, setSelectedRows] = useState<Set<string | number>>(
    new Set(),
  );

  // Client-side page (only used when server-driven pagination is off)
  const [clientPage, setClientPage] = useState(1);

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

  const displayData = useMemo(() => {
    if (isServerDriven) return data;
    const start = (clientPage - 1) * pageSize;
    return processedData.slice(start, start + pageSize);
  }, [isServerDriven, data, processedData, clientPage, pageSize]);

  const displayPage = serverPage ?? clientPage;

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
    (action: { label: string; action: (rows: T[]) => void }) => {
      const selected = displayData.filter((row, i) =>
        selectedRows.has(getRowKey(row, i, keyField)),
      );
      action.action(selected);
    },
    [displayData, selectedRows, keyField],
  );

  const visibleColumnList = columns.filter((c) => visibleColumns.has(c.key));
  const hasBulk = bulkActions && bulkActions.length > 0;

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
        bulkActions={bulkActions}
        onBulkAction={handleBulkAction}
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
        <div className="overflow-x-auto rounded-xl border border-[#e6dfd8]">
          <table className="w-full text-sm">
            <thead className="border-b border-[#e6dfd8] bg-[#f5f0e8]">
              <tr>
                {hasBulk && (
                  <th className="w-10 px-2 py-3">
                    <input
                      type="checkbox"
                      checked={
                        displayData.length > 0 &&
                        selectedRows.size === displayData.length
                      }
                      onChange={handleSelectAll}
                      className="h-4 w-4 rounded border-[#e6dfd8] text-[#cc785c] focus:ring-[#cc785c]/20"
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
                      <td className="px-2 py-3">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(rowKey)}
                          onChange={() => handleRowSelect(rowKey)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded border-[#e6dfd8] text-[#cc785c] focus:ring-[#cc785c]/20"
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
                          className={`px-4 py-3 ${cellAlign}`}
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
