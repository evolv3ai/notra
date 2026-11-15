import { logError } from "@notra/ai/utils/server-log";
import { defineTool } from "eve/tools";

import { listGeoProjectsInputSchema } from "../schemas/analytics-tools";
import { listOrganizationProjects } from "../utils/analytics";
import { requireOrganizationId } from "../utils/organization";

export function createListGeoProjectsTool() {
  return defineTool({
    description:
      "List this organization's Notra projects. Each project tracks one brand and website for GEO (AI search visibility) and website analytics. isDefault marks the project used when projectId is omitted. Call this before get_geo_overview or get_web_analytics only when the user names a brand, site, or project, or asks about one other than the default.",
    inputSchema: listGeoProjectsInputSchema,
    async execute(_input, ctx) {
      const organizationId = requireOrganizationId(ctx);
      try {
        return { projects: await listOrganizationProjects(organizationId) };
      } catch (error) {
        logError("List GEO projects tool failed", error, { organizationId });
        return "Failed to list projects.";
      }
    },
  });
}
