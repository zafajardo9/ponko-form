# FT-006: Table View — Submissions with Sortable, Filterable DataTable

> **Feature Plan** — Replace the current basic submissions table with a full-featured, sortable, filterable `DataTable` component. The table is extracted as a reusable primitive so it can power the submissions view, payments list, templates manager, and any future list view in the app. Enables column visibility toggling, multi-column sorting, text/date/status filtering, CSV export, and service execution log integration.

**Status:** 🚧 **Planned** — not yet implemented

**Dependencies:**
- ✅ **Existing submissions page** (`src/routes/forms/$formId/submissions.tsx`) — current basic table to be replaced
- ✅ **Existing server functions** (`src/lib/server-fns/submissions.ts`) — `getSubmissions` already returns submissions + columns + payment map; needs sort/filter params
- 🚧 **FT-003 (Services Integration)** — `service_execution_logs` table provides per-submission execution status to display
- 🚧 **FT-004 (Notifications)** — notification send status per submission (was confirmation sent? was admin alert sent?)

---

## 1. User Story

> *"I have 200+ submissions on my event registration form. I need to find all the entries where the attendee selected 'VIP', sort them by submission date (newest first), and export them to share with my team. Right now I can only see 3 columns, I can't sort or filter, and there's no export. I have to scroll through pages manually to find anything."*

---

## 2. The Problem

The current submissions page (`src/routes/forms/$formId/submissions.tsx`, lines 104-192) has a hardcoded `<table>` with:

| Limitation | Impact |
|---|---|
| Only shows first 3 columns (`previewColumns`, line 40) | Users with 10+ form fields can't see most data |
| No sorting | Can't sort by date, name, payment status, or any column |
| No filtering | Can't search/filter submissions — must page through manually |
| Not reusable | The table logic is baked into the submissions page; can't reuse for payments, templates, or other list views |
| No CSV export | Can't export data for external analysis |
| No service status | Can't see if emails were sent, sheets synced, etc. (FT-003/FT-004) |
| No bulk actions | Can't select multiple submissions for bulk delete/export |

---

## 3. Architecture — DataTable as a Reusable Primitive

The core of this feature is a generic `<DataTable<T>>` component that can render any tabular data. The submissions page becomes one consumer of it — so do the payments page, the templates manager (FT-005), and future list views.

```
┌─────────────────────────────────────────────────┐
│                  <DataTable<T>>                  │
│  Generic, headless-style table with:             │
│  • Sortable columns (click header → asc/desc)   │
│  • Filterable columns (text, select, date range)│
│  • Column visibility toggle (show/hide columns)  │
│  • Row selection (checkboxes for bulk actions)   │
│  • Pagination (client or server-driven)          │
│  • Empty / loading / error states                │
│  • Export CSV button                             │
│  • Horizontal scroll on overflow                 │
│                                                  │
│  Consumers:                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐     │
│  │Submissions│ │ Payments │ │Templates Mgr │     │
│  │  Page    │ │   Page   │ │  (FT-005)   │     │
│  └──────────┘ └──────────┘ └──────────────┘     │
└─────────────────────────────────────────────────┘
```

### 3.1 DataTable Props Interface

```ts
// src/components/ui/DataTable.tsx

interface DataTableColumn<T> {
  key: string                          // unique column key
  header: string                       // column header text (or ReactNode)
  accessor: (row: T) => React.ReactNode // how to render the cell value
  sortable?: boolean                   // can this column be sorted?
  sortKey?: string                     // key passed to server for sorting (defaults to `key`)
  filterable?: boolean                 // can this column be filtered?
  filterType?: 'text' | 'select' | 'date-range' | 'number-range'
  filterOptions?: { label: string; value: string }[] // for 'select' filter type
  width?: string                       // CSS width (e.g., '120px', 'minmax(200px, 1fr)')
  hideable?: boolean                   // can this column be hidden?
  defaultHidden?: boolean              // hidden by default?
  align?: 'left' | 'center' | 'right'
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: T[]
  keyField: keyof T | ((row: T) => string | number)  // unique key per row
  
  // Server-driven props (optional — for large datasets)
  totalCount?: number
  page?: number
  pageSize?: number
  onPageChange?: (page: number) => void
  onSortChange?: (sortKey: string, direction: 'asc' | 'desc') => void
  onFilterChange?: (filters: Record<string, unknown>) => void
  
  // State
  loading?: boolean
  emptyMessage?: string
  
  // Actions
  onRowClick?: (row: T) => void
  onExportCsv?: () => void
  bulkActions?: { label: string; action: (rows: T[]) => void }[]
  
  // Styling
  className?: string
}
```

### 3.2 Internal State (Client-Side)

For client-side sorting/filtering (when data fits in memory):

```
┌─────────────────────────────────────────────┐
│  DataTable State                             │
│                                              │
│  sortState: { key: string; dir: 'asc'|'desc' } | null
│  filters: Record<string, string | { min; max }>
│  visibleColumns: Set<string>   — toggled via dropdown
│  selectedRows: Set<key>        — for bulk actions
│  page: number                  — client-side pagination
└─────────────────────────────────────────────┘
```

For submissions specifically (potentially 1000s of rows), sorting and filtering are **server-driven** — handed off to `getSubmissions` with query params. For smaller datasets (templates, payments), sorting/filtering is client-side.

---

## 4. Submissions Page — Rewritten as DataTable Consumer

The existing `submissions.tsx` is rewritten to define its columns and pass them to `<DataTable>`.

### 4.1 Column Definitions for Submissions

```ts
const submissionColumns: DataTableColumn<SubmissionRow>[] = [
  {
    key: 'number',
    header: '#',
    accessor: (_, idx) => (page - 1) * pageSize + idx + 1,
    sortable: false,
    width: '60px',
    hideable: false,
  },
  {
    key: 'submittedAt',
    header: 'Submitted',
    accessor: (row) => formatDate(row.submittedAt),
    sortable: true,
    sortKey: 'submitted_at',
    filterable: true,
    filterType: 'date-range',
    width: '170px',
  },
  // Dynamic columns from form fields / flow variables
  ...responseColumns.map((col): DataTableColumn<SubmissionRow> => ({
    key: col.key,
    header: col.label,
    accessor: (row) => formatValue(row.formData[col.key]),
    sortable: true,
    sortKey: col.key,
    filterable: true,
    filterType: guessFilterType(col.key, submissions), // text or select
    hideable: true,
    defaultHidden: false,
    width: 'minmax(120px, 1fr)',
  })),
  {
    key: 'payment',
    header: 'Payment',
    accessor: (row) => row.payment ? <PaymentBadge status={row.payment.status} /> : '—',
    sortable: true,
    sortKey: 'payment_status',
    filterable: true,
    filterType: 'select',
    filterOptions: [
      { label: 'Paid', value: 'completed' },
      { label: 'Pending', value: 'pending' },
      { label: 'Failed', value: 'failed' },
    ],
    width: '100px',
  },
  {
    key: 'services',                              // NEW — FT-003
    header: 'Services',
    accessor: (row) => <ServiceStatusIcons logs={row.serviceLogs} />,
    sortable: false,
    filterable: false,
    width: '100px',
  },
  {
    key: 'notifications',                         // NEW — FT-004
    header: 'Notified',
    accessor: (row) => <NotificationStatusIcon config={row.notificationStatus} />,
    sortable: false,
    filterable: true,
    filterType: 'select',
    filterOptions: [
      { label: 'Sent', value: 'sent' },
      { label: 'Failed', value: 'failed' },
      { label: 'Skipped', value: 'skipped' },
    ],
    width: '80px',
  },
]
```

### 4.2 Enriched Submission Row Type

The `getSubmissions` server function is extended to return enriched rows:

```ts
interface SubmissionRow {
  id: number
  formId: number
  formData: Record<string, unknown>
  submittedAt: string
  status: string
  payment?: { status: string; amount: number; currency: string }
  serviceLogs?: { provider: string; status: string }[]     // FT-003 join
  notificationStatus?: { respondent: string; admin: string } // FT-004 join
}
```

### 4.3 Server-Driven Sort & Filter

`getSubmissions` gains optional `sortKey`, `sortDir`, and `filters` params:

```ts
export const getSubmissions = createServerFn({ method: 'GET', strict: false })
  .inputValidator((data: {
    formId: number
    page?: number
    sortKey?: string       // e.g., 'submitted_at', 'full_name', 'payment_status'
    sortDir?: 'asc' | 'desc'
    filters?: Record<string, unknown>  // { submitted_at: { from, to }, payment_status: 'completed', full_name: 'contains:John' }
  }) => data)
  .handler(async ({ data }) => {
    // ... build dynamic ORDER BY, WHERE clauses based on sortKey/sortDir/filters
    // ... join service_execution_logs (FT-003)
    // ... join notification status (FT-004)
  })
```

---

## 5. UI Layout

### 5.1 Toolbar (Above Table)

```
┌──────────────────────────────────────────────────────────────┐
│  [🔍 Search all fields...________]  [▼ Filters]  [≡ Columns] │
│                                                              │
│  Active filters:                                              │
│  [Payment: Completed ✕] [Date: Jan 1 – Jan 31 ✕] [Clear all] │
└──────────────────────────────────────────────────────────────┘
```

- **Search all fields:** Global text search across all form data values
- **Filters dropdown:** Opens a filter panel per column (text input, select dropdown, date range picker)
- **Columns dropdown:** Checkbox list of hideable columns — toggle visibility
- **Active filters:** Chips showing current filters with ✕ to remove

### 5.2 Table Body

```
┌──────────────────────────────────────────────────────────────────────┐
│ # ↑↓  Submitted ↑        Name ↑↓       Email ↑↓      Payment ↑  ...│
├──────────────────────────────────────────────────────────────────────┤
│ 1      Jan 15, 2:30 PM   John Doe      john@email..  [Paid]   ✓ ✉  │
│ 2      Jan 15, 1:15 PM   Jane Smith    jane@email..  [Pending] ✓ —  │
│ 3      Jan 14, 9:00 AM   Bob Wilson    bob@email...  —        — —   │
│ ...                                                                  │
├──────────────────────────────────────────────────────────────────────┤
│  1–50 of 200                     [← Previous]  Page 1  [Next →]     │
└──────────────────────────────────────────────────────────────────────┘
```

- **Sort indicators:** ↑ (ascending), ↓ (descending), ↑↓ (sortable, not active) on header click
- **Row hover:** `bg-[#f5f0e8]` (same as current, line 141)
- **Row click:** Opens ResponseDialog (same as current, line 142)
- **Horizontal scroll:** Table wrapper has `overflow-x-auto` for wide tables

### 5.3 Column Visibility Dropdown

```
┌─────────────────────┐
│ ≡ Columns           │
│ ┌─────────────────┐ │
│ │ ☑ #              │ │  ← always visible
│ │ ☑ Submitted      │ │  ← always visible
│ │ ☑ Name           │ │
│ │ ☑ Email          │ │
│ │ ☐ Phone          │ │  ← hidden
│ │ ☑ Payment        │ │
│ │ ☑ Services       │ │
│ │ ☑ Notified       │ │
│ └─────────────────┘ │
│ [Reset to Default]  │
└─────────────────────┘
```

### 5.4 Filter Panel (per column)

```
┌──────────────────────────────┐
│ Filter: Submitted            │
│                              │
│ From: [Jan 1, 2026    📅]   │
│ To:   [Jan 31, 2026   📅]   │
│                              │
│ [Apply]  [Clear]             │
└──────────────────────────────┘

┌──────────────────────────────┐
│ Filter: Payment              │
│                              │
│ [Paid      ▾]               │
│  Pending                     │
│  Failed                      │
│                              │
│ [Apply]  [Clear]             │
└──────────────────────────────┘
```

---

## 6. Reusable DataTable — File Structure

```
src/components/ui/
├── DataTable.tsx              # Main DataTable component (generic <T>)
├── DataTableHeader.tsx        # Header row with sortable column headers
├── DataTableRow.tsx           # Single row with click handler
├── DataTablePagination.tsx    # Page controls (Previous, page numbers, Next)
├── DataTableToolbar.tsx       # Search, Filters, Columns, Export buttons
├── DataTableFilterPanel.tsx   # Per-column filter UI (text, select, date-range)
├── DataTableColumnToggle.tsx  # Column visibility dropdown
├── DataTableEmpty.tsx         # Empty state
└── DataTableSkeleton.tsx      # Loading skeleton
```

---

## 7. Extended Server Function — `getSubmissions`

The existing function in `src/lib/server-fns/submissions.ts` (lines 121-194) is extended:

### 7.1 New Input Shape

```ts
.inputValidator((data: {
  formId: number
  page?: number
  sortKey?: string
  sortDir?: 'asc' | 'desc'
  filters?: Record<string, {
    type: 'contains' | 'equals' | 'range' | 'in'
    value: unknown
  }>
}) => data)
```

### 7.2 Dynamic ORDER BY

When `sortKey` is provided, build the ORDER BY clause dynamically:

```ts
// Sorting by formData fields requires jsonb extraction
if (sortKey && sortKey !== 'submitted_at' && sortKey !== 'payment_status') {
  // For form data columns, sort via jsonb field extraction
  const dir = sortDir === 'desc' ? 'DESC' : 'ASC'
  // Use PostgreSQL jsonb ->> operator for text extraction
  orderByClause = sql`form_data->>'${sql.raw(sortKey)}' ${sql.raw(dir)}`
} else if (sortKey === 'submitted_at') {
  orderByClause = sortDir === 'desc' 
    ? desc(formSubmissions.submittedAt)
    : asc(formSubmissions.submittedAt)
}
```

### 7.3 Dynamic Filters

```ts
// Build WHERE clauses from filters
const whereConditions = [eq(formSubmissions.formId, data.formId)]

if (data.filters) {
  for (const [key, filter] of Object.entries(data.filters)) {
    if (filter.type === 'contains') {
      // jsonb field contains text (case-insensitive)
      whereConditions.push(
        sql`LOWER(form_data->>'${sql.raw(key)}') LIKE LOWER(${'%' + filter.value + '%'})`
      )
    } else if (filter.type === 'equals') {
      whereConditions.push(
        sql`form_data->>'${sql.raw(key)}' = ${filter.value}`
      )
    }
  }
}
```

### 7.4 Join Service Logs (FT-003)

```ts
// For each submission, fetch latest service execution status
const serviceLogs = await db
  .select({
    submissionId: serviceExecutionLogs.formSubmissionId,
    provider: serviceExecutionLogs.provider,
    status: serviceExecutionLogs.status,
  })
  .from(serviceExecutionLogs)
  .where(inArray(serviceExecutionLogs.formSubmissionId, subIds))
```

### 7.5 Join Notification Status (FT-004)

```ts
// Check if form has notification config, then check if emails were sent
// (simplified — actual implementation depends on FT-004's notification tracking)
```

---

## 8. CSV Export

Button in the toolbar: `[Export CSV ↓]`

```ts
// src/lib/server-fns/submissions.ts

export const exportSubmissionsCsv = createServerFn({ method: 'GET' })
  .inputValidator((data: { 
    formId: number
    filters?: Record<string, unknown>
    sortKey?: string
    sortDir?: 'asc' | 'desc'
  }) => data)
  .handler(async ({ data }) => {
    // Fetch ALL matching submissions (no pagination limit)
    // Build CSV string with headers = column labels
    // Return as text/csv with Content-Disposition header
  })
```

Client-side triggers a download:

```ts
function handleExport() {
  const csv = await exportSubmissionsCsv({ data: { formId, filters, sortKey, sortDir } })
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${formTitle}_submissions.csv`
  a.click()
}
```

---

## 9. Bulk Actions

Checkbox column (leftmost) enables multi-select:

```
┌──────────────────────────────────────────────────────────────┐
│ ☐ #    Submitted          Name          Email        Payment│
│ ☐ 1    Jan 15, 2:30 PM   John Doe      john@...     [Paid] │
│ ☑ 2    Jan 15, 1:15 PM   Jane Smith    jane@...     [Pend] │
│ ☑ 3    Jan 14, 9:00 AM   Bob Wilson    bob@em...    —      │
├──────────────────────────────────────────────────────────────┤
│  2 selected  [Delete Selected]  [Export Selected]            │
└──────────────────────────────────────────────────────────────┘
```

When rows are selected, a bulk action bar appears at the bottom.

---

## 10. Responsive Behavior

| Breakpoint | Behavior |
|---|---|
| **Desktop (≥1024px)** | Full table with all visible columns, toolbar inline |
| **Tablet (640–1023px)** | Horizontal scroll, toolbar stacks vertically |
| **Mobile (<640px)** | Card view fallback (each row becomes a card) or extremely compact table with 2–3 columns |

The `DataTable` accepts a `mobileView` prop:

```ts
interface DataTableProps<T> {
  // ...
  mobileView?: 'scroll' | 'cards'  // default: 'scroll'
  renderCard?: (row: T, index: number) => React.ReactNode  // for 'cards' mode
}
```

---

## 11. File Change Summary

| File | Purpose |
|---|---|
| `src/components/ui/DataTable.tsx` | **New** — generic DataTable component (core reusable primitive) |
| `src/components/ui/DataTableHeader.tsx` | **New** — sortable header row with sort indicators |
| `src/components/ui/DataTableRow.tsx` | **New** — single row with click, selection, hover |
| `src/components/ui/DataTablePagination.tsx` | **New** — page controls |
| `src/components/ui/DataTableToolbar.tsx` | **New** — search, filters, columns, export toolbar |
| `src/components/ui/DataTableFilterPanel.tsx` | **New** — per-column filter UI |
| `src/components/ui/DataTableColumnToggle.tsx` | **New** — column visibility dropdown |
| `src/components/ui/DataTableEmpty.tsx` | **New** — empty state |
| `src/components/ui/DataTableSkeleton.tsx` | **New** — loading skeleton |
| `src/routes/forms/$formId/submissions.tsx` | **Rewrite** — replace hardcoded `<table>` with `<DataTable>`, define submission columns |
| `src/lib/server-fns/submissions.ts` | **Extend** — add `sortKey`, `sortDir`, `filters` params to `getSubmissions`; add `exportSubmissionsCsv`; join service logs + notification status |
| `src/components/submissions/SubmissionServiceStatus.tsx` | **New** — renders service execution icons per submission (FT-003) |
| `src/components/submissions/SubmissionNotificationStatus.tsx` | **New** — renders notification sent/failed icon per submission (FT-004) |

---

## 12. Step-by-Step Tasks

### Task 1: Build DataTable Component Family
- Create `src/components/ui/DataTable.tsx` — generic `<DataTable<T>>` with all props
- Create `DataTableHeader.tsx` — sortable column headers with ↑↓ indicators
- Create `DataTableRow.tsx` — row with optional checkbox, click handler
- Create `DataTablePagination.tsx` — Previous/Next, page indicator, "X–Y of Z" count
- Create `DataTableToolbar.tsx` — search input, filters dropdown, columns dropdown, export button
- Create `DataTableFilterPanel.tsx` — per-column filter types (text contains, select equals, date range)
- Create `DataTableColumnToggle.tsx` — checkbox list of hideable columns
- Create `DataTableEmpty.tsx` + `DataTableSkeleton.tsx` — empty and loading states

### Task 2: Extend Server Functions
- Add `sortKey`, `sortDir`, `filters` params to `getSubmissions` in `submissions.ts`
- Implement dynamic ORDER BY for jsonb form data columns
- Implement dynamic WHERE filters (contains, equals, range)
- Add `exportSubmissionsCsv` server function
- Join `service_execution_logs` from FT-003
- Join notification status (once FT-004 schema is in place)

### Task 3: Define Submission Columns
- Build `submissionColumns` array in the submissions page
- Dynamic columns from `getResponseColumns()` (flow variables / form fields)
- Payment status column with `PaymentBadge`
- Service status column (FT-003)
- Notification status column (FT-004)

### Task 4: Rewrite Submissions Page
- Replace hardcoded `<table>` (lines 104-192 in `submissions.tsx`) with `<DataTable>`
- Wire sort/filter state to `getSubmissions` query params
- Handle loading, empty, error states via DataTable props
- Keep `ResponseDialog` for row click — pass as `onRowClick`

### Task 5: CSV Export
- Wire `exportSubmissionsCsv` to toolbar button
- Generate CSV with proper headers, escaping, UTF-8 BOM for Excel compatibility
- Download trigger with form title as filename

### Task 6: Column Visibility Persistence
- Save visible columns to `localStorage` keyed by `formId`
- Restore on page load
- "Reset to Default" button in column toggle dropdown

### Task 7: Responsive & Polish
- Card view fallback for mobile (optional — can defer to v2)
- Horizontal scroll with sticky first column (#)
- Keyboard navigation (arrow keys to move between rows, Enter to open)
- Row striping for readability (alternating white / `bg-[#faf9f5]`)

---

## 13. Risks & Open Questions

| Risk | Mitigation |
|---|---|
| **Sorting jsonb fields is slow on large datasets** | Add a GIN index on `form_data` for text search. For sort, consider extracting commonly sorted fields into separate indexed columns in a future optimization. |
| **CSV injection** — form data could contain formula characters (`=`, `+`, `-`, `@`) | Prefix these cells with a single quote `'` to neutralize CSV injection attacks. |
| **Filter state loss** on page refresh | Persist filter/sort state in URL search params (`?sort=name&dir=asc&filter_payment=completed`). TanStack Router supports this natively. |
| **100+ columns** (forms with many fields) | Column visibility toggle lets users hide columns. Default: show first 6 fields, hide the rest. Horizontal scroll handles overflow. |
| **Service logs not yet implemented** (FT-003) | Service columns show "—" until FT-003 is built. Columns are defined but gracefully degrade. |
| **Mobile usability** — tables are inherently desktop-first | Card view fallback or extremely compact table. Mobile users typically view 2–3 key columns. |
| **Reusability scope creep** — DataTable tries to be everything to everyone | Keep the generic component minimal. Add features per consumer via composition, not by bloating the base component. |

---

## 14. Validation / Testing

- [ ] DataTable renders columns and data correctly
- [ ] Column header click toggles sort direction (asc → desc → none)
- [ ] Sort indicators (↑↓) display correctly on active/inactive columns
- [ ] Text filter: typing "John" filters rows where any column contains "John"
- [ ] Select filter: choosing "Paid" shows only rows with payment_status = completed
- [ ] Date range filter: selecting Jan 1–Jan 31 filters submittedAt correctly
- [ ] Column visibility toggle hides/shows columns
- [ ] Column visibility persists in localStorage across page refreshes
- [ ] Pagination: Previous/Next navigate pages correctly, page indicator updates
- [ ] CSV export downloads a valid CSV with correct headers and data
- [ ] CSV export applies current filters and sort order
- [ ] Empty state shows when no submissions match filters
- [ ] Loading state shows skeleton rows while fetching
- [ ] Row click opens ResponseDialog with correct submission data
- [ ] Service status icons render correctly (FT-003 data)
- [ ] Responsive: table scrolls horizontally on narrow viewports
- [ ] Keyboard navigation: arrow keys move between rows, Enter opens detail
