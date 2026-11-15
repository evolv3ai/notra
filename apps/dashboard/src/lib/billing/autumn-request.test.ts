import { describe, expect, test } from "bun:test";

import { prepareAutumnRequest } from "@/lib/billing/autumn-request";

const resolveCustomerId = async () => "org_1";

async function prepare(route: string, body: unknown) {
  const request = new Request(`https://app.test/api/autumn/${route}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const prepared = await prepareAutumnRequest(request, resolveCustomerId);
  return { request, prepared };
}

async function forwardedBody(route: string, body: unknown) {
  const { prepared } = await prepare(route, body);
  if (prepared instanceof Response) {
    throw new Error(`expected a forwarded request, got ${prepared.status}`);
  }
  return prepared.json();
}

describe("prepareAutumnRequest", () => {
  test("strips billing overrides from attach and adds the Dub customer id", async () => {
    const body = await forwardedBody("attach", {
      planId: "pro",
      metadata: { dubCustomerExternalId: "spoofed", source: "ui" },
      customize: { price: { amount: 0 } },
      freeTrial: { length: 365 },
      invoiceMode: { enabled: true, enablePlanImmediately: true },
      noBillingChanges: true,
    });

    expect(body).toEqual({
      planId: "pro",
      metadata: { dubCustomerExternalId: "org_1", source: "ui" },
    });
  });

  test("strips overrides nested in multiAttach plans and checkout params", async () => {
    const body = await forwardedBody("multiAttach", {
      plans: [{ planId: "pro", customize: { price: { amount: 0 } } }],
      checkoutSessionParams: {
        metadata: { source: "ui" },
        discounts: [{ coupon: "free" }],
        subscription_data: { metadata: { source: "ui" }, trial_days: 365 },
      },
    });

    expect(body).toEqual({
      plans: [{ planId: "pro" }],
      checkoutSessionParams: {
        metadata: { source: "ui", dubCustomerExternalId: "org_1" },
        subscription_data: { metadata: { source: "ui" } },
      },
    });
  });

  test("only allows end-of-cycle cancellation", async () => {
    const { prepared } = await prepare("updateSubscription", {
      planId: "zdr",
      cancelAction: "cancel_immediately",
    });

    expect(prepared).toBeInstanceOf(Response);
    expect((prepared as Response).status).toBe(400);
  });

  test("rejects routes the dashboard does not use", async () => {
    const { prepared } = await prepare("setupPayment", {});

    expect(prepared).toBeInstanceOf(Response);
    expect((prepared as Response).status).toBe(404);
  });

  test("passes read routes through unchanged", async () => {
    const { request, prepared } = await prepare("listPlans", {});

    expect(prepared).toBe(request);
  });
});
