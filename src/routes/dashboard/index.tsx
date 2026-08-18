import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  Lightbulb,
  MessageSquareDot,
  WalletCards,
} from "lucide-react";
import { requireAuth } from "@/lib/server-fns/auth";
import {
  getDashboardOverview,
  saveDashboardCurrency,
} from "@/lib/server-fns/dashboard";
import type { FormAnalyticsRecord } from "@/lib/dashboard-analytics";
import {
  completionRate,
  fillDashboardDateGaps,
  formatDashboardDate,
  formatDashboardMoney,
  majorToMinor,
  minorToMajor,
} from "@/lib/dashboard-analytics";
import {
  buildDashboardInsights,
  downloadDashboardReport,
} from "@/lib/dashboard-report";
import {
  DASHBOARD_CURRENCIES,
  type DashboardCurrency,
} from "@/lib/currency-conversion";
import { TimeSeriesChart } from "@/components/dashboard/TimeSeriesChart";
import { PerformanceReportDialog } from "@/components/dashboard/PerformanceReportDialog";
import { Button } from "@/components/ui/Button";

function StatCard({
  label,
  value,
  explanation,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  explanation: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e6dfd8] bg-white p-5 shadow-[0_1px_0_rgba(20,20,19,0.02)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#6c6a64]">{label}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-[#141413]">
            {value}
          </p>
        </div>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${color}18`, color }}
        >
          <Icon size={19} />
        </div>
      </div>
      <p className="mt-4 border-t border-[#f0ece5] pt-3 text-xs leading-5 text-[#79756d]">
        {explanation}
      </p>
    </div>
  );
}

function CompletionOverview({
  total,
  completed,
}: {
  total: number;
  completed: number;
}) {
  const rate = completionRate(completed, total);
  const unfinished = Math.max(0, total - completed);

  return (
    <div className="rounded-2xl border border-[#e6dfd8] bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#6b8f71]">
            Submission outcome
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[#141413]">
            {rate}% of started responses were completed
          </h2>
          <p className="mt-1 text-sm leading-6 text-[#6c6a64]">
            See where people made it to the final confirmation—or stopped before finishing.
          </p>
        </div>
        <span className="rounded-full bg-[#eaf1ea] px-3 py-1 text-sm font-semibold tabular-nums text-[#4f6e54]">
          {rate}%
        </span>
      </div>
      <div className="mt-6 h-3 overflow-hidden rounded-full bg-[#eee7de]">
        <div
          className="h-full rounded-full bg-[#6b8f71] transition-[width]"
          style={{ width: `${rate}%` }}
        />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[#f1f6f1] p-3">
          <p className="flex items-center gap-2 text-xs text-[#4f6e54]">
            <FileCheck2 size={15} /> Completed
          </p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-[#141413]">{completed}</p>
        </div>
        <div className="rounded-xl bg-[#f7f2eb] p-3">
          <p className="flex items-center gap-2 text-xs text-[#876e59]">
            <FileText size={15} /> Did not complete
          </p>
          <p className="mt-2 text-xl font-semibold tabular-nums text-[#141413]">{unfinished}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyDashboard() {
  return (
    <div className="rounded-2xl border border-dashed border-[#d9d0c5] bg-white py-20 text-center">
      <BarChart3 size={46} className="mx-auto mb-4 text-[#cfc5b8]" />
      <h2 className="text-lg font-semibold text-[#141413]">Your performance story starts here</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6c6a64]">
        Once people begin answering your forms, this page will explain response starts,
        completions, revenue, trends, and which forms perform best.
      </p>
    </div>
  );
}

export const Route = createFileRoute("/dashboard/")({
  beforeLoad: ({ location }) => requireAuth({ data: { returnTo: location.href } }),
  component: DashboardPage,
});

function DashboardPage() {
  const queryClient = useQueryClient();
  const {
    data: dashboard,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: () => getDashboardOverview(),
    staleTime: 30_000,
  });
  const [reportTarget, setReportTarget] = useState<
    "overview" | FormAnalyticsRecord | null
  >(null);
  const [downloading, setDownloading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [selectedCurrency, setSelectedCurrency] =
    useState<DashboardCurrency>("USD");

  const stats = dashboard?.stats;
  const forms = dashboard?.forms ?? [];
  const hasData =
    stats &&
    (stats.totalForms > 0 ||
      stats.totalSubmissions > 0 ||
      stats.totalPayments > 0);
  const submissionChart = fillDashboardDateGaps(
    (dashboard?.submissions ?? []).map((point) => ({ ...point })),
    30,
    { count: 0 },
  );
  const revenueChart = fillDashboardDateGaps(
    (dashboard?.revenue ?? []).map((point) => ({
      date: point.date,
      amount: minorToMajor(point.amount, point.currency),
    })),
    30,
    { amount: 0 },
  );
  const insights =
    dashboard && hasData ? buildDashboardInsights(dashboard.stats, forms) : [];
  const currencyMutation = useMutation({
    mutationFn: (currency: DashboardCurrency) =>
      saveDashboardCurrency({ data: { currency } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["dashboard-overview"],
      });
    },
    onError: () => {
      if (dashboard) setSelectedCurrency(dashboard.conversion.currency);
    },
  });

  useEffect(() => {
    if (dashboard) setSelectedCurrency(dashboard.conversion.currency);
  }, [dashboard]);

  async function downloadReport(target: "overview" | FormAnalyticsRecord) {
    if (!dashboard) return;
    setDownloading(true);
    setExportError(null);
    try {
      await downloadDashboardReport(
        dashboard,
        target === "overview" ? null : target,
      );
    } catch (downloadError) {
      console.error('[ponkoform-dashboard] Failed to download dashboard report', downloadError);
      setExportError("The PDF could not be prepared. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main className="min-h-full bg-[#faf8f4]">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-6 sm:py-12">
        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#a9583e]">
              Creator analytics
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#141413] sm:text-4xl">
              Form performance
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6c6a64] sm:text-base">
              Understand who started, who completed, what you earned, and where to improve.
            </p>
          </div>
          {dashboard && hasData && (
            <div className="flex flex-col items-stretch gap-3">
              <div className="flex items-center gap-3 rounded-xl border border-[#ded6cc] bg-white px-3 py-2 shadow-[0_1px_0_rgba(20,20,19,0.03)]">
                <CircleDollarSign size={18} className="shrink-0 text-[#a9583e]" />
                <label className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="whitespace-nowrap text-xs font-medium text-[#6c6a64]">
                    Display currency
                  </span>
                  <select
                    value={selectedCurrency}
                    disabled={currencyMutation.isPending}
                    onChange={(event) => {
                      const currency = event.target.value as DashboardCurrency;
                      setSelectedCurrency(currency);
                      currencyMutation.mutate(currency);
                    }}
                    className="min-w-0 flex-1 cursor-pointer rounded-lg border border-[#e6dfd8] bg-[#faf8f4] px-2 py-1.5 text-sm font-semibold text-[#141413] outline-none transition focus:border-[#cc785c] focus:ring-2 focus:ring-[#cc785c]/20 disabled:cursor-wait"
                    aria-label="Display currency"
                  >
                    {DASHBOARD_CURRENCIES.map((currency) => (
                      <option key={currency.code} value={currency.code}>
                        {currency.code} · {currency.name}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="whitespace-nowrap text-[11px] text-[#79756d]">
                  {currencyMutation.isPending ? "Saving…" : "Saved"}
                </span>
              </div>
              <p className="text-right text-[11px] text-[#79756d]">
                Daily reference rates from{" "}
                <a
                  href="https://frankfurter.dev/"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-[#a9583e] hover:underline"
                >
                  Frankfurter
                </a>
                . Payment records stay in their original currency.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-2"
                  onClick={() => setReportTarget("overview")}
                >
                  <Eye size={16} />
                  View full report
                </Button>
                <Button
                  type="button"
                  className="gap-2"
                  disabled={downloading}
                  onClick={() => void downloadReport("overview")}
                >
                  <Download size={16} />
                  {downloading ? "Preparing…" : "Download PDF"}
                </Button>
              </div>
            </div>
          )}
        </header>

        {exportError && (
          <div role="alert" className="mb-5 flex items-center gap-2 rounded-xl border border-[#e8b9aa] bg-[#fff3ef] px-4 py-3 text-sm text-[#824735]">
            <AlertCircle size={17} />
            {exportError}
          </div>
        )}

        {currencyMutation.isError && (
          <div role="alert" className="mb-5 flex items-center gap-2 rounded-xl border border-[#e8b9aa] bg-[#fff3ef] px-4 py-3 text-sm text-[#824735]">
            <AlertCircle size={17} />
            Your display currency could not be saved. Please try again.
          </div>
        )}

        {dashboard?.conversion.status === "unavailable" && (
          <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-[#e1c88c] bg-[#fff8e7] px-4 py-3 text-sm text-[#6b4f16]">
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-[#141413]">Converted totals are temporarily unavailable</p>
              <p className="mt-0.5 text-xs leading-5">
                Original payment currencies are shown until reference rates for {dashboard.conversion.unavailableCurrencies.join(", ")} are available.
              </p>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-40 animate-pulse rounded-2xl bg-[#eee8df]" />
            ))}
          </div>
        ) : isError ? (
          <div role="alert" className="rounded-2xl border border-[#d7a84c] bg-[#fff8e7] p-6 text-[#6b4f16]">
            <h2 className="font-medium text-[#141413]">Dashboard data could not be loaded</h2>
            <p className="mt-1 text-sm">
              {(error as Error)?.message ||
                "Your connection may still be recovering. Try again in a moment."}
            </p>
            <Button type="button" variant="secondary" className="mt-4" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        ) : !hasData || !stats ? (
          <EmptyDashboard />
        ) : (
          <>
            <section aria-labelledby="summary-title">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 id="summary-title" className="text-lg font-semibold text-[#141413]">At a glance</h2>
                  <p className="mt-1 text-sm text-[#6c6a64]">The four numbers that explain overall performance.</p>
                </div>
                <span className="hidden text-xs text-[#79756d] sm:block">All-time totals</span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Submissions"
                  value={stats.totalSubmissions}
                  explanation="Every response that was started, whether it was finished or not."
                  icon={FileText}
                  color="#6b8f71"
                />
                <StatCard
                  label="Completed"
                  value={stats.completedSubmissions}
                  explanation="Responses that reached the final confirmation step."
                  icon={CheckCircle2}
                  color="#4a78a8"
                />
                <StatCard
                  label="Completion rate"
                  value={`${completionRate(stats.completedSubmissions, stats.totalSubmissions)}%`}
                  explanation="The share of started responses that were completed."
                  icon={BarChart3}
                  color="#8a7658"
                />
                <StatCard
                  label="Revenue"
                  value={formatDashboardMoney(stats.totalRevenue, stats.revenueCurrency)}
                  explanation={
                    dashboard.conversion.rateDate
                      ? `${stats.completedPayments} successful ${stats.completedPayments === 1 ? "payment" : "payments"} · reference rates from ${formatDashboardDate(dashboard.conversion.rateDate)}.`
                      : `${stats.completedPayments} successful ${stats.completedPayments === 1 ? "payment" : "payments"} recorded.`
                  }
                  icon={WalletCards}
                  color="#cc785c"
                />
              </div>
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
              <CompletionOverview
                total={stats.totalSubmissions}
                completed={stats.completedSubmissions}
              />
              <div className="rounded-2xl border border-[#e6dfd8] bg-[#252522] p-5 text-white sm:p-6">
                <div className="flex items-center gap-2 text-[#e5b29f]">
                  <Lightbulb size={17} />
                  <p className="text-xs font-semibold uppercase tracking-[0.1em]">What this means</p>
                </div>
                <div className="mt-4 space-y-4">
                  {insights.map((insight, index) => (
                    <div key={insight.title} className={index > 0 ? "border-t border-white/10 pt-4" : ""}>
                      <h3 className="text-sm font-semibold">{insight.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-[#cbc8c0]">{insight.detail}</p>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="group mt-5 inline-flex h-9 items-center gap-2 rounded-md border border-white/15 bg-white/8 px-3.5 text-sm font-medium text-[#f5d3c6] transition-colors hover:border-white/25 hover:bg-white/12 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#efbba8] focus-visible:ring-offset-2 focus-visible:ring-offset-[#252522]"
                  onClick={() => setReportTarget("overview")}
                >
                  See the explained report
                  <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            </section>

            <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2" aria-label="30-day trends">
              <div className="rounded-2xl border border-[#e6dfd8] bg-white p-5 sm:p-6">
                <div>
                  <h2 className="text-lg font-semibold text-[#141413]">Submission activity</h2>
                  <p className="mt-1 text-sm text-[#6c6a64]">Daily response starts during the last 30 days.</p>
                </div>
                <div className="mt-4 h-56 sm:h-64">
                  <TimeSeriesChart
                    data={submissionChart.map((point) => ({ date: point.date, value: point.count }))}
                    kind="area"
                    color="#6b8f71"
                    label="Submissions during the last 30 days"
                    valueLabel={(value) => `${value} ${value === 1 ? "submission" : "submissions"}`}
                    axisLabel={(value) => String(Math.round(value))}
                    integerValues
                  />
                </div>
              </div>
              <div className="rounded-2xl border border-[#e6dfd8] bg-white p-5 sm:p-6">
                <div>
                  <h2 className="text-lg font-semibold text-[#141413]">Revenue activity</h2>
                  <p className="mt-1 text-sm text-[#6c6a64]">Successful payment revenue during the last 30 days.</p>
                </div>
                <div className="mt-4 h-56 sm:h-64">
                  <TimeSeriesChart
                    data={revenueChart.map((point) => ({ date: point.date, value: point.amount }))}
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
            </section>

            {forms.length > 0 && (
              <section className="mt-8 overflow-hidden rounded-2xl border border-[#e6dfd8] bg-white" aria-labelledby="form-performance-title">
                <div className="flex flex-col gap-2 border-b border-[#e6dfd8] px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
                  <div>
                    <h2 id="form-performance-title" className="text-lg font-semibold text-[#141413]">Performance by form</h2>
                    <p className="mt-1 text-sm text-[#6c6a64]">Open any row for an explained report and its own PDF.</p>
                  </div>
                  <span className="text-xs text-[#79756d]">{forms.length} {forms.length === 1 ? "form" : "forms"}</span>
                </div>

                <div className="divide-y divide-[#eee9e1] md:hidden">
                  {forms.map((form) => {
                    const rate = completionRate(form.completedCount, form.submissionCount);
                    return (
                      <article key={form.id} className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-medium text-[#141413]">{form.title}</h3>
                            <p className="mt-1 text-xs capitalize text-[#79756d]">{form.status}</p>
                          </div>
                          <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={() => setReportTarget(form)}>
                            <Eye size={14} /> Report
                          </Button>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                          <div><p className="text-xs text-[#79756d]">Started</p><p className="mt-1 font-semibold tabular-nums">{form.submissionCount}</p></div>
                          <div><p className="text-xs text-[#79756d]">Completed</p><p className="mt-1 font-semibold tabular-nums">{form.completedCount} <span className="font-normal text-[#79756d]">({rate}%)</span></p></div>
                          <div><p className="text-xs text-[#79756d]">Revenue</p><p className="mt-1 font-semibold tabular-nums">{formatDashboardMoney(form.revenue, form.revenueCurrency)}</p></div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[850px] text-sm">
                    <thead>
                      <tr className="bg-[#fcfbf8] text-left text-xs text-[#6c6a64]">
                        <th className="px-6 py-3 font-medium">Form</th>
                        <th className="px-5 py-3 text-right font-medium">Submissions</th>
                        <th className="px-5 py-3 font-medium">Completion</th>
                        <th className="px-5 py-3 text-right font-medium">Revenue</th>
                        <th className="px-5 py-3 text-right font-medium">Last response</th>
                        <th className="px-6 py-3"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {forms.map((form) => {
                        const rate = completionRate(form.completedCount, form.submissionCount);
                        return (
                          <tr key={form.id} className="border-t border-[#eee9e1] hover:bg-[#fcfbf8]">
                            <td className="px-6 py-4">
                              <p className="font-medium text-[#141413]">{form.title}</p>
                              <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                                form.status === "published"
                                  ? "bg-[#eaf2ea] text-[#4f6e54]"
                                  : "bg-[#f2eee7] text-[#796c5c]"
                              }`}>
                                {form.status}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right font-medium tabular-nums text-[#141413]">{form.submissionCount}</td>
                            <td className="w-48 px-5 py-4">
                              <div className="flex justify-between text-xs">
                                <span className="text-[#6c6a64]">{form.completedCount} completed</span>
                                <strong className="tabular-nums text-[#141413]">{rate}%</strong>
                              </div>
                              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eee7de]">
                                <div className="h-full rounded-full bg-[#6b8f71]" style={{ width: `${rate}%` }} />
                              </div>
                            </td>
                            <td className="px-5 py-4 text-right font-medium tabular-nums text-[#141413]">{formatDashboardMoney(form.revenue, form.revenueCurrency)}</td>
                            <td className="px-5 py-4 text-right text-[#6c6a64]">
                              {form.lastSubmissionAt ? formatDashboardDate(form.lastSubmissionAt) : "No responses"}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={() => setReportTarget(form)}>
                                <Eye size={14} /> View report
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}

        {/* Payment Links quick link */}
        <section className="mt-8">
          <Link
            to="/dashboard/payment-links"
            className="group flex items-center justify-between rounded-2xl border border-[#e6dfd8] bg-white p-5 transition-colors hover:border-[#d9d0c5] hover:bg-[#fcfbf8]"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5ece4] text-[#cc785c]">
                <ExternalLink size={19} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#141413]">Payment Links</h3>
                <p className="mt-0.5 text-xs text-[#6c6a64]">
                  Create shareable payment links for products, donations, and one-off charges.
                </p>
              </div>
            </div>
            <span className="shrink-0 text-xs font-medium text-[#a9583e] opacity-0 transition-opacity group-hover:opacity-100">
              Manage links &rarr;
            </span>
          </Link>
        </section>

        {/* Popups quick link (FT-026) */}
        <section className="mt-4">
          <Link
            to="/popups"
            className="group flex items-center justify-between rounded-2xl border border-[#e6dfd8] bg-white p-5 transition-colors hover:border-[#d9d0c5] hover:bg-[#fcfbf8]"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f5ece4] text-[#cc785c]">
                <MessageSquareDot size={19} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#141413]">Popups</h3>
                <p className="mt-0.5 text-xs text-[#6c6a64]">
                  Design lead-capture popups and embed them on any website with one snippet.
                </p>
              </div>
            </div>
            <span className="shrink-0 text-xs font-medium text-[#a9583e] opacity-0 transition-opacity group-hover:opacity-100">
              Manage popups &rarr;
            </span>
          </Link>
        </section>
      </div>

      {dashboard && reportTarget && (
        <PerformanceReportDialog
          overview={dashboard}
          selectedForm={reportTarget === "overview" ? null : reportTarget}
          downloading={downloading}
          onClose={() => setReportTarget(null)}
          onDownload={() => void downloadReport(reportTarget)}
        />
      )}
    </main>
  );
}
