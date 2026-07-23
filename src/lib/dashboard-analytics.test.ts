import { describe, expect, it } from "vitest";
import {
  dashboardDateKey,
  fillDashboardDateGaps,
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
        [{ formId: 1, total: 3, completed: 2, revenue: 12_500 }],
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
});
