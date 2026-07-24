import { describe, expect, it } from "vitest";
import {
  convertRevenueAmounts,
  isDashboardCurrency,
  mergeRevenueAmounts,
} from "./currency-conversion";

describe("dashboard currency conversion", () => {
  it("merges source currency totals before conversion", () => {
    expect(
      mergeRevenueAmounts([
        { currency: "USD", amount: 1_000 },
        { currency: "PHP", amount: 5_000 },
        { currency: "USD", amount: 500 },
      ]),
    ).toEqual([
      { currency: "USD", amount: 1_500 },
      { currency: "PHP", amount: 5_000 },
    ]);
  });

  it("converts every currency portion in minor units", () => {
    expect(
      convertRevenueAmounts(
        [
          { currency: "USD", amount: 1_000 },
          { currency: "PHP", amount: 5_000 },
        ],
        { USD: 58, PHP: 1 },
        "PHP",
      ),
    ).toBe(63_000);
  });

  it("fails closed when a source rate is missing", () => {
    expect(
      convertRevenueAmounts(
        [{ currency: "USD", amount: 1_000 }],
        {},
        "PHP",
      ),
    ).toBeNull();
    expect(isDashboardCurrency("PHP")).toBe(true);
    expect(isDashboardCurrency("BTC")).toBe(false);
  });

  it("respects currencies with different minor-unit precision", () => {
    expect(
      convertRevenueAmounts(
        [{ currency: "JPY", amount: 1_000 }],
        { JPY: 0.34 },
        "PHP",
      ),
    ).toBe(34_000);
  });
});
