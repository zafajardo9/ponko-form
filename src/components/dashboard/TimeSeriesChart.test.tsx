// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  TimeSeriesChart,
  chartPoints,
  niceMaximum,
} from "./TimeSeriesChart";

describe("TimeSeriesChart", () => {
  it("rounds chart bounds to readable values", () => {
    expect(niceMaximum(0)).toBe(1);
    expect(niceMaximum(1.2)).toBe(2);
    expect(niceMaximum(38)).toBe(50);
    expect(niceMaximum(830)).toBe(1_000);
  });

  it("maps the first and last data points across the plot", () => {
    const points = chartPoints(
      [
        { date: "2026-07-01", value: 0 },
        { date: "2026-07-02", value: 10 },
      ],
      10,
    );

    expect(points[0]).toMatchObject({ x: 40, y: 208 });
    expect(points[1]).toMatchObject({ x: 410, y: 12 });
  });

  it("exposes every point to keyboard users and shows its value on focus", () => {
    render(
      <TimeSeriesChart
        data={[
          { date: "2026-07-01", value: 2 },
          { date: "2026-07-02", value: 5 },
        ]}
        kind="area"
        color="#6b8f71"
        label="Submission history"
        valueLabel={(value) => `${value} submissions`}
      />,
    );

    expect(
      screen.getByRole("img", { name: /submission history/i }),
    ).toBeTruthy();
    const point = screen.getByLabelText(/jul 2, 2026: 5 submissions/i);
    fireEvent.focus(point);
    expect(screen.getByText("5 submissions")).toBeTruthy();
    fireEvent.blur(point);
    expect(screen.queryByText("5 submissions")).toBeNull();
  });
});
