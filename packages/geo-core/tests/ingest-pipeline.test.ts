import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { WebPageViewRow } from "@notra/analytics/types/tinybird-datasources";
import type { GeoIngestIdentity } from "@notra/geo-core/types/geo";
import type { Ratelimit } from "@upstash/ratelimit";
import { Effect } from "effect";

const STORED = { successful_rows: 1, quarantined_rows: 0 };
const ingestGeoTrafficEvents = mock(
  async (): Promise<typeof STORED | null> => STORED
);
const getGeoIngestTokenGeneration = mock(async (): Promise<number | null> => 1);
const loadIngestAllowedHosts = mock(
  async (_identity?: GeoIngestIdentity): Promise<string[] | null> => [
    "example.com",
  ]
);
const ratelimitLimit = mock(
  async (): Promise<
    Pick<Awaited<ReturnType<Ratelimit["limit"]>>, "success" | "reason">
  > => ({
    success: true,
  })
);
const trackGeoIngestAnalytics = mock(() => Effect.void);
const verifyGeoIngestToken = mock((): GeoIngestIdentity => ({
  organizationId: "org_1",
  projectId: "proj_1",
  generation: 1,
}));
const verifyGeoIngestSiteToken = mock((token: string): string | null =>
  token === "nst.site_1.good" ? "site_1" : null
);
const SITE = {
  id: "site_1",
  organizationId: "org_2",
  projectId: "proj_2",
  hosts: ["acme.com"],
  mounts: ["/"],
};
const loadSite = async (siteId: string) => (siteId === SITE.id ? SITE : null);
const loadIngestSite = mock(loadSite);
const loadOrganizationSitePrefixes = mock(
  async (): Promise<{ host: string; mounts: string[] }[] | null> => []
);
const resolveJourneyId = mock(() => ({ journeyId: "journey_1", path: "/" }));
const ingestWebPageViews = mock(async (_rows: WebPageViewRow[]) => ({
  successful_rows: 1,
  quarantined_rows: 0,
}));
const webRatelimitLimit = mock(async () => ({ success: true }));
const hasAiTrafficEventsQuota = mock(() => Effect.succeed(true));
const trackAiTrafficEvent = mock(async (_organizationId: string) => {});
const ingestWebPageEngagement = mock(async (_rows: unknown[]) => ({
  successful_rows: 1,
  quarantined_rows: 0,
}));

const SITE_TOKEN = "nst.site_1.good";
const HUMAN_USER_AGENT = "Mozilla/5.0 Chrome/130.0 Safari/537.36";
const SITE_PAGE = {
  method: "GET",
  url: "https://acme.com/blog/a",
  userAgent: HUMAN_USER_AGENT,
};

mock.module("@notra/analytics/tinybird/client", () => ({
  ingestGeoTrafficEvents,
  ingestMcpEvents: ingestGeoTrafficEvents,
  ingestWebPageEngagement,
  ingestWebPageViews,
}));
mock.module("@notra/geo-core/geo/ingest", () => ({
  verifyGeoIngestToken,
  verifyGeoIngestSiteToken,
  isGeoIngestSiteToken: (token: string) => token.startsWith("nst."),
  getGeoIngestTokenGeneration,
  geoIngestHostsCacheKey: () => "hosts:key",
  getGeoIngestSecret: () => "test-secret",
}));
mock.module("@notra/ai/billing/ai-traffic-events", () => ({
  hasAiTrafficEventsQuota,
  trackAiTrafficEvent,
}));
mock.module("../src/ingest/hosts", () => ({
  loadIngestAllowedHosts,
}));
mock.module("../src/ingest/sites", () => ({
  loadIngestSite,
  loadOrganizationSitePrefixes,
}));
mock.module("../src/ingest/analytics", () => ({
  trackGeoIngestAnalytics,
}));
mock.module("../src/ingest/journey", () => ({
  resolveJourneyId,
}));
mock.module("../src/ingest/ratelimit", () => ({
  geoIngestRatelimit: { limit: ratelimitLimit },
  webIngestRatelimit: { limit: webRatelimitLimit },
  geoIngestAdmissionRatelimit: { limit: async () => ({ success: true }) },
}));

const { runGeoIngest } = await import("../src/ingest/pipeline");
const {
  GeoIngestInvalidTokenError,
  GeoIngestFailedError,
  GeoIngestRateLimitedError,
} = await import("../src/ingest/errors");

function ingestRequest(
  body: unknown = {
    method: "GET",
    url: "https://example.com/",
    userAgent: "GPTBot",
  },
  token = "token_1"
) {
  return {
    headers: new Headers({ authorization: `Bearer ${token}` }),
    json: async () => body,
  } as never;
}

async function run(request: unknown) {
  return Effect.runPromise(
    Effect.result(runGeoIngest(request as never, () => {})) as never
  ) as Promise<
    | { _tag: "Success"; success: unknown }
    | { _tag: "Failure"; failure: unknown }
  >;
}

describe("runGeoIngest ordering", () => {
  beforeEach(() => {
    for (const m of [
      ingestGeoTrafficEvents,
      getGeoIngestTokenGeneration,
      loadIngestAllowedHosts,
      ratelimitLimit,
      trackGeoIngestAnalytics,
      ingestWebPageViews,
      ingestWebPageEngagement,
      webRatelimitLimit,
      verifyGeoIngestToken,
      resolveJourneyId,
      hasAiTrafficEventsQuota,
      trackAiTrafficEvent,
    ]) {
      m.mockClear();
    }
    hasAiTrafficEventsQuota.mockImplementation(() => Effect.succeed(true));
    webRatelimitLimit.mockImplementation(async () => ({ success: true }));
    verifyGeoIngestToken.mockImplementation(() => ({
      organizationId: "org_1",
      projectId: "proj_1",
      generation: 1,
    }));
    getGeoIngestTokenGeneration.mockImplementation(async () => 1);
    loadIngestAllowedHosts.mockImplementation(
      async (identity?: GeoIngestIdentity) =>
        identity?.site ? identity.site.hosts : ["example.com"]
    );
    ratelimitLimit.mockImplementation(async () => ({ success: true }));
    ingestGeoTrafficEvents.mockImplementation(async () => STORED);
    loadOrganizationSitePrefixes.mockImplementation(async () => []);
    loadIngestSite.mockImplementation(loadSite);
  });

  test.each([
    [
      "Tinybird is not configured",
      () => ingestGeoTrafficEvents.mockImplementation(async () => null),
      GeoIngestFailedError,
      true,
    ],
    [
      "a row is quarantined",
      () =>
        ingestGeoTrafficEvents.mockImplementation(async () => ({
          successful_rows: 0,
          quarantined_rows: 1,
        })),
      GeoIngestFailedError,
      true,
    ],
    [
      "the rate-limit transport fails",
      () =>
        ratelimitLimit.mockImplementation(async () => {
          throw new Error("Redis unavailable");
        }),
      GeoIngestFailedError,
      false,
    ],
    [
      "Upstash times out even with success true",
      () =>
        ratelimitLimit.mockImplementation(async () => ({
          success: true,
          reason: "timeout",
        })),
      GeoIngestFailedError,
      false,
    ],
    [
      "the rate limit is hit",
      () => ratelimitLimit.mockImplementation(async () => ({ success: false })),
      GeoIngestRateLimitedError,
      false,
    ],
    [
      "the token was revoked",
      () => getGeoIngestTokenGeneration.mockImplementation(async () => 2),
      GeoIngestInvalidTokenError,
      false,
    ],
    [
      "a legacy organization token cannot load its hosts",
      () => {
        verifyGeoIngestToken.mockImplementation(() => ({
          organizationId: "org_1",
          projectId: null,
          generation: 1,
        }));
        loadIngestAllowedHosts.mockImplementation(async () => null);
      },
      GeoIngestFailedError,
      false,
    ],
  ] as const)(
    "tracked traffic fails instead of acknowledging when %s",
    async (_case, arrange, error, writes) => {
      arrange();
      const outcome = await run(ingestRequest());
      expect(outcome._tag === "Failure" && outcome.failure).toBeInstanceOf(
        error
      );
      expect(ingestGeoTrafficEvents.mock.calls.length > 0).toBe(writes);
    }
  );

  test.each([{ method: "GET" }, { method: "GET", url: ":::" }])(
    "a revoked token stays 401 for the malformed payload %j",
    async (body) => {
      getGeoIngestTokenGeneration.mockImplementation(async () => null);
      const outcome = await run(ingestRequest(body));
      expect(outcome._tag === "Failure" && outcome.failure).toBeInstanceOf(
        GeoIngestInvalidTokenError
      );
      expect(ingestGeoTrafficEvents).not.toHaveBeenCalled();
    }
  );

  test("drops tracked events for hosts outside the allowed list", async () => {
    loadIngestAllowedHosts.mockImplementation(async () => ["other.example"]);

    const outcome = await run(ingestRequest());

    expect(outcome._tag).toBe("Success");
    expect(ingestGeoTrafficEvents).not.toHaveBeenCalled();
  });

  test("drops tracked events once the AI traffic events quota is used up", async () => {
    hasAiTrafficEventsQuota.mockImplementation(() => Effect.succeed(false));

    const outcome = await run(ingestRequest());

    expect(outcome).toMatchObject({
      _tag: "Success",
      success: { outcome: "dropped", reason: "quota" },
    });
    expect(hasAiTrafficEventsQuota).toHaveBeenCalledWith("org_1");
    expect(ingestGeoTrafficEvents).not.toHaveBeenCalled();
  });

  test("legacy organization tokens do not ingest a sibling project's host", async () => {
    verifyGeoIngestToken.mockImplementation(() => ({
      organizationId: "org_1",
      projectId: null,
      generation: 1,
    }));
    loadIngestAllowedHosts.mockImplementation(async () => ["oldest.example"]);

    const outcome = await run(ingestRequest());

    expect(outcome._tag).toBe("Success");
    expect(loadIngestAllowedHosts).toHaveBeenCalledWith({
      organizationId: "org_1",
      projectId: null,
      generation: 1,
    });
    expect(ingestGeoTrafficEvents).not.toHaveBeenCalled();
  });

  test("a site token ingests under the site's project and only for its host", async () => {
    const page = {
      method: "GET",
      url: "https://acme.com/blog/a",
      userAgent: "GPTBot",
    };
    const outcome = await run(ingestRequest(page, "nst.site_1.good"));
    expect(outcome).toMatchObject({
      _tag: "Success",
      success: {
        outcome: "ingested",
        organizationId: "org_2",
        projectId: "proj_2",
      },
    });
    expect(verifyGeoIngestToken).not.toHaveBeenCalled();
    expect(ingestGeoTrafficEvents).toHaveBeenCalledWith([
      expect.objectContaining({ site_id: "site_1", project_id: "proj_2" }),
    ]);

    const elsewhere = await run(
      ingestRequest({ ...page, url: "https://example.com/" }, "nst.site_1.good")
    );
    expect(elsewhere).toMatchObject({
      _tag: "Success",
      success: { outcome: "dropped", reason: "host" },
    });
  });

  test("a site token cannot ingest outside its published mounts", async () => {
    loadIngestSite.mockImplementation(async () => ({
      ...SITE,
      mounts: ["/blog"],
    }));
    loadIngestAllowedHosts.mockImplementation(async () => ["acme.com"]);
    const outcome = await run(
      ingestRequest(
        {
          method: "GET",
          url: "https://acme.com/blogroll/a",
          userAgent: "GPTBot",
        },
        "nst.site_1.good"
      )
    );
    expect(outcome).toMatchObject({
      _tag: "Success",
      success: { outcome: "dropped", reason: "host" },
    });
    expect(ingestGeoTrafficEvents).not.toHaveBeenCalled();
  });

  test("a site counts its human visitors in web_page_views only", async () => {
    const outcome = await run(
      ingestRequest(
        {
          method: "GET",
          url: "https://acme.com/blog/a",
          userAgent:
            "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
          referer: "https://www.google.com/",
        },
        "nst.site_1.good"
      )
    );
    expect(outcome).toMatchObject({
      _tag: "Success",
      success: { outcome: "ingested", visitorType: "human" },
    });
    expect(ingestGeoTrafficEvents).not.toHaveBeenCalled();
    expect(ingestWebPageViews).toHaveBeenCalledTimes(1);
    const [rows] = ingestWebPageViews.mock.calls[0] as unknown as [
      Record<string, unknown>[],
    ];
    expect(rows[0]).toMatchObject({
      site_id: "site_1",
      host: "acme.com",
      path: "/blog/a",
      referrer_group: "search",
      referrer_source: "google",
      browser: "Chrome",
    });
  });

  test("a site visitor counts only with measurement consent, AI crawlers always", async () => {
    const declined = { ...SITE_PAGE, visitorConsent: false };
    expect(await run(ingestRequest(declined, SITE_TOKEN))).toMatchObject({
      _tag: "Success",
      success: { outcome: "dropped", reason: "visitor_type" },
    });
    expect(
      await run(
        ingestRequest(
          { ...declined, referer: "https://chatgpt.com/" },
          SITE_TOKEN
        )
      )
    ).toMatchObject({
      _tag: "Success",
      success: { outcome: "dropped", reason: "consent" },
    });
    expect(ingestWebPageViews).not.toHaveBeenCalled();
    expect(ingestGeoTrafficEvents).not.toHaveBeenCalled();

    expect(
      await run(ingestRequest({ ...declined, userAgent: "GPTBot" }, SITE_TOKEN))
    ).toMatchObject({
      _tag: "Success",
      success: { outcome: "ingested", visitorType: "crawler" },
    });
    expect(ingestWebPageViews).not.toHaveBeenCalled();

    const consentedBeacon = {
      ...SITE_PAGE,
      accept: "*/*",
      referer: "https://www.google.com/",
      signals: {
        clientHints: true,
        fetchMode: "no-cors",
        tracing: false,
        prefetch: false,
      },
      visitorConsent: true,
    };
    expect(await run(ingestRequest(consentedBeacon, SITE_TOKEN))).toMatchObject(
      {
        _tag: "Success",
        success: { outcome: "ingested", visitorType: "human" },
      }
    );
    const [rows] = ingestWebPageViews.mock.calls[0] as unknown as [
      Record<string, unknown>[],
    ];
    expect(rows[0]).toMatchObject({
      path: "/blog/a",
      referrer_group: "search",
      referrer_source: "google",
    });
  });

  test("the SDK never counts people, only AI traffic", async () => {
    const outcome = await run(
      ingestRequest({
        method: "GET",
        url: "https://example.com/pricing",
        userAgent: HUMAN_USER_AGENT,
      })
    );
    expect(outcome).toMatchObject({
      _tag: "Success",
      success: { outcome: "dropped", reason: "visitor_type" },
    });
    expect(ingestWebPageViews).not.toHaveBeenCalled();
    expect(getGeoIngestTokenGeneration).not.toHaveBeenCalled();
  });

  test("site visitor counting still rejects revoked tokens and ignores wrong hosts", async () => {
    getGeoIngestTokenGeneration.mockImplementation(async () => null);
    const revoked = await run(ingestRequest(SITE_PAGE, SITE_TOKEN));
    expect(revoked._tag === "Failure" && revoked.failure).toBeInstanceOf(
      GeoIngestInvalidTokenError
    );
    expect(ingestWebPageViews).not.toHaveBeenCalled();
    getGeoIngestTokenGeneration.mockImplementation(async () => 1);
    expect(
      await run(
        ingestRequest({ ...SITE_PAGE, url: "https://example.com/" }, SITE_TOKEN)
      )
    ).toMatchObject({
      _tag: "Success",
      success: { outcome: "dropped", reason: "host" },
    });
    expect(ingestWebPageViews).not.toHaveBeenCalled();
  });

  test.each([
    { userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1)" },
    {
      signals: {
        clientHints: true,
        fetchMode: "navigate",
        tracing: false,
        prefetch: true,
      },
    },
    { url: "https://acme.com/llms.txt" },
    { method: "POST" },
    { status: 302 },
  ])("site visitor counting filters non-page traffic %j", async (override) => {
    expect(
      await run(ingestRequest({ ...SITE_PAGE, ...override }, SITE_TOKEN))
    ).toMatchObject({
      _tag: "Success",
      success: { outcome: "dropped", reason: "visitor_type" },
    });
    expect(ingestWebPageViews).not.toHaveBeenCalled();
    expect(getGeoIngestTokenGeneration).not.toHaveBeenCalled();
    expect(loadIngestAllowedHosts).not.toHaveBeenCalled();
  });

  test("site visitor counting retains the independent web admission limit", async () => {
    webRatelimitLimit.mockImplementation(async () => ({ success: false }));
    expect(await run(ingestRequest(SITE_PAGE, SITE_TOKEN))).toMatchObject({
      _tag: "Success",
      success: { outcome: "dropped", reason: "web_rate_limited" },
    });
    expect(ingestWebPageViews).not.toHaveBeenCalled();
    expect(getGeoIngestTokenGeneration).not.toHaveBeenCalled();
    expect(ratelimitLimit).not.toHaveBeenCalled();
  });

  test("a site reports visible time per view, capped and scoped to its pages", async () => {
    const engagement = {
      type: "engagement",
      url: "https://acme.com/blog/a",
      viewId: "a1b2c3d4e5f6a7b8c9d0e1f2",
      visibleMs: 5 * 60 * 60 * 1000,
      scrollDepth: 80,
    };
    expect(await run(ingestRequest(engagement, SITE_TOKEN))).toMatchObject({
      _tag: "Success",
      success: { outcome: "ingested", visitorType: "human" },
    });
    expect(ingestWebPageEngagement.mock.calls[0]?.[0]).toMatchObject([
      {
        organization_id: "org_2",
        project_id: "proj_2",
        site_id: "site_1",
        host: "acme.com",
        path: "/blog/a",
        view_id: "a1b2c3d4e5f6a7b8c9d0e1f2",
        visible_ms: 30 * 60 * 1000,
        scroll_depth: 80,
      },
    ]);
    ingestWebPageEngagement.mockClear();

    expect(
      await run(
        ingestRequest(
          { ...engagement, url: "https://example.com/blog/a" },
          SITE_TOKEN
        )
      )
    ).toMatchObject({
      _tag: "Success",
      success: { outcome: "dropped", reason: "host" },
    });
    expect(await run(ingestRequest(engagement))).toMatchObject({
      _tag: "Success",
      success: { outcome: "dropped", reason: "not_site" },
    });
    const malformed = await run(
      ingestRequest({ ...engagement, viewId: "x" }, SITE_TOKEN)
    );
    expect(malformed._tag).toBe("Failure");
    expect(ingestWebPageEngagement).not.toHaveBeenCalled();
  });

  test("a forged or orphaned site token is a 401", async () => {
    const forged = await run(ingestRequest(undefined, "nst.site_1.bad"));
    expect(forged._tag === "Failure" && forged.failure).toBeInstanceOf(
      GeoIngestInvalidTokenError
    );
    verifyGeoIngestSiteToken.mockImplementationOnce(() => "site_gone");
    const orphaned = await run(ingestRequest(undefined, "nst.site_gone.sig"));
    expect(orphaned._tag === "Failure" && orphaned.failure).toBeInstanceOf(
      GeoIngestInvalidTokenError
    );
  });

  test("the SDK does not count a page a Notra Site already reports", async () => {
    loadOrganizationSitePrefixes.mockImplementation(async () => [
      { host: "example.com", mounts: ["/blog"] },
    ]);
    const proxied = await run(
      ingestRequest({
        method: "GET",
        url: "https://example.com/blog/a",
        userAgent: "GPTBot",
      })
    );
    expect(proxied).toMatchObject({
      _tag: "Success",
      success: { outcome: "dropped", reason: "site" },
    });
    const outside = await run(
      ingestRequest({
        method: "GET",
        url: "https://example.com/blogroll",
        userAgent: "GPTBot",
      })
    );
    expect(outside).toMatchObject({
      _tag: "Success",
      success: { outcome: "ingested" },
    });
  });
});
