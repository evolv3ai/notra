import { redis } from "@notra/ai/utils/redis";
import { db } from "@notra/db/drizzle";
import { projects, siteDeployments, sites } from "@notra/db/schema";
import {
  GEO_INGEST_IDENTITY_ACTIVE_TTL_SECONDS,
  GEO_INGEST_SITE_INACTIVE_TTL_SECONDS,
  GEO_INGEST_ORGANIZATION_SITES_CACHE_PREFIX,
  GEO_INGEST_SITE_CACHE_PREFIX,
  GEO_INGEST_SITE_MEMORY_MAX_ENTRIES,
  GEO_INGEST_SITE_MEMORY_TTL_MS,
} from "@notra/geo-core/constants/geo";
import { GEO_PROJECTS_OLDEST_ORDER } from "@notra/geo-core/constants/geo-projects";
import type {
  GeoIngestSite,
  GeoIngestSitePrefix,
} from "@notra/geo-core/types/geo";
import { urlHost } from "@notra/geo-core/utils/url-host";
import { listMountedAreas } from "@notra/sites-core/utils/mounts";
import { and, eq } from "drizzle-orm";
import { Cache, Effect, Exit } from "effect";

/**
 * In-process layer in front of Redis on the hot ingest path. Concurrent
 * misses for one site share a single lookup; the oldest entries are evicted
 * at capacity; failed lookups are not kept.
 */
const memory = Effect.runSync(
  Cache.makeWith(
    // Callers sit behind a Promise boundary; a rejected lookup surfaces to
    // them unchanged and is not cached.
    (siteId: string) => Effect.promise(() => lookupIngestSite(siteId)),
    {
      capacity: GEO_INGEST_SITE_MEMORY_MAX_ENTRIES,
      timeToLive: (exit) =>
        Exit.isSuccess(exit) ? GEO_INGEST_SITE_MEMORY_TTL_MS : 0,
    }
  )
);

export async function invalidateIngestSiteCaches(
  siteId: string,
  organizationId: string
): Promise<void> {
  await Effect.runPromise(Cache.invalidate(memory, siteId));
  const client = redis;
  if (client) {
    await client.del(
      `${GEO_INGEST_SITE_CACHE_PREFIX}:${siteId}`,
      `${GEO_INGEST_ORGANIZATION_SITES_CACHE_PREFIX}:${organizationId}`
    );
  }
}

async function cached<T>(
  key: string,
  load: () => Promise<T | null>
): Promise<T | null> {
  const client = redis;
  if (client) {
    const hit = await client.get<{ value: T | null }>(key).catch(() => null);
    if (hit && typeof hit === "object" && "value" in hit) {
      return hit.value;
    }
  }
  const value = await load();
  if (client) {
    await client
      .set(
        key,
        { value },
        {
          ex:
            value === null
              ? GEO_INGEST_SITE_INACTIVE_TTL_SECONDS
              : GEO_INGEST_IDENTITY_ACTIVE_TTL_SECONDS,
        }
      )
      .catch(() => null);
  }
  return value;
}

export function loadIngestSite(siteId: string): Promise<GeoIngestSite | null> {
  return Effect.runPromise(Cache.get(memory, siteId));
}

function lookupIngestSite(siteId: string): Promise<GeoIngestSite | null> {
  return cached(`${GEO_INGEST_SITE_CACHE_PREFIX}:${siteId}`, async () => {
    const [site] = await db
      .select({
        id: sites.id,
        organizationId: sites.organizationId,
        projectId: sites.projectId,
        target: siteDeployments.target,
      })
      .from(sites)
      .innerJoin(
        siteDeployments,
        and(
          eq(sites.activeProductionDeploymentId, siteDeployments.id),
          eq(sites.id, siteDeployments.siteId),
          eq(siteDeployments.kind, "production")
        )
      )
      .where(
        and(
          eq(sites.id, siteId),
          eq(sites.status, "active"),
          eq(sites.analyticsEnabled, true)
        )
      )
      .limit(1);
    const host = site ? urlHost(site.target.publicOrigin) : null;
    if (!(site && host)) {
      return null;
    }
    const projectId =
      site.projectId ??
      (
        await db.query.projects.findFirst({
          columns: { id: true },
          where: eq(projects.organizationId, site.organizationId),
          orderBy: GEO_PROJECTS_OLDEST_ORDER,
        })
      )?.id;
    if (!projectId) {
      return null;
    }
    return {
      id: site.id,
      organizationId: site.organizationId,
      projectId,
      hosts: [host],
      mounts: listMountedAreas(site.target.mounts).map(({ mount }) => mount),
    };
  });
}

export async function loadOrganizationSitePrefixes(
  organizationId: string
): Promise<GeoIngestSitePrefix[] | null> {
  try {
    return await cached(
      `${GEO_INGEST_ORGANIZATION_SITES_CACHE_PREFIX}:${organizationId}`,
      async () => {
        const rows = await db
          .select({ target: siteDeployments.target })
          .from(sites)
          .innerJoin(
            siteDeployments,
            and(
              eq(sites.activeProductionDeploymentId, siteDeployments.id),
              eq(sites.id, siteDeployments.siteId),
              eq(siteDeployments.kind, "production")
            )
          )
          .where(
            and(
              eq(sites.organizationId, organizationId),
              eq(sites.status, "active")
            )
          );
        const prefixes: GeoIngestSitePrefix[] = [];
        for (const row of rows) {
          const host = urlHost(row.target.publicOrigin);
          if (host) {
            prefixes.push({
              host,
              mounts: listMountedAreas(row.target.mounts).map(
                ({ mount }) => mount
              ),
            });
          }
        }
        return prefixes;
      }
    );
  } catch {
    return null;
  }
}
