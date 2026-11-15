import { DASHBOARD_SITE_FIXTURES } from "./constants/fixtures";
import { requireTestDatabaseUrl } from "./utils/database";

const started = performance.now();
process.env.DATABASE_URL = requireTestDatabaseUrl();
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";
const integrationId = process.argv[2]?.trim();
if (!integrationId) {
  throw new Error(
    "Usage: bun --no-env-file scripts/testing/dashboard/associate-repository.ts <approved-integration-id>"
  );
}
const { db } = await import("../../../packages/db/src/drizzle");
const { sites } = await import("../../../packages/db/src/schema");
const { and, eq } = await import("drizzle-orm");
const { requireOrganizationRepository } =
  await import("../../../packages/sites-server/src/repositories");
try {
  const acme = DASHBOARD_SITE_FIXTURES[0];
  const { integration, repository } = await requireOrganizationRepository(
    acme.organizationId,
    integrationId
  );
  const updated = await db
    .update(sites)
    .set({
      repositoryId: integration.id,
      githubInstallationId: repository.installationId,
      githubRepositoryId: repository.githubRepositoryId,
      repositoryOwner: repository.owner,
      repositoryName: repository.repo,
      productionBranch: integration.defaultBranch || "main",
    })
    .where(
      and(
        eq(sites.id, "sites-e2e-acme-site"),
        eq(sites.organizationId, acme.organizationId),
        eq(sites.projectId, `${acme.organizationId}-project`)
      )
    )
    .returning({ id: sites.id, repositoryId: sites.repositoryId });
  if (updated.length !== 1) {
    throw new Error("Seed the Acme fixture before associating its repository.");
  }
  console.log(
    JSON.stringify({
      command: "associate-repository",
      durationMs: +(performance.now() - started).toFixed(2),
      site: updated[0],
    })
  );
} finally {
  await db.$client.end();
}
