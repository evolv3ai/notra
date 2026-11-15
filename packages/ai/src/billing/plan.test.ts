import { beforeEach, describe, expect, mock, test } from "bun:test";

const getOrCreate = mock();
const billing = {
  autumn: { customers: { getOrCreate } },
  AUTUMN_READ_TIMEOUT_MS: 5000,
};
mock.module("./autumn", () => billing);

const { resolveOrganizationPlan } = await import("./plan");

beforeEach(() => getOrCreate.mockReset());

describe("paid organization plans", () => {
  test.each([
    ["starter", "active", false, "paid"],
    ["growth_annual", "active", false, "paid"],
    ["pro", "active", false, "paid"],
    ["free", "active", false, "free"],
    ["starter", "past_due", false, "free"],
    ["starter", "canceled", false, "free"],
    ["starter", "active", true, "free"],
  ] as const)(
    "%s/%s/addOn=%s resolves to %s",
    async (planId, status, addOn, expected) => {
      getOrCreate.mockResolvedValue({
        subscriptions: [{ planId, status, addOn }],
      });
      expect(await resolveOrganizationPlan("org-plan")).toBe(expected);
      expect(getOrCreate).toHaveBeenCalledWith(
        { customerId: "org-plan" },
        { timeoutMs: 5000 }
      );
    }
  );

  test("credits without a subscription are not a paid plan", async () => {
    getOrCreate.mockResolvedValue({
      subscriptions: [],
      balances: { ai_credits: { remaining: 1000 } },
    });
    expect(await resolveOrganizationPlan("org-credits")).toBe("free");
  });

  test("billing failures do not grant paid access", async () => {
    getOrCreate.mockRejectedValue(new Error("billing unavailable"));
    await expect(resolveOrganizationPlan("org-unavailable")).rejects.toThrow(
      "billing unavailable"
    );
  });
});
