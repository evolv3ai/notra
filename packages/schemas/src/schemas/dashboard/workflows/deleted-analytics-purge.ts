import "zod/compile";
// biome-ignore lint/performance/noNamespaceImport: Zod recommended way of importing
import * as z from "zod";

/** The delayed QStash message that repeats a deleted workspace, site or project purge. */
export const deletedAnalyticsPurgeSchema = z.object({
  organizationId: z.string().trim().min(1),
  siteId: z.string().trim().min(1).optional(),
  projectId: z.string().trim().min(1).optional(),
});
