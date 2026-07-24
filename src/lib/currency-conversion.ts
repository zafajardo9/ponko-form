import {
  currencyFractionDigits,
  type RevenueAmount,
} from "./dashboard-analytics";

export const DASHBOARD_CURRENCIES = [
  { code: "PHP", name: "Philippine peso" },
  { code: "USD", name: "US dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British pound" },
  { code: "JPY", name: "Japanese yen" },
  { code: "AUD", name: "Australian dollar" },
  { code: "CAD", name: "Canadian dollar" },
  { code: "SGD", name: "Singapore dollar" },
  { code: "HKD", name: "Hong Kong dollar" },
  { code: "NZD", name: "New Zealand dollar" },
] as const;

export type DashboardCurrency =
  (typeof DASHBOARD_CURRENCIES)[number]["code"];

export function isDashboardCurrency(value: string): value is DashboardCurrency {
  return DASHBOARD_CURRENCIES.some((currency) => currency.code === value);
}

export function mergeRevenueAmounts(items: RevenueAmount[]) {
  const amounts = new Map<string, number>();
  items.forEach((item) => {
    amounts.set(item.currency, (amounts.get(item.currency) ?? 0) + item.amount);
  });
  return Array.from(amounts, ([currency, amount]) => ({ currency, amount }));
}

export function convertRevenueAmounts(
  items: RevenueAmount[],
  rates: Record<string, number>,
  targetCurrency: string,
) {
  if (items.some((item) => rates[item.currency] === undefined)) return null;
  const targetScale = 10 ** currencyFractionDigits(targetCurrency);
  return Math.round(
    items.reduce(
      (total, item) =>
        total +
          (item.amount / 10 ** currencyFractionDigits(item.currency)) *
          rates[item.currency]! *
          targetScale,
      0,
    ),
  );
}
