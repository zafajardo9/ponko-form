import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CreditCard } from "lucide-react";
import { FormWorkspaceLayout } from "@/components/forms/FormWorkspaceLayout";
import {
  ResponseActionDialog,
  ResponseRowActions,
} from "@/components/forms/ResponseActions";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useCallback, useMemo } from "react";
import { requireAuth } from "@/lib/server-fns/auth";
import {
  getSubmissions,
  setSubmissionArchived,
  deleteSubmission,
  bulkArchiveSubmissions,
  bulkDeleteSubmissions,
} from "@/lib/server-fns/submissions";
import type { ResponseColumn } from "@/lib/server-fns/submissions";
import { submissionCsvDownloadUrl } from "@/lib/submissions/csv";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { useToast } from "@/components/ui/Toast";
import type { DataTableColumn } from "@/components/ui/DataTableTypes";
import {
  navigationBackIconClass,
  navigationButtonClass,
} from "@/components/ui/Button";

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
  archivedAt: string | null;
  payment?: PaymentInfo;
}

type ResponseView = "active" | "archived";

interface PendingResponseAction {
  kind: "archive" | "delete";
  row: SubmissionRow;
  number: number;
}

function SubmissionsPage() {
  const { formId } = Route.useParams();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortKey, setSortKey] = useState<string>("submitted_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filters, setFilters] = useState<Record<string, unknown>>({});
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [responseView, setResponseView] = useState<ResponseView>("active");
  const [pendingAction, setPendingAction] =
    useState<PendingResponseAction | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<{
    sub: any;
    number: number;
  } | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: [
      "submissions",
      formId,
      responseView,
      page,
      pageSize,
      sortKey,
      sortDir,
      filters,
      search,
    ],
    queryFn: () =>
      getSubmissions({
        data: {
          formId: Number(formId),
          page,
          pageSize,
          sortKey,
          sortDir,
          filters,
          search: search || undefined,
          archived: responseView === "archived",
        },
      }),
  });

  const submissions = data?.submissions ?? [];
  const columns = (data?.columns ?? []) as ResponseColumn[];
  const form = data?.form;
  const paymentMap = (data?.paymentMap ?? {}) as Record<string, PaymentInfo>;
  const totalCount = data?.totalCount ?? 0;

  const hasPaymentData = data?.hasPaymentData ?? false;

  // Build enriched rows
  const rows: SubmissionRow[] = submissions.map((sub: any) => ({
    id: sub.id,
    formId: sub.formId,
    formData: sub.formData as Record<string, unknown>,
    submittedAt: sub.submittedAt,
    status: sub.status,
    archivedAt: sub.archivedAt,
    payment: paymentMap[String(sub.id)] as PaymentInfo | undefined,
  }));

  const openResponse = useCallback(
    (row: SubmissionRow, index: number) => {
      const submission = submissions.find((item) => item.id === row.id);
      if (!submission) return;
      setSelected({
        sub: submission,
        number: (page - 1) * pageSize + index + 1,
      });
    },
    [page, pageSize, submissions],
  );

  const archiveMutation = useMutation({
    mutationFn: ({ submissionId, archived }: { submissionId: number; archived: boolean }) =>
      setSubmissionArchived({
        data: { formId: Number(formId), submissionId, archived },
      }),
    onSuccess: async (_result, variables) => {
      setPendingAction(null);
      const message = variables.archived ? "Response archived." : "Response restored.";
      setActionMessage(message);
      toast.success(message);
      if (rows.length === 1 && page > 1) setPage(page - 1);
      await queryClient.invalidateQueries({ queryKey: ["submissions", formId] });
    },
    onError: (error) => {
      const detail = error instanceof Error ? error.message : "Unable to update the response.";
      setActionMessage(detail);
      toast.error("Response was not updated", detail);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (submissionId: number) =>
      deleteSubmission({ data: { formId: Number(formId), submissionId } }),
    onSuccess: async () => {
      setPendingAction(null);
      setActionMessage("Response permanently deleted.");
      toast.success("Response permanently deleted");
      if (rows.length === 1 && page > 1) setPage(page - 1);
      await queryClient.invalidateQueries({ queryKey: ["submissions", formId] });
    },
    onError: (error) => {
      const detail = error instanceof Error ? error.message : "Unable to delete the response.";
      setActionMessage(detail);
      toast.error("Response was not deleted", detail);
    },
  });

  // Bulk mutations
  const bulkArchiveMutation = useMutation({
    mutationFn: ({ submissionIds, archived }: { submissionIds: number[]; archived: boolean }) =>
      bulkArchiveSubmissions({ data: { formId: Number(formId), submissionIds, archived } }),
    onSuccess: async (_result, variables) => {
      const message = variables.archived
          ? `${_result.count} response(s) archived.`
          : `${_result.count} response(s) restored.`;
      setActionMessage(message);
      toast.success(message);
      if (pageSize > 1 && variables.submissionIds.length >= rows.length && page > 1) setPage(page - 1);
      await queryClient.invalidateQueries({ queryKey: ["submissions", formId] });
    },
    onError: (error) => {
      const detail = error instanceof Error ? error.message : "Bulk archive failed.";
      setActionMessage(detail);
      toast.error("Selected responses were not updated", detail);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (submissionIds: number[]) =>
      bulkDeleteSubmissions({ data: { formId: Number(formId), submissionIds } }),
    onSuccess: async (_result, variables) => {
      setActionMessage(`${_result.count} response(s) deleted.`);
      toast.success(`${_result.count} response(s) permanently deleted`);
      if (pageSize > 1 && variables.length >= rows.length && page > 1) setPage(page - 1);
      await queryClient.invalidateQueries({ queryKey: ["submissions", formId] });
    },
    onError: (error) => {
      const detail = error instanceof Error ? error.message : "Bulk delete failed.";
      setActionMessage(detail);
      toast.error("Selected responses were not deleted", detail);
    },
  });

  // Build bulk actions based on current view
  const bulkActions = useMemo(() => {
    const deleteSelected = {
      label: "Delete",
      tone: "danger" as const,
      action: (selected: SubmissionRow[]) => {
        const ids = selected.map((row) => row.id);
        if (ids.length === 0) return;
        if (
          !window.confirm(
            `Permanently delete ${ids.length} selected ${
              ids.length === 1 ? "response" : "responses"
            }? This cannot be undone.`,
          )
        ) {
          return;
        }
        bulkDeleteMutation.mutate(ids);
      },
    };

    if (responseView === "active") {
      return [
        {
          label: "Archive",
          action: (selected: SubmissionRow[]) => {
            const ids = selected.map((r) => r.id);
            if (ids.length === 0) return;
            bulkArchiveMutation.mutate({ submissionIds: ids, archived: true });
          },
        },
        deleteSelected,
      ];
    }
    return [
      {
        label: "Restore",
        action: (selected: SubmissionRow[]) => {
          const ids = selected.map((r) => r.id);
          if (ids.length === 0) return;
          bulkArchiveMutation.mutate({ submissionIds: ids, archived: false });
        },
      },
      deleteSelected,
    ];
  }, [responseView, bulkArchiveMutation, bulkDeleteMutation]);

  // Build column definitions
  const submissionColumns: DataTableColumn<SubmissionRow>[] = [
    {
      key: "number",
      header: "#",
      accessor: (_row, idx) => (page - 1) * pageSize + idx + 1,
      sortable: false,
      width: "48px",
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
      width: "160px",
    },
    {
      key: "status",
      header: "Response",
      accessor: (row) => <ResponseStatusBadge status={row.status} />,
      sortable: true,
      sortKey: "status",
      width: "148px",
      filterable: true,
      filterType: "select",
      filterOptions: [
        { label: "Completed", value: "completed" },
        { label: "Awaiting payment", value: "pending_payment" },
        { label: "Payment failed", value: "payment_failed" },
        { label: "Incomplete", value: "incomplete" },
      ],
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
        width: /email/i.test(col.label)
          ? "190px"
          : /full\s*name/i.test(col.label)
            ? "170px"
            : /name/i.test(col.label)
              ? "104px"
              : "148px",
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
            width: "112px",
          } satisfies DataTableColumn<SubmissionRow>,
        ]
      : []),
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      accessor: (row, index) => {
        const number = (page - 1) * pageSize + index + 1;
        return (
          <ResponseRowActions
            archived={responseView === "archived"}
            busy={archiveMutation.isPending || deleteMutation.isPending}
            onView={() => openResponse(row, index)}
            onArchive={() => setPendingAction({ kind: "archive", row, number })}
            onRestore={() =>
              archiveMutation.mutate({ submissionId: row.id, archived: false })
            }
            onDelete={() => setPendingAction({ kind: "delete", row, number })}
          />
        );
      },
      sortable: false,
      hideable: false,
      align: "right",
      width: "128px",
    },
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

  const downloadCsv = useCallback(() => {
    const anchor = document.createElement("a");
    anchor.href = submissionCsvDownloadUrl({
      formId,
      filters,
      sortKey,
      sortDir,
      search: search || undefined,
      archived: responseView === "archived",
    });
    anchor.hidden = true;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }, [filters, formId, responseView, search, sortDir, sortKey]);

  return (
    <FormWorkspaceLayout
      formId={formId}
      formTitle={form?.title}
      active="responses"
      hasPayment={data?.hasPaymentFlow ?? false}
      title="Responses"
      count={totalCount}
      wide
      actions={
        <>
          {hasPaymentData && (
            <Link
              to="/forms/$formId/payments"
              params={{ formId }}
              className={navigationButtonClass}
            >
              <CreditCard size={15} aria-hidden="true" />
              View payments
            </Link>
          )}
          <Link
            to="/forms/$formId/edit"
            params={{ formId }}
            className={navigationButtonClass}
          >
            <ArrowLeft size={15} className={navigationBackIconClass} />
            Back to builder
          </Link>
        </>
      }
    >
      <div className="mb-4 flex min-h-10 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="inline-flex w-fit rounded-lg border border-[#e6dfd8] bg-[#f5f0e8] p-0.5"
          role="group"
          aria-label="Response view"
        >
          {(["active", "archived"] as const).map((view) => (
            <button
              key={view}
              type="button"
              aria-pressed={responseView === view}
              onClick={() => {
                setResponseView(view);
                setPage(1);
                setActionMessage(null);
              }}
              className={`rounded-md px-3 py-1.5 text-sm capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cc785c] ${
                responseView === view
                  ? "bg-white font-medium text-[#141413] shadow-sm"
                  : "text-[#6c6a64] hover:text-[#141413]"
              }`}
            >
              {view}
            </button>
          ))}
        </div>
        {actionMessage && (
          <p role="status" className="text-sm text-[#6c6a64]">
            {actionMessage}
          </p>
        )}
      </div>

      {/* DataTable */}
      <DataTable
        columns={submissionColumns}
        data={rows}
        keyField="id"
        selectionLabel="response"
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setPage(1);
        }}
        onSortChange={handleSortChange}
        onFilterChange={handleFilterChange}
        loading={isLoading}
        emptyMessage={
          responseView === "archived"
            ? "No archived responses."
            : "No responses yet."
        }
        onRowClick={(row) => openResponse(row, rows.indexOf(row))}
        onExportCsv={downloadCsv}
        initialSort={{ key: "submitted_at", dir: "desc" }}
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        bulkActions={bulkActions}
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

      {pendingAction && (
        <ResponseActionDialog
          kind={pendingAction.kind}
          number={pendingAction.number}
          busy={archiveMutation.isPending || deleteMutation.isPending}
          onCancel={() => setPendingAction(null)}
          onConfirm={() => {
            if (pendingAction.kind === "archive") {
              archiveMutation.mutate({
                submissionId: pendingAction.row.id,
                archived: true,
              });
            } else {
              deleteMutation.mutate(pendingAction.row.id);
            }
          }}
        />
      )}
    </FormWorkspaceLayout>
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
