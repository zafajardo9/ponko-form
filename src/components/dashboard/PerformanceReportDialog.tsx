import { useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCheck2,
  FileText,
  Lightbulb,
  X,
} from "lucide-react";
import type { DashboardOverview, DashboardStats } from "../../lib/server-fns/dashboard";
import type { FormAnalyticsRecord } from "../../lib/dashboard-analytics";
import {
  completionRate,
  fillDashboardDateGaps,
  formatDashboardDate,
  formatDashboardMoney,
  majorToMinor,
  minorToMajor,
} from "../../lib/dashboard-analytics";
import {
  buildDashboardInsights,
  selectedFormSummary,
} from "../../lib/dashboard-report";
import { Button } from "../ui/Button";
import { TimeSeriesChart } from "./TimeSeriesChart";

interface PerformanceReportDialogProps {
  overview: DashboardOverview;
  selectedForm?: FormAnalyticsRecord | null;
  downloading: boolean;
  onClose: () => void;
  onDownload: () => void;
}

function CompletionRing({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  const rate = completionRate(completed, total);

  return (
    <div className="relative h-36 w-36 shrink-0" aria-label={`${rate}% completion rate`}>
      <svg viewBox="0 0 120 120" className="-rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r="48" fill="none" stroke="#eee8df" strokeWidth="11" />
        <circle
          cx="60"
          cy="60"
          r="48"
          fill="none"
          stroke="#6b8f71"
          strokeWidth="11"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray={`${rate} ${100 - rate}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tabular-nums text-[#141413]">{rate}%</span>
        <span className="text-xs text-[#6c6a64]">completed</span>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  help,
}: {
  label: string;
  value: string | number;
  help: string;
}) {
  return (
    <div className="rounded-xl border border-[#e6dfd8] bg-[#fcfbf8] p-4">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#79756d]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-[#141413]">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[#6c6a64]">{help}</p>
    </div>
  );
}

function insightIcon(tone: "positive" | "neutral" | "attention") {
  if (tone === "positive") return CheckCircle2;
  if (tone === "attention") return AlertTriangle;
  return Lightbulb;
}

export function PerformanceReportDialog({
  overview,
  selectedForm,
  downloading,
  onClose,
  onDownload,
}: PerformanceReportDialogProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const stats: DashboardStats = selectedForm
    ? {
        totalForms: 1,
        publishedForms: selectedForm.status === "published" ? 1 : 0,
        totalSubmissions: selectedForm.submissionCount,
        completedSubmissions: selectedForm.completedCount,
        pendingPaymentSubmissions: Math.max(
          0,
          selectedForm.paymentCount - selectedForm.completedPaymentCount,
        ),
        paymentFailedSubmissions: 0,
        totalPayments: selectedForm.paymentCount,
        completedPayments: selectedForm.completedPaymentCount,
        failedPayments: Math.max(
          0,
          selectedForm.paymentCount - selectedForm.completedPaymentCount,
        ),
        totalRevenue: selectedForm.revenue,
        revenueCurrency: selectedForm.revenueCurrency,
        revenueBreakdown: selectedForm.revenueBreakdown,
      }
    : overview.stats;
  const forms = selectedForm ? [selectedForm] : overview.forms;
  const insights = buildDashboardInsights(stats, forms);
  const summary = selectedForm ? selectedFormSummary(selectedForm) : null;
  const unfinished = Math.max(
    0,
    stats.totalSubmissions - stats.completedSubmissions,
  );
  const subChartData = fillDashboardDateGaps(
    overview.submissions.map((point) => ({ ...point })),
    30,
    { count: 0 },
  );
  const revenueChartData = fillDashboardDateGaps(
    overview.revenue.map((point) => ({
      date: point.date,
      amount: minorToMajor(point.amount, point.currency),
    })),
    30,
    { amount: 0 },
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#141413]/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="performance-report-title"
        className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-[#f8f5ef] shadow-2xl sm:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#e2dbd1] bg-white px-5 py-5 sm:px-7">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#a9583e]">
              Performance report
            </p>
            <h2 id="performance-report-title" className="text-xl font-semibold text-[#141413] sm:text-2xl">
              {selectedForm ? selectedForm.title : "All forms overview"}
            </h2>
            <p className="mt-1 text-sm text-[#6c6a64]">
              {selectedForm
                ? "A focused view of how this form converts and earns."
                : "A creator-friendly explanation of your responses, completion, and revenue."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#6c6a64] transition hover:bg-[#f2eee7] hover:text-[#141413]"
            aria-label="Close performance report"
          >
            <X size={20} />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-6 sm:px-7">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric
              label="Submissions"
              value={stats.totalSubmissions}
              help="Every response that was started."
            />
            <Metric
              label="Completed"
              value={stats.completedSubmissions}
              help="Responses that reached confirmation."
            />
            <Metric
              label="Completion rate"
              value={`${completionRate(stats.completedSubmissions, stats.totalSubmissions)}%`}
              help="Completed responses divided by starts."
            />
            <Metric
              label="Revenue"
              value={formatDashboardMoney(stats.totalRevenue, stats.revenueCurrency)}
              help={`${stats.completedPayments} successful ${stats.completedPayments === 1 ? "payment" : "payments"}.`}
            />
          </div>
          <p className="mt-3 text-xs leading-5 text-[#79756d]">
            {overview.conversion.rateDate
              ? `Revenue is displayed in ${overview.conversion.currency} using reference rates dated ${formatDashboardDate(overview.conversion.rateDate)}. Original payment currencies are unchanged.`
              : `Revenue is displayed in ${overview.conversion.currency}. Original payment currencies are unchanged.`}
          </p>

          <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-[#e2dbd1] bg-white p-5">
              <div className="flex flex-col items-center gap-6 sm:flex-row">
                <CompletionRing
                  completed={stats.completedSubmissions}
                  total={stats.totalSubmissions}
                />
                <div className="w-full flex-1">
                  <h3 className="text-base font-semibold text-[#141413]">Where responses ended</h3>
                  <p className="mt-1 text-sm leading-6 text-[#6c6a64]">
                    This separates people who reached the final confirmation from those who stopped earlier.
                  </p>
                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-[#4f6e54]">
                        <FileCheck2 size={16} /> Completed
                      </span>
                      <strong className="tabular-nums text-[#141413]">{stats.completedSubmissions}</strong>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-[#8a6d58]">
                        <FileText size={16} /> Did not complete
                      </span>
                      <strong className="tabular-nums text-[#141413]">{unfinished}</strong>
                    </div>
                    {(stats.pendingPaymentSubmissions > 0 || stats.failedPayments > 0) && (
                      <div className="rounded-lg bg-[#fff3ef] px-3 py-2 text-xs leading-5 text-[#824735]">
                        {stats.pendingPaymentSubmissions} waiting for payment · {stats.failedPayments} failed payments
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#e2dbd1] bg-white p-5">
              <h3 className="text-base font-semibold text-[#141413]">What this means</h3>
              <p className="mt-1 text-sm text-[#6c6a64]">The important signals, translated into plain language.</p>
              <div className="mt-4 space-y-3">
                {insights.map((insight) => {
                  const Icon = insightIcon(insight.tone);
                  return (
                    <div key={insight.title} className="flex gap-3 rounded-xl bg-[#f8f5ef] p-3">
                      <Icon
                        size={18}
                        className={
                          insight.tone === "positive"
                            ? "mt-0.5 shrink-0 text-[#5d805f]"
                            : insight.tone === "attention"
                              ? "mt-0.5 shrink-0 text-[#b35e43]"
                              : "mt-0.5 shrink-0 text-[#8a7658]"
                        }
                      />
                      <div>
                        <p className="text-sm font-medium text-[#141413]">{insight.title}</p>
                        <p className="mt-0.5 text-xs leading-5 text-[#6c6a64]">{insight.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {!selectedForm && (
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div className="rounded-2xl border border-[#e2dbd1] bg-white p-5">
                <h3 className="text-base font-semibold text-[#141413]">Submission activity</h3>
                <p className="mt-1 text-sm text-[#6c6a64]">Daily response starts over the last 30 days.</p>
                <div className="mt-4 h-56">
                  <TimeSeriesChart
                    data={subChartData.map((point) => ({ date: point.date, value: point.count }))}
                    kind="area"
                    color="#6b8f71"
                    label="Submissions during the last 30 days"
                    valueLabel={(value) => `${value} ${value === 1 ? "submission" : "submissions"}`}
                    axisLabel={(value) => String(Math.round(value))}
                    integerValues
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-[#e2dbd1] bg-white p-5">
                <h3 className="text-base font-semibold text-[#141413]">Revenue activity</h3>
                <p className="mt-1 text-sm text-[#6c6a64]">Successful payment revenue over the last 30 days.</p>
                <div className="mt-4 h-56">
                  <TimeSeriesChart
                    data={revenueChartData.map((point) => ({ date: point.date, value: point.amount }))}
                    kind="bar"
                    color="#cc785c"
                    label="Revenue during the last 30 days"
                    valueLabel={(value) =>
                      formatDashboardMoney(
                        majorToMinor(value, stats.revenueCurrency),
                        stats.revenueCurrency,
                      )
                    }
                    axisLabel={(value) =>
                      stats.revenueCurrency === "MIXED"
                        ? Math.round(value).toLocaleString()
                        : new Intl.NumberFormat(undefined, {
                            style: "currency",
                            currency: stats.revenueCurrency,
                            maximumFractionDigits: 0,
                          }).format(value)
                    }
                  />
                </div>
              </div>
            </div>
          )}

          {selectedForm && summary && (
            <div className="mt-5 rounded-2xl border border-[#e2dbd1] bg-white p-5">
              <h3 className="text-base font-semibold text-[#141413]">Form details</h3>
              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-[#6c6a64]">Status</dt>
                  <dd className="mt-1 font-medium capitalize text-[#141413]">{selectedForm.status}</dd>
                </div>
                <div>
                  <dt className="text-[#6c6a64]">Last submission</dt>
                  <dd className="mt-1 font-medium text-[#141413]">{summary.lastSubmission}</dd>
                </div>
                <div>
                  <dt className="text-[#6c6a64]">Payment success</dt>
                  <dd className="mt-1 font-medium text-[#141413]">
                    {selectedForm.completedPaymentCount} of {selectedForm.paymentCount}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {!selectedForm && overview.forms.length > 0 && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-[#e2dbd1] bg-white">
              <div className="border-b border-[#e6dfd8] px-5 py-4">
                <h3 className="text-base font-semibold text-[#141413]">Performance by form</h3>
                <p className="mt-1 text-sm text-[#6c6a64]">Compare starts, completion, and earned revenue.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="bg-[#fcfbf8] text-left text-xs text-[#6c6a64]">
                      <th className="px-5 py-3 font-medium">Form</th>
                      <th className="px-5 py-3 text-right font-medium">Started</th>
                      <th className="px-5 py-3 text-right font-medium">Completed</th>
                      <th className="px-5 py-3 text-right font-medium">Rate</th>
                      <th className="px-5 py-3 text-right font-medium">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.forms.map((form) => (
                      <tr key={form.id} className="border-t border-[#eee9e1]">
                        <td className="px-5 py-3 font-medium text-[#141413]">{form.title}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-[#6c6a64]">{form.submissionCount}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-[#6c6a64]">{form.completedCount}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-[#141413]">
                          {completionRate(form.completedCount, form.submissionCount)}%
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-[#141413]">
                          {formatDashboardMoney(form.revenue, form.revenueCurrency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-[#e2dbd1] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <p className="text-xs text-[#79756d]">
            PDF includes the metrics, outcome summary, insights, and form comparison.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1 sm:flex-none">
              Close
            </Button>
            <Button type="button" onClick={onDownload} disabled={downloading} className="flex-1 gap-2 sm:flex-none">
              <Download size={16} />
              {downloading ? "Preparing…" : "Download PDF"}
            </Button>
          </div>
        </footer>
      </section>
    </div>
  );
}
