import {
  GEO_COMMERCE_AUDIENCE_ENGINE_IDS,
  GEO_DEFAULT_ENGINE_IDS,
  GEO_GENERAL_AUDIENCE_ENGINE_IDS,
  GEO_META_SEARCH_MODEL_IDS,
  GEO_MODEL_BATCH_SUFFIX,
  GEO_MODEL_CATALOG_SEED,
  GEO_MODEL_CATALOG_STATIC,
  GEO_MODEL_EXCLUDED_ID_PATTERN,
  GEO_MODEL_EXCLUDED_IDS,
  GEO_MODEL_EXCLUDED_SLUG_PATTERN,
  GEO_MODEL_EXCLUDED_TAGS,
  GEO_MODEL_HIDDEN_ID_PATTERN,
  GEO_MODEL_PROVIDERS,
  GEO_MODEL_STALE_LINE_DAYS,
  GEO_STATIC_ENGINE_ENV,
} from "../constants/geo-model-catalog";
import type {
  GeoAudienceType,
  GeoGatewayModel,
  GeoModelCatalog,
  GeoModelCatalogEntry,
  GeoModelProviderId,
} from "../types/geo";

const MS_PER_SECOND = 1000;
const MS_PER_DAY = 86_400_000;
const DAY_LENGTH = 10;
const VERSION_PATTERN = /\d+(?:\.\d+)*/g;
const DEFAULT_ENGINE_SET = new Set<string>(GEO_DEFAULT_ENGINE_IDS);
const SEED_RELEASE_DATES = new Map(
  GEO_MODEL_CATALOG_SEED.map((entry) => [entry.id, entry.released])
);

function isEligibleFeedModel(model: GeoGatewayModel): boolean {
  if (model.type !== "language" || model.deprecated_at) {
    return false;
  }
  if (
    GEO_MODEL_EXCLUDED_IDS.has(model.id) ||
    // Gateway batches cannot run GEO's web-search tools or enforce ZDR.
    model.id.endsWith(GEO_MODEL_BATCH_SUFFIX) ||
    GEO_MODEL_EXCLUDED_ID_PATTERN.test(model.id) ||
    GEO_MODEL_EXCLUDED_SLUG_PATTERN.test(model.id)
  ) {
    return false;
  }
  return !(model.tags ?? []).some((tag) => GEO_MODEL_EXCLUDED_TAGS.has(tag));
}

function toCatalogEntry(
  model: GeoGatewayModel,
  provider: GeoModelProviderId
): GeoModelCatalogEntry {
  return {
    id: model.id,
    provider,
    label: model.name,
    zdr: GEO_META_SEARCH_MODEL_IDS.has(model.id) ? "none" : model.zdr,
    released:
      toDayString(model.released) || (SEED_RELEASE_DATES.get(model.id) ?? ""),
    default: DEFAULT_ENGINE_SET.has(model.id),
    gateways: ["vercel"],
  };
}

function toDayString(seconds: number | undefined): string {
  if (!seconds) {
    return "";
  }
  return new Date(seconds * MS_PER_SECOND).toISOString().slice(0, DAY_LENGTH);
}

function isGeoStaticEngineAvailable(entry: GeoModelCatalogEntry): boolean {
  const envKeys = GEO_STATIC_ENGINE_ENV[entry.id];
  if (!envKeys) {
    return true;
  }
  return envKeys.every(
    (envKey) => (process.env[envKey] ?? "").trim().length > 0
  );
}

function staticEntriesForProvider(
  providerId: GeoModelProviderId,
  requireCredentials: boolean
): GeoModelCatalogEntry[] {
  return GEO_MODEL_CATALOG_STATIC.filter(
    (entry) =>
      entry.provider === providerId &&
      !GEO_MODEL_EXCLUDED_IDS.has(entry.id) &&
      (!requireCredentials || isGeoStaticEngineAvailable(entry))
  );
}

export function buildGeoModelCatalogFromFeed(
  feed: readonly GeoGatewayModel[],
  requireCredentials = true
): GeoModelCatalog {
  const models: GeoModelCatalogEntry[] = [];
  for (const provider of GEO_MODEL_PROVIDERS) {
    const entries = feed
      .filter(
        (model) =>
          model.owned_by === provider.id &&
          (provider.id !== "perplexity" || model.id === "perplexity/sonar") &&
          isEligibleFeedModel(model)
      )
      .map((model) => toCatalogEntry(model, provider.id))
      .sort(byReleaseDescending);
    const fallback =
      provider.id === "perplexity"
        ? GEO_MODEL_CATALOG_SEED.filter(
            (entry) =>
              entry.provider === provider.id &&
              !GEO_MODEL_EXCLUDED_IDS.has(entry.id) &&
              !entries.some((model) => model.id === entry.id)
          )
        : [];
    models.push(
      ...markHiddenGeoModels([...entries, ...fallback]),
      ...staticEntriesForProvider(provider.id, requireCredentials)
    );
  }
  const providers = GEO_MODEL_PROVIDERS.filter((provider) =>
    models.some((model) => model.provider === provider.id)
  );
  return { providers, models };
}

function byReleaseDescending(
  left: GeoModelCatalogEntry,
  right: GeoModelCatalogEntry
): number {
  return right.released.localeCompare(left.released);
}

/** `openai/gpt-6.1-sol` → `gpt-sol`: every release of one model line. */
function geoModelLine(id: string): string {
  return id
    .slice(id.indexOf("/") + 1)
    .split("-")
    .map((part) => part.replace(VERSION_PATTERN, ""))
    .filter(Boolean)
    .join("-");
}

function releasedAt(entry: GeoModelCatalogEntry): number {
  return Date.parse(entry.released) || 0;
}

/**
 * Hide niche variants and superseded releases from the picker: per model line
 * only the newest release stays, and lines that went stale disappear.
 * Defaults are never hidden. Hidden models stay in the catalog so stored
 * selections keep resolving.
 */
function markHiddenGeoModels(
  entries: readonly GeoModelCatalogEntry[]
): GeoModelCatalogEntry[] {
  const candidates = entries.filter(
    (entry) => !GEO_MODEL_HIDDEN_ID_PATTERN.test(entry.id)
  );
  // Without a release date neither recency rule can judge a model, so it stays.
  const undated = candidates.filter((entry) => releasedAt(entry) === 0);
  const newestByLine = new Map<string, GeoModelCatalogEntry>();
  for (const entry of candidates.filter((model) => releasedAt(model) > 0)) {
    const line = geoModelLine(entry.id);
    const newest = newestByLine.get(line);
    if (!newest || releasedAt(entry) > releasedAt(newest)) {
      newestByLine.set(line, entry);
    }
  }
  const providerNewest = Math.max(0, ...candidates.map(releasedAt));
  const staleBefore = providerNewest - GEO_MODEL_STALE_LINE_DAYS * MS_PER_DAY;
  const listed = new Set(
    [
      ...[...newestByLine.values()].filter(
        (entry) => releasedAt(entry) >= staleBefore
      ),
      ...undated,
    ].map((entry) => entry.id)
  );
  const isListed = (entry: GeoModelCatalogEntry) =>
    entry.default || STATIC_ENGINE_IDS.has(entry.id) || listed.has(entry.id);
  return entries.map((entry) => {
    const hidden = !isListed(entry);
    return hidden ? { ...entry, hidden } : entry;
  });
}

export function seedGeoModelCatalog(
  requireCredentials = true
): GeoModelCatalog {
  const models: GeoModelCatalogEntry[] = [];
  for (const provider of GEO_MODEL_PROVIDERS) {
    models.push(
      ...markHiddenGeoModels(
        GEO_MODEL_CATALOG_SEED.filter(
          (entry) =>
            entry.provider === provider.id &&
            !GEO_MODEL_EXCLUDED_IDS.has(entry.id)
        )
      ),
      ...staticEntriesForProvider(provider.id, requireCredentials)
    );
  }
  const providers = GEO_MODEL_PROVIDERS.filter((provider) =>
    models.some((model) => model.provider === provider.id)
  );
  return { providers, models };
}

/** Catalog without the given engine ids; providers left empty are dropped. */
export function withoutGeoModelCatalogEntries(
  catalog: GeoModelCatalog,
  engineIds: readonly string[]
): GeoModelCatalog {
  const removed = new Set(engineIds);
  const models = catalog.models.filter((model) => !removed.has(model.id));
  const providers = catalog.providers.filter((provider) =>
    models.some((model) => model.provider === provider.id)
  );
  return { providers, models };
}

export function getGeoModelCatalogEntry(
  catalog: GeoModelCatalog,
  engine: string
): GeoModelCatalogEntry | undefined {
  return catalog.models.find((model) => model.id === engine);
}

/**
 * True when the model has at least one zero-data-retention host. Engines the
 * catalog does not know fail closed: nothing vouches for their hosts.
 */
export function isGeoEngineZdrCapable(
  catalog: GeoModelCatalog,
  engine: string
): boolean {
  const entry = getGeoModelCatalogEntry(catalog, engine);
  return entry ? entry.zdr !== "none" : false;
}

const STATIC_ENGINE_IDS = new Set(
  GEO_MODEL_CATALOG_STATIC.map((entry) => entry.id)
);

/**
 * Picker models for one provider. Hidden models are only listed while
 * `selected` still contains them, so a project can switch them off.
 */
export function geoModelsForProvider(
  catalog: GeoModelCatalog,
  providerId: GeoModelProviderId,
  selected: ReadonlySet<string> = new Set()
): GeoModelCatalogEntry[] {
  return catalog.models
    .filter(
      (model) =>
        model.provider === providerId &&
        (!model.hidden || selected.has(model.id))
    )
    .sort((left, right) => {
      const leftStatic = STATIC_ENGINE_IDS.has(left.id);
      const rightStatic = STATIC_ENGINE_IDS.has(right.id);
      if (leftStatic !== rightStatic) {
        return leftStatic ? -1 : 1;
      }
      return right.released.localeCompare(left.released);
    });
}

export function geoDefaultEngines(catalog: GeoModelCatalog): string[] {
  const defaults = catalog.models
    .filter((model) => model.default && !model.hidden)
    .map((model) => model.id);
  if (defaults.length > 0) {
    return defaults;
  }
  return catalog.models
    .filter((model) => !model.hidden)
    .slice(0, 1)
    .map((model) => model.id);
}

/**
 * Engines seeded at onboarding. Non-technical audiences get the models the
 * assistant apps default to, but only while the catalog has all of them: a
 * partial set would be stored as the project's selection for good, so it
 * falls back to the full default set instead. The Google AI Overview is the
 * one optional engine, since it depends on a credential.
 */
export function geoEnginesForAudience(
  catalog: GeoModelCatalog,
  audienceType: GeoAudienceType | undefined
): string[] {
  if (audienceType !== "general" && audienceType !== "commerce") {
    return geoDefaultEngines(catalog);
  }
  const known = new Set(
    catalog.models.filter((model) => !model.hidden).map((model) => model.id)
  );
  if (!GEO_GENERAL_AUDIENCE_ENGINE_IDS.every((id) => known.has(id))) {
    return geoDefaultEngines(catalog);
  }
  const preferred =
    audienceType === "commerce"
      ? GEO_COMMERCE_AUDIENCE_ENGINE_IDS
      : GEO_GENERAL_AUDIENCE_ENGINE_IDS;
  return preferred.filter((id) => known.has(id));
}
