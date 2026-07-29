import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { requireAuth } from "@/lib/server-fns/auth";
import {
  getFormPayments,
  getPaymentActivity,
  verifyFormPayment,
  getPaymentRecoveryLink,
  replaceExpiredPaymentLink,
  emailPaymentRecoveryLink,
  bulkVerifyPayments,
  type PaymentViewRow,
} from "@/lib/server-fns/payments-view";
import { Badge } from "@/components/ui/Badge";
import { FormWorkspaceLayout } from "@/components/forms/FormWorkspaceLayout";
import { useToast } from "@/components/ui/Toast";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/ui/DataTable";
import {
  navigationBackIconClass,
  navigationButtonClass,
} from "@/components/ui/Button";

export const Route = createFileRoute("/forms/$formId/payments")({
  beforeLoad: ({ location }) => requireAuth({ data: { returnTo: location.href } }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const { formId } = Route.useParams();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortKey, setSortKey] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filters, setFilters] = useState<Record<string, unknown>>({});
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PaymentViewRow | null>(null);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
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
      "form-payments",
      formId,
      page,
      pageSize,
      sortKey,
      sortDir,
      filters,
      search,
    ],
    queryFn: () =>
      getFormPayments({
        data: {
          formId: Number(formId),
          page,
          pageSize,
          sortKey,
          sortDir,
          filters,
          search,
        },
      }),
  });

  const payments = data?.payments ?? [];
  const totalCount = data?.totalCount ?? 0;
  const hasPaymentFlow = data?.hasPaymentFlow ?? false;
  const formTitle = data?.formTitle;
  const activityQuery = useQuery({
    queryKey: ["payment-activity", formId, selected?.id],
    queryFn: () => {
      if (!selected) throw new Error("Select a payment");
      return getPaymentActivity({
        data: { formId: Number(formId), paymentId: selected.id },
      });
    },
    enabled: selected != null,
  });
  const selectedPayment =
    selected && activityQuery.data
      ? { ...selected, ...activityQuery.data }
      : selected;
  const verifyMut = useMutation({
    mutationFn: (paymentId: number) => verifyFormPayment({ data: { formId: Number(formId), paymentId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["form-payments", formId] });
      setSelected(null);
      toast.success("Payment verification recorded", "The payment status and activity are up to date.");
    },
    onError: (error) =>
      toast.error("Payment could not be verified", (error as Error).message),
  });
  const copyLinkMut = useMutation({
    mutationFn: (paymentId: number) => getPaymentRecoveryLink({ data: { formId: Number(formId), paymentId } }),
    onSuccess: async (result) => {
      await navigator.clipboard.writeText(result.paymentUrl);
      const message = "Payment link copied. You can send it to the respondent.";
      setRecoveryMessage(message);
      toast.success("Payment link copied", "It is ready to paste into a message.");
      await queryClient.invalidateQueries({ queryKey: ["form-payments", formId] });
    },
    onError: (error) => {
      setRecoveryMessage((error as Error).message);
      toast.error("Payment link could not be copied", (error as Error).message);
    },
  });
  const replaceLinkMut = useMutation({
    mutationFn: ({
      paymentId,
      recipientEmail,
    }: {
      paymentId: number;
      recipientEmail?: string;
    }) =>
      replaceExpiredPaymentLink({
        data: { formId: Number(formId), paymentId, recipientEmail },
      }),
    onSuccess: async (result) => {
      await navigator.clipboard.writeText(result.paymentUrl);
      const message = result.emailSent
          ? "Replacement payment link created, emailed, and copied."
          : result.emailError
            ? `Replacement link created and copied, but email failed: ${result.emailError}`
            : result.reused
              ? "Active payment link copied."
              : "Replacement payment link created and copied.";
      setRecoveryMessage(message);
      if (result.emailError) toast.info("Replacement link created", message);
      else toast.success(result.reused ? "Active payment link copied" : "Replacement link ready", message);
      await queryClient.invalidateQueries({ queryKey: ["form-payments", formId] });
    },
    onError: (error) => {
      setRecoveryMessage((error as Error).message);
      toast.error("Replacement link could not be created", (error as Error).message);
    },
  });
  const emailLinkMut = useMutation({
    mutationFn: ({ paymentId, recipientEmail }: { paymentId: number; recipientEmail: string }) =>
      emailPaymentRecoveryLink({ data: { formId: Number(formId), paymentId, recipientEmail } }),
    onSuccess: async () => {
      setRecoveryMessage("Payment reminder accepted for delivery.");
      toast.success("Payment reminder accepted", "The email provider accepted it for delivery.");
      await queryClient.invalidateQueries({ queryKey: ["form-payments", formId] });
    },
    onError: (error) => {
      setRecoveryMessage((error as Error).message);
      toast.error("Payment reminder was not sent", (error as Error).message);
    },
  });

  // Bulk verify mutation
  const bulkVerifyMut = useMutation({
    mutationFn: (paymentIds: number[]) =>
      bulkVerifyPayments({ data: { formId: Number(formId), paymentIds } }),
    onSuccess: async (result) => {
      setRecoveryMessage(`${result.verified} payment(s) verified.`);
      toast.success(`${result.verified} payment(s) verified`, "Payment activity has been refreshed.");
      await queryClient.invalidateQueries({ queryKey: ["form-payments", formId] });
    },
    onError: (error) => {
      setRecoveryMessage((error as Error).message);
      toast.error("Selected payments could not be verified", (error as Error).message);
    },
  });

  // No payment flow configured for this form.
  if (
    !isLoading &&
    !hasPaymentFlow &&
    totalCount === 0 &&
    !search &&
    Object.keys(filters).length === 0
  ) {
    return (
      <FormWorkspaceLayout
        formId={formId}
        formTitle={formTitle}
        active="payments"
        title="Payments"
      >
        <div className="rounded-xl border border-dashed border-[#e6dfd8] py-24 text-center">
          <p className="text-[#8e8b82]">
            This form doesn't have any payment steps configured.
          </p>
          <p className="mt-1 text-xs text-[#8e8b82]">
            Add a <strong>Payment</strong> node to your flow to start collecting
            transactions.
          </p>
          <Link
            to="/forms/$formId/edit"
            params={{ formId }}
            className={`${navigationButtonClass} mt-5`}
          >
            <ArrowLeft size={15} className={navigationBackIconClass} />
            Back to builder
          </Link>
        </div>
      </FormWorkspaceLayout>
    );
  }

  // Format a money value from minor units to a readable string.
  function formatAmount(amount: number, currency: string): string {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
      }).format(amount / 100);
    } catch {
      return `${currency} ${(amount / 100).toFixed(2)}`;
    }
  }

  // Status badge variant.
  function statusBadge(status: string) {
    switch (status) {
      case "completed":
        return <Badge variant="paid">Completed</Badge>;
      case "pending":
        return <Badge variant="pending">Pending</Badge>;
      case "failed":
        return <Badge variant="failed">Failed</Badge>;
      case "refunded":
        return <Badge variant="refunded">Refunded</Badge>;
      default:
        return <Badge variant="draft">{status}</Badge>;
    }
  }

  function subscriptionStatusBadge(status: string | null) {
    if (status === "active") return <Badge variant="paid">Active</Badge>;
    if (status === "past_due" || status === "failed") return <Badge variant="failed">{status === "past_due" ? "Past due" : "Failed"}</Badge>;
    if (status === "cancelled" || status === "deactivated" || status === "completed") return <Badge variant="draft">{status === "cancelled" ? "Cancelled" : status === "deactivated" ? "Deactivated" : "Ended"}</Badge>;
    return <Badge variant="pending">{status ?? "Pending"}</Badge>;
  }

  const paymentColumns: DataTableColumn<PaymentViewRow>[] = [
    {
      key: "invoice",
      header: "Invoice",
      width: "150px",
      sortable: true,
      accessor: (payment) => (
        <span className="whitespace-nowrap font-mono text-xs text-[#57544d]">
          {payment.invoiceNo}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Date",
      sortable: true,
      filterable: true,
      filterType: "date-range",
      width: "190px",
      accessor: (payment) => (
        <span className="whitespace-nowrap text-[#6c6a64]">
          {new Date(payment.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      filterable: true,
      filterType: "number-range",
      width: "140px",
      accessor: (payment) => (
        <span className="whitespace-nowrap font-medium text-[#141413]">
          {formatAmount(payment.amount, payment.currency)}
          {payment.paymentKind === "subscription" && (
            <span className="ml-1 text-xs font-normal text-[#8e8b82]">/cycle</span>
          )}
        </span>
      ),
    },
    {
      key: "paymentKind",
      header: "Type",
      filterable: true,
      filterType: "select",
      filterOptions: [
        { label: "One-time", value: "one_time" },
        { label: "Subscription", value: "subscription" },
      ],
      width: "130px",
      accessor: (payment) =>
        payment.paymentKind === "subscription" ? "Subscription" : "One-time",
    },
    {
      key: "subscriber",
      header: "Subscriber",
      sortable: true,
      width: "210px",
      accessor: (payment) =>
        payment.paymentKind === "subscription" ? (
          <div className="max-w-[180px]">
            <p className="truncate text-[#57544d]">
              {payment.respondentName ?? "Subscriber"}
            </p>
            <p className="truncate text-xs text-[#8e8b82]">
              {payment.respondentEmail ?? "—"}
            </p>
          </div>
        ) : (
          <span className="text-[#8e8b82]">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      filterable: true,
      filterType: "select",
      filterOptions: [
        { label: "Pending payment", value: "one_time:pending" },
        { label: "Completed payment", value: "one_time:completed" },
        { label: "Failed payment", value: "one_time:failed" },
        { label: "Refunded payment", value: "one_time:refunded" },
        { label: "Pending subscription", value: "subscription:pending" },
        { label: "Active subscription", value: "subscription:active" },
        { label: "Paused subscription", value: "subscription:paused" },
        { label: "Past-due subscription", value: "subscription:past_due" },
        { label: "Cancelled subscription", value: "subscription:cancelled" },
        { label: "Deactivated subscription", value: "subscription:deactivated" },
        { label: "Ended subscription", value: "subscription:completed" },
      ],
      width: "140px",
      accessor: (payment) =>
        payment.paymentKind === "subscription"
          ? subscriptionStatusBadge(payment.subscriptionStatus)
          : statusBadge(payment.status),
    },
    {
      key: "gateway",
      header: "Gateway",
      sortable: true,
      filterable: true,
      filterType: "select",
      filterOptions: [
        { label: "Xendit", value: "xendit" },
        { label: "PayPal", value: "paypal" },
      ],
      width: "120px",
      accessor: (payment) => payment.gatewayName,
    },
    {
      key: "channel",
      header: "Channel",
      sortable: true,
      hideable: true,
      defaultHidden: true,
      accessor: (payment) => payment.paymentChannel ?? "—",
    },
    {
      key: "reference",
      header: "Reference",
      sortable: true,
      hideable: true,
      defaultHidden: true,
      accessor: (payment) => (
        <span className="block max-w-[140px] truncate font-mono text-xs text-[#8e8b82]">
          {payment.gatewayPaymentId ?? "—"}
        </span>
      ),
    },
    {
      key: "details",
      header: "",
      align: "right",
      width: "110px",
      accessor: () => (
        <span className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-[#a9583e]">
          Details <ChevronRight size={14} aria-hidden="true" />
        </span>
      ),
    },
  ];

  return (
    <FormWorkspaceLayout
      formId={formId}
      formTitle={formTitle}
      active="payments"
      title="Payments"
      count={totalCount}
      wide
      description={
        hasPaymentFlow
          ? "All payment transactions processed through this form's flow."
          : undefined
      }
    >
      <DataTable
        columns={paymentColumns}
        data={payments}
        keyField="id"
        selectionLabel="payment"
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setPage(1);
        }}
        onSortChange={(nextSortKey, nextSortDir) => {
          setSortKey(nextSortKey);
          setSortDir(nextSortDir);
          setPage(1);
        }}
        onFilterChange={(nextFilters) => {
          setFilters(nextFilters);
          setPage(1);
        }}
        loading={isLoading}
        emptyMessage={
          search || Object.keys(filters).length > 0
            ? "No payment transactions match your search or filters."
            : "No payment transactions yet."
        }
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        onRowClick={setSelected}
        initialSort={{ key: "createdAt", dir: "desc" }}
        bulkActions={[
          {
            label: "Verify",
            action: (selected: PaymentViewRow[]) =>
              bulkVerifyMut.mutate(selected.map((p) => p.id)),
          },
        ]}
      />

      {selectedPayment && (
        <PaymentDetailDialog
          payment={selectedPayment}
          onClose={() => setSelected(null)}
          formatAmount={formatAmount}
          onVerify={() => verifyMut.mutate(selectedPayment.id)}
          verifying={verifyMut.isPending}
          formId={formId}
          onCopyLink={() => copyLinkMut.mutate(selectedPayment.id)}
          onReplaceLink={(recipientEmail) =>
            replaceLinkMut.mutate({
              paymentId: selectedPayment.id,
              recipientEmail,
            })
          }
          recoveryBusy={copyLinkMut.isPending || replaceLinkMut.isPending}
          recoveryMessage={recoveryMessage}
          onEmailLink={(recipientEmail) =>
            emailLinkMut.mutate({
              paymentId: selectedPayment.id,
              recipientEmail,
            })
          }
          emailing={emailLinkMut.isPending}
          activityLoading={activityQuery.isLoading}
        />
      )}
    </FormWorkspaceLayout>
  );
}

function PaymentDetailDialog({
  payment,
  onClose,
  formatAmount,
  onVerify,
  verifying,
  formId,
  onCopyLink,
  onReplaceLink,
  recoveryBusy,
  recoveryMessage,
  onEmailLink,
  emailing,
  activityLoading,
}: {
  payment: PaymentViewRow;
  onClose: () => void;
  formatAmount: (amount: number, currency: string) => string;
  onVerify: () => void;
  verifying: boolean;
  formId: string;
  onCopyLink: () => void;
  onReplaceLink: (recipientEmail?: string) => void;
  recoveryBusy: boolean;
  recoveryMessage: string | null;
  onEmailLink: (recipientEmail: string) => void;
  emailing: boolean;
  activityLoading: boolean;
}) {
  const [recipientEmail, setRecipientEmail] = useState(
    payment.respondentEmail ?? "",
  );
  const validRecipient = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    recipientEmail.trim(),
  );
  // Close on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-xl bg-[#faf9f5] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e6dfd8] px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[#141413]">
              {payment.invoiceNo}
            </h2>
            <p className="mt-0.5 text-xs text-[#8e8b82]">
              {new Date(payment.createdAt).toLocaleString()}
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
          {/* Status + Amount row */}
          <div className="mb-5 flex items-center justify-between rounded-lg border border-[#e6dfd8] bg-white px-5 py-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-[#8e8b82]">Status</span>
              {statusBadgeText(payment.paymentKind === "subscription" ? payment.subscriptionStatus ?? "pending" : payment.status)}
            </div>
            <div className="text-right">
              <span className="text-xs text-[#8e8b82]">Amount</span>
              <p className="text-2xl font-semibold text-[#141413]">
                {formatAmount(payment.amount, payment.currency)}
              </p>
            </div>
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            <button onClick={onVerify} disabled={verifying} className="rounded-md bg-[#141413] px-3 py-2 text-sm text-white disabled:opacity-50">
              {verifying ? "Verifying…" : "Verify now"}
            </button>
            {payment.submissionId && (
              <Link to="/forms/$formId/submissions" params={{ formId: String(formId) }} className="rounded-md border border-[#e6dfd8] px-3 py-2 text-sm text-[#141413]">
                Open response
              </Link>
            )}
          </div>

          {payment.paymentKind === "one_time" &&
            payment.status !== "completed" &&
            payment.status !== "refunded" && (
              <section className="mb-5 rounded-xl border border-[#ded5ca] bg-[#f6f1e9] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-[#141413]">
                      Payment recovery
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-[#6c6a64]">
                      The system verifies the provider before creating another checkout,
                      which helps prevent duplicate payments.
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#876e59]">
                    Safeguarded
                  </span>
                </div>

                <label className="mt-4 block">
                  <span className="text-xs font-medium text-[#57544d]">
                    Respondent email
                  </span>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(event) => setRecipientEmail(event.target.value)}
                    placeholder="name@example.com"
                    className="mt-1.5 h-10 w-full rounded-lg border border-[#d8cfc3] bg-white px-3 text-sm text-[#141413] outline-none transition focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/20"
                  />
                </label>

                <div className="mt-3 flex flex-wrap gap-2">
                  {payment.status === "pending" &&
                    payment.paymentUrl &&
                    (!payment.expiresAt ||
                      new Date(payment.expiresAt).getTime() > Date.now()) && (
                      <>
                        <button
                          onClick={onCopyLink}
                          disabled={recoveryBusy}
                          className="rounded-md border border-[#d8cfc3] bg-white px-3 py-2 text-sm text-[#141413] disabled:opacity-50"
                        >
                          Copy active link
                        </button>
                        <button
                          onClick={() => onEmailLink(recipientEmail.trim())}
                          disabled={!validRecipient || emailing || recoveryBusy}
                          className="rounded-md bg-[#cc785c] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                        >
                          {emailing ? "Sending…" : "Email active link"}
                        </button>
                      </>
                    )}
                  {(payment.status === "failed" ||
                    (payment.expiresAt &&
                      new Date(payment.expiresAt).getTime() <= Date.now())) && (
                    <>
                      <button
                        onClick={() => onReplaceLink()}
                        disabled={recoveryBusy}
                        className="rounded-md border border-[#d8cfc3] bg-white px-3 py-2 text-sm text-[#141413] disabled:opacity-50"
                      >
                        Create and copy new link
                      </button>
                      <button
                        onClick={() => onReplaceLink(recipientEmail.trim())}
                        disabled={!validRecipient || recoveryBusy || emailing}
                        className="rounded-md bg-[#cc785c] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {recoveryBusy ? "Preparing…" : "Create and email new link"}
                      </button>
                    </>
                  )}
                </div>
              </section>
            )}
          {recoveryMessage && <p className="mb-5 text-sm text-[#6c6a64]">{recoveryMessage}</p>}

          {/* Details grid */}
          <dl className="divide-y divide-[#e6dfd8] rounded-lg border border-[#e6dfd8] bg-white">
            <DetailRow label="Payment ID" value={String(payment.id)} mono />
            <DetailRow label="Invoice" value={payment.invoiceNo} mono />
            <DetailRow label="Type" value={payment.paymentKind === "subscription" ? "Subscription enrollment" : "One-time payment"} />
            {payment.paymentKind === "subscription" && <>
              <DetailRow label="Subscriber" value={payment.respondentName ?? "—"} />
              <DetailRow label="Subscriber email" value={payment.respondentEmail ?? "—"} />
              <DetailRow label="Subscription status" value={payment.subscriptionStatus ?? "Pending"} />
              <DetailRow label="Xendit plan" value={payment.subscriptionPlanId ?? "—"} mono />
              <DetailRow label="Checkout status" value={payment.subscriptionCheckoutStatus ?? "—"} />
              <DetailRow label="Schedule" value={payment.subscriptionInterval
                ? `Every ${payment.subscriptionIntervalCount ?? 1} ${payment.subscriptionInterval.toLowerCase()}${(payment.subscriptionIntervalCount ?? 1) === 1 ? "" : "s"}`
                : "—"} />
              <DetailRow label="Trial" value={`${payment.subscriptionTrialDays ?? 0} days`} />
              <DetailRow label="Maximum cycles" value={payment.subscriptionMaxCycles == null ? "No limit" : String(payment.subscriptionMaxCycles)} />
              <DetailRow label="Next billing" value={payment.subscriptionNextChargeAt ? new Date(payment.subscriptionNextChargeAt).toLocaleString() : "—"} />
              <DetailRow label="Cancelled / ended" value={payment.subscriptionEndedAt ? new Date(payment.subscriptionEndedAt).toLocaleString() : "—"} />
            </>}
            <DetailRow label="Gateway" value={payment.gatewayName} />
            <DetailRow
              label="Environment"
              value={
                payment.gatewayResponse?.environment === "live"
                  ? "Live"
                  : payment.gatewayResponse?.environment === "sandbox"
                    ? "Sandbox / Test"
                    : "Not recorded (legacy payment)"
              }
            />
            <DetailRow
              label="Gateway Reference"
              value={payment.gatewayPaymentId ?? "—"}
              mono
            />
            <DetailRow
              label="Payment Channel"
              value={payment.paymentChannel ?? "—"}
            />
            <DetailRow label="Currency" value={payment.currency} />
            <DetailRow label="External ID" value={payment.externalId ?? "—"} mono />
            <DetailRow label="Link expires" value={payment.expiresAt ? new Date(payment.expiresAt).toLocaleString() : "Not provided"} />
            <DetailRow label="Link copies" value={String(payment.reminderCount)} />
            <DetailRow label="Verification source" value={payment.verificationSource ?? "—"} />
            <DetailRow label="Paid at" value={payment.paidAt ? new Date(payment.paidAt).toLocaleString() : "—"} />
            <DetailRow label="Refunded at" value={payment.refundedAt ? new Date(payment.refundedAt).toLocaleString() : "—"} />
            <DetailRow label="Failure reason" value={payment.failureReason ?? "—"} />
            <DetailRow
              label="Amount (minor units)"
              value={String(payment.amount)}
              mono
            />
            <DetailRow
              label="Execution ID"
              value={payment.executionId == null ? "—" : String(payment.executionId)}
              mono
            />
            <DetailRow label="Page session ID" value={payment.pageSessionId == null ? "—" : String(payment.pageSessionId)} mono />
            <DetailRow
              label="Submission ID"
              value={
                payment.submissionId != null
                  ? String(payment.submissionId)
                  : "Pending..."
              }
              mono
            />
          </dl>

          {payment.paymentKind === "subscription" && (
            <div className="mt-5 rounded-lg border border-[#e6dfd8] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#8e8b82]">Billing cycles</p>
                <span className="text-xs text-[#8e8b82]">Managed in Xendit</span>
              </div>
              {activityLoading ? (
                <p className="mt-2 text-sm text-[#8e8b82]">Loading billing activity…</p>
              ) : payment.cycles.length === 0 ? (
                <p className="mt-2 text-sm text-[#8e8b82]">No billing attempts have been reported yet.</p>
              ) : payment.cycles.map((cycle) => (
                <div key={cycle.id} className="mt-3 border-t border-[#e6dfd8] pt-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-[#141413]">Cycle {cycle.cycleNumber ?? "—"} · {cycle.status}</p>
                      <p className="mt-0.5 text-xs text-[#8e8b82]">
                        {cycle.scheduledAt ? new Date(cycle.scheduledAt).toLocaleString() : "Schedule unavailable"}
                        {cycle.failureCode ? ` · ${cycle.failureCode}` : ""}
                      </p>
                    </div>
                    <span className="font-medium text-[#141413]">{formatAmount(cycle.amount, cycle.currency)}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#6c6a64]">
                    {cycle.status === "paid" && cycle.paidAt ? `Received ${new Date(cycle.paidAt).toLocaleString()}`
                      : cycle.status === "failed" && cycle.failedAt ? `Failed ${new Date(cycle.failedAt).toLocaleString()}`
                        : "Awaiting provider outcome"}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 rounded-lg border border-[#e6dfd8] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#8e8b82]">Event timeline</p>
            {activityLoading ? (
              <p className="mt-2 text-sm text-[#8e8b82]">Loading event activity…</p>
            ) : payment.events.length === 0 ? (
              <p className="mt-2 text-sm text-[#8e8b82]">No verification events recorded yet.</p>
            ) : payment.events.map((event) => (
              <div key={event.id} className="mt-3 border-t border-[#e6dfd8] pt-3 text-xs">
                <div className="flex justify-between gap-3"><span className="font-medium">{event.eventType}</span><span>{new Date(event.receivedAt).toLocaleString()}</span></div>
                <p className="mt-1 text-[#6c6a64]">{event.source} · {event.providerStatus ?? "unknown"} · {event.processingStatus}</p>
              </div>
            ))}
          </div>

          {/* Raw gateway response (collapsible) */}
          {payment.gatewayResponse && (
            <details className="mt-5 rounded-lg border border-[#e6dfd8] bg-white">
              <summary className="cursor-pointer px-4 py-3 text-xs font-medium text-[#6c6a64] hover:text-[#141413]">
                Gateway Response (raw)
              </summary>
              <pre className="max-h-64 overflow-auto border-t border-[#e6dfd8] bg-[#f5f0e8] px-4 py-3 text-xs text-[#57544d]">
                {JSON.stringify(payment.gatewayResponse, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <dt className="text-sm text-[#6c6a64]">{label}</dt>
      <dd
        className={`text-right text-sm text-[#141413] ${mono ? "font-mono text-xs" : "font-medium"}`}
      >
        {value}
      </dd>
    </div>
  );
}

/** Render a human-readable status badge for the dialog header. */
function statusBadgeText(status: string) {
  switch (status) {
    case "active":
      return <span className="text-sm font-semibold text-[#2d7a3e]">● Active</span>;
    case "past_due":
      return <span className="text-sm font-semibold text-[#b45309]">● Past due</span>;
    case "cancelled":
    case "deactivated":
      return <span className="text-sm font-semibold text-[#6c6a64]">● {status === "cancelled" ? "Cancelled" : "Deactivated"}</span>;
    case "completed":
      return (
        <span className="text-sm font-semibold text-[#2d7a3e]">
          ✅ Completed
        </span>
      );
    case "pending":
      return (
        <span className="text-sm font-semibold text-[#8a6000]">⏳ Pending</span>
      );
    case "failed":
      return (
        <span className="text-sm font-semibold text-[#c64545]">❌ Failed</span>
      );
    case "refunded":
      return (
        <span className="text-sm font-semibold text-[#6c6a64]">↩ Refunded</span>
      );
    default:
      return <span className="text-sm text-[#6c6a64]">{status}</span>;
  }
}
