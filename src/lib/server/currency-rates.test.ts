import { afterEach, describe, expect, it, vi } from "vitest";
import { loadDashboardConversion } from "./currency-rates";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("dashboard exchange-rate service", () => {
  it("loads and validates the latest pair rate", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          date: "2026-07-24",
          base: "USD",
          quote: "PHP",
          rate: 61.739,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const conversion = await loadDashboardConversion(
      [{ currency: "USD", amount: 1_000 }],
      "PHP",
    );

    expect(conversion).toMatchObject({
      currency: "PHP",
      rateDate: "2026-07-24",
      status: "ready",
      rates: { USD: 61.739 },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.frankfurter.dev/v2/rate/USD/PHP",
      expect.objectContaining({
        headers: { Accept: "application/json" },
      }),
    );
  });

  it("returns a safe unavailable state when a pair cannot be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 503 })),
    );

    const conversion = await loadDashboardConversion(
      [{ currency: "EUR", amount: 1_000 }],
      "PHP",
    );

    expect(conversion.status).toBe("unavailable");
    expect(conversion.unavailableCurrencies).toEqual(["EUR"]);
    expect(conversion.rates).toEqual({});
  });
});
