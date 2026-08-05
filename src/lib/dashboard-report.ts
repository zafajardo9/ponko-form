import type {
  DashboardOverview,
  DashboardStats,
} from "./server-fns/dashboard";
import type { FormAnalyticsRecord } from "./dashboard-analytics";
import { appConfig } from "../utils/app-config";
import {
  compareFormPerformance,
  completionRate,
  currencyFractionDigits,
  formatDashboardDate,
  formatDashboardMoney,
} from "./dashboard-analytics";

export interface DashboardInsight {
  tone: "positive" | "neutral" | "attention";
  title: string;
  detail: string;
}

export function buildDashboardInsights(
  stats: DashboardStats,
  forms: FormAnalyticsRecord[],
): DashboardInsight[] {
  const rate = completionRate(
    stats.completedSubmissions,
    stats.totalSubmissions,
  );
  const comparison = compareFormPerformance(forms);
  const insights: DashboardInsight[] = [];

  if (stats.totalSubmissions === 0) {
    insights.push({
      tone: "neutral",
      title: "No responses to measure yet",
      detail:
        "Share a published form to begin tracking starts, completion, and revenue.",
    });
  } else if (rate >= 80) {
    insights.push({
      tone: "positive",
      title: "Most visitors finish",
      detail: `${rate}% of started submissions reached completion.`,
    });
  } else if (rate >= 50) {
    insights.push({
      tone: "neutral",
      title: "Completion has room to improve",
      detail: `${rate}% of started submissions reached completion. Review longer forms and required questions.`,
    });
  } else {
    insights.push({
      tone: "attention",
      title: "Many visitors stop before finishing",
      detail: `Only ${rate}% of started submissions reached completion. Shorten the first page and check conditional logic.`,
    });
  }

  if (stats.pendingPaymentSubmissions > 0 || stats.failedPayments > 0) {
    insights.push({
      tone: "attention",
      title: "Payments need follow-up",
      detail: `${stats.pendingPaymentSubmissions} submissions are waiting for payment and ${stats.failedPayments} payments failed.`,
    });
  } else if (stats.completedPayments > 0) {
    insights.push({
      tone: "positive",
      title: "Payment flow is healthy",
      detail: `${stats.completedPayments} payments completed with no recorded failures.`,
    });
  }

  if (comparison.topBySubmissions) {
    insights.push({
      tone: "neutral",
      title: `${comparison.topBySubmissions.title} brings the most responses`,
      detail: `${comparison.topBySubmissions.submissionCount} submissions make it your highest-volume form.`,
    });
  }

  return insights.slice(0, 3);
}

function ascii(value: string) {
  return value
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E]/g, "");
}

function reportMoney(cents: number, currency: string) {
  if (currency === "MIXED") return `${(cents / 100).toFixed(2)} combined`;
  const fractionDigits = currencyFractionDigits(currency);
  return `${currency} ${(cents / 10 ** fractionDigits).toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

export async function createDashboardReportPdf(
  overview: DashboardOverview,
  selectedForm?: FormAnalyticsRecord | null,
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const accent = [204, 120, 92] as const;
  const ink = [20, 20, 19] as const;
  const body = [61, 61, 58] as const;
  const muted = [108, 106, 100] as const;
  const line = [230, 223, 216] as const;
  const soft = [245, 240, 232] as const;
  const scopeForms = selectedForm ? [selectedForm] : overview.forms;
  const stats = selectedForm
    ? {
        totalSubmissions: selectedForm.submissionCount,
        completedSubmissions: selectedForm.completedCount,
        completedPayments: selectedForm.completedPaymentCount,
        failedPayments:
          selectedForm.paymentCount - selectedForm.completedPaymentCount,
        totalRevenue: selectedForm.revenue,
        revenueCurrency: selectedForm.revenueCurrency,
        revenueBreakdown: selectedForm.revenueBreakdown,
      }
    : overview.stats;
  const rate = completionRate(
    stats.completedSubmissions,
    stats.totalSubmissions,
  );

  function footer() {
    doc.setDrawColor(...line);
    doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(`${appConfig.name} performance report`, margin, pageHeight - 8);
    doc.text(
      `Page ${doc.getNumberOfPages()}`,
      pageWidth - margin,
      pageHeight - 8,
      { align: "right" },
    );
  }

  function pageHeader(title: string, subtitle: string) {
    doc.setFillColor(...soft);
    doc.rect(0, 0, pageWidth, 34, "F");
    doc.setFillColor(...accent);
    doc.roundedRect(margin, 9, 8, 8, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...ink);
    doc.text(ascii(title), margin + 12, 14.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...muted);
    doc.text(ascii(subtitle), margin + 12, 20);
  }

  pageHeader(
    selectedForm ? selectedForm.title : "Form performance overview",
    `Generated ${new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })} - ${overview.conversion.currency} display currency - Last 30 days of trend data`,
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...body);
  const intro = selectedForm
    ? `A focused report for ${selectedForm.title}, including submission completion and payment performance.`
    : "A creator-facing summary of submissions, completion, revenue, payment health, and performance by form.";
  doc.text(doc.splitTextToSize(ascii(intro), contentWidth), margin, 44);

  const cards = [
    ["Submissions", String(stats.totalSubmissions)],
    ["Completed", String(stats.completedSubmissions)],
    ["Completion rate", `${rate}%`],
    [
      "Revenue",
      reportMoney(stats.totalRevenue, stats.revenueCurrency),
    ],
  ];
  const cardGap = 3;
  const cardWidth = (contentWidth - cardGap * 3) / 4;
  cards.forEach(([label, value], index) => {
    const x = margin + index * (cardWidth + cardGap);
    doc.setFillColor(250, 249, 245);
    doc.setDrawColor(...line);
    doc.roundedRect(x, 56, cardWidth, 27, 2.5, 2.5, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...muted);
    doc.text(label, x + 3, 63);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(value.length > 14 ? 10 : 14);
    doc.setTextColor(...ink);
    doc.text(ascii(value), x + 3, 75);
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...ink);
  doc.text("Submission outcome", margin, 96);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text(
    "How many started responses reached a completed submission.",
    margin,
    101,
  );
  doc.setFillColor(232, 224, 214);
  doc.roundedRect(margin, 108, contentWidth, 10, 3, 3, "F");
  doc.setFillColor(107, 143, 113);
  doc.roundedRect(
    margin,
    108,
    Math.max(rate > 0 ? 3 : 0, (contentWidth * rate) / 100),
    10,
    3,
    3,
    "F",
  );
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  if (rate >= 12) doc.text(`${rate}% complete`, margin + 3, 114.5);
  doc.setTextColor(...body);
  doc.text(
    `${Math.max(0, stats.totalSubmissions - stats.completedSubmissions)} did not complete`,
    pageWidth - margin,
    126,
    { align: "right" },
  );

  if (!selectedForm) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...ink);
    doc.text("30-day activity", margin, 140);
    const chartTop = 147;
    const chartHeight = 45;
    const chartWidth = (contentWidth - 6) / 2;
    const submissions = overview.submissions.slice(-30);
    const revenue = overview.revenue.slice(-30);

    function drawMiniChart(
      x: number,
      title: string,
      values: number[],
      chartColor: readonly [number, number, number],
      kind: "line" | "bar",
    ) {
      doc.setFillColor(250, 249, 245);
      doc.setDrawColor(...line);
      doc.roundedRect(x, chartTop, chartWidth, chartHeight, 2.5, 2.5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...ink);
      doc.text(title, x + 4, chartTop + 7);
      const plotX = x + 4;
      const plotY = chartTop + 12;
      const plotW = chartWidth - 8;
      const plotH = chartHeight - 17;
      const max = Math.max(1, ...values);
      doc.setDrawColor(...line);
      doc.line(plotX, plotY + plotH, plotX + plotW, plotY + plotH);
      doc.setDrawColor(...chartColor);
      doc.setFillColor(...chartColor);
      values.forEach((value, index) => {
        const pointX =
          plotX + (index / Math.max(values.length - 1, 1)) * plotW;
        const pointY = plotY + plotH - (value / max) * plotH;
        if (kind === "bar") {
          const width = Math.max(0.8, plotW / Math.max(values.length, 1) - 0.8);
          doc.rect(pointX - width / 2, pointY, width, plotY + plotH - pointY, "F");
        } else if (index > 0) {
          const previousX =
            plotX + ((index - 1) / Math.max(values.length - 1, 1)) * plotW;
          const previousY =
            plotY + plotH - (values[index - 1] / max) * plotH;
          doc.line(previousX, previousY, pointX, pointY);
        }
      });
    }

    drawMiniChart(
      margin,
      "Submissions",
      submissions.map((point) => point.count),
      [107, 143, 113],
      "line",
    );
    drawMiniChart(
      margin + chartWidth + 6,
      `Revenue (${overview.stats.revenueCurrency})`,
      revenue.map(
        (point) =>
          point.amount / 10 ** currencyFractionDigits(point.currency),
      ),
      accent,
      "bar",
    );
  }

  const insightStats: DashboardStats = selectedForm
    ? {
        totalForms: 1,
        publishedForms: selectedForm.status === "published" ? 1 : 0,
        totalSubmissions: selectedForm.submissionCount,
        completedSubmissions: selectedForm.completedCount,
        pendingPaymentSubmissions: Math.max(
          0,
          selectedForm.paymentCount - selectedForm.completedPaymentCount,
        ),
        paymentFailedSubmissions: 0,
        totalPayments: selectedForm.paymentCount,
        completedPayments: selectedForm.completedPaymentCount,
        failedPayments: Math.max(
          0,
          selectedForm.paymentCount - selectedForm.completedPaymentCount,
        ),
        totalRevenue: selectedForm.revenue,
        revenueCurrency: selectedForm.revenueCurrency,
        revenueBreakdown: selectedForm.revenueBreakdown,
      }
    : overview.stats;
  const insights = buildDashboardInsights(insightStats, scopeForms);
  const insightTop = selectedForm ? 140 : 207;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...ink);
  doc.text("What this means", margin, insightTop);
  let insightY = insightTop + 8;
  insights.forEach((insight) => {
    const insightColor =
      insight.tone === "positive"
        ? ([232, 241, 233] as const)
        : insight.tone === "attention"
          ? ([255, 243, 239] as const)
          : soft;
    doc.setFillColor(insightColor[0], insightColor[1], insightColor[2]);
    doc.roundedRect(margin, insightY, contentWidth, 18, 2.5, 2.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...ink);
    doc.text(ascii(insight.title), margin + 4, insightY + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...body);
    doc.text(
      doc.splitTextToSize(ascii(insight.detail), contentWidth - 8),
      margin + 4,
      insightY + 11,
    );
    insightY += 21;
  });
  footer();

  if (!selectedForm && overview.forms.length > 0) {
    doc.addPage();
    pageHeader(
      "Performance by form",
      "Compare response volume, completion, payment success, and revenue.",
    );
    const columns = [
      { label: "Form", x: margin, width: 58, align: "left" as const },
      { label: "Started", x: 78, width: 18, align: "right" as const },
      { label: "Complete", x: 101, width: 20, align: "right" as const },
      { label: "Rate", x: 126, width: 16, align: "right" as const },
      { label: "Revenue", x: 148, width: 46, align: "right" as const },
    ];
    let y = 47;

    function tableHeader() {
      doc.setFillColor(...soft);
      doc.roundedRect(margin, y, contentWidth, 10, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...muted);
      columns.forEach((column) =>
        doc.text(column.label, column.x, y + 6.5, { align: column.align }),
      );
      y += 13;
    }

    tableHeader();
    overview.forms.forEach((form) => {
      if (y > pageHeight - 28) {
        footer();
        doc.addPage();
        pageHeader("Performance by form", "Continued");
        y = 43;
        tableHeader();
      }
      doc.setDrawColor(...line);
      doc.line(margin, y + 9, pageWidth - margin, y + 9);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...ink);
      doc.text(
        ascii(form.title).slice(0, 34),
        columns[0].x,
        y + 5.5,
      );
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...body);
      doc.text(String(form.submissionCount), columns[1].x, y + 5.5, {
        align: "right",
      });
      doc.text(String(form.completedCount), columns[2].x, y + 5.5, {
        align: "right",
      });
      doc.text(
        `${completionRate(form.completedCount, form.submissionCount)}%`,
        columns[3].x,
        y + 5.5,
        { align: "right" },
      );
      doc.text(
        ascii(reportMoney(form.revenue, form.revenueCurrency)),
        columns[4].x,
        y + 5.5,
        { align: "right" },
      );
      y += 11;
    });
    footer();
  }

  const filename = selectedForm
    ? `${selectedForm.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-performance-report.pdf`
    : "ponkoform-performance-report.pdf";
  return { doc, filename };
}

export async function downloadDashboardReport(
  overview: DashboardOverview,
  selectedForm?: FormAnalyticsRecord | null,
) {
  const { doc, filename } = await createDashboardReportPdf(
    overview,
    selectedForm,
  );
  doc.save(filename);
}

export function selectedFormSummary(form: FormAnalyticsRecord) {
  return {
    completionRate: completionRate(form.completedCount, form.submissionCount),
    revenue: formatDashboardMoney(form.revenue, form.revenueCurrency),
    lastSubmission: form.lastSubmissionAt
      ? formatDashboardDate(form.lastSubmissionAt)
      : "No submissions yet",
  };
}
