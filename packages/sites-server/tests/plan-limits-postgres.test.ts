import { afterAll, afterEach, beforeEach, expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { seedSiteProject } from "./utils/site-project";

const databaseUrl = process.env.SITES_TEST_DATABASE_URL;

if (!databaseUrl) {
  test.skip("Sites plan limits require SITES_TEST_DATABASE_URL", () => {});
} else if (process.env.NOTRA_SITES_PLAN_LIMITS_WORKER !== "1") {
  test("Sites Free plan limits with real PostgreSQL", () => {
    const url = new URL(databaseUrl);
    expect(url.hostname).toBe("127.0.0.1");
    url.searchParams.set(
      "options",
      "-c statement_timeout=3000 -c lock_timeout=1500"
    );
    const result = spawnSync(
      process.execPath,
      ["--no-env-file", "test", fileURLToPath(import.meta.url)],
      {
        env: {
          ...process.env,
          DATABASE_URL: url.toString(),
          NOTRA_SITES_PLAN_LIMITS_WORKER: "1",
          UPSTASH_REDIS_REST_URL: "",
          UPSTASH_REDIS_REST_TOKEN: "",
        },
        encoding: "utf8",
        timeout: 30_000,
      }
    );
    expect(result.status, result.stdout + result.stderr).toBe(0);
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
  });
} else {
  const plans = new Map<string, "free" | "paid">();
  let planLookupFails = false;
  mock.module("@notra/ai/billing/autumn", () => ({
    autumn: {},
    AUTUMN_READ_TIMEOUT_MS: 5000,
    allowUnmeteredAiInDevelopment: false,
  }));
  mock.module("@notra/ai/billing/plan", () => ({
    resolveOrganizationPlan: async (organizationId: string) => {
      if (planLookupFails) {
        throw new Error("Synthetic Autumn outage");
      }
      return plans.get(organizationId) ?? "free";
    },
  }));
  const cloudflare = await import("../src/cloudflare-saas");
  mock.module("../src/cloudflare-saas", () => ({
    ...cloudflare,
    cloudflareSaasConfig: () => null,
  }));
  mock.module("@notra/geo-core/ingest/sites", () => ({
    invalidateIngestSiteCaches: async () => {},
  }));

  const { db } = await import("@notra/db/drizzle");
  const { organizations, siteDeployments, siteDomains, sites } =
    await import("@notra/db/schema");
  const { eq, inArray } = await import("drizzle-orm");
  const { addSiteDomain } = await import("../src/domains");
  const { updateSiteSettings } = await import("../src/sites");
  const { enqueueSiteDeployment } = await import("../src/deployments");
  const { SiteInputError, SitePlanLimitError } =
    await import("../src/errors/sites");
  const { SITE_PLAN_LIMIT_MESSAGES, SITE_PLAN_UNAVAILABLE_MESSAGE } =
    await import("../src/constants/plan-limits");
  const { assertSitePlanAllows, enforceSitePlanBranding, getSitePlanUsage } =
    await import("../src/plan-limits");

  let organizationIds: string[] = [];

  const seedOrganization = async (plan: "free" | "paid", siteCount = 1) => {
    const organizationId = crypto.randomUUID();
    organizationIds.push(organizationId);
    plans.set(organizationId, plan);
    await db.insert(organizations).values({
      id: organizationId,
      name: "Synthetic plan workspace",
      slug: organizationId,
      createdAt: new Date(),
    });
    const projectId = await seedSiteProject(organizationId);
    if (siteCount === 0) {
      return { organizationId, sites: [] };
    }
    const seeded = await db
      .insert(sites)
      .values(
        Array.from({ length: siteCount }, () => {
          const id = crypto.randomUUID();
          return {
            id,
            organizationId,
            projectId,
            name: "Synthetic plan site",
            slug: id,
            publicOrigin: `https://${id}.notra.site`,
            mounts: { blog: "/blog" },
            productionBranch: "main",
            showBranding: false,
          };
        })
      )
      .returning();
    return { organizationId, sites: seeded };
  };

  const domainsOf = async (organizationId: string) => {
    return await db
      .select({ hostname: siteDomains.hostname })
      .from(siteDomains)
      .where(eq(siteDomains.organizationId, organizationId));
  };

  const storedBranding = async (siteId: string) => {
    const [stored] = await db
      .select({ showBranding: sites.showBranding })
      .from(sites)
      .where(eq(sites.id, siteId));
    return stored?.showBranding;
  };

  const hostname = () => `${crypto.randomUUID()}.example.test`;

  beforeEach(() => {
    process.env.SITES_HOSTING_DOMAIN = "notra.site";
    process.env.SITES_PREVIEW_SECRET = "synthetic-plan-limits-secret";
    planLookupFails = false;
    organizationIds = [];
  });
  afterEach(async () => {
    await db
      .delete(organizations)
      .where(inArray(organizations.id, organizationIds));
  });
  afterAll(async () => {
    await Reflect.get(db, "$client").end();
  });

  test("a Free workspace gets one custom domain across all of its sites", async () => {
    const { organizationId, sites: owned } = await seedOrganization("free", 2);
    const [first, second] = owned;
    if (!(first && second)) {
      throw new Error("Expected two synthetic sites");
    }
    await addSiteDomain(first, { kind: "subdomain", value: hostname() });
    const rejected = await addSiteDomain(second, {
      kind: "subdomain",
      value: hostname(),
    }).catch((error: unknown) => error);
    expect(rejected).toBeInstanceOf(SitePlanLimitError);
    expect(rejected).toMatchObject({
      limit: "domains",
      message: SITE_PLAN_LIMIT_MESSAGES.domains,
    });
    expect(await domainsOf(organizationId)).toHaveLength(1);
  });

  test("concurrent domain additions in a Free workspace admit exactly one", async () => {
    const { organizationId, sites: owned } = await seedOrganization("free", 2);
    const results = await Promise.allSettled(
      owned.map((site) =>
        addSiteDomain(site, { kind: "subdomain", value: hostname() })
      )
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const [failure] = results.filter((r) => r.status === "rejected");
    expect(failure?.reason).toBeInstanceOf(SitePlanLimitError);
    expect(await domainsOf(organizationId)).toHaveLength(1);
  });

  test("a Free workspace already over the limit keeps its domains but can't add more", async () => {
    const { organizationId, sites: owned } = await seedOrganization("free", 2);
    const existing = owned.map((site) => ({
      id: crypto.randomUUID(),
      siteId: site.id,
      organizationId,
      hostname: hostname(),
      kind: "subdomain" as const,
      status: "active" as const,
    }));
    await db.insert(siteDomains).values(existing);
    const [first] = owned;
    if (!first) {
      throw new Error("Expected a synthetic site");
    }
    await expect(
      addSiteDomain(first, { kind: "proxy", value: hostname() })
    ).rejects.toBeInstanceOf(SitePlanLimitError);
    expect((await domainsOf(organizationId)).map((d) => d.hostname)).toEqual(
      expect.arrayContaining(existing.map((d) => d.hostname))
    );
    expect(await getSitePlanUsage(organizationId)).toEqual({
      plan: "free",
      sites: { used: 2, limit: 1 },
      domains: { used: 2, limit: 1 },
      brandingRequired: true,
    });
  });

  test("a paid workspace keeps adding domains past the Free limit", async () => {
    const { organizationId, sites: owned } = await seedOrganization("paid", 2);
    for (const site of owned) {
      await addSiteDomain(site, { kind: "subdomain", value: hostname() });
      await addSiteDomain(site, { kind: "proxy", value: hostname() });
    }
    expect(await domainsOf(organizationId)).toHaveLength(4);
    expect(await getSitePlanUsage(organizationId)).toEqual({
      plan: "paid",
      sites: { used: 2, limit: null },
      domains: { used: 4, limit: null },
      brandingRequired: false,
    });
  });

  test("the site cap admits a Free workspace's first site only", async () => {
    const empty = await seedOrganization("free", 0);
    await db.transaction((tx) =>
      assertSitePlanAllows(tx, empty.organizationId, "free", "sites")
    );
    const { organizationId } = await seedOrganization("free", 1);
    const rejected = await db
      .transaction((tx) =>
        assertSitePlanAllows(tx, organizationId, "free", "sites")
      )
      .catch((error: unknown) => error);
    expect(rejected).toBeInstanceOf(SitePlanLimitError);
    expect(rejected).toMatchObject({
      limit: "sites",
      message: SITE_PLAN_LIMIT_MESSAGES.sites,
    });
    await db.transaction((tx) =>
      assertSitePlanAllows(tx, organizationId, "paid", "sites")
    );
  });

  test("a failed plan lookup rejects the addition instead of skipping the cap", async () => {
    const { organizationId, sites: owned } = await seedOrganization("free");
    const [site] = owned;
    if (!site) {
      throw new Error("Expected a synthetic site");
    }
    planLookupFails = true;
    const rejected = await addSiteDomain(site, {
      kind: "subdomain",
      value: hostname(),
    }).catch((error: unknown) => error);
    expect(rejected).toBeInstanceOf(SiteInputError);
    expect(rejected).toMatchObject({ message: SITE_PLAN_UNAVAILABLE_MESSAGE });
    expect(await domainsOf(organizationId)).toHaveLength(0);
  });

  test("a Free workspace can't turn the badge off, a paid one can", async () => {
    const [freeSite] = (await seedOrganization("free")).sites;
    const [paidSite] = (await seedOrganization("paid")).sites;
    if (!(freeSite && paidSite)) {
      throw new Error("Expected synthetic sites");
    }
    const rejected = await updateSiteSettings(
      freeSite,
      { showBranding: false },
      null
    ).catch((error: unknown) => error);
    expect(rejected).toMatchObject({
      limit: "branding",
      message: SITE_PLAN_LIMIT_MESSAGES.branding,
    });
    const turnedOn = await updateSiteSettings(
      freeSite,
      { showBranding: true },
      null
    );
    expect(turnedOn.site.showBranding).toBe(true);
    const turnedOff = await updateSiteSettings(
      paidSite,
      { showBranding: false },
      null
    );
    expect(turnedOff.site.showBranding).toBe(false);
  });

  test("a Free site builds with the badge whatever its stored setting", async () => {
    const [freeSite] = (await seedOrganization("free")).sites;
    const [paidSite] = (await seedOrganization("paid")).sites;
    if (!(freeSite && paidSite)) {
      throw new Error("Expected synthetic sites");
    }
    for (const site of [freeSite, paidSite]) {
      await enqueueSiteDeployment({
        siteId: site.id,
        kind: "production",
        previewKey: null,
        trigger: "manual",
        branch: "main",
        commitSha: "a".repeat(40),
      });
    }
    const deployments = await db
      .select({
        siteId: siteDeployments.siteId,
        target: siteDeployments.target,
      })
      .from(siteDeployments)
      .where(inArray(siteDeployments.siteId, [freeSite.id, paidSite.id]));
    expect(
      Object.fromEntries(deployments.map((d) => [d.siteId, d.target.branding]))
    ).toEqual({ [freeSite.id]: true, [paidSite.id]: false });
    expect(await storedBranding(freeSite.id)).toBe(true);
    expect(await storedBranding(paidSite.id)).toBe(false);
  });

  test("a failed plan lookup keeps the stored badge setting rather than blocking builds", async () => {
    const [site] = (await seedOrganization("free")).sites;
    if (!site) {
      throw new Error("Expected a synthetic site");
    }
    planLookupFails = true;
    await enforceSitePlanBranding(site.id);
    expect(await storedBranding(site.id)).toBe(false);
  });
}
