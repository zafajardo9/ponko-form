import { describe, expect, it } from "vitest";
import {
  dashboardDateKey,
  compareFormPerformance,
  completionRate,
  fillDashboardDateGaps,
  formatDashboardMoney,
  formatDashboardDate,
  mergeFormAnalytics,
} from "./dashboard-analytics";

describe("mergeFormAnalytics", () => {
  it("merges grouped analytics and preserves forms with no activity", () => {
    expect(
      mergeFormAnalytics(
        [
          { id: 1, title: "Active form", status: "published" },
          { id: 2, title: "New form", status: "draft" },
        ],
        [
          {
            formId: 1,
            total: 8,
            completed: 6,
            lastAt: "2026-07-20T10:00:00.000Z",
          },
        ],
        [
          {
            formId: 1,
            total: 3,
            completed: 2,
            revenue: 12_500,
            revenueCurrency: "PHP",
            revenueBreakdown: [{ currency: "PHP", amount: 12_500 }],
          },
        ],
      ),
    ).toEqual([
      {
        id: 1,
        title: "Active form",
        status: "published",
        submissionCount: 8,
        completedCount: 6,
        paymentCount: 3,
        completedPaymentCount: 2,
        revenue: 12_500,
        revenueCurrency: "PHP",
        revenueBreakdown: [{ currency: "PHP", amount: 12_500 }],
        lastSubmissionAt: "2026-07-20T10:00:00.000Z",
      },
      {
        id: 2,
        title: "New form",
        status: "draft",
        submissionCount: 0,
        completedCount: 0,
        paymentCount: 0,
        completedPaymentCount: 0,
        revenue: 0,
        revenueCurrency: "USD",
        revenueBreakdown: [],
        lastSubmissionAt: null,
      },
    ]);
  });

  it("fills a local-calendar date window across month and year boundaries", () => {
    const now = new Date(2026, 0, 2, 12);
    expect(
      fillDashboardDateGaps(
        [{ date: "2026-01-01", count: 3 }],
        4,
        { count: 0 },
        now,
      ),
    ).toEqual([
      { date: "2025-12-30", count: 0 },
      { date: "2025-12-31", count: 0 },
      { date: "2026-01-01", count: 3 },
      { date: "2026-01-02", count: 0 },
    ]);
  });

  it("formats stable dashboard date keys and readable labels", () => {
    const date = new Date(2026, 6, 20, 12);
    expect(dashboardDateKey(date)).toBe("2026-07-20");
    expect(formatDashboardDate(date)).toBe("Jul 20, 2026");
    expect(formatDashboardDate("not-a-date")).toBe("—");
  });

  it("calculates readable completion rates and ranks form performance", () => {
    expect(completionRate(7, 10)).toBe(70);
    expect(completionRate(0, 0)).toBe(0);

    const forms = mergeFormAnalytics(
      [
        { id: 1, title: "Volume", status: "published" },
        { id: 2, title: "Quality", status: "published" },
      ],
      [
        { formId: 1, total: 20, completed: 10, lastAt: null },
        { formId: 2, total: 8, completed: 8, lastAt: null },
      ],
      [
        {
          formId: 1,
          total: 4,
          completed: 4,
          revenue: 20_000,
          revenueCurrency: "USD",
          revenueBreakdown: [{ currency: "USD", amount: 20_000 }],
        },
      ],
    );

    expect(compareFormPerformance(forms).topBySubmissions?.title).toBe("Volume");
    expect(compareFormPerformance(forms).topByCompletion?.title).toBe("Quality");
    expect(formatDashboardMoney(12_500, "PHP")).toContain("PHP");
  });
});
