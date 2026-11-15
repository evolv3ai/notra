import { Effect } from "effect";

import { GEO_PAID_CODING_AGENT_ENGINE_IDS } from "../constants/geo";
import {
  GEO_MODEL_CATALOG_STATIC,
  GEO_MODEL_FEED_REVALIDATE_SECONDS,
  GEO_MODEL_FEED_URL,
  GEO_MODEL_NO_SEARCH_VISIBLE,
} from "../constants/geo-model-catalog";
import { GeoEngineCredentialsRequired } from "../deps";
import { geoModelFeedSchema } from "../schemas/geo-model-feed";
import type {
  GeoModelCatalog,
  GeoModelCatalogEntry,
  GeoResolvedModelCatalog,
} from "../types/geo";
import { isGeoNativeSearchEngine } from "../utils/geo-engines";
import { resolveGroundedEngines } from "../utils/geo-grounded-engines";
import { logGeoFailure } from "../utils/geo-log";
import {
  buildGeoModelCatalogFromFeed,
  seedGeoModelCatalog,
  withoutGeoModelCatalogEntries,
} from "../utils/geo-model-catalog";
import { loadGeoCodingAgentAccess } from "./coding-agent-access";

const MS_PER_SECOND = 1000;

interface NextRevalidateRequestInit extends RequestInit {
  next?: { revalidate?: number };
}

const STATIC_ENGINE_IDS = new Set(
  GEO_MODEL_CATALOG_STATIC.map((entry) => entry.id)
);

const cachedByCredentials = new Map<
  boolean,
  { catalog: GeoModelCatalog; expiresAt: number }
>();

async function fetchGeoModelCatalog(
  requireCredentials: boolean
): Promise<GeoModelCatalog> {
  const init: NextRevalidateRequestInit = {
    next: { revalidate: GEO_MODEL_FEED_REVALIDATE_SECONDS },
  };
  const response = await fetch(GEO_MODEL_FEED_URL, init);
  if (!response.ok) {
    throw new Error(`Model feed responded with ${response.status}`);
  }
  const feed = geoModelFeedSchema.parse(await response.json());
  const catalog = buildGeoModelCatalogFromFeed(feed.data, requireCredentials);
  if (catalog.models.length === 0) {
    throw new Error("Model feed returned no eligible models");
  }
  return catalog;
}

async function loadSharedGeoModelCatalog(
  requireCredentials: boolean
): Promise<GeoModelCatalog> {
  const cached = cachedByCredentials.get(requireCredentials) ?? null;
  if (cached && cached.expiresAt > Date.now()) {
    return cached.catalog;
  }
  try {
    const catalog = await fetchGeoModelCatalog(requireCredentials);
    cachedByCredentials.set(requireCredentials, {
      catalog,
      expiresAt: Date.now() + GEO_MODEL_FEED_REVALIDATE_SECONDS * MS_PER_SECOND,
    });
    return catalog;
  } catch (error) {
    logGeoFailure(
      "geo.model_catalog.feed_unavailable",
      "Model feed unavailable, using seed catalog",
      error,
      { hasCachedCatalog: cached !== null }
    );
    return cached?.catalog ?? seedGeoModelCatalog(requireCredentials);
  }
}

export const loadGeoModelCatalog = Effect.fn("geo.modelCatalog")(function* (
  organizationId: string
) {
  const requireCredentials = yield* GeoEngineCredentialsRequired;
  const [catalog, codingAgentsAllowed] = yield* Effect.all(
    [
      Effect.promise(() => loadSharedGeoModelCatalog(requireCredentials)),
      loadGeoCodingAgentAccess(organizationId),
    ],
    { concurrency: "unbounded" }
  );
  const available = withoutGeoModelCatalogEntries(
    catalog,
    codingAgentsAllowed ? [] : GEO_PAID_CODING_AGENT_ENGINE_IDS
  );
  const grounded = new Set(
    available.models
      .filter(
        (model) => resolveGroundedEngines([model.id], available).length > 0
      )
      .map((model) => model.id)
  );
  const searchless = new Set(
    available.models
      .filter(
        (model) =>
          !grounded.has(model.id) &&
          !isGeoNativeSearchEngine(available, model.id)
      )
      .map((model) => model.id)
  );
  const listedSearchless = newestSearchlessModels(available, searchless);
  const resolved: GeoResolvedModelCatalog = {
    ...available,
    models: available.models.map((model) => ({
      ...model,
      hidden:
        model.hidden ||
        (searchless.has(model.id) && !listedSearchless.has(model.id)),
      supportsGroundedChecks: grounded.has(model.id),
    })),
  };
  return resolved;
});

/**
 * Gateway models without web search stay listed only as each provider's
 * newest few; the rest are legacy-only. Static engines without search
 * (Cursor) stay legacy-only.
 */
function newestSearchlessModels(
  catalog: GeoModelCatalog,
  searchless: ReadonlySet<string>
): Set<string> {
  const byProvider = new Map<string, GeoModelCatalogEntry[]>();
  for (const model of catalog.models) {
    if (
      model.hidden ||
      !searchless.has(model.id) ||
      STATIC_ENGINE_IDS.has(model.id)
    ) {
      continue;
    }
    byProvider.set(model.provider, [
      ...(byProvider.get(model.provider) ?? []),
      model,
    ]);
  }
  // Undated models can't be ranked, so they never count against the limit.
  return new Set(
    [...byProvider.values()]
      .flatMap((models) => [
        ...models
          .filter((model) => model.released)
          .toSorted((left, right) =>
            right.released.localeCompare(left.released)
          )
          .slice(0, GEO_MODEL_NO_SEARCH_VISIBLE),
        ...models.filter((model) => !model.released),
      ])
      .map((model) => model.id)
  );
}
