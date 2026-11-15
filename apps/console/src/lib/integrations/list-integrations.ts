import { db } from "@notra/db/drizzle";
import { githubIntegrations, linearIntegrations } from "@notra/db/schema";
import { desc, eq } from "drizzle-orm";

export async function getGitHubIntegrationsByOrganization(
  organizationId: string
) {
  const rows = await db
    .select({
      id: githubIntegrations.id,
      displayName: githubIntegrations.displayName,
      enabled: githubIntegrations.enabled,
      createdAt: githubIntegrations.createdAt,
      owner: githubIntegrations.owner,
      repo: githubIntegrations.repo,
    })
    .from(githubIntegrations)
    .where(eq(githubIntegrations.organizationId, organizationId));

  return rows.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    enabled: row.enabled,
    createdAt: row.createdAt,
    repositories: [{ owner: row.owner ?? "", repo: row.repo ?? "" }],
  }));
}

export function getLinearIntegrationsByOrganization(organizationId: string) {
  return db
    .select({
      id: linearIntegrations.id,
      displayName: linearIntegrations.displayName,
      enabled: linearIntegrations.enabled,
      createdAt: linearIntegrations.createdAt,
    })
    .from(linearIntegrations)
    .where(eq(linearIntegrations.organizationId, organizationId))
    .orderBy(desc(linearIntegrations.createdAt));
}
