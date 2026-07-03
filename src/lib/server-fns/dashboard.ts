import { createServerFn } from "@tanstack/react-start";
import { auth } from "@clerk/tanstack-react-start/server";
import { db } from "../../db/index";
import { forms, formSubmissions, payments, profiles } from "../../db/schema";
import { eq, desc, sql, and, gte, count } from "drizzle-orm";

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

export interface FormAnalytics {
  id: number;
  title: string;
  status: string;
  submissionCount: number;
  completedCount: number;
  paymentCount: number;
  completedPaymentCount: number;
  revenue: number; // in cents
  lastSubmissionAt: string | null;
}

// ── Server Functions ──

/** High-level summary stats across all of a user's forms. */
export const getDashboardStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardStats> => {
    const profileId = await getProfileId();


    // Form counts
    const [formCounts] = await db
      .select({
        total: count(),
        published:
          sql<number>`COUNT(CASE WHEN ${forms.status} = 'published' THEN 1 END)`.mapWith(
            Number,
          ),
      })
      .from(forms)
      .where(eq(forms.profileId, profileId));

    // Submission counts
    const [subCounts] = await db
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
      .where(eq(forms.profileId, profileId));

    // Payment counts & revenue
    const [payCounts] = await db
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
      .where(eq(forms.profileId, profileId));

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
  },
);

/** Daily submission counts for the last 30 days. */
export const getSubmissionsOverTime = createServerFn({ method: "GET" }).handler(
  async (): Promise<TimeSeriesPoint[]> => {
    const profileId = await getProfileId();

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

    return rows.map((r) => ({ date: r.date, count: r.count }));
  },
);

/** Daily revenue (completed payments only) for the last 30 days. */
export const getRevenueOverTime = createServerFn({ method: "GET" }).handler(
  async (): Promise<RevenuePoint[]> => {
    const profileId = await getProfileId();

    const rows = await db
      .select({
        date: sql<string>`DATE(${payments.createdAt})`.mapWith(String),
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
          gte(payments.createdAt, sql`NOW() - INTERVAL '30 days'`),
        ),
      )
      .groupBy(sql`DATE(${payments.createdAt})`)
      .orderBy(sql`DATE(${payments.createdAt})`);

    return rows.map((r) => ({ date: r.date, amount: r.amount }));
  },
);

/** Per-form analytics for the forms table. */
export const getFormAnalytics = createServerFn({ method: "GET" }).handler(
  async (): Promise<FormAnalytics[]> => {
    const profileId = await getProfileId();

    const userForms = await db
      .select({
        id: forms.id,
        title: forms.title,
        status: forms.status,
      })
      .from(forms)
      .where(eq(forms.profileId, profileId))
      .orderBy(desc(forms.updatedAt));

    // For each form, fetch analytics
    const analytics: FormAnalytics[] = await Promise.all(
      userForms.map(async (form) => {
        const [subCounts] = await db
          .select({
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
          .where(eq(formSubmissions.formId, form.id));

        const [payCounts] = await db
          .select({
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
          .where(eq(formSubmissions.formId, form.id));

        return {
          id: form.id,
          title: form.title,
          status: form.status,
          submissionCount: subCounts.total,
          completedCount: subCounts.completed,
          paymentCount: payCounts.total,
          completedPaymentCount: payCounts.completed,
          revenue: payCounts.revenue,
          lastSubmissionAt: subCounts.lastAt,
        };
      }),
    );

    return analytics;
  },
);
