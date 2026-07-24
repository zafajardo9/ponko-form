export interface FormAnalyticsRecord {
  id: number;
  title: string;
  status: string;
  submissionCount: number;
  completedCount: number;
  paymentCount: number;
  completedPaymentCount: number;
  revenue: number;
  revenueCurrency: string;
  revenueBreakdown: RevenueAmount[];
  lastSubmissionAt: string | null;
}

export interface RevenueAmount {
  currency: string;
  amount: number;
}

export type FormSummary = Pick<
  FormAnalyticsRecord,
  "id" | "title" | "status"
>;

export type SubmissionSummary = {
  formId: number;
  total: number;
  completed: number;
  lastAt: string | null;
};

export type PaymentSummary = {
  formId: number;
  total: number;
  completed: number;
  revenue: number;
  revenueCurrency: string;
  revenueBreakdown: RevenueAmount[];
};

export function dashboardDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDashboardDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function fillDashboardDateGaps<T extends Record<string, unknown>>(
  data: (T & { date: string })[],
  days: number,
  defaultValue: T,
  now = new Date(),
): (T & { date: string })[] {
  const map = new Map(data.map((datum) => [datum.date, datum]));
  const result: (T & { date: string })[] = [];

  for (let offset = days - 1; offset >= 0; offset--) {
    const date = new Date(now);
    date.setDate(date.getDate() - offset);
    const key = dashboardDateKey(date);
    result.push(
      map.get(key) ?? ({ date: key, ...defaultValue } as T & { date: string }),
    );
  }

  return result;
}

export function mergeFormAnalytics(
  userForms: FormSummary[],
  submissions: SubmissionSummary[],
  paymentRows: PaymentSummary[],
): FormAnalyticsRecord[] {
  const submissionsByForm = new Map(
    submissions.map((row) => [row.formId, row]),
  );
  const paymentsByForm = new Map(paymentRows.map((row) => [row.formId, row]));

  return userForms.map((form) => {
    const submission = submissionsByForm.get(form.id);
    const payment = paymentsByForm.get(form.id);
    return {
      ...form,
      submissionCount: submission?.total ?? 0,
      completedCount: submission?.completed ?? 0,
      paymentCount: payment?.total ?? 0,
      completedPaymentCount: payment?.completed ?? 0,
      revenue: payment?.revenue ?? 0,
      revenueCurrency: payment?.revenueCurrency ?? "USD",
      revenueBreakdown: payment?.revenueBreakdown ?? [],
      lastSubmissionAt: submission?.lastAt ?? null,
    };
  });
}

export function completionRate(completed: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

export function formatDashboardMoney(cents: number, currency = "USD") {
  if (currency === "MIXED") return `${(cents / 100).toFixed(2)} combined`;
  const fractionDigits = currencyFractionDigits(currency);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    currencyDisplay: currency === "PHP" ? "code" : "symbol",
  }).format(minorToMajor(cents, currency));
}

export function currencyFractionDigits(currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

export function minorToMajor(amount: number, currency: string) {
  return amount / 10 ** currencyFractionDigits(currency);
}

export function majorToMinor(amount: number, currency: string) {
  return Math.round(amount * 10 ** currencyFractionDigits(currency));
}

export function compareFormPerformance(forms: FormAnalyticsRecord[]) {
  const active = forms.filter((form) => form.submissionCount > 0);
  const topBySubmissions = [...active].sort(
    (a, b) => b.submissionCount - a.submissionCount,
  )[0] ?? null;
  const topByCompletion = [...active].sort(
    (a, b) =>
      completionRate(b.completedCount, b.submissionCount) -
      completionRate(a.completedCount, a.submissionCount),
  )[0] ?? null;
  const topByRevenue = [...active].sort((a, b) => b.revenue - a.revenue)[0] ?? null;
  return { topBySubmissions, topByCompletion, topByRevenue };
}
