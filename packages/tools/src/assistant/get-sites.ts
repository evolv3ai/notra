import { db } from "@notra/db/drizzle";
import { sites } from "@notra/db/schema";
import { isDemoMode } from "@notra/utils/demo-mode";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { defineTool } from "eve/tools";

import { PUBLIC_SITE_COLUMNS } from "../constants/sites";
import { getSitesInputSchema } from "../schemas/sites";
import { requireOrganizationId } from "../utils/organization";
import { serializePublicSite } from "../utils/sites";

export function createGetSitesTool() {
  return defineTool({
    description:
      "Lists this organization's public Notra hosted sites with a live production deployment and their blog/changelog URLs. Returns no drafts, previews, repository details or deployment logs. Use nextOffset to continue when present.",
    inputSchema: getSitesInputSchema,
    async execute({ projectId, limit, offset }, ctx) {
      const organizationId = requireOrganizationId(ctx);
      if (isDemoMode()) {
        return { success: false, error: "Notra Sites is not available" };
      }
      const rows = await db.query.sites.findMany({
        columns: PUBLIC_SITE_COLUMNS,
        where: and(
          eq(sites.organizationId, organizationId),
          eq(sites.status, "active"),
          isNotNull(sites.activeProductionDeploymentId),
          projectId ? eq(sites.projectId, projectId) : undefined
        ),
        orderBy: [asc(sites.id)],
        limit: limit + 1,
        offset,
      });
      return {
        success: true,
        sites: rows.slice(0, limit).flatMap((site) => {
          const serialized = serializePublicSite(site);
          return serialized ? [serialized] : [];
        }),
        nextOffset: rows.length > limit ? offset + limit : null,
      };
    },
  });
}
