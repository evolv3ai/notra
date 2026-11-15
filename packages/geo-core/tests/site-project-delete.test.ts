import { afterAll, expect, mock, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { Effect } from "effect";

const databaseUrl = process.env.SITES_TEST_DATABASE_URL;
if (!databaseUrl) {
  test.skip("Project deletion with Sites requires synthetic PostgreSQL", () => {});
} else if (process.env.NOTRA_SITE_PROJECT_DELETE_TEST_WORKER !== "1") {
  test("project deletion blocks hosted Sites without orphaning them", () => {
    const url = new URL(databaseUrl);
    expect(url.hostname).toBe("127.0.0.1");
    expect(url.pathname).toBe("/notra_server_audit");
    const result = spawnSync(
      process.execPath,
      ["--no-env-file", "test", fileURLToPath(import.meta.url)],
      {
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
          NOTRA_SITE_PROJECT_DELETE_TEST_WORKER: "1",
          UPSTASH_REDIS_REST_URL: "",
          UPSTASH_REDIS_REST_TOKEN: "",
        },
        timeout: 30_000,
      }
    );
    expect(result.status, result.stderr?.toString()).toBe(0);
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
  });
} else {
  const { db } = await import("@notra/db/drizzle");
  const { brandSettings, organizations, projects, siteDeployments, sites } =
    await import("@notra/db/schema");
  const { eq } = await import("drizzle-orm");
  const deletedKeys: string[] = [];
  mock.module("@notra/ai/utils/redis", () => ({
    redis: {
      get: async () => null,
      set: async () => {},
      del: async (...keys: string[]) => {
        deletedKeys.push(...keys);
      },
    },
  }));
  const { deleteGeoProject } = await import("../src/geo/projects");
  afterAll(async () => {
    await Reflect.get(db, "$client").end();
  });

  test("attached Sites block deletion; other project's Sites and last-project policy are preserved", async () => {
    const organizationId = `project-site-${crypto.randomUUID()}`;
    const brandId = `${organizationId}-brand`;
    const owningProjectId = `${organizationId}-owning`;
    const emptyProjectId = `${organizationId}-empty`;
    const siteId = `${organizationId}-site`;
    try {
      await db.insert(organizations).values({
        id: organizationId,
        name: "Synthetic",
        slug: organizationId,
        createdAt: new Date(),
      });
      await db.insert(brandSettings).values({
        id: brandId,
        organizationId,
        websiteUrl: "https://example.test",
      });
      await db.insert(projects).values(
        [owningProjectId, emptyProjectId].map((id) => ({
          id,
          organizationId,
          name: id,
          brandSettingsId: brandId,
        }))
      );
      await db.insert(sites).values({
        id: siteId,
        organizationId,
        projectId: owningProjectId,
        name: "Synthetic",
        slug: crypto.randomUUID().slice(0, 8),
        publicOrigin: "https://example.test",
        mounts: { blog: "/blog" },
      });
      await db.insert(siteDeployments).values({
        id: `${siteId}-live`,
        siteId,
        organizationId,
        kind: "production",
        trigger: "manual",
        status: "ready",
        generation: 1,
        branch: "main",
        commitSha: "a".repeat(40),
        configHash: "synthetic",
        target: {
          publicOrigin: "https://example.test",
          mounts: { blog: "/blog" },
          noindex: false,
          branding: true,
        },
      });
      await db
        .update(sites)
        .set({ activeProductionDeploymentId: `${siteId}-live` })
        .where(eq(sites.id, siteId));
      const before = await db.query.sites.findFirst({
        where: eq(sites.id, siteId),
      });
      const failure = await Effect.runPromise(
        deleteGeoProject(organizationId, owningProjectId).pipe(Effect.flip)
      );
      expect(failure).toMatchObject({
        _tag: "GeoProjectDeleteBlockedError",
        reason: "has_sites",
      });
      expect(
        await db.query.sites.findFirst({ where: eq(sites.id, siteId) })
      ).toEqual(before);
      expect(
        await db.query.projects.findFirst({
          where: eq(projects.id, owningProjectId),
        })
      ).toBeDefined();
      expect(
        await db.query.siteDeployments.findFirst({
          where: eq(siteDeployments.id, `${siteId}-live`),
        })
      ).toBeDefined();
      expect(deletedKeys).toEqual([]);
      expect(
        await Effect.runPromise(
          deleteGeoProject(organizationId, emptyProjectId)
        )
      ).toEqual({ id: emptyProjectId, success: true });
      expect(
        await db.query.projects.findFirst({
          where: eq(projects.id, emptyProjectId),
        })
      ).toBeUndefined();
      expect(
        await Effect.runPromise(
          deleteGeoProject(organizationId, owningProjectId).pipe(Effect.flip)
        )
      ).toMatchObject({ reason: "last_project" });
      await db.delete(sites).where(eq(sites.id, siteId));
      expect(
        await Effect.runPromise(
          deleteGeoProject(organizationId, owningProjectId).pipe(Effect.flip)
        )
      ).toMatchObject({ reason: "last_project" });
    } finally {
      await db
        .delete(organizations)
        .where(eq(organizations.id, organizationId));
    }
  });
}
