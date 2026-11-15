import { db } from "@notra/db/drizzle";
import { mcpServerIntegrations } from "@notra/db/schema";
import { and, asc, eq } from "drizzle-orm";

const LIVE_STORE_LISTING_DETAIL_COLUMNS = {
  id: true,
  name: true,
  url: true,
  description: true,
  author: true,
  websiteUrl: true,
  brandColor: true,
  logoLightUrl: true,
  logoDarkUrl: true,
  bannerUrl: true,
  slug: true,
  category: true,
  storeFeaturedAt: true,
  authType: true,
  indexedToolCount: true,
} as const;

export async function listLiveMcpStoreIntegrations() {
  return await db.query.mcpServerIntegrations.findMany({
    where: and(
      eq(mcpServerIntegrations.resourceType, "store_listing"),
      eq(mcpServerIntegrations.storeStatus, "live"),
      eq(mcpServerIntegrations.enabled, true)
    ),
    orderBy: asc(mcpServerIntegrations.name),
    columns: LIVE_STORE_LISTING_DETAIL_COLUMNS,
  });
}

export async function getLiveMcpStoreIntegrationById(integrationId: string) {
  const integration = await db.query.mcpServerIntegrations.findFirst({
    where: and(
      eq(mcpServerIntegrations.id, integrationId),
      eq(mcpServerIntegrations.resourceType, "store_listing"),
      eq(mcpServerIntegrations.storeStatus, "live"),
      eq(mcpServerIntegrations.enabled, true)
    ),
    columns: LIVE_STORE_LISTING_DETAIL_COLUMNS,
  });

  return integration ?? null;
}

export async function getLiveMcpStoreIntegrationBySlug(slug: string) {
  const integration = await db.query.mcpServerIntegrations.findFirst({
    where: and(
      eq(mcpServerIntegrations.slug, slug),
      eq(mcpServerIntegrations.resourceType, "store_listing"),
      eq(mcpServerIntegrations.storeStatus, "live"),
      eq(mcpServerIntegrations.enabled, true)
    ),
    columns: LIVE_STORE_LISTING_DETAIL_COLUMNS,
  });

  return integration ?? null;
}
