import { invalidateIngestSiteCaches } from "@notra/geo-core/ingest/sites";

import type { Site } from "../types/sites";

export async function invalidateSiteIngestCaches(
  site: Pick<Site, "id" | "organizationId">
): Promise<void> {
  await invalidateIngestSiteCaches(site.id, site.organizationId).catch(
    () => undefined
  );
}
