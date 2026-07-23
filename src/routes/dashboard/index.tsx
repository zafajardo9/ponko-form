import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "../../lib/server-fns/auth";
import { useQuery } from "@tanstack/react-query";
import { getDashboardOverview } from "../../lib/server-fns/dashboard";
import {
  FileText,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  BarChart3,
} from "lucide-react";
import { TimeSeriesChart } from "../../components/dashboard/TimeSeriesChart";
import { Button } from "../../components/ui/Button";
import {
  fillDashboardDateGaps,
  formatDashboardDate,
} from "../../lib/dashboard-analytics";

// ── Sub-components ──

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-[#e6dfd8] bg-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-[#6c6a64]">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-[#141413]">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-[#6c6a64]">{sub}</p>}
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function EmptyDashboard() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <BarChart3 size={48} className="mb-4 text-[#d4cec4]" />
      <h2 className="text-lg font-medium text-[#141413]">No data yet</h2>
      <p className="mt-1 max-w-sm text-sm text-[#6c6a64]">
        Analytics will appear here once you start receiving form submissions and
        payments. Create a form and share it to get started.
      </p>
    </div>
  );
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// ── Route ──

export const Route = createFileRoute("/dashboard/")({
  beforeLoad: ({ location }) => requireAuth({ data: { returnTo: location.href } }),
  component: DashboardPage,
});

// ── Main Dashboard ──

function DashboardPage() {
  const {
    data: dashboard,
    isLoading: statsLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: () => getDashboardOverview(),
    staleTime: 30_000,
  });
  const stats = dashboard?.stats;
  const submissionsTimeSeries = dashboard?.submissions;
  const revenueTimeSeries = dashboard?.revenue;
  const formAnalytics = dashboard?.forms;

  const hasData =
    stats && (stats.totalSubmissions > 0 || stats.totalPayments > 0);

  const subChartData = fillDashboardDateGaps(
    (submissionsTimeSeries ?? []).map((p) => ({ ...p })),
    30,
    { count: 0 },
  );

  const revChartData = fillDashboardDateGaps(
    (revenueTimeSeries ?? []).map((p) => ({
      date: p.date,
      amount: p.amount / 100,
    })),
    30,
    { amount: 0 },
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-medium text-[#141413]">Dashboard</h1>
        <p className="mt-1 text-[#6c6a64]">
          Analytics and performance across all your forms
        </p>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl bg-[#efe9de]"
            />
          ))}
        </div>
      ) : isError ? (
        <div
          role="alert"
          className="rounded-xl border border-[#d7a84c] bg-[#fff8e7] p-6 text-[#6b4f16]"
        >
          <h2 className="font-medium text-[#141413]">
            Dashboard data could not be loaded
          </h2>
          <p className="mt-1 text-sm">
            {(error as Error)?.message ||
              "Your connection may still be recovering. Try again in a moment."}
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-4"
            onClick={() => void refetch()}
          >
            Try again
          </Button>
        </div>
      ) : !hasData ? (
        <EmptyDashboard />
      ) : (
        <>
          {/* ── Summary Stat Cards ── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Submissions"
              value={stats!.totalSubmissions}
              sub={`${stats!.completedSubmissions} completed`}
              icon={FileText}
              color="#6b8f71"
            />
            <StatCard
              label="Completion Rate"
              value={
                stats!.totalSubmissions > 0
                  ? `${Math.round((stats!.completedSubmissions / stats!.totalSubmissions) * 100)}%`
                  : "—"
              }
              icon={CheckCircle2}
              color="#4a90d9"
            />
            <StatCard
              label="Total Revenue"
              value={formatCents(stats!.totalRevenue)}
              sub={`${stats!.completedPayments} successful payments`}
              icon={DollarSign}
              color="#cc785c"
            />
            <StatCard
              label="Failed Payments"
              value={stats!.failedPayments}
              icon={AlertCircle}
              color="#c64545"
            />
          </div>

          {/* ── Charts Row ── */}
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-[#e6dfd8] bg-white p-5">
              <h3 className="mb-4 text-sm font-semibold text-[#141413]">
                Submissions (Last 30 Days)
              </h3>
              <div className="h-48 sm:h-64">
                <TimeSeriesChart
                  data={subChartData.map((point) => ({
                    date: point.date,
                    value: point.count,
                  }))}
                  kind="area"
                  color="#6b8f71"
                  label="Submissions during the last 30 days"
                  valueLabel={(value) =>
                    `${value} ${value === 1 ? "submission" : "submissions"}`
                  }
                  axisLabel={(value) => String(Math.round(value))}
                  integerValues
                />
              </div>
            </div>

            <div className="rounded-xl border border-[#e6dfd8] bg-white p-5">
              <h3 className="mb-4 text-sm font-semibold text-[#141413]">
                Revenue (Last 30 Days)
              </h3>
              <div className="h-48 sm:h-64">
                <TimeSeriesChart
                  data={revChartData.map((point) => ({
                    date: point.date,
                    value: point.amount,
                  }))}
                  kind="bar"
                  color="#cc785c"
                  label="Revenue during the last 30 days"
                  valueLabel={(value) => formatCents(value * 100)}
                  axisLabel={(value) => `$${Math.round(value)}`}
                />
              </div>
            </div>
          </div>

          {/* ── Form Analytics Table ── */}
          {formAnalytics && formAnalytics.length > 0 && (
            <div className="mt-8 rounded-xl border border-[#e6dfd8] bg-white">
              <div className="border-b border-[#e6dfd8] px-5 py-4">
                <h3 className="text-sm font-semibold text-[#141413]">
                  Form Performance
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#e6dfd8] text-left text-xs text-[#6c6a64]">
                      <th className="px-5 py-3 font-medium">Form</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium text-right">
                        Submissions
                      </th>
                      <th className="px-5 py-3 font-medium text-right">
                        Completed
                      </th>
                      <th className="px-5 py-3 font-medium text-right">
                        Revenue
                      </th>
                      <th className="px-5 py-3 font-medium text-right">
                        Last Submission
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {formAnalytics.map((form) => (
                      <tr
                        key={form.id}
                        className="border-b border-[#f0ece4] last:border-0 hover:bg-[#faf9f5]"
                      >
                        <td className="px-5 py-3 font-medium text-[#141413]">
                          {form.title}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              form.status === "published"
                                ? "bg-[#e6f0e6] text-[#4a7c4f]"
                                : "bg-[#f5f0e8] text-[#8a7a60]"
                            }`}
                          >
                            {form.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-[#6c6a64]">
                          {form.submissionCount}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-[#6c6a64]">
                          {form.completedCount}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-[#141413]">
                          {form.revenue > 0 ? formatCents(form.revenue) : "—"}
                        </td>
                        <td className="px-5 py-3 text-right text-[#6c6a64]">
                          {form.lastSubmissionAt
                            ? formatDashboardDate(form.lastSubmissionAt)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
