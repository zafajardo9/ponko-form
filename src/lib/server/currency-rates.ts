import type { RevenueAmount } from "../dashboard-analytics";
import {
  convertRevenueAmounts,
  mergeRevenueAmounts,
  type DashboardCurrency,
} from "../currency-conversion";

const RATE_TTL_MS = 6 * 60 * 60 * 1000;
const rateCache = new Map<
  string,
  { rate: number; date: string; expiresAt: number }
>();

type FrankfurterRate = {
  date: string;
  base: string;
  quote: string;
  rate: number;
};

export interface DashboardConversion {
  currency: DashboardCurrency;
  rateDate: string | null;
  status: "ready" | "unavailable";
  sourceCurrencies: string[];
  unavailableCurrencies: string[];
  rates: Record<string, number>;
}

async function fetchPairRate(source: string, target: string) {
  if (source === target) {
    return { rate: 1, date: new Date().toISOString().slice(0, 10) };
  }

  const cacheKey = `${source}/${target}`;
  const cached = rateCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const response = await fetch(
    `https://api.frankfurter.dev/v2/rate/${encodeURIComponent(source)}/${encodeURIComponent(target)}`,
    {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    },
  );
  if (!response.ok) {
    throw new Error(`Exchange rate unavailable for ${source}/${target}`);
  }

  const payload = (await response.json()) as FrankfurterRate;
  if (
    payload.base !== source ||
    payload.quote !== target ||
    !Number.isFinite(payload.rate) ||
    payload.rate <= 0
  ) {
    throw new Error(`Invalid exchange rate for ${source}/${target}`);
  }

  const cachedRate = {
    rate: payload.rate,
    date: payload.date,
    expiresAt: Date.now() + RATE_TTL_MS,
  };
  rateCache.set(cacheKey, cachedRate);
  return cachedRate;
}

export async function loadDashboardConversion(
  revenue: RevenueAmount[],
  target: DashboardCurrency,
): Promise<DashboardConversion> {
  const sourceCurrencies = Array.from(
    new Set(revenue.map((item) => item.currency)),
  );
  if (sourceCurrencies.length === 0) {
    return {
      currency: target,
      rateDate: null,
      status: "ready",
      sourceCurrencies: [],
      unavailableCurrencies: [],
      rates: {},
    };
  }

  const results = await Promise.allSettled(
    sourceCurrencies.map(async (source) => ({
      source,
      ...(await fetchPairRate(source, target)),
    })),
  );
  const rates: Record<string, number> = {};
  const dates: string[] = [];
  const unavailableCurrencies: string[] = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      rates[result.value.source] = result.value.rate;
      dates.push(result.value.date);
    } else {
      unavailableCurrencies.push(sourceCurrencies[index]);
    }
  });

  return {
    currency: target,
    rateDate: dates.sort()[0] ?? null,
    status: unavailableCurrencies.length === 0 ? "ready" : "unavailable",
    sourceCurrencies,
    unavailableCurrencies,
    rates,
  };
}

export function convertedAmount(
  revenue: RevenueAmount[],
  conversion: DashboardConversion,
) {
  return convertRevenueAmounts(
    mergeRevenueAmounts(revenue),
    conversion.rates,
    conversion.currency,
  );
}
