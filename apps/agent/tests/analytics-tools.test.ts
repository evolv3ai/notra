import { describe, expect, mock, test } from "bun:test";

const projectRows = [
  {
    id: "proj-old",
    name: "Acme",
    websiteUrl: "https://acme.com",
    isSample: false,
  },
  {
    id: "proj-new",
    name: "Acme Labs",
    websiteUrl: "https://labs.acme.com",
    isSample: false,
  },
];
const chain = {
  from: () => chain,
  leftJoin: () => chain,
  where: () => chain,
  orderBy: () => Promise.resolve(projectRows),
};
mock.module("@notra/db/drizzle", () => ({ db: { select: () => chain } }));

const requests: Record<string, Record<string, unknown>> = {};
const record =
  (name: string, data: unknown[]) => (params: Record<string, unknown>) => {
    requests[name] = params;
    return Promise.resolve({ data });
  };
mock.module("@notra/analytics/tinybird/client", () => ({
  isTinybirdConfigured: () => true,
  queryWebOverview: record("overview", [
    { views: 120, previous_views: 80, visitors: 40, previous_visitors: 30 },
  ]),
  queryWebTimeseries: record("timeseries", [
    { day: "2026-11-02", views: 10, visitors: 4 },
  ]),
  queryWebPages: record("pages", []),
  queryWebSources: record("sources", []),
  queryWebAudience: record("audience", [
    { value: "DE", visitors: 20, previous_visitors: 12, views: 60 },
    { value: "", visitors: 2, previous_visitors: 0, views: 3 },
  ]),
}));

const { resolveAnalyticsRange, normalizeHostFilter } =
  await import("@notra/tools/utils/analytics");
const { getWebAnalyticsInputSchema } =
  await import("@notra/tools/schemas/analytics-tools");
const { createGetWebAnalyticsTool } =
  await import("@notra/tools/analytics/get-web-analytics");

const ctx = {
  session: {
    auth: {
      current: { attributes: { organizationId: "org-1" } },
      initiator: null,
    },
  },
};

describe("analytics ranges", () => {
  const now = new Date("2026-11-02T15:00:00.000Z");

  test("days covers exactly that many days ending today in UTC", () => {
    expect(resolveAnalyticsRange({ days: 7 }, now)).toEqual({
      from: "2026-10-27",
      to: "2026-11-02",
      days: 7,
      timezone: "UTC",
    });
  });

  test("explicit ranges are inclusive and validated", () => {
    expect(
      resolveAnalyticsRange(
        { days: 30, from: "2026-10-01", to: "2026-10-31" },
        now
      )
    ).toMatchObject({ from: "2026-10-01", to: "2026-10-31", days: 31 });
    expect(resolveAnalyticsRange({ days: 30, from: "2026-02-30" }, now)).toBe(
      "Invalid date. Use a real calendar day in YYYY-MM-DD format."
    );
    expect(
      resolveAnalyticsRange({ days: 30, from: "2026-11-02", to: "2026-11-01" })
    ).toBe("from must be on or before to.");
  });

  test("host filters are reduced to a bare domain", () => {
    expect(normalizeHostFilter("https://www.Acme.com/pricing")).toBe(
      "acme.com"
    );
    expect(normalizeHostFilter(undefined)).toBe("");
  });
});

describe("get_web_analytics", () => {
  const tool = createGetWebAnalyticsTool() as unknown as {
    execute: (input: unknown, context: unknown) => Promise<unknown>;
  };

  test("returns a country breakdown for the default project", async () => {
    const result = (await tool.execute(
      getWebAnalyticsInputSchema.parse({ days: 7 }),
      ctx
    )) as Record<string, unknown>;

    expect(requests.audience).toMatchObject({
      organization_id: "org-1",
      project_id: "proj-old",
      include_unassigned: 1,
      dimension: "country",
      days: 7,
    });
    expect(result.scope).toEqual({
      project: {
        id: "proj-old",
        name: "Acme",
        isDefault: true,
        otherProjects: 1,
      },
    });
    expect(result.breakdown).toEqual({
      dimension: "country",
      rows: [
        { value: "DE", visitors: 20, previous_visitors: 12, views: 60 },
        { value: "Unknown", visitors: 2, previous_visitors: 0, views: 3 },
      ],
    });
    expect(result.totals).toMatchObject({ views: 120, previous_views: 80 });
  });

  test("scopes non-default projects without unassigned rows", async () => {
    await tool.execute(
      getWebAnalyticsInputSchema.parse({
        projectId: "proj-new",
        dimension: "device",
        from: "2026-10-01",
        to: "2026-10-07",
      }),
      ctx
    );
    expect(requests.audience).toMatchObject({
      project_id: "proj-new",
      include_unassigned: 0,
      dimension: "device",
      date_from: "2026-10-01",
      date_to: "2026-10-07",
    });
  });

  test("rejects projects outside the organization", async () => {
    expect(
      await tool.execute(
        getWebAnalyticsInputSchema.parse({ projectId: "proj-other" }),
        ctx
      )
    ).toBe(
      "Project not found in this organization. Call list_geo_projects for valid project IDs."
    );
  });
});
