import { createServerFn } from "@tanstack/react-start";
import { auth } from "@clerk/tanstack-react-start/server";
import { db } from "../../db/index";
import { forms, formSubmissions, payments, profiles } from "../../db/schema";
import { eq, desc, sql, and, gte, count } from "drizzle-orm";
import {
  mergeFormAnalytics,
  type FormAnalyticsRecord,
} from "../dashboard-analytics";

async function getProfileId() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.clerkId, userId))
    .limit(1);
  if (!profile) throw new Error("Profile not found");
  return profile.id;
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
}

export interface TimeSeriesPoint {
  date: string;
  count: number;
}

export interface RevenuePoint {
  date: string;
  amount: number; // in cents
}

export type FormAnalytics = FormAnalyticsRecord;

export interface DashboardOverview {
  stats: DashboardStats;
  submissions: TimeSeriesPoint[];
  revenue: RevenuePoint[];
  forms: FormAnalytics[];
}

async function loadDashboardStats(profileId: number): Promise<DashboardStats> {
  const [formCounts, subCounts, payCounts] = await Promise.all([
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
    revenueCurrency: "USD",
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
    .groupBy(sql`DATE(${payments.createdAt})`)
    .orderBy(sql`DATE(${payments.createdAt})`);

  return rows.map((row) => ({ date: row.date, amount: row.amount }));
}

async function loadFormAnalytics(profileId: number): Promise<FormAnalytics[]> {
  const [userForms, submissionRows, paymentRows] = await Promise.all([
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
  ]);

  return mergeFormAnalytics(userForms, submissionRows, paymentRows);
}

// ── Server Functions ──

/**
 * One authenticated dashboard request. The independent aggregates execute in
 * parallel and per-form analytics stays constant-query instead of issuing two
 * extra database requests for every form.
 */
export const getDashboardOverview = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardOverview> => {
    const profileId = await getProfileId();
    const [stats, submissions, revenue, formAnalytics] = await Promise.all([
      loadDashboardStats(profileId),
      loadSubmissionsOverTime(profileId),
      loadRevenueOverTime(profileId),
      loadFormAnalytics(profileId),
    ]);
    return { stats, submissions, revenue, forms: formAnalytics };
  },
);

/** Compatibility endpoints retained for existing consumers. */
export const getDashboardStats = createServerFn({ method: "GET" }).handler(
  async () => loadDashboardStats(await getProfileId()),
);

export const getSubmissionsOverTime = createServerFn({ method: "GET" }).handler(
  async () => loadSubmissionsOverTime(await getProfileId()),
);

export const getRevenueOverTime = createServerFn({ method: "GET" }).handler(
  async () => loadRevenueOverTime(await getProfileId()),
);

export const getFormAnalytics = createServerFn({ method: "GET" }).handler(
  async () => loadFormAnalytics(await getProfileId()),
);
