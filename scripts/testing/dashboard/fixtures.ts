import { DASHBOARD_SITE_FIXTURES } from "./constants/fixtures";
import { requireTestDatabaseUrl } from "./utils/database";

const started = performance.now();
const command = process.argv[2];
if (command !== "seed" && command !== "cleanup") {
  throw new Error(
    "Usage: bun --no-env-file scripts/testing/dashboard/fixtures.ts seed|cleanup"
  );
}
process.env.DATABASE_URL = requireTestDatabaseUrl();
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";
const { createDb } = await import("../../../packages/db/src/drizzle");
const { brandSettings, members, organizations, projects, sites, users } =
  await import("../../../packages/db/src/schema");
const { eq, inArray } = await import("drizzle-orm");
const db = createDb(process.env.DATABASE_URL, 1);

try {
  await db.transaction(async (tx) => {
    const organizationIds = DASHBOARD_SITE_FIXTURES.map(
      (f) => f.organizationId
    );
    await tx
      .delete(sites)
      .where(inArray(sites.organizationId, organizationIds));
    await tx
      .delete(organizations)
      .where(inArray(organizations.id, organizationIds));
    await tx.delete(users).where(
      inArray(
        users.id,
        DASHBOARD_SITE_FIXTURES.map((f) => f.userId)
      )
    );
    if (command === "cleanup") {
      return;
    }
    for (const fixture of DASHBOARD_SITE_FIXTURES) {
      await tx.insert(users).values({
        id: fixture.userId,
        email: fixture.email,
        name: fixture.name,
        emailVerified: true,
      });
      await tx.insert(organizations).values({
        id: fixture.organizationId,
        slug: fixture.slug,
        name: fixture.name,
        createdAt: new Date(),
        onboardingCompleted: true,
      });
      await tx.insert(members).values({
        id: `${fixture.organizationId}-member`,
        organizationId: fixture.organizationId,
        userId: fixture.userId,
        role: fixture.role,
        createdAt: new Date(),
      });
      await tx.insert(brandSettings).values({
        id: `${fixture.organizationId}-brand`,
        organizationId: fixture.organizationId,
        companyName: fixture.name,
        websiteUrl: "https://acme.example.test",
      });
      await tx.insert(projects).values({
        id: `${fixture.organizationId}-project`,
        organizationId: fixture.organizationId,
        name: fixture.name,
        brandSettingsId: `${fixture.organizationId}-brand`,
      });
    }
    const acme = DASHBOARD_SITE_FIXTURES[0];
    await tx.insert(sites).values({
      id: "sites-e2e-acme-site",
      organizationId: acme.organizationId,
      projectId: `${acme.organizationId}-project`,
      name: "Acme E2E site",
      slug: "sites-e2e-acme-site",
      publicOrigin: "https://acme.example.test",
      mounts: { blog: "/blog", changelog: "/changelog" },
      createdByUserId: acme.userId,
    });
    const owner = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, acme.userId));
    if (owner.length !== 1) {
      throw new Error("Fixture owner was not created.");
    }
  });
  console.log(
    JSON.stringify({
      command,
      durationMs: +(performance.now() - started).toFixed(2),
      fixtures: command === "seed" ? DASHBOARD_SITE_FIXTURES : [],
    })
  );
} finally {
  await db.$client.end();
}
