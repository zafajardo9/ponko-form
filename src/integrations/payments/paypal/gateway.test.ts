import { afterEach, describe, expect, it, vi } from "vitest";
import { PayPalGateway } from "./gateway";

const credentials = {
  clientId: "client-id",
  clientSecret: "client-secret",
  mode: "sandbox" as const,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PayPal payment verification", () => {
  it("recognizes an already captured order without capturing it again", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "token" }))
      .mockResolvedValueOnce(
        jsonResponse({
          status: "COMPLETED",
          purchase_units: [{
            amount: { currency_code: "USD", value: "12.50" },
            payments: {
              captures: [{
                status: "COMPLETED",
                amount: { currency_code: "USD", value: "12.50" },
                create_time: "2026-07-24T01:00:00Z",
              }],
            },
          }],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new PayPalGateway().getPaymentDetails(
      "ORDER-1",
      credentials,
    );

    expect(result).toMatchObject({
      status: "completed",
      providerStatus: "COMPLETED",
      amount: 1_250,
      paidAmount: 1_250,
      currency: "USD",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("captures an approved order and reads the capture result", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "token" }))
      .mockResolvedValueOnce(jsonResponse({ status: "APPROVED" }))
      .mockResolvedValueOnce(
        jsonResponse({
          status: "COMPLETED",
          purchase_units: [{
            payments: {
              captures: [{
                status: "COMPLETED",
                amount: { currency_code: "PHP", value: "500.00" },
              }],
            },
          }],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new PayPalGateway().getPaymentDetails(
      "ORDER-2",
      credentials,
    );

    expect(result.status).toBe("completed");
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api-m.sandbox.paypal.com/v2/checkout/orders/ORDER-2/capture",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("rechecks the order when the capture response is lost", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "token" }))
      .mockResolvedValueOnce(jsonResponse({ status: "APPROVED" }))
      .mockResolvedValueOnce(new Response("", { status: 502 }))
      .mockResolvedValueOnce(
        jsonResponse({
          status: "COMPLETED",
          purchase_units: [{
            payments: { captures: [{ status: "COMPLETED" }] },
          }],
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new PayPalGateway().getPaymentDetails(
      "ORDER-3",
      credentials,
    );

    expect(result.status).toBe("completed");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
