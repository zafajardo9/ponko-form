import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "../../lib/server-fns/auth";
import { useQuery } from "@tanstack/react-query";
import {
  getDashboardStats,
  getSubmissionsOverTime,
  getRevenueOverTime,
  getFormAnalytics,
} from "../../lib/server-fns/dashboard";
import {
  FileText,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  BarChart3,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { useState, useEffect, type ReactNode } from "react";

// ── Client-only wrapper ──

function ClientOnly({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return fallback ?? null;
  return children;
}

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

function ChartSkeleton() {
  return <div className="h-64 animate-pulse rounded-lg bg-[#efe9de]" />;
}

function fillDateGaps<T extends Record<string, unknown>>(
  data: (T & { date: string })[],
  days: number,
  defaultValue: T,
): (T & { date: string })[] {
  const map = new Map(data.map((d) => [d.date, d]));
  const result: (T & { date: string })[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = format(subDays(new Date(), i), "yyyy-MM-dd");
    result.push(
      map.get(date) ?? ({ date, ...defaultValue } as T & { date: string }),
    );
  }
  return result;
}

// ── Lazy chart component to avoid SSR issues ──

function SubmissionsChart({
  data,
}: {
  data: { date: string; count: number }[];
}) {
  const [mod, setMod] = useState<any>(null);
  useEffect(() => {
    import("recharts").then((m) => setMod(m));
  }, []);
  if (!mod) return <ChartSkeleton />;
  const {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
  } = mod;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="subGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6b8f71" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#6b8f71" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#e6dfd8" strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#6c6a64" }}
          tickFormatter={(d: string) => format(new Date(d), "MMM d")}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#6c6a64" }}
          allowDecimals={false}
          width={32}
        />
        <Tooltip
          content={
            <ChartTooltip
              valueFormatter={(v) => `${v} submissions`}
              labelFormatter={(l) => format(new Date(l), "MMM d, yyyy")}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#6b8f71"
          strokeWidth={2}
          fill="url(#subGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function RevenueChart({ data }: { data: { date: string; amount: number }[] }) {
  const [mod, setMod] = useState<any>(null);
  useEffect(() => {
    import("recharts").then((m) => setMod(m));
  }, []);
  if (!mod) return <ChartSkeleton />;
  const {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
  } = mod;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid stroke="#e6dfd8" strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#6c6a64" }}
          tickFormatter={(d: string) => format(new Date(d), "MMM d")}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#6c6a64" }}
          tickFormatter={(v: number) => `$${v}`}
          width={40}
        />
        <Tooltip
          content={
            <ChartTooltip
              valueFormatter={(v) => formatCents(v * 100)}
              labelFormatter={(l) => format(new Date(l), "MMM d, yyyy")}
            />
          }
        />
        <Bar
          dataKey="amount"
          fill="#cc785c"
          radius={[4, 4, 0, 0]}
          maxBarSize={24}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  valueFormatter?: (v: number) => string;
  labelFormatter?: (l: string) => string;
}

function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter = (v) => String(v),
  labelFormatter = (l) => l,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[#e6dfd8] bg-white px-3 py-2 shadow-sm">
      <p className="text-xs text-[#6c6a64]">{labelFormatter(label ?? "")}</p>
      <p className="text-sm font-semibold text-[#141413]">
        {valueFormatter(payload[0].value)}
      </p>
    </div>
  );
}

// ── Route ──

export const Route = createFileRoute("/dashboard/")({
  beforeLoad: ({ location }) => requireAuth({ data: { returnTo: location.href } }),
  component: DashboardPage,
});

// ── Main Dashboard ──

function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => getDashboardStats(),
  });

  const { data: submissionsTimeSeries } = useQuery({
    queryKey: ["dashboard-submissions-time"],
    queryFn: () => getSubmissionsOverTime(),
  });

  const { data: revenueTimeSeries } = useQuery({
    queryKey: ["dashboard-revenue-time"],
    queryFn: () => getRevenueOverTime(),
  });

  const { data: formAnalytics } = useQuery({
    queryKey: ["dashboard-form-analytics"],
    queryFn: () => getFormAnalytics(),
  });

  const hasData =
    stats && (stats.totalSubmissions > 0 || stats.totalPayments > 0);

  const subChartData = fillDateGaps(
    (submissionsTimeSeries ?? []).map((p) => ({ ...p })),
    30,
    { count: 0 },
  );

  const revChartData = fillDateGaps(
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
              <div className="h-64">
                <ClientOnly fallback={<ChartSkeleton />}>
                  <SubmissionsChart data={subChartData} />
                </ClientOnly>
              </div>
            </div>

            <div className="rounded-xl border border-[#e6dfd8] bg-white p-5">
              <h3 className="mb-4 text-sm font-semibold text-[#141413]">
                Revenue (Last 30 Days)
              </h3>
              <div className="h-64">
                <ClientOnly fallback={<ChartSkeleton />}>
                  <RevenueChart data={revChartData} />
                </ClientOnly>
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
                            ? format(
                                new Date(form.lastSubmissionAt),
                                "MMM d, yyyy",
                              )
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
