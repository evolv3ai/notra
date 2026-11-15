import { afterEach, expect, mock, test } from "bun:test";

const lookups: string[] = [];
mock.module("@notra/ai/billing/autumn", () => ({
  autumn: null,
  AUTUMN_READ_TIMEOUT_MS: 5000,
  allowUnmeteredAiInDevelopment: false,
}));
mock.module("@notra/ai/billing/plan", () => ({
  resolveOrganizationPlan: async (organizationId: string) => {
    lookups.push(organizationId);
    return "free";
  },
}));

const { resolveSitePlan } = await import("../src/plan-limits");
const nodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = nodeEnv;
  lookups.length = 0;
});

test("without Autumn, development and tests are unlimited", async () => {
  process.env.NODE_ENV = "development";
  expect(await resolveSitePlan("org-dev")).toBe("paid");
  process.env.NODE_ENV = "test";
  expect(await resolveSitePlan("org-test")).toBe("paid");
  expect(lookups).toEqual([]);
});

test("without Autumn, production falls back to the Free limits", async () => {
  process.env.NODE_ENV = "production";
  expect(await resolveSitePlan("org-prod")).toBe("free");
  expect(lookups).toEqual(["org-prod"]);
});
