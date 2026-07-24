import { describe, expect, it } from "vitest";
import type { DashboardOverview } from "./server-fns/dashboard";
import {
  buildDashboardInsights,
  createDashboardReportPdf,
} from "./dashboard-report";

const overview: DashboardOverview = {
  stats: {
    totalForms: 1,
    publishedForms: 1,
    totalSubmissions: 10,
    completedSubmissions: 7,
    pendingPaymentSubmissions: 1,
    paymentFailedSubmissions: 0,
    totalPayments: 3,
    completedPayments: 2,
    failedPayments: 1,
    totalRevenue: 12_500,
    revenueCurrency: "PHP",
    revenueBreakdown: [{ currency: "PHP", amount: 12_500 }],
  },
  submissions: [{ date: "2026-07-23", count: 10 }],
  revenue: [{ date: "2026-07-23", amount: 12_500, currency: "PHP" }],
  forms: [
    {
      id: 1,
      title: "Workshop registration",
      status: "published",
      submissionCount: 10,
      completedCount: 7,
      paymentCount: 3,
      completedPaymentCount: 2,
      revenue: 12_500,
      revenueCurrency: "PHP",
      revenueBreakdown: [{ currency: "PHP", amount: 12_500 }],
      lastSubmissionAt: "2026-07-23T10:00:00.000Z",
    },
  ],
  conversion: {
    currency: "PHP",
    rateDate: "2026-07-23",
    status: "ready",
    sourceCurrencies: ["PHP"],
    unavailableCurrencies: [],
    rates: { PHP: 1 },
  },
};

describe("dashboard performance report", () => {
  it("turns performance into creator-readable insights", () => {
    const insights = buildDashboardInsights(overview.stats, overview.forms);

    expect(insights.map((insight) => insight.title)).toEqual([
      "Completion has room to improve",
      "Payments need follow-up",
      "Workshop registration brings the most responses",
    ]);
  });

  it("describes an empty dashboard without implying poor performance", () => {
    const insights = buildDashboardInsights(
      {
        ...overview.stats,
        totalSubmissions: 0,
        completedSubmissions: 0,
        pendingPaymentSubmissions: 0,
        totalPayments: 0,
        completedPayments: 0,
        failedPayments: 0,
        totalRevenue: 0,
      },
      [],
    );

    expect(insights[0].title).toBe("No responses to measure yet");
  });

  it("creates a two-page overview PDF with the form comparison", async () => {
    const { doc, filename } = await createDashboardReportPdf(overview);

    expect(filename).toBe("ponkoform-performance-report.pdf");
    expect(doc.getNumberOfPages()).toBe(2);
    expect(doc.output("arraybuffer").byteLength).toBeGreaterThan(5_000);
  });
});
