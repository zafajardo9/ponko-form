import { createFileRoute, Link } from "@tanstack/react-router";
import { FormSectionNav } from "../../../components/forms/FormSectionNav";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect, useState, useCallback } from "react";
import { requireAuth } from "../../../lib/server-fns/auth";
import {
  getSubmissions,
  exportSubmissionsCsv,
} from "../../../lib/server-fns/submissions";
import type { ResponseColumn } from "../../../lib/server-fns/submissions";
import { Badge } from "../../../components/ui/Badge";
import { DataTable } from "../../../components/ui/DataTable";
import type { DataTableColumn } from "../../../components/ui/DataTableTypes";

export const Route = createFileRoute("/forms/$formId/submissions")({
  beforeLoad: ({ location }) => requireAuth({ data: { returnTo: location.href } }),
  component: SubmissionsPage,
});

interface PaymentInfo {
  status: string;
  amount: number;
  currency: string;
}

interface SubmissionRow {
  id: number;
  formId: number;
  formData: Record<string, unknown>;
  submittedAt: string;
  status: string;
  payment?: PaymentInfo;
}

function SubmissionsPage() {
  const { formId } = Route.useParams();
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string>("submitted_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filters, setFilters] = useState<Record<string, unknown>>({});
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{
    sub: any;
    number: number;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["submissions", formId, page, sortKey, sortDir, filters, search],
    queryFn: () =>
      getSubmissions({
        data: {
          formId: Number(formId),
          page,
          sortKey,
          sortDir,
          filters,
          search: search || undefined,
        },
      }),
  });

  const submissions = data?.submissions ?? [];
  const columns = (data?.columns ?? []) as ResponseColumn[];
  const form = data?.form;
  const paymentMap = (data?.paymentMap ?? {}) as Record<string, PaymentInfo>;
  const totalCount = data?.totalCount ?? 0;

  const hasPaymentData = Object.keys(paymentMap).length > 0;

  // Build enriched rows
  const rows: SubmissionRow[] = submissions.map((sub: any) => ({
    id: sub.id,
    formId: sub.formId,
    formData: sub.formData as Record<string, unknown>,
    submittedAt: sub.submittedAt,
    status: sub.status,
    payment: paymentMap[String(sub.id)] as PaymentInfo | undefined,
  }));

  // Build column definitions
  const submissionColumns: DataTableColumn<SubmissionRow>[] = [
    {
      key: "number",
      header: "#",
      accessor: (_row, idx) => (page - 1) * 50 + idx + 1,
      sortable: false,
      width: "60px",
      hideable: false,
    },
    {
      key: "submittedAt",
      header: "Submitted",
      accessor: (row) =>
        row.submittedAt ? new Date(row.submittedAt).toLocaleString() : "—",
      sortable: true,
      sortKey: "submitted_at",
      filterable: true,
      filterType: "date-range",
      width: "170px",
    },
    {
      key: "status",
      header: "Response",
      accessor: (row) => <ResponseStatusBadge status={row.status} />,
      sortable: true,
      sortKey: "status",
      width: "130px",
    },
    ...columns.map(
      (col): DataTableColumn<SubmissionRow> => ({
        key: col.key,
        header: col.label,
        accessor: (row) => formatValue(row.formData[col.key]),
        sortable: true,
        sortKey: col.key,
        filterable: true,
        filterType: "text",
        hideable: true,
        defaultHidden: false,
        width: "minmax(120px, 1fr)",
      }),
    ),
    ...(hasPaymentData
      ? [
          {
            key: "payment",
            header: "Payment",
            accessor: (row: SubmissionRow) =>
              row.payment ? (
                <PaymentBadge status={row.payment.status} />
              ) : (
                <span className="text-xs text-[#8e8b82]">—</span>
              ),
            sortable: true,
            sortKey: "payment_status",
            filterable: true,
            filterType: "select" as const,
            filterOptions: [
              { label: "Paid", value: "completed" },
              { label: "Pending", value: "pending" },
              { label: "Failed", value: "failed" },
              { label: "None", value: "none" },
            ],
            width: "100px",
          } satisfies DataTableColumn<SubmissionRow>,
        ]
      : []),
  ];

  // Sort change handler
  const handleSortChange = useCallback(
    (key: string, direction: "asc" | "desc") => {
      setSortKey(key);
      setSortDir(direction);
      setPage(1);
    },
    [],
  );

  // Filter change handler
  const handleFilterChange = useCallback(
    (newFilters: Record<string, unknown>) => {
      setFilters(newFilters);
      setPage(1);
    },
    [],
  );

  // CSV export
  const exportMutation = useMutation({
    mutationFn: async () => {
      const csv = await exportSubmissionsCsv({
        data: {
          formId: Number(formId),
          filters,
          sortKey,
          sortDir,
          search: search || undefined,
        },
      });
      return csv;
    },
    onSuccess: (csv: string) => {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${form?.title ?? "form"}_submissions.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      {/* Header */}
      <div className="mb-5">
        <FormSectionNav formId={formId} active="responses" />
      </div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-[#6c6a64]">
            <Link to="/forms" className="hover:text-[#141413]">
              Forms
            </Link>
            <span>/</span>
            <Link
              to="/forms/$formId/edit"
              params={{ formId }}
              className="hover:text-[#141413]"
            >
              {form?.title ?? "Form"}
            </Link>
            <span>/</span>
            <span className="text-[#141413]">Responses</span>
          </div>
          <h1 className="text-2xl font-medium text-[#141413]">
            Responses
            {totalCount > 0 && (
              <span className="ml-2 text-base text-[#6c6a64]">
                ({totalCount})
              </span>
            )}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {hasPaymentData && (
            <Link
              to="/forms/$formId/payments"
              params={{ formId }}
              className="text-sm text-[#cc785c] hover:text-[#a9583e]"
            >
              View Payments →
            </Link>
          )}
          <Link to="/forms/$formId/edit" params={{ formId }}>
            <span className="text-sm text-[#cc785c] hover:text-[#a9583e]">
              ← Back to builder
            </span>
          </Link>
        </div>
      </div>

      {/* DataTable */}
      <DataTable
        columns={submissionColumns}
        data={rows}
        keyField="id"
        totalCount={totalCount}
        page={page}
        pageSize={50}
        onPageChange={setPage}
        onSortChange={handleSortChange}
        onFilterChange={handleFilterChange}
        loading={isLoading || exportMutation.isPending}
        emptyMessage="No responses yet."
        onRowClick={(row) => {
          const idx = rows.indexOf(row);
          setSelected({
            sub: submissions[idx],
            number: (page - 1) * 50 + idx + 1,
          });
        }}
        onExportCsv={() => exportMutation.mutate()}
        searchValue={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
      />

      {/* Response Dialog */}
      {selected && (
        <ResponseDialog
          number={selected.number}
          submission={selected.sub}
          columns={columns}
          payment={
            paymentMap[String(selected.sub.id)] as PaymentInfo | undefined
          }
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function PaymentBadge({ status }: { status: string }) {
  switch (status) {
    case "completed":
      return <Badge variant="paid">Paid</Badge>;
    case "pending":
      return <Badge variant="pending">Pending</Badge>;
    case "failed":
      return <Badge variant="failed">Failed</Badge>;
    case "refunded":
      return <Badge variant="refunded">Refunded</Badge>;
    default:
      return <span className="text-xs text-[#8e8b82]">{status}</span>;
  }
}

function ResponseStatusBadge({ status }: { status: string }) {
  if (status === "completed") return <Badge variant="paid">Completed</Badge>;
  if (status === "incomplete") return <Badge variant="pending">Incomplete paid</Badge>;
  if (status === "pending_payment") return <Badge variant="pending">Awaiting payment</Badge>;
  if (status === "payment_failed") return <Badge variant="failed">Payment failed</Badge>;
  return <span className="text-xs text-[#8e8b82]">{status}</span>;
}

function ResponseDialog({
  number,
  submission,
  columns,
  payment,
  onClose,
}: {
  number: number;
  submission: any;
  columns: ResponseColumn[];
  payment?: PaymentInfo;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const formData = (submission.formData as Record<string, unknown>) ?? {};
  const paymentRef = formData.payment_ref as string | undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-[#faf9f5] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e6dfd8] px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[#141413]">
              Response #{number}
            </h2>
            <p className="mt-0.5 text-xs text-[#8e8b82]">
              Submitted {new Date(submission.submittedAt).toLocaleString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#8e8b82] transition-colors hover:bg-[#e8e0d2] hover:text-[#141413]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {columns.length === 0 ? (
            <p className="text-sm text-[#8e8b82]">
              This form has no input fields to display.
            </p>
          ) : (
            <dl className="divide-y divide-[#e6dfd8] rounded-lg border border-[#e6dfd8] bg-white">
              {columns.map((c) => (
                <div
                  key={c.key}
                  className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
                >
                  <dt className="text-sm font-medium text-[#6c6a64] sm:w-1/3 sm:shrink-0">
                    {c.label}
                  </dt>
                  <dd className="whitespace-pre-wrap break-words text-sm text-[#141413] sm:flex-1 sm:text-right">
                    {formatValue(formData[c.key])}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {payment && (
            <div className="mt-5 rounded-lg border border-[#e6dfd8] bg-white p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8e8b82]">
                Payment
              </p>
              <div className="mt-2 flex items-center justify-between">
                <span>
                  <PaymentBadge status={payment.status} />
                </span>
                <span className="text-sm font-medium text-[#141413]">
                  {formatMoney(payment.amount / 100, payment.currency)}
                </span>
              </div>
              {paymentRef && (
                <p className="mt-2 text-xs text-[#8e8b82]">
                  Reference:{" "}
                  <span className="font-mono text-[#57544d]">{paymentRef}</span>
                </p>
              )}
            </div>
          )}

          {!payment && paymentRef && (
            <p className="mt-4 text-xs text-[#8e8b82]">
              Payment reference:{" "}
              <span className="font-mono text-[#57544d]">{paymentRef}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  return String(value);
}

function formatMoney(major: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(major);
  } catch {
    return `${currency} ${major.toFixed(2)}`;
  }
}
