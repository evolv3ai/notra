import { logWarn } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { geoTrafficEmbeds, projects } from "@notra/db/schema";
import { advisoryXactLock } from "@notra/db/utils/advisory-xact-lock";
import { loadAiTraffic } from "@notra/geo-core/geo/programs";
import { webHostFilter } from "@notra/geo-core/utils/geo-project-domains";
import { Redis } from "@upstash/redis";
import { and, count, desc, eq, isNull } from "drizzle-orm";
import { Effect } from "effect";
import { nanoid } from "nanoid";

import {
  TRAFFIC_EMBED_CACHE_PREFIX,
  TRAFFIC_EMBED_CONFIG_MISS,
  TRAFFIC_EMBED_CONFIG_TTL_SECONDS,
  TRAFFIC_EMBED_DATA_TTL_SECONDS,
  TRAFFIC_EMBED_ID_LENGTH,
  TRAFFIC_EMBED_MAX_PER_ORGANIZATION,
  TRAFFIC_EMBED_REDIS_READ_TIMEOUT_MS,
  TRAFFIC_EMBED_REDIS_WRITE_TIMEOUT_MS,
} from "@/constants/traffic-embed";
import { geoCoreDashboardLayer } from "@/lib/geo/configure";
import type {
  PublicTrafficEmbed,
  TrafficEmbedConfig,
  TrafficEmbedRange,
  TrafficEmbedSummary,
} from "@/types/traffic-embed";
import { geoPresetRange } from "@/utils/geo-range";
import { isTrafficEmbedId } from "@/utils/traffic-embed";

function createBoundedRedisClient(timeoutMs: number): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!(url && token)) {
    return null;
  }
  return new Redis({
    url,
    token,
    signal: () => AbortSignal.timeout(timeoutMs),
  });
}

const readRedis = createBoundedRedisClient(TRAFFIC_EMBED_REDIS_READ_TIMEOUT_MS);
const writeRedis = createBoundedRedisClient(
  TRAFFIC_EMBED_REDIS_WRITE_TIMEOUT_MS
);

/**
 * Loads in progress on this instance, so concurrent requests for a cold
 * embed share one traffic query.
 */
const pendingLoads = new Map<string, Promise<PublicTrafficEmbed>>();

const configKey = (id: string) => `${TRAFFIC_EMBED_CACHE_PREFIX}:config:${id}`;
const dataKey = (id: string, range: TrafficEmbedRange, to: string) =>
  `${TRAFFIC_EMBED_CACHE_PREFIX}:data:${id}:${range}:${to}`;

/** Best effort: a Redis outage or timeout falls back to the live lookup. */
async function readCache<T>(key: string): Promise<T | null> {
  if (!readRedis) {
    return null;
  }
  try {
    return await readRedis.get<T>(key);
  } catch (error) {
    logWarn("[geo] traffic embed cache read skipped", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** One round trip for several keys; same fallback as `readCache`. */
async function readCaches<T extends unknown[]>(keys: {
  [K in keyof T]: string;
}): Promise<{ [K in keyof T]: T[K] | null }> {
  const misses = keys.map(() => null) as { [K in keyof T]: null };
  if (!readRedis) {
    return misses;
  }
  try {
    return await readRedis.mget<{ [K in keyof T]: T[K] | null }>(...keys);
  } catch (error) {
    logWarn("[geo] traffic embed cache read skipped", {
      error: error instanceof Error ? error.message : String(error),
    });
    return misses;
  }
}

async function writeCache(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  if (!writeRedis) {
    return;
  }
  try {
    await writeRedis.set(key, value, { ex: ttlSeconds });
  } catch (error) {
    logWarn("[geo] traffic embed cache write skipped", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function dropConfigCache(id: string): Promise<void> {
  if (!writeRedis) {
    return;
  }
  try {
    await writeRedis.del(configKey(id));
  } catch (error) {
    logWarn("[geo] traffic embed cache drop skipped", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const summaryColumns = {
  id: geoTrafficEmbeds.id,
  name: geoTrafficEmbeds.name,
  projectId: geoTrafficEmbeds.projectId,
  host: geoTrafficEmbeds.host,
  allowedOrigins: geoTrafficEmbeds.allowedOrigins,
  createdAt: geoTrafficEmbeds.createdAt,
};

function toSummary(row: {
  id: string;
  name: string;
  projectId: string | null;
  host: string | null;
  allowedOrigins: string[];
  createdAt: Date;
}): TrafficEmbedSummary {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

export async function listTrafficEmbeds(
  organizationId: string,
  projectId: string | null
): Promise<TrafficEmbedSummary[]> {
  const rows = await db
    .select(summaryColumns)
    .from(geoTrafficEmbeds)
    .where(
      and(
        eq(geoTrafficEmbeds.organizationId, organizationId),
        projectId === null
          ? isNull(geoTrafficEmbeds.projectId)
          : eq(geoTrafficEmbeds.projectId, projectId),
        isNull(geoTrafficEmbeds.revokedAt)
      )
    )
    .orderBy(desc(geoTrafficEmbeds.createdAt));
  return rows.map(toSummary);
}

/** Null when the project isn't the organization's or the org is at its cap. */
export async function createTrafficEmbed(input: {
  organizationId: string;
  projectId: string | null;
  userId: string;
  name: string;
  host: string | null;
  allowedOrigins: string[];
}): Promise<TrafficEmbedSummary | "limit" | null> {
  // The org lock serializes count + insert, so concurrent creates can't pass
  // the cap together.
  return db.transaction(async (tx) => {
    await advisoryXactLock(tx, `traffic-embed:${input.organizationId}`);
    const [project, [active]] = await Promise.all([
      input.projectId === null
        ? Promise.resolve(true)
        : tx
            .select({ id: projects.id })
            .from(projects)
            .where(
              and(
                eq(projects.id, input.projectId),
                eq(projects.organizationId, input.organizationId)
              )
            )
            .limit(1)
            .then((rows) => rows.length > 0),
      tx
        .select({ value: count() })
        .from(geoTrafficEmbeds)
        .where(
          and(
            eq(geoTrafficEmbeds.organizationId, input.organizationId),
            isNull(geoTrafficEmbeds.revokedAt)
          )
        ),
    ]);
    if (!project) {
      return null;
    }
    if ((active?.value ?? 0) >= TRAFFIC_EMBED_MAX_PER_ORGANIZATION) {
      return "limit";
    }
    const [row] = await tx
      .insert(geoTrafficEmbeds)
      .values({
        id: nanoid(TRAFFIC_EMBED_ID_LENGTH),
        organizationId: input.organizationId,
        projectId: input.projectId,
        createdByUserId: input.userId,
        name: input.name,
        host: input.host,
        allowedOrigins: input.allowedOrigins,
      })
      .returning(summaryColumns);
    return row ? toSummary(row) : null;
  });
}

export async function updateTrafficEmbed(input: {
  organizationId: string;
  embedId: string;
  name: string;
  allowedOrigins: string[];
}): Promise<TrafficEmbedSummary | null> {
  const [row] = await db
    .update(geoTrafficEmbeds)
    .set({ name: input.name, allowedOrigins: input.allowedOrigins })
    .where(
      and(
        eq(geoTrafficEmbeds.id, input.embedId),
        eq(geoTrafficEmbeds.organizationId, input.organizationId),
        isNull(geoTrafficEmbeds.revokedAt)
      )
    )
    .returning(summaryColumns);
  await dropConfigCache(input.embedId);
  return row ? toSummary(row) : null;
}

export async function revokeTrafficEmbed(
  organizationId: string,
  embedId: string
): Promise<boolean> {
  const rows = await db
    .update(geoTrafficEmbeds)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(geoTrafficEmbeds.id, embedId),
        eq(geoTrafficEmbeds.organizationId, organizationId),
        isNull(geoTrafficEmbeds.revokedAt)
      )
    )
    .returning({ id: geoTrafficEmbeds.id });
  await dropConfigCache(embedId);
  return rows.length > 0;
}

/**
 * Read on every embed request, by the header middleware and the page loader.
 * Edits and revocations drop the cached entry, so the TTL only bounds a
 * failed drop. Unknown and revoked ids are cached as a miss, so repeated
 * requests for them don't reach the database.
 */
export async function getTrafficEmbedConfig(
  embedId: string
): Promise<TrafficEmbedConfig | null> {
  if (!isTrafficEmbedId(embedId)) {
    return null;
  }
  const cached = await readCache<CachedConfig>(configKey(embedId));
  return cached === null ? lookupTrafficEmbedConfig(embedId) : configOf(cached);
}

type CachedConfig = TrafficEmbedConfig | typeof TRAFFIC_EMBED_CONFIG_MISS;

function configOf(cached: CachedConfig): TrafficEmbedConfig | null {
  return cached === TRAFFIC_EMBED_CONFIG_MISS ? null : cached;
}

/** The database lookup behind the config cache; fills it, hit or miss. */
async function lookupTrafficEmbedConfig(
  embedId: string
): Promise<TrafficEmbedConfig | null> {
  const [row] = await db
    .select({
      id: geoTrafficEmbeds.id,
      organizationId: geoTrafficEmbeds.organizationId,
      projectId: geoTrafficEmbeds.projectId,
      host: geoTrafficEmbeds.host,
      allowedOrigins: geoTrafficEmbeds.allowedOrigins,
    })
    .from(geoTrafficEmbeds)
    .where(
      and(eq(geoTrafficEmbeds.id, embedId), isNull(geoTrafficEmbeds.revokedAt))
    )
    .limit(1);
  await writeCache(
    configKey(embedId),
    row ?? TRAFFIC_EMBED_CONFIG_MISS,
    TRAFFIC_EMBED_CONFIG_TTL_SECONDS
  );
  return row ?? null;
}

/** Null for unknown or revoked embeds. */
export async function loadPublicTrafficEmbed(
  embedId: string,
  range: TrafficEmbedRange
): Promise<PublicTrafficEmbed | null> {
  if (!isTrafficEmbedId(embedId)) {
    return null;
  }
  const { dateFrom: from, dateTo: to } = geoPresetRange(range);
  const key = dataKey(embedId, range, to);
  // A warm embed needs both entries, so they come back in one round trip.
  const [cachedConfig, cached] = await readCaches<
    [CachedConfig, PublicTrafficEmbed]
  >([configKey(embedId), key]);
  const config =
    cachedConfig === null
      ? await lookupTrafficEmbedConfig(embedId)
      : configOf(cachedConfig);
  if (!config) {
    return null;
  }
  if (cached) {
    return cached;
  }
  const pending = pendingLoads.get(key);
  if (pending) {
    return pending;
  }
  const load = Effect.runPromise(
    loadAiTraffic(
      {
        organizationId: config.organizationId,
        ...(config.projectId ? { projectId: config.projectId } : {}),
      },
      { from, to },
      webHostFilter(config.host ?? undefined),
      "",
      "",
      undefined,
      false
    ).pipe(Effect.provide(geoCoreDashboardLayer))
  )
    .then(async (traffic) => {
      const embed: PublicTrafficEmbed = { range, from, to, traffic };
      await writeCache(key, embed, TRAFFIC_EMBED_DATA_TTL_SECONDS);
      return embed;
    })
    .finally(() => pendingLoads.delete(key));
  pendingLoads.set(key, load);
  return load;
}
