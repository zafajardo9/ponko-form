import { createServerFn } from "@tanstack/react-start";
import { auth } from "@clerk/tanstack-react-start/server";
import { db } from "../../db/index";
import { forms, formSubmissions, payments, profiles } from "../../db/schema";
import { eq, desc, sql, and, gte, count } from "drizzle-orm";
import {
  mergeFormAnalytics,
  type RevenueAmount,
  type FormAnalyticsRecord,
} from "../dashboard-analytics";
import {
  isDashboardCurrency,
  type DashboardCurrency,
} from "../currency-conversion";
import {
  convertedAmount,
  loadDashboardConversion,
  type DashboardConversion,
} from "../server/currency-rates";

async function getDashboardProfile() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const [profile] = await db
    .select({
      id: profiles.id,
      dashboardCurrency: profiles.dashboardCurrency,
    })
    .from(profiles)
    .where(eq(profiles.clerkId, userId))
    .limit(1);
  if (!profile) throw new Error("Profile not found");
  return profile;
}

// ── Types ──

export interface DashboardStats {
  totalForms: number;
  publishedForms: number;
  totalSubmissions: number;
  completedSubmissions: number;
  pendingPaymentSubmissions: number;
  paymentFailedSubmissions: number;
  totalPayments: number;
  completedPayments: number;
  failedPayments: number;
  totalRevenue: number; // in cents
  revenueCurrency: string;
  revenueBreakdown: RevenueAmount[];
}

export interface TimeSeriesPoint {
  date: string;
  count: number;
}

export interface RevenuePoint {
  date: string;
  amount: number; // in cents
  currency: string;
}

export type FormAnalytics = FormAnalyticsRecord;

export interface DashboardOverview {
  stats: DashboardStats;
  submissions: TimeSeriesPoint[];
  revenue: RevenuePoint[];
  forms: FormAnalytics[];
  conversion: DashboardConversion;
}

async function loadDashboardStats(profileId: number): Promise<DashboardStats> {
  const [formCounts, subCounts, payCounts, revenueBreakdown] =
    await Promise.all([
    db
      .select({
        total: count(),
        published:
          sql<number>`COUNT(CASE WHEN ${forms.status} = 'published' THEN 1 END)`.mapWith(
            Number,
          ),
      })
      .from(forms)
      .where(eq(forms.profileId, profileId))
      .then((rows) => rows[0]),
    db
      .select({
        total: count(),
        completed:
          sql<number>`COUNT(CASE WHEN ${formSubmissions.status} = 'completed' THEN 1 END)`.mapWith(
            Number,
          ),
        pendingPayment:
          sql<number>`COUNT(CASE WHEN ${formSubmissions.status} = 'pending_payment' THEN 1 END)`.mapWith(
            Number,
          ),
        paymentFailed:
          sql<number>`COUNT(CASE WHEN ${formSubmissions.status} = 'payment_failed' THEN 1 END)`.mapWith(
            Number,
          ),
      })
      .from(formSubmissions)
      .innerJoin(forms, eq(formSubmissions.formId, forms.id))
      .where(eq(forms.profileId, profileId))
      .then((rows) => rows[0]),
    db
      .select({
        total: count(),
        completed:
          sql<number>`COUNT(CASE WHEN ${payments.status} = 'completed' THEN 1 END)`.mapWith(
            Number,
          ),
        failed:
          sql<number>`COUNT(CASE WHEN ${payments.status} = 'failed' THEN 1 END)`.mapWith(
            Number,
          ),
        totalRevenue:
          sql<number>`COALESCE(SUM(CASE WHEN ${payments.status} = 'completed' THEN ${payments.amount} ELSE 0 END), 0)`.mapWith(
            Number,
          ),
      })
      .from(payments)
      .innerJoin(
        formSubmissions,
        eq(payments.formSubmissionId, formSubmissions.id),
      )
      .innerJoin(forms, eq(formSubmissions.formId, forms.id))
      .where(eq(forms.profileId, profileId))
      .then((rows) => rows[0]),
    db
      .select({
        currency: payments.currency,
        amount: sql<number>`COALESCE(SUM(${payments.amount}), 0)`.mapWith(
          Number,
        ),
      })
      .from(payments)
      .innerJoin(
        formSubmissions,
        eq(payments.formSubmissionId, formSubmissions.id),
      )
      .innerJoin(forms, eq(formSubmissions.formId, forms.id))
      .where(
        and(
          eq(forms.profileId, profileId),
          eq(payments.status, "completed"),
        ),
      )
      .groupBy(payments.currency),
  ]);

  return {
    totalForms: formCounts.total,
    publishedForms: formCounts.published,
    totalSubmissions: subCounts.total,
    completedSubmissions: subCounts.completed,
    pendingPaymentSubmissions: subCounts.pendingPayment,
    paymentFailedSubmissions: subCounts.paymentFailed,
    totalPayments: payCounts.total,
    completedPayments: payCounts.completed,
    failedPayments: payCounts.failed,
    totalRevenue: payCounts.totalRevenue,
    revenueCurrency:
      revenueBreakdown.length > 1
        ? "MIXED"
        : revenueBreakdown[0]?.currency ?? "USD",
    revenueBreakdown,
  };
}

async function loadSubmissionsOverTime(
  profileId: number,
): Promise<TimeSeriesPoint[]> {
  const rows = await db
    .select({
      date: sql<string>`DATE(${formSubmissions.submittedAt})`.mapWith(String),
      count: count(),
    })
    .from(formSubmissions)
    .innerJoin(forms, eq(formSubmissions.formId, forms.id))
    .where(
      and(
        eq(forms.profileId, profileId),
        gte(formSubmissions.submittedAt, sql`NOW() - INTERVAL '30 days'`),
      ),
    )
    .groupBy(sql`DATE(${formSubmissions.submittedAt})`)
    .orderBy(sql`DATE(${formSubmissions.submittedAt})`);

  return rows.map((row) => ({ date: row.date, count: row.count }));
}

async function loadRevenueOverTime(
  profileId: number,
): Promise<RevenuePoint[]> {
  const rows = await db
    .select({
      date: sql<string>`DATE(${payments.createdAt})`.mapWith(String),
      amount: sql<number>`COALESCE(SUM(${payments.amount}), 0)`.mapWith(Number),
      currency: payments.currency,
    })
    .from(payments)
    .innerJoin(
      formSubmissions,
      eq(payments.formSubmissionId, formSubmissions.id),
    )
    .innerJoin(forms, eq(formSubmissions.formId, forms.id))
    .where(
      and(
        eq(forms.profileId, profileId),
        eq(payments.status, "completed"),
        gte(payments.createdAt, sql`NOW() - INTERVAL '30 days'`),
      ),
    )
    .groupBy(sql`DATE(${payments.createdAt})`, payments.currency)
    .orderBy(sql`DATE(${payments.createdAt})`);

  return rows.map((row) => ({
    date: row.date,
    amount: row.amount,
    currency: row.currency,
  }));
}

async function loadFormAnalytics(profileId: number): Promise<FormAnalytics[]> {
  const [userForms, submissionRows, paymentRows, revenueRows] =
    await Promise.all([
    db
      .select({
        id: forms.id,
        title: forms.title,
        status: forms.status,
      })
      .from(forms)
      .where(eq(forms.profileId, profileId))
      .orderBy(desc(forms.updatedAt)),
    db
      .select({
        formId: formSubmissions.formId,
        total: count(),
        completed:
          sql<number>`COUNT(CASE WHEN ${formSubmissions.status} = 'completed' THEN 1 END)`.mapWith(
            Number,
          ),
        lastAt: sql<
          string | null
        >`MAX(${formSubmissions.submittedAt}::text)`.mapWith(String),
      })
      .from(formSubmissions)
      .innerJoin(forms, eq(formSubmissions.formId, forms.id))
      .where(eq(forms.profileId, profileId))
      .groupBy(formSubmissions.formId),
    db
      .select({
        formId: formSubmissions.formId,
        total: count(),
        completed:
          sql<number>`COUNT(CASE WHEN ${payments.status} = 'completed' THEN 1 END)`.mapWith(
            Number,
          ),
        revenue:
          sql<number>`COALESCE(SUM(CASE WHEN ${payments.status} = 'completed' THEN ${payments.amount} ELSE 0 END), 0)`.mapWith(
            Number,
          ),
      })
      .from(payments)
      .innerJoin(
        formSubmissions,
        eq(payments.formSubmissionId, formSubmissions.id),
      )
      .innerJoin(forms, eq(formSubmissions.formId, forms.id))
      .where(eq(forms.profileId, profileId))
      .groupBy(formSubmissions.formId),
    db
      .select({
        formId: formSubmissions.formId,
        currency: payments.currency,
        amount: sql<number>`COALESCE(SUM(${payments.amount}), 0)`.mapWith(
          Number,
        ),
      })
      .from(payments)
      .innerJoin(
        formSubmissions,
        eq(payments.formSubmissionId, formSubmissions.id),
      )
      .innerJoin(forms, eq(formSubmissions.formId, forms.id))
      .where(
        and(
          eq(forms.profileId, profileId),
          eq(payments.status, "completed"),
        ),
      )
      .groupBy(formSubmissions.formId, payments.currency),
  ]);

  const revenueByForm = new Map<number, RevenueAmount[]>();
  revenueRows.forEach((row) => {
    const values = revenueByForm.get(row.formId) ?? [];
    values.push({ currency: row.currency, amount: row.amount });
    revenueByForm.set(row.formId, values);
  });

  return mergeFormAnalytics(
    userForms,
    submissionRows,
    paymentRows.map((row) => ({
      ...row,
      revenueBreakdown: revenueByForm.get(row.formId) ?? [],
      revenueCurrency:
        (revenueByForm.get(row.formId)?.length ?? 0) > 1
          ? "MIXED"
          : revenueByForm.get(row.formId)?.[0]?.currency ?? "USD",
    })),
  );
}

function applyDashboardConversion(
  stats: DashboardStats,
  revenue: RevenuePoint[],
  forms: FormAnalytics[],
  conversion: DashboardConversion,
) {
  if (conversion.status !== "ready") return { stats, revenue, forms };

  const totalRevenue =
    convertedAmount(stats.revenueBreakdown, conversion) ?? stats.totalRevenue;
  const revenueByDate = new Map<string, number>();
  revenue.forEach((point) => {
    const converted =
      convertedAmount(
        [{ currency: point.currency, amount: point.amount }],
        conversion,
      ) ?? 0;
    revenueByDate.set(
      point.date,
      (revenueByDate.get(point.date) ?? 0) + converted,
    );
  });

  return {
    stats: {
      ...stats,
      totalRevenue,
      revenueCurrency: conversion.currency,
    },
    revenue: Array.from(revenueByDate, ([date, amount]) => ({
      date,
      amount,
      currency: conversion.currency,
    })),
    forms: forms.map((form) => ({
      ...form,
      revenue:
        convertedAmount(form.revenueBreakdown, conversion) ?? form.revenue,
      revenueCurrency: conversion.currency,
    })),
  };
}

// ── Server Functions ──

/**
 * One authenticated dashboard request. The independent aggregates execute in
 * parallel and per-form analytics stays constant-query instead of issuing two
 * extra database requests for every form.
 */
export const getDashboardOverview = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardOverview> => {
    const profile = await getDashboardProfile();
    const [stats, submissions, revenue, formAnalytics] = await Promise.all([
      loadDashboardStats(profile.id),
      loadSubmissionsOverTime(profile.id),
      loadRevenueOverTime(profile.id),
      loadFormAnalytics(profile.id),
    ]);
    const dashboardCurrency = isDashboardCurrency(profile.dashboardCurrency)
      ? profile.dashboardCurrency
      : "USD";
    const conversion = await loadDashboardConversion(
      stats.revenueBreakdown,
      dashboardCurrency,
    );
    const converted = applyDashboardConversion(
      stats,
      revenue,
      formAnalytics,
      conversion,
    );
    return {
      ...converted,
      submissions,
      conversion,
    };
  },
);

/** Compatibility endpoints retained for existing consumers. */
export const getDashboardStats = createServerFn({ method: "GET" }).handler(
  async () => loadDashboardStats((await getDashboardProfile()).id),
);

export const getSubmissionsOverTime = createServerFn({ method: "GET" }).handler(
  async () => loadSubmissionsOverTime((await getDashboardProfile()).id),
);

export const getRevenueOverTime = createServerFn({ method: "GET" }).handler(
  async () => loadRevenueOverTime((await getDashboardProfile()).id),
);

export const getFormAnalytics = createServerFn({ method: "GET" }).handler(
  async () => loadFormAnalytics((await getDashboardProfile()).id),
);

export const saveDashboardCurrency = createServerFn({ method: "POST" })
  .validator((data: { currency: string }) => data)
  .handler(async ({ data }) => {
    if (!isDashboardCurrency(data.currency)) {
      throw new Error("Choose a supported display currency.");
    }
    const profile = await getDashboardProfile();
    await db
      .update(profiles)
      .set({ dashboardCurrency: data.currency })
      .where(eq(profiles.id, profile.id));
    return { currency: data.currency as DashboardCurrency };
  });
