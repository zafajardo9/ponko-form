import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { requireAuth } from "../../../lib/server-fns/auth";
import {
  getFormPayments,
  verifyFormPayment,
  getPaymentRecoveryLink,
  replaceExpiredPaymentLink,
  emailPaymentRecoveryLink,
  type PaymentViewRow,
} from "../../../lib/server-fns/payments-view";
import { Badge } from "../../../components/ui/Badge";

export const Route = createFileRoute("/forms/$formId/payments")({
  beforeLoad: () => requireAuth(),
  component: PaymentsPage,
});

function PaymentsPage() {
  const { formId } = Route.useParams();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<PaymentViewRow | null>(null);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["form-payments", formId, page],
    queryFn: () => getFormPayments({ data: { formId: Number(formId), page } }),
  });

  const payments = data?.payments ?? [];
  const hasPaymentFlow = data?.hasPaymentFlow ?? false;
  const formTitle = data?.formTitle;
  const verifyMut = useMutation({
    mutationFn: (paymentId: number) => verifyFormPayment({ data: { formId: Number(formId), paymentId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["form-payments", formId] });
      setSelected(null);
    },
  });
  const copyLinkMut = useMutation({
    mutationFn: (paymentId: number) => getPaymentRecoveryLink({ data: { formId: Number(formId), paymentId } }),
    onSuccess: async (result) => {
      await navigator.clipboard.writeText(result.paymentUrl);
      setRecoveryMessage("Payment link copied. You can send it to the respondent.");
      await queryClient.invalidateQueries({ queryKey: ["form-payments", formId] });
    },
    onError: (error) => setRecoveryMessage((error as Error).message),
  });
  const replaceLinkMut = useMutation({
    mutationFn: (paymentId: number) => replaceExpiredPaymentLink({ data: { formId: Number(formId), paymentId } }),
    onSuccess: async (result) => {
      await navigator.clipboard.writeText(result.paymentUrl);
      setRecoveryMessage(result.reused ? "Active payment link copied." : "Replacement payment link created and copied.");
      await queryClient.invalidateQueries({ queryKey: ["form-payments", formId] });
      setSelected(null);
    },
    onError: (error) => setRecoveryMessage((error as Error).message),
  });
  const emailLinkMut = useMutation({
    mutationFn: ({ paymentId, recipientEmail }: { paymentId: number; recipientEmail: string }) =>
      emailPaymentRecoveryLink({ data: { formId: Number(formId), paymentId, recipientEmail } }),
    onSuccess: async () => {
      setRecoveryMessage("Payment reminder accepted by Resend.");
      await queryClient.invalidateQueries({ queryKey: ["form-payments", formId] });
    },
    onError: (error) => setRecoveryMessage((error as Error).message),
  });

  // No payment flow configured for this form.
  if (!isLoading && !hasPaymentFlow && payments.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12">
        <Breadcrumbs formId={formId} formTitle={formTitle} />
        <h1 className="mb-2 text-2xl font-medium text-[#141413]">Payments</h1>
        <div className="mt-8 rounded-xl border border-dashed border-[#e6dfd8] py-24 text-center">
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
            className="mt-4 inline-block text-sm text-[#cc785c] hover:text-[#a9583e]"
          >
            ← Back to builder
          </Link>
        </div>
      </div>
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

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Breadcrumbs formId={formId} formTitle={formTitle} />

      <h1 className="text-2xl font-medium text-[#141413]">
        Payments
        {payments.length > 0 && (
          <span className="ml-2 text-base text-[#6c6a64]">
            ({payments.length})
          </span>
        )}
      </h1>
      {hasPaymentFlow && (
        <p className="mt-1 text-xs text-[#8e8b82]">
          All payment transactions processed through this form's flow.
        </p>
      )}

      {isLoading ? (
        <div className="mt-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-xl bg-[#efe9de]"
            />
          ))}
        </div>
      ) : payments.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-[#e6dfd8] py-24 text-center">
          <p className="text-[#8e8b82]">No payment transactions yet.</p>
          <p className="mt-1 text-xs text-[#8e8b82]">
            Transactions will appear here once respondents submit payments.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-[#e6dfd8]">
          <table className="w-full text-sm">
            <thead className="border-b border-[#e6dfd8] bg-[#f5f0e8]">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-[#6c6a64]">
                  Invoice
                </th>
                <th className="px-4 py-3 text-left font-medium text-[#6c6a64]">
                  Date
                </th>
                <th className="px-4 py-3 text-left font-medium text-[#6c6a64]">
                  Amount
                </th>
                <th className="px-4 py-3 text-left font-medium text-[#6c6a64]">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-[#6c6a64]">
                  Gateway
                </th>
                <th className="px-4 py-3 text-left font-medium text-[#6c6a64]">
                  Channel
                </th>
                <th className="px-4 py-3 text-left font-medium text-[#6c6a64]">
                  Reference
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e6dfd8] bg-[#faf9f5]">
              {payments.map((p) => (
                <tr
                  key={p.id}
                  className="cursor-pointer transition-colors hover:bg-[#f5f0e8]"
                  onClick={() => setSelected(p)}
                >
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-[#57544d]">
                    {p.invoiceNo}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#6c6a64]">
                    {new Date(p.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-[#141413]">
                    {formatAmount(p.amount, p.currency)}
                  </td>
                  <td className="px-4 py-3">{statusBadge(p.status)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#57544d]">
                    {p.gatewayName}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#6c6a64]">
                    {p.paymentChannel ?? "—"}
                  </td>
                  <td className="max-w-[120px] truncate px-4 py-3 font-mono text-xs text-[#8e8b82]">
                    {p.gatewayPaymentId ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-[#cc785c]">
                    Details →
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {payments.length === 50 && (
            <div className="flex justify-center gap-3 border-t border-[#e6dfd8] py-3">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="text-sm text-[#cc785c] disabled:opacity-40 hover:text-[#a9583e]"
              >
                ← Previous
              </button>
              <span className="text-sm text-[#6c6a64]">Page {page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                className="text-sm text-[#cc785c] hover:text-[#a9583e]"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {selected && (
        <PaymentDetailDialog
          payment={selected}
          onClose={() => setSelected(null)}
          formatAmount={formatAmount}
          onVerify={() => verifyMut.mutate(selected.id)}
          verifying={verifyMut.isPending}
          formId={formId}
          onCopyLink={() => copyLinkMut.mutate(selected.id)}
          onReplaceLink={() => replaceLinkMut.mutate(selected.id)}
          recoveryBusy={copyLinkMut.isPending || replaceLinkMut.isPending}
          recoveryMessage={recoveryMessage}
          onEmailLink={() => {
            const recipientEmail = window.prompt("Recipient email address")?.trim();
            if (recipientEmail) emailLinkMut.mutate({ paymentId: selected.id, recipientEmail });
          }}
          emailing={emailLinkMut.isPending}
        />
      )}
    </div>
  );
}

function Breadcrumbs({
  formId,
  onCopyLink,
  onReplaceLink,
  recoveryBusy,
  recoveryMessage,
  onEmailLink,
  emailing,
  formTitle,
}: {
  formId: string;
  onCopyLink: () => void;
  onReplaceLink: () => void;
  recoveryBusy: boolean;
  recoveryMessage: string | null;
  onEmailLink: () => void;
  emailing: boolean;
  formTitle?: string;
}) {
  return (
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
        {formTitle ?? "Form"}
      </Link>
      <span>/</span>
      <span className="text-[#141413]">Payments</span>
    </div>
  );
}

function PaymentDetailDialog({
  payment,
  onClose,
  formatAmount,
  onVerify,
  verifying,
  formId,
}: {
  payment: PaymentViewRow;
  onClose: () => void;
  formatAmount: (amount: number, currency: string) => string;
  onVerify: () => void;
  verifying: boolean;
  formId: string;
}) {
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
              {statusBadgeText(payment.status)}
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
            {payment.status === "pending" && payment.paymentUrl && (
              <>
                <button onClick={onCopyLink} disabled={recoveryBusy} className="rounded-md border border-[#e6dfd8] px-3 py-2 text-sm text-[#141413] disabled:opacity-50">
                  Copy payment link
                </button>
                <button onClick={onEmailLink} disabled={emailing || recoveryBusy} className="rounded-md border border-[#e6dfd8] px-3 py-2 text-sm text-[#141413] disabled:opacity-50">
                  {emailing ? "Sending…" : "Email payment link"}
                </button>
              </>
            )}
            {(payment.status === "failed" || (payment.expiresAt && new Date(payment.expiresAt).getTime() <= Date.now())) && (
              <button onClick={onReplaceLink} disabled={recoveryBusy} className="rounded-md border border-[#e6dfd8] px-3 py-2 text-sm text-[#141413] disabled:opacity-50">
                Create replacement link
              </button>
            )}
            {payment.submissionId && (
              <Link to="/forms/$formId/submissions" params={{ formId: String(formId) }} className="rounded-md border border-[#e6dfd8] px-3 py-2 text-sm text-[#141413]">
                Open response
              </Link>
            )}
          </div>
          {recoveryMessage && <p className="mb-5 text-sm text-[#6c6a64]">{recoveryMessage}</p>}

          {/* Details grid */}
          <dl className="divide-y divide-[#e6dfd8] rounded-lg border border-[#e6dfd8] bg-white">
            <DetailRow label="Payment ID" value={String(payment.id)} mono />
            <DetailRow label="Invoice" value={payment.invoiceNo} mono />
            <DetailRow label="Gateway" value={payment.gatewayName} />
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

          <div className="mt-5 rounded-lg border border-[#e6dfd8] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#8e8b82]">Event timeline</p>
            {payment.events.length === 0 ? (
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
