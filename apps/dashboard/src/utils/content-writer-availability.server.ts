import { logWarn } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { geoSettings } from "@notra/db/schema";
import { isDemoMode } from "@notra/utils/demo-mode";
import { eq } from "drizzle-orm";

import { resolveGeoEntitlement } from "@/lib/billing/subscription";

/** Requires membership validation and an organization-scoped project ID. */
export async function canWriteContentArticle(
  organizationId: string,
  projectId: string | undefined,
  headers: Headers
): Promise<boolean> {
  if (!projectId) {
    return false;
  }

  try {
    const [settings, entitlement] = await Promise.all([
      db.query.geoSettings.findFirst({
        columns: { projectId: true },
        where: eq(geoSettings.projectId, projectId),
      }),
      isDemoMode() ? null : resolveGeoEntitlement(organizationId, headers),
    ]);
    return Boolean(settings) && entitlement !== "denied";
  } catch (error) {
    logWarn("[content] Article availability lookup unavailable", {
      organizationId,
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return false;
  }
}
