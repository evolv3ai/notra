import { describeContentBillingDenial } from "@notra/ai/utils/content-billing-messages";
import {
  isTinybirdConfigured,
  queryGeoJourneyDetail,
  queryGeoJourneyPages,
  queryGeoJourneySources,
  queryGeoTrafficJourneys,
  queryGeoTrafficLog,
  queryGeoTrafficOverview,
  queryGeoTrafficPages,
  queryGeoTrafficTimeseries,
} from "@notra/analytics/tinybird/client";
import type { GeoTrafficOverviewRow } from "@notra/analytics/types/tinybird-endpoints";
import { db } from "@notra/db/drizzle";
import {
  brandSettings,
  geoCompetitors,
  geoPrompts,
  geoPromptSuggestions,
  geoScans,
  geoSettings,
} from "@notra/db/schema";
import { bumpGeoCheckGeneration } from "@notra/db/utils/geo-check-cache";
import {
  queryGeoCheckCompetitorPrompts,
  queryGeoCheckCompetitorPromptSummary,
  queryGeoCheckCompetitorShare,
  queryGeoCheckCompetitorShareAggregate,
  queryGeoCheckCompetitorTimeseries,
  queryGeoCheckEngineBrandMentions,
  queryGeoCheckEngineTotals,
  queryGeoCheckLanguageShare,
  queryGeoCheckLanguageShareTrends,
  queryGeoCheckOverview,
  queryGeoCheckPromptHistory,
  queryGeoCheckPromptResults,
  queryGeoScanComparison,
  queryGeoCheckTimeseries,
  toGeoCheckWindow,
} from "@notra/db/utils/geo-checks";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { Effect } from "effect";

import {
  AI_TRAFFIC_DEFAULT_DAYS,
  AI_TRAFFIC_DEFAULT_JOURNEYS_LIMIT,
  GEO_JOURNEY_PAGES_LIMIT,
  AI_TRAFFIC_DEFAULT_LOG_LIMIT,
  AI_TRAFFIC_DEFAULT_PAGES_LIMIT,
  AI_TRAFFIC_PAGES_FETCH_LIMIT,
  GEO_CHANGES_LIMIT,
  GEO_COMPETITOR_DETAIL_DAYS,
  GEO_COMPETITOR_SHARE_LIMIT,
  GEO_PROMPT_HISTORY_LIMIT,
  GEO_JOURNEY_DETAIL_LIMIT,
  GEO_MAX_COMPETITORS,
  GEO_MAX_ENGINES,
  GEO_MAX_LANGUAGES,
} from "../constants/geo";
import {
  GEO_MODEL_CATALOG_STATIC,
  GEO_MODEL_EXCLUDED_IDS,
} from "../constants/geo-model-catalog";
import { GeoEntitlementService } from "../deps";
import type { DbTransaction } from "../types/db";
import type {
  AiTrafficResponse,
  GeoChangesResponse,
  GeoScanDiff,
  GeoChangeScan,
  GeoCompetitorDomainFillInput,
  GeoCompetitorIgnoreInput,
  GeoCompetitor,
  GeoCompetitorDetailResponse,
  GeoCompetitorMerge,
  GeoCompetitorReconcileOutcome,
  GeoCompetitorSeed,
  GeoCompetitorEngineMatrixResponse,
  GeoCompetitorShareResponse,
  GeoCompetitorsResponse,
  GeoCompetitorUpsertInput,
  GeoAutoPromptToggleResult,
  GeoInsertedPrompt,
  GeoJourneyDetailResponse,
  GeoLanguageShareResponse,
  GeoOverviewResponse,
  GeoPromptHistoryInput,
  GeoPromptHistoryResponse,
  GeoPromptInsert,
  GeoPromptRescanInput,
  GeoPromptResultsResponse,
  GeoPromptUpdateChanges,
  GeoScanStartInput,
  GeoScopeInput,
  GeoSettingsEngineAddInput,
  GeoSettingsLanguageAddInput,
  GeoSettingsResponse,
  GeoSettingsUpsertInput,
  GeoTimeseriesResponse,
  GeoTrackedPrompt,
  GeoTrackedPromptsResponse,
  GeoJourneyDailyPoint,
  GeoJourneyStatsResponse,
  GeoTrafficJourneysResponse,
  GeoTrafficLogResponse,
  GeoTrafficPagesResponse,
  AiTrafficSourcesResponse,
  GeoTrafficSitesMode,
  GeoTrafficSource,
  GeoWindowInput,
} from "../types/geo";
import type {
  GeoCompetitorImportRow,
  GeoCompetitorsImportResult,
  GeoImportResult,
  GeoPromptImportRow,
} from "../types/geo-import";
import { toGeoTrafficTotals, toGeoVisitorType } from "../utils/ai-traffic";
import {
  diffScanChecks,
  summarizeGeoChanges,
  toGeoScanCheckSnapshot,
} from "../utils/geo-changes";
import {
  competitorBrandFoldKeys,
  competitorCanonicalMap,
  isGeoOwnBrandName,
} from "../utils/geo-competitor-names";
import { summarizeGeoCompetitorShare } from "../utils/geo-competitor-share";
import {
  normalizeConversionPaths,
  sumConversionVisits,
} from "../utils/geo-conversion-paths";
import { engineFamilyOf } from "../utils/geo-engine-family";
import {
  remapRetiredGeoEngineIds,
  scopeGeoScanEngines,
} from "../utils/geo-engines";
import {
  trackedGeoLanguages,
  withPromptLanguage,
} from "../utils/geo-language-rows";
import {
  geoDefaultEngines,
  getGeoModelCatalogEntry,
  isGeoEngineZdrCapable,
} from "../utils/geo-model-catalog";
import {
  normalizeProjectDomains,
  trafficLogHostFilter,
} from "../utils/geo-project-domains";
import { toGeoPromptResult } from "../utils/geo-prompt-results";
import { normalizePromptTags } from "../utils/geo-prompt-tags";
import { groupGeoSparklinePoints } from "../utils/geo-sparkline";
import { memoizeGeoRequest } from "../utils/request-memo";
import { competitorKey, normalizeCompetitorDomain } from "./domain";
import { geoDb, geoQuery, geoRequiredQuery, geoSkip } from "./effect";
import {
  GeoCompetitorLimitError,
  GeoPromptDuplicateError,
  GeoPromptNotFoundError,
  GeoScanAlreadyRunningError,
  GeoScanEnginesEmptyError,
  GeoSettingsDisabledError,
  GeoSettingsMissingError,
  GeoSettingsTrackingError,
  GeoWriterCreditsExhaustedError,
} from "./errors";
import { geoHiddenSourceParams } from "./hidden-sources";
import { invalidateGeoIngestHostsCache } from "./ingest";
import { lockGeoProject } from "./lock";
import {
  toGeoCompetitor,
  toGeoSettings,
  toGeoTrafficLogEntry,
  toTrackedPrompt,
} from "./mappers";
import { loadGeoModelCatalog } from "./model-catalog";
import { loadGeoProjectBrand } from "./project-brand";
import {
  ensureGeoProject,
  geoCheckScope,
  geoScopeParams,
  requireGeoProject,
  resolveGeoScope,
} from "./projects";
import { promptKey } from "./prompt-key";
import {
  deleteGeoPromptTranslations,
  pickNewGeoPrompts,
} from "./prompt-translations";
import {
  applyAutoPromptChange,
  buildGeoPrompts,
  customPromptScanId,
  generatedAutoPromptIds,
  isGeoAutoPromptId,
  toAutoTrackedPrompts,
} from "./prompts";
import {
  findGeoScanBillingDenial,
  startClaimedGeoScanRun,
} from "./scan-handoff";
import { rearmedGeoScanAt } from "./scan-schedule";
import { claimGeoScanRun, sweepStaleGeoScanRows } from "./scan-status";
import { geoTransaction } from "./transaction";
import { geoTrafficWindowParams } from "./window";

function mergeLegacyCompetitors(
  competitors: GeoCompetitor[],
  legacyNames: readonly string[]
): GeoCompetitor[] {
  const seen = new Set(
    competitors.map((competitor) => competitorKey(competitor.name))
  );
  const merged = [...competitors];
  for (const name of legacyNames) {
    const key = competitorKey(name);
    if (key.length === 0 || seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push({
      id: `legacy:${key}`,
      name,
      domain: null,
      synonyms: [],
      kind: "direct",
      color: null,
    });
  }
  return merged;
}

function findGeoSettingsRow(projectId: string) {
  return memoizeGeoRequest(`settings:${projectId}`, () =>
    db.query.geoSettings.findFirst({
      where: eq(geoSettings.projectId, projectId),
    })
  );
}

function loadScopeSettingsRow(projectId: string | null) {
  return projectId
    ? geoDb("settings lookup failed", () => findGeoSettingsRow(projectId))
    : Effect.succeed(null);
}

export const loadGeoSettings = Effect.fn("geo.settings")(function* (
  input: GeoScopeInput
) {
  const scope = yield* resolveGeoScope(input);
  const row = yield* loadScopeSettingsRow(scope.projectId);

  const catalog = yield* loadGeoModelCatalog(scope.organizationId);
  const response: GeoSettingsResponse = {
    configured: isTinybirdConfigured(),
    settings: row ? toGeoSettings(row, catalog) : null,
  };
  return response;
});

const reconcileCompetitorsInTransaction = Effect.fn(
  "geo.competitorsReconcileTx"
)(function* (
  tx: DbTransaction,
  organizationId: string,
  projectId: string,
  merge: GeoCompetitorMerge,
  limit?: number
) {
  yield* lockGeoProject(tx, projectId);
  const [existing, settingsRow] = yield* Effect.all(
    [
      geoDb("competitors lookup failed", () =>
        tx.query.geoCompetitors.findMany({
          where: eq(geoCompetitors.projectId, projectId),
          orderBy: [asc(geoCompetitors.createdAt)],
        })
      ),
      geoDb("settings lookup failed", () =>
        tx.query.geoSettings.findFirst({
          columns: { competitors: true },
          where: eq(geoSettings.projectId, projectId),
        })
      ),
    ],
    { concurrency: "unbounded" }
  );
  const current = mergeLegacyCompetitors(
    existing.map(toGeoCompetitor),
    settingsRow?.competitors ?? []
  );
  const entries = merge(current);
  const existingByName = new Map(
    existing.map((row) => [competitorKey(row.name), row])
  );

  const resolved: Required<GeoCompetitorSeed>[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const name = entry.name.trim();
    const key = competitorKey(name);
    if (name.length === 0 || seen.has(key)) {
      continue;
    }
    seen.add(key);
    const previous = existingByName.get(key);
    resolved.push({
      name,
      domain: entry.domain ?? previous?.domain ?? null,
      synonyms: entry.synonyms ?? previous?.synonyms ?? [],
      kind: entry.kind ?? previous?.kind ?? "direct",
      color: entry.color ?? previous?.color ?? null,
    });
  }

  if (limit !== undefined && resolved.length > limit) {
    const overLimit: GeoCompetitorReconcileOutcome = { status: "limit" };
    return overLimit;
  }

  const staleIds = existing.flatMap((row) =>
    seen.has(competitorKey(row.name)) ? [] : [row.id]
  );
  if (staleIds.length > 0) {
    yield* geoDb("competitors delete failed", () =>
      tx
        .delete(geoCompetitors)
        .where(
          and(
            eq(geoCompetitors.projectId, projectId),
            inArray(geoCompetitors.id, staleIds)
          )
        )
    );
  }

  if (resolved.length > 0) {
    yield* geoDb("competitors upsert failed", () =>
      tx
        .insert(geoCompetitors)
        .values(
          resolved.map((entry) => ({
            id: crypto.randomUUID(),
            organizationId,
            projectId,
            name: entry.name,
            domain: entry.domain,
            synonyms: entry.synonyms,
            kind: entry.kind,
            color: entry.color,
          }))
        )
        .onConflictDoUpdate({
          target: [geoCompetitors.projectId, geoCompetitors.name],
          set: {
            domain: sql`excluded.domain`,
            synonyms: sql`excluded.synonyms`,
            kind: sql`excluded.kind`,
            color: sql`excluded.color`,
          },
        })
    );
  }

  yield* geoDb("settings update failed", () =>
    tx
      .update(geoSettings)
      .set({ competitors: resolved.map((entry) => entry.name) })
      .where(eq(geoSettings.projectId, projectId))
  );

  const rows = yield* geoDb("competitors lookup failed", () =>
    tx.query.geoCompetitors.findMany({
      where: eq(geoCompetitors.projectId, projectId),
      orderBy: [asc(geoCompetitors.createdAt)],
    })
  );
  const outcome: GeoCompetitorReconcileOutcome = {
    status: "ok",
    competitors: rows.map(toGeoCompetitor),
  };
  return outcome;
});

export const reconcileGeoCompetitors = Effect.fn("geo.competitorsReconcile")(
  function* (input: GeoScopeInput, merge: GeoCompetitorMerge, limit?: number) {
    const scope = yield* requireGeoProject(input);
    const outcome = yield* geoTransaction("competitors sync failed", (tx) =>
      reconcileCompetitorsInTransaction(
        tx,
        scope.organizationId,
        scope.projectId,
        merge,
        limit
      )
    );

    if (outcome.status === "limit") {
      return yield* Effect.fail(
        new GeoCompetitorLimitError({ limit: limit ?? GEO_MAX_COMPETITORS })
      );
    }
    return outcome.competitors;
  }
);

const loadCompetitorsByProject = Effect.fn("geo.competitorsByProject")(
  function* (projectId: string) {
    const [rows, settingsRow] = yield* Effect.all(
      [
        geoDb("competitors lookup failed", () =>
          db.query.geoCompetitors.findMany({
            where: eq(geoCompetitors.projectId, projectId),
            orderBy: [asc(geoCompetitors.createdAt)],
          })
        ),
        geoDb("settings lookup failed", () => findGeoSettingsRow(projectId)),
      ],
      { concurrency: "unbounded" }
    );

    return mergeLegacyCompetitors(
      rows.map(toGeoCompetitor),
      settingsRow?.competitors ?? []
    );
  }
);

export const loadGeoCompetitors = Effect.fn("geo.competitors")(function* (
  input: GeoScopeInput
) {
  const scope = yield* resolveGeoScope(input);
  if (!scope.projectId) {
    const emptyResponse: GeoCompetitorsResponse = { competitors: [] };
    return emptyResponse;
  }

  const response: GeoCompetitorsResponse = {
    competitors: yield* loadCompetitorsByProject(scope.projectId),
  };
  return response;
});

export const upsertGeoCompetitor = Effect.fn("geo.competitorUpsert")(function* (
  scopeInput: GeoScopeInput,
  input: GeoCompetitorUpsertInput
) {
  const key = competitorKey(input.previousName ?? input.name);
  const competitors = yield* reconcileGeoCompetitors(
    scopeInput,
    (current) => {
      const entries: GeoCompetitorSeed[] = current.map((competitor) =>
        competitorKey(competitor.name) === key
          ? {
              name: input.name.trim(),
              domain: input.domain,
              synonyms: input.synonyms ?? competitor.synonyms,
              kind: input.kind ?? competitor.kind,
              color: input.color ?? competitor.color,
            }
          : competitor
      );

      if (
        !entries.some(
          (entry) => competitorKey(entry.name) === competitorKey(input.name)
        )
      ) {
        entries.push({
          name: input.name.trim(),
          domain: input.domain,
          synonyms: input.synonyms ?? [],
          kind: input.kind ?? "direct",
          color: input.color ?? null,
        });
      }
      return entries;
    },
    GEO_MAX_COMPETITORS
  );
  const response: GeoCompetitorsResponse = { competitors };
  return response;
});

/**
 * Stores looked-up websites for competitors that still have none. Checked
 * against the stored rows inside the reconcile transaction, so a website
 * someone entered meanwhile is never replaced.
 */
export const fillGeoCompetitorDomains = Effect.fn("geo.competitorDomainsFill")(
  function* (input: GeoCompetitorDomainFillInput) {
    const domains = new Map(
      input.domains.flatMap((entry) => {
        const domain = normalizeCompetitorDomain(entry.domain);
        return domain ? [[competitorKey(entry.name), domain] as const] : [];
      })
    );
    const competitors = yield* reconcileGeoCompetitors(input, (current) =>
      current.map((competitor) => {
        const domain = domains.get(competitorKey(competitor.name));
        return competitor.domain || !domain
          ? competitor
          : { ...competitor, domain };
      })
    );
    const response: GeoCompetitorsResponse = { competitors };
    return response;
  }
);

export const deleteGeoCompetitor = Effect.fn("geo.competitorDelete")(function* (
  scopeInput: GeoScopeInput,
  name: string
) {
  const key = competitorKey(name);
  const competitors = yield* reconcileGeoCompetitors(scopeInput, (current) =>
    current.filter((competitor) => competitorKey(competitor.name) !== key)
  );
  const response: GeoCompetitorsResponse = { competitors };
  return response;
});

/**
 * Dismisses a discovered brand from the competitor suggestions (or brings it
 * back). Stored lowercased so name variants that differ in case stay hidden.
 */
export const setGeoCompetitorIgnored = Effect.fn("geo.competitorIgnore")(
  function* (input: GeoCompetitorIgnoreInput) {
    const scope = yield* requireGeoProject(input);
    const key = competitorKey(input.name);
    const column = geoSettings.ignoredCompetitors;
    const next = input.ignored
      ? sql`CASE WHEN ${key} = ANY(${column}) THEN ${column} ELSE array_append(${column}, ${key}) END`
      : sql`array_remove(${column}, ${key})`;
    const updated = yield* geoDb("ignore competitor suggestion failed", () =>
      db
        .update(geoSettings)
        .set({ ignoredCompetitors: next })
        .where(eq(geoSettings.projectId, scope.projectId))
        .returning({ ignoredCompetitors: geoSettings.ignoredCompetitors })
    );
    const row = updated[0];
    if (!row) {
      return yield* Effect.fail(
        new GeoSettingsMissingError({ organizationId: scope.organizationId })
      );
    }
    return { ignoredCompetitors: row.ignoredCompetitors };
  }
);

export const importGeoCompetitors = Effect.fn("geo.competitorsImport")(
  function* (
    scopeInput: GeoScopeInput,
    rows: readonly GeoCompetitorImportRow[]
  ) {
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    const competitors = yield* reconcileGeoCompetitors(
      scopeInput,
      (current) => {
        imported = 0;
        updated = 0;
        skipped = 0;
        const entries: Required<GeoCompetitorSeed>[] = current.map(
          (competitor) => ({
            name: competitor.name,
            domain: competitor.domain,
            synonyms: competitor.synonyms,
            kind: competitor.kind,
            color: competitor.color,
          })
        );
        const indexByKey = new Map(
          entries.map((entry, index) => [competitorKey(entry.name), index])
        );
        const seen = new Set<string>();

        for (const row of rows) {
          const name = row.name.trim();
          const key = competitorKey(name);
          if (seen.has(key)) {
            skipped += 1;
            continue;
          }
          seen.add(key);
          const index = indexByKey.get(key);
          const previous = index === undefined ? undefined : entries[index];
          if (index === undefined || !previous) {
            entries.push({
              name,
              domain: row.domain ?? null,
              synonyms: row.synonyms ?? [],
              kind: row.kind ?? "direct",
              color: null,
            });
            indexByKey.set(key, entries.length - 1);
            imported += 1;
            continue;
          }
          entries[index] = {
            name: previous.name,
            domain: row.domain ?? previous.domain,
            synonyms: row.synonyms ?? previous.synonyms,
            kind: row.kind ?? previous.kind,
            color: previous.color,
          };
          updated += 1;
        }
        return entries;
      },
      GEO_MAX_COMPETITORS
    );

    const result: GeoCompetitorsImportResult = {
      imported,
      updated,
      skipped,
      competitors,
    };
    return result;
  }
);

export const addGeoTrackedEngine = Effect.fn("geo.settingsEngineAdd")(
  function* (input: GeoSettingsEngineAddInput) {
    const { projectId } = yield* requireGeoProject(input);
    const catalog = yield* loadGeoModelCatalog(input.organizationId);
    const model = getGeoModelCatalogEntry(catalog, input.engine);
    if (!model) {
      return yield* Effect.fail(
        new GeoSettingsTrackingError({
          message: "This model is no longer available for tracking",
        })
      );
    }

    const initialEngines = [
      ...new Set([...geoDefaultEngines(catalog), input.engine]),
    ];
    const updated = yield* geoDb("tracked engine update failed", () =>
      db
        .update(geoSettings)
        .set({
          engines: sql<string[]>`
            CASE
              WHEN ${geoSettings.engines} IS NULL OR cardinality(${geoSettings.engines}) = 0
                THEN ${sql.param(initialEngines)}::text[]
              WHEN ${input.engine} = ANY(${geoSettings.engines})
                THEN ${geoSettings.engines}
              WHEN (
                SELECT count(DISTINCT engine)
                FROM unnest(${geoSettings.engines}) AS tracked_engines(engine)
              ) < ${GEO_MAX_ENGINES}
                THEN array_append(${geoSettings.engines}, ${input.engine})
              ELSE ${geoSettings.engines}
            END
          `,
        })
        .where(
          and(
            eq(geoSettings.organizationId, input.organizationId),
            eq(geoSettings.projectId, projectId),
            sql`(NOT ${Boolean(model.hidden)} OR ${input.engine} = ANY(${geoSettings.engines}))`,
            sql`(
              NOT ${geoSettings.enforceZdr}
              OR ${isGeoEngineZdrCapable(catalog, input.engine)}
              OR ${input.engine} = ANY(${geoSettings.nonZdrApprovedEngines})
            )`
          )
        )
        .returning({ engines: geoSettings.engines })
    );

    if (!updated.at(0)?.engines?.includes(input.engine)) {
      return yield* Effect.fail(
        new GeoSettingsTrackingError({
          message:
            "This model cannot be added under the current tracking settings",
        })
      );
    }
  }
);

export const addGeoTrackedLanguage = Effect.fn("geo.settingsLanguageAdd")(
  function* (input: GeoSettingsLanguageAddInput) {
    const { projectId } = yield* requireGeoProject(input);
    const initialLanguages = [
      ...new Set([...trackedGeoLanguages([]), input.language]),
    ];
    const updated = yield* geoDb("tracked language update failed", () =>
      db
        .update(geoSettings)
        .set({
          languages: sql<string[]>`
            CASE
              WHEN ${geoSettings.languages} IS NULL OR cardinality(${geoSettings.languages}) = 0
                THEN ${sql.param(initialLanguages)}::text[]
              WHEN ${input.language} = ANY(${geoSettings.languages})
                THEN ${geoSettings.languages}
              WHEN (
                SELECT count(DISTINCT language)
                FROM unnest(${geoSettings.languages}) AS tracked_languages(language)
              ) < ${GEO_MAX_LANGUAGES}
                THEN array_append(${geoSettings.languages}, ${input.language})
              ELSE ${geoSettings.languages}
            END
          `,
        })
        .where(
          and(
            eq(geoSettings.organizationId, input.organizationId),
            eq(geoSettings.projectId, projectId)
          )
        )
        .returning({ languages: geoSettings.languages })
    );

    if (!updated.at(0)?.languages?.includes(input.language)) {
      return yield* Effect.fail(
        new GeoSettingsTrackingError({
          message: "This language cannot be added to tracking",
        })
      );
    }
  }
);

export const upsertGeoSettings = Effect.fn("geo.settingsUpsert")(function* (
  input: GeoSettingsUpsertInput
) {
  const entitlements = yield* GeoEntitlementService;
  const projectId =
    input.engines.length === 0
      ? (yield* requireGeoProject(input)).projectId
      : yield* ensureGeoProject(
          { organizationId: input.organizationId, projectId: input.projectId },
          input.companyName
        );

  const entitlement = yield* entitlements.resolveZdrEntitlement(
    input.organizationId
  );
  const enforceZdr = entitlement === "entitled" && input.enforceZdr;
  const catalog = yield* loadGeoModelCatalog(input.organizationId);
  const unavailableStaticEngines = new Set<string>();
  for (const entry of GEO_MODEL_CATALOG_STATIC) {
    if (
      !GEO_MODEL_EXCLUDED_IDS.has(entry.id) &&
      !getGeoModelCatalogEntry(catalog, entry.id)
    ) {
      unavailableStaticEngines.add(entry.id);
    }
  }
  const existingSettings = yield* geoDb("settings lookup failed", () =>
    db.query.geoSettings.findFirst({
      columns: {
        companyName: true,
        aliases: true,
        engines: true,
        nonZdrApprovedEngines: true,
        trackWithoutSearch: true,
        conversionPaths: true,
        domains: true,
        pausedAutoPromptIds: true,
        removedAutoPromptIds: true,
        enabled: true,
        nextScanAt: true,
        lastScanAt: true,
        scanIntervalHours: true,
        promptLanguage: true,
      },
      where: eq(geoSettings.projectId, projectId),
    })
  );
  const storedEngines = remapRetiredGeoEngineIds(
    existingSettings?.engines ?? []
  );
  const storedEngineSet = new Set(storedEngines);
  const requestedEngines = remapRetiredGeoEngineIds(input.engines);
  if (
    requestedEngines.some((engine) => {
      const model = getGeoModelCatalogEntry(catalog, engine);
      return !storedEngineSet.has(engine) && (!model || model.hidden);
    })
  ) {
    return yield* Effect.fail(
      new GeoSettingsTrackingError({
        message: "Legacy or unavailable models cannot be newly selected",
      })
    );
  }
  const pausedAutoPromptIds =
    input.pausedAutoPromptIds ?? existingSettings?.pausedAutoPromptIds ?? [];
  const removedAutoPromptIds =
    input.removedAutoPromptIds ?? existingSettings?.removedAutoPromptIds ?? [];
  const trackWithoutSearch =
    input.trackWithoutSearch ?? existingSettings?.trackWithoutSearch ?? false;
  const conversionPaths = normalizeConversionPaths(
    input.conversionPaths ?? existingSettings?.conversionPaths ?? []
  );
  const domains = normalizeProjectDomains(
    input.domains ?? existingSettings?.domains ?? []
  );
  const promptLanguage =
    existingSettings?.promptLanguage ?? input.promptLanguage ?? null;
  const languages = withPromptLanguage(input.languages, promptLanguage);
  if (!languages) {
    return yield* Effect.fail(
      new GeoSettingsTrackingError({
        message: `${promptLanguage} is the prompt language and stays tracked, so choose at most ${GEO_MAX_LANGUAGES - 1} other languages`,
      })
    );
  }
  const preservedEngines = storedEngines.filter((engine) =>
    unavailableStaticEngines.has(engine)
  );
  const preservedEngineSet = new Set(preservedEngines);
  const engines = [...new Set([...requestedEngines, ...preservedEngines])];
  if (engines.length === 0) {
    return yield* Effect.fail(
      new GeoSettingsTrackingError({ message: "Choose at least one model" })
    );
  }
  const engineSet = new Set(engines);
  const nonZdrApprovedEngines = [
    ...new Set([
      ...remapRetiredGeoEngineIds(input.nonZdrApprovedEngines),
      ...remapRetiredGeoEngineIds(
        existingSettings?.nonZdrApprovedEngines ?? []
      ).filter((engine) => preservedEngineSet.has(engine)),
    ]),
  ].filter((engine) => engineSet.has(engine));

  const keepNextScanAt =
    input.enabled &&
    existingSettings?.enabled === true &&
    existingSettings.scanIntervalHours === input.scanIntervalHours;
  let nextScanAt: Date | null = null;
  if (keepNextScanAt) {
    nextScanAt = existingSettings?.nextScanAt ?? null;
  } else if (input.enabled) {
    nextScanAt = rearmedGeoScanAt(
      input.scanIntervalHours,
      existingSettings?.lastScanAt ?? null
    );
  }
  const clearedLease = keepNextScanAt
    ? {}
    : { scanLeaseUntil: null, scanFirstFailedAt: null };

  yield* geoDb("settings upsert failed", () =>
    db
      .insert(geoSettings)
      .values({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        projectId,
        companyName: input.companyName,
        aliases: input.aliases,
        competitors: [],
        conversionPaths,
        domains,
        languages,
        promptLanguage,
        engines,
        enforceZdr,
        nonZdrApprovedEngines,
        trackWithoutSearch,
        pausedAutoPromptIds,
        removedAutoPromptIds,
        enabled: input.enabled,
        scanIntervalHours: input.scanIntervalHours,
        nextScanAt,
      })
      .onConflictDoUpdate({
        target: geoSettings.projectId,
        set: {
          companyName: input.companyName,
          aliases: input.aliases,
          conversionPaths,
          domains,
          languages,
          promptLanguage,
          engines,
          enforceZdr,
          nonZdrApprovedEngines,
          trackWithoutSearch,
          pausedAutoPromptIds,
          removedAutoPromptIds,
          enabled: input.enabled,
          scanIntervalHours: input.scanIntervalHours,
          nextScanAt,
          ...clearedLease,
        },
      })
  );

  yield* Effect.promise(() =>
    invalidateGeoIngestHostsCache(input.organizationId, projectId)
  );
  const brandNamesChanged =
    existingSettings?.companyName !== input.companyName ||
    (existingSettings?.aliases ?? []).join("\n") !== input.aliases.join("\n");
  if (brandNamesChanged) {
    yield* Effect.promise(() => bumpGeoCheckGeneration([input.organizationId]));
  }

  yield* reconcileGeoCompetitors(
    { organizationId: input.organizationId, projectId },
    (current) => current
  );

  const rows = yield* geoDb("settings lookup failed", () =>
    db.select().from(geoSettings).where(eq(geoSettings.projectId, projectId))
  );

  const row = rows.at(0);
  const response: GeoSettingsResponse = {
    configured: isTinybirdConfigured(),
    settings: row ? toGeoSettings(row, catalog) : null,
  };
  return response;
});

export const loadGeoLanguageShare = Effect.fn("geo.languageShare")(function* (
  input: GeoScopeInput,
  window: GeoWindowInput
) {
  const scope = yield* resolveGeoScope(input);
  const checkScope = geoCheckScope(scope);
  const checkWindow = toGeoCheckWindow(window);
  const [rows, trendRows] = yield* Effect.all(
    [
      geoDb("language share query failed", () =>
        queryGeoCheckLanguageShare(checkScope, checkWindow)
      ),
      geoDb("language share trends query failed", () =>
        queryGeoCheckLanguageShareTrends(checkScope, checkWindow)
      ),
    ],
    { concurrency: "unbounded" }
  );
  const trendsByLanguage = groupGeoSparklinePoints(
    trendRows,
    (point) => point.language,
    (point) => ({ day: point.day, value: point.visibilityRate })
  );

  const response: GeoLanguageShareResponse = {
    configured: true,
    points: rows.map((row) => ({
      language: row.language,
      checks: row.checks,
      mentions: row.mentions,
      mentionRate: row.mentionRate,
      citations: row.citations,
      visibility: row.visibility,
      visibilityRate: row.visibilityRate,
      avgPosition: row.avgPosition,
      trend: trendsByLanguage.get(row.language) ?? [],
    })),
  };
  return response;
});

export const loadGeoOverview = Effect.fn("geo.overview")(function* (
  input: GeoScopeInput,
  window: GeoWindowInput
) {
  const scope = yield* resolveGeoScope(input);
  const rows = yield* geoDb("overview query failed", () =>
    queryGeoCheckOverview(geoCheckScope(scope), toGeoCheckWindow(window))
  );

  const engines: GeoOverviewResponse["engines"] = rows.map((row) => ({
    engine: row.engine,
    checks: row.checks,
    mentions: row.mentions,
    mentionRate: row.mentionRate,
    citations: row.citations,
    visibility: row.visibility,
    visibilityRate: row.visibilityRate,
    avgPosition: row.avgPosition,
    lastCheckedAt: row.lastCheckedAt.toISOString(),
  }));

  const response: GeoOverviewResponse = {
    configured: true,
    engines,
  };
  return response;
});

export const loadGeoTimeseries = Effect.fn("geo.timeseries")(function* (
  input: GeoScopeInput,
  window: GeoWindowInput
) {
  const scope = yield* resolveGeoScope(input);
  const rows = yield* geoDb("timeseries query failed", () =>
    queryGeoCheckTimeseries(geoCheckScope(scope), toGeoCheckWindow(window))
  );

  const response: GeoTimeseriesResponse = {
    configured: true,
    points: rows.map((row) => ({
      day: row.day,
      engine: row.engine,
      checks: row.checks,
      mentions: row.mentions,
      citations: row.citations,
      visibility: row.visibility,
      avgPosition: row.avgPosition,
    })),
  };
  return response;
});

export const loadGeoPromptResults = Effect.fn("geo.promptResults")(function* (
  input: GeoScopeInput,
  window: GeoWindowInput
) {
  const scope = yield* resolveGeoScope(input);
  const rows = yield* geoDb("prompt results query failed", () =>
    queryGeoCheckPromptResults(geoCheckScope(scope), toGeoCheckWindow(window))
  );

  const response: GeoPromptResultsResponse = {
    configured: true,
    results: rows.map(toGeoPromptResult),
  };
  return response;
});

function promptHistoryScanIds(promptId: string): string[] {
  return [...new Set([promptId, customPromptScanId(promptId)])];
}

export const loadGeoPromptHistory = Effect.fn("geo.promptHistory")(function* (
  input: GeoPromptHistoryInput
) {
  const scope = yield* resolveGeoScope(input);
  const rows = yield* geoDb("prompt history query failed", () =>
    queryGeoCheckPromptHistory(geoCheckScope(scope), {
      promptIds: promptHistoryScanIds(input.promptId),
      scanId: input.scanId,
      limit: GEO_PROMPT_HISTORY_LIMIT,
    })
  );

  const response: GeoPromptHistoryResponse = {
    configured: true,
    promptId: input.promptId,
    checks: rows.map((row) => ({
      id: row.id,
      scanId: row.scanId,
      engine: row.engine,
      mentioned: row.mentioned,
      ownedSourceCited: row.ownedSourceCited,
      position: row.position,
      sentiment: row.sentiment,
      competitors: row.competitors,
      language: row.language,
      capturedAt: row.capturedAt.toISOString(),
    })),
  };
  return response;
});

function toGeoChangeScan(
  scan: { id: string; finishedAt: Date | null } | null
): GeoChangeScan | null {
  if (!scan) {
    return null;
  }
  return { id: scan.id, finishedAt: scan.finishedAt?.toISOString() ?? null };
}

export const loadGeoChanges = Effect.fn("geo.changes")(function* (
  input: GeoScopeInput
) {
  const scope = yield* requireGeoProject(input);
  const [comparison, competitors] = yield* Effect.all(
    [
      geoDb("scan comparison query failed", () =>
        queryGeoScanComparison({ projectId: scope.projectId })
      ),
      loadCompetitorsByProject(scope.projectId),
    ],
    { concurrency: "unbounded" }
  );
  const events = comparison.previousScan
    ? diffScanChecks(
        comparison.previous.map(toGeoScanCheckSnapshot),
        comparison.current.map(toGeoScanCheckSnapshot),
        competitors
      )
    : [];

  const response: GeoChangesResponse = {
    previousScan: toGeoChangeScan(comparison.previousScan),
    currentScan: toGeoChangeScan(comparison.currentScan),
    summary: summarizeGeoChanges(events),
    events: events.slice(0, GEO_CHANGES_LIMIT),
  };
  return response;
});

/** Every change between the two latest completed scans, unsliced. */
export const loadGeoScanDiff = Effect.fn("geo.scanDiff")(function* (
  input: GeoScopeInput
) {
  const scope = yield* requireGeoProject(input);
  const [comparison, competitors] = yield* Effect.all(
    [
      geoDb("scan comparison query failed", () =>
        queryGeoScanComparison({ projectId: scope.projectId })
      ),
      loadCompetitorsByProject(scope.projectId),
    ],
    { concurrency: "unbounded" }
  );
  const previous = comparison.previous.map(toGeoScanCheckSnapshot);
  const current = comparison.current.map(toGeoScanCheckSnapshot);
  const diff: GeoScanDiff = {
    previousScanId: comparison.previousScan?.id ?? null,
    currentScanId: comparison.currentScan?.id ?? null,
    previous,
    current,
    events: comparison.previousScan
      ? diffScanChecks(previous, current, competitors)
      : [],
  };
  return diff;
});

export const loadGeoCompetitorShare = Effect.fn("geo.competitorShare")(
  function* (
    input: GeoScopeInput,
    window: GeoWindowInput,
    summaryOnly = false
  ) {
    const scope = yield* resolveGeoScope(input);
    const checkScope = geoCheckScope(scope);
    const checkWindow = toGeoCheckWindow(window);

    if (summaryOnly) {
      const rows = yield* geoDb("competitor share query failed", () =>
        queryGeoCheckCompetitorShare(
          checkScope,
          checkWindow,
          GEO_COMPETITOR_SHARE_LIMIT
        )
      );
      const response: GeoCompetitorShareResponse = {
        configured: true,
        points: rows.map((row) => ({
          brand: row.brand,
          mentions: row.mentions,
        })),
        timeseries: [],
      };
      return response;
    }

    const aggregates = yield* geoDb(
      "competitor share aggregate query failed",
      () => queryGeoCheckCompetitorShareAggregate(checkScope, checkWindow)
    );

    const response: GeoCompetitorShareResponse = {
      configured: true,
      ...summarizeGeoCompetitorShare(aggregates, GEO_COMPETITOR_SHARE_LIMIT),
    };
    return response;
  }
);

export const loadGeoCompetitorEngineMatrix = Effect.fn(
  "geo.competitorEngineMatrix"
)(function* (input: GeoScopeInput, window: GeoWindowInput) {
  const scope = yield* resolveGeoScope(input);
  const checkScope = geoCheckScope(scope);
  const checkWindow = toGeoCheckWindow(window);

  const [engines, competitors] = yield* Effect.all(
    [
      geoDb("engine totals query failed", () =>
        queryGeoCheckEngineTotals(checkScope, checkWindow)
      ),
      scope.projectId
        ? loadCompetitorsByProject(scope.projectId)
        : Effect.succeed<GeoCompetitor[]>([]),
    ],
    { concurrency: "unbounded" }
  );
  const brands = competitorCanonicalMap(competitors);
  if (brands.size === 0) {
    const topBrands = yield* geoDb("competitor share query failed", () =>
      queryGeoCheckCompetitorShare(
        checkScope,
        checkWindow,
        GEO_COMPETITOR_SHARE_LIMIT
      )
    );
    for (const row of topBrands) {
      const key = competitorKey(row.brand);
      if (key.length > 0 && !brands.has(key)) {
        brands.set(key, row.brand);
      }
    }
  }
  const cells = yield* geoDb("engine brand mentions query failed", () =>
    queryGeoCheckEngineBrandMentions(
      checkScope,
      checkWindow,
      Array.from(brands, ([key, name]) => ({ key, name }))
    )
  );

  const response: GeoCompetitorEngineMatrixResponse = {
    configured: true,
    engines,
    cells,
  };
  return response;
});

export const loadGeoCompetitorDetail = Effect.fn("geo.competitorDetail")(
  function* (
    input: GeoScopeInput,
    brand: string,
    window: GeoWindowInput,
    summaryOnly = false
  ) {
    const scope = yield* resolveGeoScope(input);
    const resolvedWindow =
      toGeoCheckWindow(window) ??
      toGeoCheckWindow({ days: GEO_COMPETITOR_DETAIL_DAYS });

    const checkScope = geoCheckScope(scope);
    const settingsRow = yield* loadScopeSettingsRow(scope.projectId);
    const own = isGeoOwnBrandName(
      brand,
      settingsRow?.companyName,
      settingsRow?.aliases ?? []
    );
    const tracked =
      own || !scope.projectId
        ? []
        : yield* loadCompetitorsByProject(scope.projectId);
    const brandKeys = competitorBrandFoldKeys(brand, tracked);
    if (summaryOnly) {
      const summary = yield* geoDb("competitor summary query failed", () =>
        queryGeoCheckCompetitorPromptSummary(
          checkScope,
          brandKeys,
          resolvedWindow,
          own
        )
      );
      const response: GeoCompetitorDetailResponse = {
        configured: true,
        points: [],
        prompts: [],
        summary: {
          answers: summary.answers,
          prompts: summary.prompts,
          engines: new Set(summary.engineIds.map(engineFamilyOf)).size,
          ownMentioned: summary.ownMentioned,
        },
      };
      return response;
    }

    const [timeseries, prompts] = yield* Effect.all(
      [
        geoDb("competitor timeseries query failed", () =>
          queryGeoCheckCompetitorTimeseries(
            checkScope,
            brandKeys,
            resolvedWindow,
            own
          )
        ),
        geoDb("competitor prompts query failed", () =>
          queryGeoCheckCompetitorPrompts(
            checkScope,
            brandKeys,
            resolvedWindow,
            own
          )
        ),
      ],
      { concurrency: "unbounded" }
    );

    const response: GeoCompetitorDetailResponse = {
      configured: true,
      points: timeseries.map((row) => ({
        day: row.day,
        mentions: row.mentions,
        checks: row.checks,
      })),
      prompts: prompts.map((row) => ({
        promptId: row.promptId,
        prompt: row.prompt,
        engine: row.engine,
        capturedAt: row.capturedAt.toISOString(),
        mentioned: row.mentioned,
        position: row.position,
      })),
    };
    return response;
  }
);

function toGeoTrafficSources(
  rows: readonly GeoTrafficOverviewRow[] | undefined
): GeoTrafficSource[] {
  return (rows ?? []).map((row) => ({
    source: row.source,
    visitorType: toGeoVisitorType(row.visitor_type),
    agent: row.agent,
    category: row.category,
    confidence: row.confidence,
    visits: Number(row.visits),
    ...(row.previous_visits == null
      ? {}
      : { previousVisits: Number(row.previous_visits) }),
    markdownVisits: Number(row.markdown_visits),
    ...(row.previous_markdown_visits == null
      ? {}
      : { previousMarkdownVisits: Number(row.previous_markdown_visits) }),
    paths: Number(row.paths),
    ...(row.previous_paths == null
      ? {}
      : { previousPaths: Number(row.previous_paths) }),
    lastSeenAt: row.last_seen_at,
  }));
}

function isAiVisitorSource(row: GeoTrafficSource): boolean {
  return row.visitorType === "crawler" || row.visitorType === "ai_referral";
}

const aiTrafficParams = Effect.fn("geo.aiTrafficParams")(function* (
  input: GeoScopeInput,
  window: GeoWindowInput,
  hosts: readonly string[],
  siteId: string,
  path: string,
  sites: GeoTrafficSitesMode | undefined
) {
  const scope = yield* resolveGeoScope(input);
  const params = {
    ...geoScopeParams(scope),
    ...geoHiddenSourceParams(),
    ...geoTrafficWindowParams(window, AI_TRAFFIC_DEFAULT_DAYS),
    hosts: hosts.join(","),
    path,
    sites: sites ?? "",
    ...(siteId
      ? { site_id: siteId, project_id: "", include_unassigned: 0 }
      : {}),
  };
  return { scope, params };
});

/**
 * Totals, chart points and per-source visits. `withPaths: false` skips the
 * distinct page counts, which cost far more than the rest of the query; read
 * them separately with loadAiTrafficSources.
 */
export const loadAiTraffic = Effect.fn("geo.aiTraffic")(function* (
  input: GeoScopeInput,
  window: GeoWindowInput,
  hosts: readonly string[] = [],
  siteId = "",
  path = "",
  sites: GeoTrafficSitesMode | undefined = undefined,
  withPaths = true
) {
  const { scope, params } = yield* aiTrafficParams(
    input,
    window,
    hosts,
    siteId,
    path,
    sites
  );
  const settingsRow = yield* loadScopeSettingsRow(scope.projectId);
  const conversionPaths = settingsRow?.conversionPaths ?? [];
  const query = siteId && isTinybirdConfigured() ? geoRequiredQuery : geoQuery;

  const [overview, timeseries, conversionPages] = yield* Effect.all(
    [
      query("traffic overview query failed", () =>
        queryGeoTrafficOverview({ ...params, with_paths: withPaths ? 1 : 0 })
      ),
      query("traffic timeseries query failed", () =>
        queryGeoTrafficTimeseries(params)
      ),
      conversionPaths.length === 0
        ? Effect.succeed(null)
        : query("traffic conversion pages query failed", () =>
            queryGeoTrafficPages({
              ...params,
              limit: AI_TRAFFIC_PAGES_FETCH_LIMIT,
              visitor: "ai_referral",
            })
          ),
    ],
    { concurrency: "unbounded" }
  );
  const conversionTotals =
    conversionPaths.length === 0
      ? null
      : sumConversionVisits(
          (conversionPages?.data ?? []).map((row) => ({
            path: row.path,
            visits: Number(row.visits),
            ...(row.previous_visits == null
              ? {}
              : { previousVisits: Number(row.previous_visits) }),
          })),
          conversionPaths
        );

  const sources = toGeoTrafficSources(overview?.data);

  const response: AiTrafficResponse = {
    configured: isTinybirdConfigured(),
    totals: toGeoTrafficTotals(sources, conversionTotals?.conversions ?? null),
    previousConversions: conversionTotals?.previousConversions ?? null,
    sources: sources.filter(isAiVisitorSource),
    points: (timeseries?.data ?? []).map((row) => ({
      day: row.day,
      visitorType: toGeoVisitorType(row.visitor_type),
      source: row.source ?? "",
      visits: Number(row.visits),
    })),
  };
  return response;
});

/** Per-source visits with distinct page counts, for the sources table. */
export const loadAiTrafficSources = Effect.fn("geo.aiTrafficSources")(
  function* (
    input: GeoScopeInput,
    window: GeoWindowInput,
    hosts: readonly string[] = [],
    path = "",
    sites: GeoTrafficSitesMode | undefined = undefined
  ) {
    const { params } = yield* aiTrafficParams(
      input,
      window,
      hosts,
      "",
      path,
      sites
    );
    const overview = yield* geoQuery("traffic sources query failed", () =>
      queryGeoTrafficOverview({ ...params, with_paths: 1 })
    );
    const response: AiTrafficSourcesResponse = {
      configured: isTinybirdConfigured(),
      sources: toGeoTrafficSources(overview?.data).filter(isAiVisitorSource),
    };
    return response;
  }
);

export const loadGeoTrafficLog = Effect.fn("geo.trafficLog")(function* (
  input: GeoScopeInput,
  limit: number | undefined,
  visitorTypes: readonly string[] | undefined,
  categories: readonly string[] | undefined,
  host: string | undefined,
  path = "",
  sites: GeoTrafficSitesMode | undefined = undefined
) {
  const scope = yield* resolveGeoScope(input);
  const rows = yield* geoQuery("traffic log query failed", () =>
    queryGeoTrafficLog({
      ...geoScopeParams(scope),
      ...geoHiddenSourceParams(),
      limit: limit ?? AI_TRAFFIC_DEFAULT_LOG_LIMIT,
      visitor_type: visitorTypes?.join(",") ?? "",
      category: categories?.join(",") ?? "",
      host: trafficLogHostFilter(host),
      path,
      sites: sites ?? "",
    })
  );
  const log = (rows?.data ?? []).map(toGeoTrafficLogEntry);

  const response: GeoTrafficLogResponse = {
    configured: isTinybirdConfigured(),
    log,
    total: log.length,
  };
  return response;
});

export const loadGeoTrafficJourneys = Effect.fn("geo.trafficJourneys")(
  function* (
    input: GeoScopeInput,
    window: GeoWindowInput,
    limit: number | undefined
  ) {
    const scope = yield* resolveGeoScope(input);
    const journeys = yield* geoQuery("traffic journeys query failed", () =>
      queryGeoTrafficJourneys({
        ...geoScopeParams(scope),
        ...geoHiddenSourceParams(),
        ...geoTrafficWindowParams(window, AI_TRAFFIC_DEFAULT_DAYS),
        limit: limit ?? AI_TRAFFIC_DEFAULT_JOURNEYS_LIMIT,
      })
    );

    const response: GeoTrafficJourneysResponse = {
      configured: isTinybirdConfigured(),
      journeys: (journeys?.data ?? []).map((row) => ({
        journeyId: row.journey_id,
        source: row.source,
        visitorType: toGeoVisitorType(row.visitor_type),
        pages: Number(row.pages),
        distinctPaths: Number(row.distinct_paths),
        firstSeenAt: row.first_seen_at,
        lastSeenAt: row.last_seen_at,
        entryPath: row.entry_path ?? row.sample_paths[0] ?? "",
        samplePaths: row.sample_paths,
      })),
    };
    return response;
  }
);

function toJourneyDailyPoints(
  days: readonly string[],
  counts: readonly (number | string)[]
): GeoJourneyDailyPoint[] {
  return days.map((day, index) => ({
    day,
    journeys: Number(counts[index] ?? 0),
  }));
}

function journeyLastSeen(value: string): string | null {
  return value.startsWith(JOURNEY_EPOCH_PREFIX) ? null : value;
}

const JOURNEY_EPOCH_PREFIX = "1970-01-01";

export const loadGeoJourneyStats = Effect.fn("geo.journeyStats")(function* (
  input: GeoScopeInput,
  window: GeoWindowInput
) {
  const scope = yield* resolveGeoScope(input);
  const params = {
    ...geoScopeParams(scope),
    ...geoHiddenSourceParams(),
    ...geoTrafficWindowParams(window, AI_TRAFFIC_DEFAULT_DAYS),
  };
  const [sources, pages] = yield* Effect.all(
    [
      geoQuery("journey sources query failed", () =>
        queryGeoJourneySources(params)
      ),
      geoQuery("journey pages query failed", () =>
        queryGeoJourneyPages({ ...params, limit: GEO_JOURNEY_PAGES_LIMIT })
      ),
    ],
    { concurrency: "unbounded" }
  );
  const pageRows = pages?.data ?? [];

  const response: GeoJourneyStatsResponse = {
    configured: isTinybirdConfigured(),
    sources: (sources?.data ?? []).map((row) => ({
      source: row.source,
      visitorType: toGeoVisitorType(row.visitor_type),
      journeys: Number(row.journeys),
      previousJourneys: Number(row.previous_journeys),
      pages: Number(row.pages),
      singleFetch: Number(row.single_fetch),
      deepCrawls: Number(row.deep_crawls),
      lastSeenAt: journeyLastSeen(row.last_seen_at),
      daily: toJourneyDailyPoints(row.days, row.daily_journeys),
    })),
    pages: pageRows
      .filter((row) => Number(row.journeys) > 0)
      .map((row) => ({
        path: row.path,
        journeys: Number(row.journeys),
        previousJourneys: Number(row.previous_journeys),
        entries: Number(row.entries),
        lastSeenAt: journeyLastSeen(row.last_seen_at),
        daily: toJourneyDailyPoints(row.days, row.daily_journeys),
      })),
    totalPages: Number(pageRows[0]?.total_paths ?? 0),
    previousTotalPages: Number(pageRows[0]?.previous_total_paths ?? 0),
  };
  return response;
});

export const loadGeoJourneyDetail = Effect.fn("geo.journeyDetail")(function* (
  input: GeoScopeInput,
  journeyId: string,
  window: GeoWindowInput
) {
  const scope = yield* resolveGeoScope(input);
  const detail = yield* geoQuery("journey detail query failed", () =>
    queryGeoJourneyDetail({
      ...geoScopeParams(scope),
      ...geoHiddenSourceParams(),
      journey_id: journeyId,
      ...geoTrafficWindowParams(window, AI_TRAFFIC_DEFAULT_DAYS),
      limit: GEO_JOURNEY_DETAIL_LIMIT,
    })
  );

  const response: GeoJourneyDetailResponse = {
    configured: isTinybirdConfigured(),
    events: (detail?.data ?? []).map((row) => ({
      capturedAt: row.captured_at,
      path: row.path,
      host: row.host,
      method: row.method,
      referer: row.referer,
      country: row.country,
      agent: row.agent,
      category: row.category,
    })),
  };
  return response;
});

export const loadGeoTrafficPages = Effect.fn("geo.trafficPages")(function* (
  input: GeoScopeInput,
  window: GeoWindowInput,
  limit: number | undefined,
  visitorType: string | undefined,
  host: string | undefined,
  path = "",
  sites: GeoTrafficSitesMode | undefined = undefined
) {
  const scope = yield* resolveGeoScope(input);
  const pages = yield* geoQuery("traffic pages query failed", () =>
    queryGeoTrafficPages({
      ...geoScopeParams(scope),
      ...geoHiddenSourceParams(),
      ...geoTrafficWindowParams(window, AI_TRAFFIC_DEFAULT_DAYS),
      limit: limit ?? AI_TRAFFIC_DEFAULT_PAGES_LIMIT,
      visitor: visitorType ?? "",
      host: trafficLogHostFilter(host),
      path,
      sites: sites ?? "",
    })
  );

  const response: GeoTrafficPagesResponse = {
    configured: isTinybirdConfigured(),
    pages: (pages?.data ?? []).map((row) => ({
      host: row.host ?? "",
      path: row.path,
      source: row.source,
      visitorType: toGeoVisitorType(row.visitor_type),
      visits: Number(row.visits),
      ...(row.previous_visits != null
        ? { previousVisits: Number(row.previous_visits) }
        : {}),
      lastSeenAt: row.last_seen_at,
    })),
  };
  return response;
});

export const listGeoPrompts = Effect.fn("geo.promptsList")(function* (
  input: GeoScopeInput
) {
  const scope = yield* resolveGeoScope(input);
  if (!scope.projectId) {
    const emptyResponse: GeoTrackedPromptsResponse = {
      configured: isTinybirdConfigured(),
      prompts: [],
    };
    return emptyResponse;
  }

  const projectId = scope.projectId;
  const [customRows, settingsRow, brand] = yield* Effect.all(
    [
      geoDb("prompts lookup failed", () =>
        db.query.geoPrompts.findMany({
          where: eq(geoPrompts.projectId, projectId),
          orderBy: [desc(geoPrompts.createdAt)],
        })
      ),
      geoDb("settings lookup failed", () => findGeoSettingsRow(projectId)),
      loadGeoProjectBrand({ organizationId: scope.organizationId, projectId }),
    ],
    { concurrency: "unbounded" }
  );

  const prompts: GeoTrackedPrompt[] = customRows.map(toTrackedPrompt);

  if (!settingsRow) {
    const emptyResponse: GeoTrackedPromptsResponse = {
      configured: isTinybirdConfigured(),
      prompts,
    };
    return emptyResponse;
  }

  const catalog = yield* loadGeoModelCatalog(scope.organizationId);
  const autoPrompts = toAutoTrackedPrompts(
    buildGeoPrompts(
      toGeoSettings(settingsRow, catalog),
      brand
        ? {
            companyDescription: brand.companyDescription,
            audience: brand.audience,
          }
        : null
    ),
    settingsRow.pausedAutoPromptIds,
    settingsRow.removedAutoPromptIds
  );
  prompts.push(...autoPrompts);

  const response: GeoTrackedPromptsResponse = {
    configured: isTinybirdConfigured(),
    prompts,
  };
  return response;
});

const createPromptInTransaction = Effect.fn("geo.promptsCreateTx")(function* (
  tx: DbTransaction,
  organizationId: string,
  projectId: string,
  prompt: string,
  id?: string,
  tags: readonly string[] = []
) {
  yield* lockGeoProject(tx, projectId);
  const duplicate = yield* geoDb("prompt lookup failed", () =>
    tx.query.geoPrompts.findFirst({
      columns: { id: true },
      where: and(
        eq(geoPrompts.projectId, projectId),
        sql`lower(trim(${geoPrompts.prompt})) = ${promptKey(prompt)}`
      ),
    })
  );
  if (duplicate) {
    return null;
  }
  const rows = yield* geoDb("prompt create failed", () =>
    tx
      .insert(geoPrompts)
      .values({
        id: id ?? crypto.randomUUID(),
        organizationId,
        projectId,
        prompt,
        tags: normalizePromptTags(tags),
      })
      .returning()
  );
  return rows.at(0) ?? null;
});

export const createGeoPrompt = Effect.fn("geo.promptsCreate")(function* (
  input: GeoScopeInput,
  prompt: string,
  id?: string,
  tags: readonly string[] = []
) {
  const scope = yield* requireGeoProject(input);
  const row = yield* geoTransaction("prompt create failed", (tx) =>
    createPromptInTransaction(
      tx,
      scope.organizationId,
      scope.projectId,
      prompt,
      id,
      tags
    )
  );

  if (!row) {
    return yield* Effect.fail(new GeoPromptDuplicateError({ prompt }));
  }

  yield* pickNewGeoPrompts(input, [customPromptScanId(row.id)]).pipe(
    geoSkip("prompt translation pick failed")
  );
  return toTrackedPrompt(row);
});

const insertPromptsInTransaction = Effect.fn("geo.promptsInsertTx")(function* (
  tx: DbTransaction,
  organizationId: string,
  projectId: string,
  entries: readonly GeoPromptInsert[]
) {
  yield* lockGeoProject(tx, projectId);
  const existing = yield* geoDb("prompts lookup failed", () =>
    tx.query.geoPrompts.findMany({
      columns: { prompt: true },
      where: eq(geoPrompts.projectId, projectId),
    })
  );
  const seen = new Set(existing.map((row) => promptKey(row.prompt)));
  const values = entries.flatMap((entry) => {
    const prompt = entry.prompt.trim();
    const key = promptKey(prompt);
    if (prompt.length === 0 || seen.has(key)) {
      return [];
    }
    seen.add(key);
    return [
      {
        id: crypto.randomUUID(),
        organizationId,
        projectId,
        prompt,
        title: entry.title ?? null,
        enabled: entry.enabled ?? true,
      },
    ];
  });

  if (values.length === 0) {
    const none: GeoInsertedPrompt[] = [];
    return none;
  }
  const rows = yield* geoDb("prompts insert failed", () =>
    tx
      .insert(geoPrompts)
      .values(values)
      .returning({ id: geoPrompts.id, prompt: geoPrompts.prompt })
  );
  const inserted: GeoInsertedPrompt[] = rows;
  return inserted;
});

export { insertPromptsInTransaction, reconcileCompetitorsInTransaction };

export const insertGeoPrompts = Effect.fn("geo.promptsInsert")(function* (
  input: GeoScopeInput,
  entries: readonly GeoPromptInsert[]
) {
  const scope = yield* requireGeoProject(input);
  return yield* geoTransaction("prompts insert failed", (tx) =>
    insertPromptsInTransaction(
      tx,
      scope.organizationId,
      scope.projectId,
      entries
    )
  );
});

export const importGeoPrompts = Effect.fn("geo.promptsImport")(function* (
  input: GeoScopeInput,
  rows: readonly GeoPromptImportRow[]
) {
  const inserted = yield* insertGeoPrompts(input, rows);
  yield* pickNewGeoPrompts(
    input,
    inserted.map((row) => customPromptScanId(row.id))
  ).pipe(geoSkip("prompt translation pick failed"));

  const result: GeoImportResult = {
    imported: inserted.length,
    updated: 0,
    skipped: rows.length - inserted.length,
  };
  return result;
});

function trackedAutoPrompt(
  promptId: string,
  enabled: boolean
): GeoTrackedPrompt {
  return {
    id: promptId,
    prompt: promptId,
    enabled,
    source: "auto",
    tags: [],
    createdAt: null,
  };
}

type AutoPromptPatchOutcome =
  | {
      status: "updated";
      pausedAutoPromptIds: string[];
      removedAutoPromptIds: string[];
    }
  | { status: "missing-settings" }
  | { status: "not-found" };

const patchAutoPromptInTransaction = Effect.fn("geo.promptsPatchAutoTx")(
  function* (
    tx: DbTransaction,
    organizationId: string,
    projectId: string,
    brandSettingsId: string,
    promptId: string,
    change: "pause" | "resume" | "remove"
  ) {
    yield* lockGeoProject(tx, projectId);
    const settingsRow = yield* geoDb("settings lookup failed", () =>
      tx.query.geoSettings.findFirst({
        columns: {
          companyName: true,
          aliases: true,
          promptLanguage: true,
          pausedAutoPromptIds: true,
          removedAutoPromptIds: true,
        },
        where: eq(geoSettings.projectId, projectId),
      })
    );
    if (!settingsRow) {
      const outcome: AutoPromptPatchOutcome = { status: "missing-settings" };
      return outcome;
    }
    if (settingsRow.removedAutoPromptIds.includes(promptId)) {
      const outcome: AutoPromptPatchOutcome = { status: "not-found" };
      return outcome;
    }
    const brand = yield* geoDb("brand lookup failed", () =>
      tx.query.brandSettings.findFirst({
        columns: { companyDescription: true, audience: true },
        where: and(
          eq(brandSettings.organizationId, organizationId),
          eq(brandSettings.id, brandSettingsId)
        ),
      })
    );
    const generatedIds = generatedAutoPromptIds(
      {
        companyName: settingsRow.companyName,
        aliases: settingsRow.aliases,
        promptLanguage: settingsRow.promptLanguage ?? undefined,
      },
      brand
        ? {
            companyDescription: brand.companyDescription,
            audience: brand.audience,
          }
        : null
    );
    if (!generatedIds.has(promptId)) {
      const outcome: AutoPromptPatchOutcome = { status: "not-found" };
      return outcome;
    }
    const next = applyAutoPromptChange(
      settingsRow.pausedAutoPromptIds,
      settingsRow.removedAutoPromptIds,
      promptId,
      change
    );
    yield* geoDb("auto prompt update failed", () =>
      tx
        .update(geoSettings)
        .set({
          pausedAutoPromptIds: next.pausedAutoPromptIds,
          removedAutoPromptIds: next.removedAutoPromptIds,
        })
        .where(eq(geoSettings.projectId, projectId))
    );
    const outcome: AutoPromptPatchOutcome = { status: "updated", ...next };
    return outcome;
  }
);

const patchAutoPromptSettings = Effect.fn("geo.promptsPatchAuto")(function* (
  organizationId: string,
  projectId: string,
  brandSettingsId: string,
  promptId: string,
  change: "pause" | "resume" | "remove"
) {
  const outcome = yield* geoTransaction("auto prompt update failed", (tx) =>
    patchAutoPromptInTransaction(
      tx,
      organizationId,
      projectId,
      brandSettingsId,
      promptId,
      change
    )
  );
  if (outcome.status === "missing-settings") {
    return yield* Effect.fail(new GeoSettingsMissingError({ organizationId }));
  }
  if (outcome.status === "not-found") {
    return yield* Effect.fail(new GeoPromptNotFoundError({ promptId }));
  }
  return outcome;
});

export const deleteGeoPrompt = Effect.fn("geo.promptsDelete")(function* (
  input: GeoScopeInput,
  promptId: string
) {
  const scope = yield* requireGeoProject(input);
  // Autopilot suggestions about this prompt have nothing left to act on.
  yield* geoDb("retire prompt suggestions failed", () =>
    db
      .update(geoPromptSuggestions)
      .set({ status: "dismissed" })
      .where(
        and(
          eq(geoPromptSuggestions.projectId, scope.projectId),
          eq(geoPromptSuggestions.targetPromptId, promptId),
          eq(geoPromptSuggestions.status, "pending")
        )
      )
  );
  const rows = yield* geoDb("prompt delete failed", () =>
    db
      .delete(geoPrompts)
      .where(
        and(
          eq(geoPrompts.id, promptId),
          eq(geoPrompts.organizationId, scope.organizationId),
          eq(geoPrompts.projectId, scope.projectId)
        )
      )
      .returning()
  );

  if (rows.at(0)) {
    yield* deleteGeoPromptTranslations(
      scope.projectId,
      customPromptScanId(promptId)
    );
    return { success: true };
  }
  if (!isGeoAutoPromptId(promptId)) {
    return yield* Effect.fail(new GeoPromptNotFoundError({ promptId }));
  }
  yield* patchAutoPromptSettings(
    scope.organizationId,
    scope.projectId,
    scope.brandSettingsId,
    promptId,
    "remove"
  );
  yield* deleteGeoPromptTranslations(scope.projectId, promptId);
  return { success: true };
});

export const updateGeoPrompt = Effect.fn("geo.promptsUpdate")(function* (
  input: GeoScopeInput,
  promptId: string,
  changes: GeoPromptUpdateChanges
) {
  const scope = yield* requireGeoProject(input);
  const set: { enabled?: boolean; tags?: string[] } = {};
  if (changes.enabled !== undefined) {
    set.enabled = changes.enabled;
  }
  if (changes.tags !== undefined) {
    set.tags = normalizePromptTags(changes.tags);
  }
  const rows = yield* geoDb("prompt update failed", () =>
    db
      .update(geoPrompts)
      .set(set)
      .where(
        and(
          eq(geoPrompts.id, promptId),
          eq(geoPrompts.organizationId, scope.organizationId),
          eq(geoPrompts.projectId, scope.projectId)
        )
      )
      .returning()
  );

  const row = rows.at(0);
  if (row) {
    return toTrackedPrompt(row);
  }
  if (changes.enabled === undefined || !isGeoAutoPromptId(promptId)) {
    return yield* Effect.fail(new GeoPromptNotFoundError({ promptId }));
  }
  yield* patchAutoPromptSettings(
    scope.organizationId,
    scope.projectId,
    scope.brandSettingsId,
    promptId,
    changes.enabled ? "resume" : "pause"
  );
  return trackedAutoPrompt(promptId, changes.enabled);
});

export const toggleGeoAutoPrompt = Effect.fn("geo.promptsToggleAuto")(
  function* (input: GeoScopeInput, promptId: string, enabled: boolean) {
    const scope = yield* requireGeoProject(input);
    if (!isGeoAutoPromptId(promptId)) {
      return yield* Effect.fail(new GeoPromptNotFoundError({ promptId }));
    }
    const next = yield* patchAutoPromptSettings(
      scope.organizationId,
      scope.projectId,
      scope.brandSettingsId,
      promptId,
      enabled ? "resume" : "pause"
    );
    const result: GeoAutoPromptToggleResult = {
      promptId,
      enabled,
      pausedAutoPromptIds: next.pausedAutoPromptIds,
    };
    return result;
  }
);

export const toggleGeoPrompt = Effect.fn("geo.promptsToggle")(function* (
  input: GeoScopeInput,
  promptId: string,
  enabled: boolean
) {
  const scope = yield* requireGeoProject(input);
  const rows = yield* geoDb("prompt toggle failed", () =>
    db
      .update(geoPrompts)
      .set({ enabled })
      .where(
        and(
          eq(geoPrompts.id, promptId),
          eq(geoPrompts.organizationId, scope.organizationId),
          eq(geoPrompts.projectId, scope.projectId)
        )
      )
      .returning()
  );

  const row = rows.at(0);
  if (row) {
    return toTrackedPrompt(row);
  }
  if (!isGeoAutoPromptId(promptId)) {
    return yield* Effect.fail(new GeoPromptNotFoundError({ promptId }));
  }
  yield* patchAutoPromptSettings(
    scope.organizationId,
    scope.projectId,
    scope.brandSettingsId,
    promptId,
    enabled ? "resume" : "pause"
  );
  return trackedAutoPrompt(promptId, enabled);
});

/**
 * `manual` is for a hand-started conversation or persona run: those stay
 * runnable while automatic scans are paused, so the enabled check is skipped.
 * Everything else (claim, billing, engine scoping, ZDR at planning) still
 * applies.
 */
export const startGeoScanScoped = Effect.fn("geo.startScanScoped")(function* (
  input: GeoScopeInput,
  promptIds?: readonly string[],
  engines?: readonly string[],
  manual = false,
  freeScan = false
) {
  const scope = yield* requireGeoProject(input);
  const projectId = scope.projectId;
  const row = yield* geoDb("settings lookup failed", () =>
    db.query.geoSettings.findFirst({
      columns: { id: true, enabled: true, engines: true },
      where: eq(geoSettings.projectId, projectId),
    })
  );

  if (!row) {
    return yield* Effect.fail(
      new GeoSettingsMissingError({ organizationId: scope.organizationId })
    );
  }

  const manualScope = manual && promptIds !== undefined;
  if (!(row.enabled || manualScope)) {
    return yield* Effect.fail(new GeoSettingsDisabledError({ projectId }));
  }

  if (engines) {
    const catalog = yield* loadGeoModelCatalog(scope.organizationId);
    if (scopeGeoScanEngines(catalog, row.engines ?? [], engines).length === 0) {
      return yield* Effect.fail(new GeoScanEnginesEmptyError({ projectId }));
    }
  }

  const denial = yield* findGeoScanBillingDenial(
    scope.organizationId,
    projectId
  );
  if (denial) {
    return yield* Effect.fail(
      new GeoWriterCreditsExhaustedError({
        message: describeContentBillingDenial(denial),
      })
    );
  }

  const claim = yield* claimGeoScanRun(projectId);
  if (!claim) {
    return yield* Effect.fail(new GeoScanAlreadyRunningError({ projectId }));
  }

  return yield* startClaimedGeoScanRun(
    scope.organizationId,
    projectId,
    claim.claimedAt,
    promptIds,
    engines,
    manualScope,
    freeScan
  );
});

export const startGeoScan = Effect.fn("geo.startScan")(function* (
  input: GeoScanStartInput
) {
  return yield* startGeoScanScoped(input, undefined, input.engines);
});

export const startGeoPromptRescan = Effect.fn("geo.rescanPrompt")(function* (
  input: GeoPromptRescanInput
) {
  const { prompts } = yield* listGeoPrompts(input);
  const prompt = prompts.find(
    (candidate) =>
      candidate.enabled &&
      (candidate.id === input.promptId ||
        customPromptScanId(candidate.id) === input.promptId)
  );
  if (!prompt) {
    return yield* Effect.fail(
      new GeoPromptNotFoundError({ promptId: input.promptId })
    );
  }
  return yield* startGeoScanScoped(input, [prompt.id], input.engines);
});

export const loadGeoScanStatus = Effect.fn("geo.scanStatus")(function* (
  input: GeoScopeInput,
  scanId: string
) {
  const scope = yield* requireGeoProject(input);
  yield* sweepStaleGeoScanRows(scope);
  const scan = yield* geoDb("scan status lookup failed", () =>
    db.query.geoScans.findFirst({
      columns: { id: true, status: true, startedAt: true, finishedAt: true },
      where: and(
        eq(geoScans.id, scanId),
        eq(geoScans.projectId, scope.projectId),
        eq(geoScans.organizationId, scope.organizationId)
      ),
    })
  );
  return scan
    ? {
        ...scan,
        startedAt: scan.startedAt.toISOString(),
        finishedAt: scan.finishedAt?.toISOString() ?? null,
      }
    : null;
});
