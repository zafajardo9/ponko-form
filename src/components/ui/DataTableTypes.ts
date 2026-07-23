import type { ReactNode } from "react";

export interface DataTableColumn<T> {
  key: string;
  header: string | ReactNode;
  accessor: (row: T, index: number) => ReactNode;
  sortable?: boolean;
  sortKey?: string;
  filterable?: boolean;
  filterType?: "text" | "select" | "date-range" | "number-range";
  filterOptions?: { label: string; value: string }[];
  width?: string;
  hideable?: boolean;
  defaultHidden?: boolean;
  align?: "left" | "center" | "right";
}

export interface SortState {
  key: string;
  dir: "asc" | "desc";
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  keyField: keyof T | ((row: T, index: number) => string | number);

  // Server-driven props
  totalCount?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onSortChange?: (sortKey: string, direction: "asc" | "desc") => void;
  onFilterChange?: (filters: Record<string, unknown>) => void;

  // State
  loading?: boolean;
  emptyMessage?: string;

  // Search
  searchValue?: string;
  onSearchChange?: (value: string) => void;

  // Actions
  onRowClick?: (row: T) => void;
  onExportCsv?: () => void;
  bulkActions?: { label: string; action: (rows: T[]) => void }[];

  // Sort/filter override for client-side
  clientSort?: boolean;
  clientFilter?: boolean;
  initialSort?: SortState;
  initialFilters?: Record<string, unknown>;

  // Styling
  className?: string;
}
