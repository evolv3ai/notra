"use client";

import { AGENT_READINESS_POLL_INTERVAL_MS } from "@notra/geo-core/constants/agent-readiness";
import {
  GEO_BRAND_SEARCH_MIN_QUERY_LENGTH,
  GEO_BRAND_SEARCH_STALE_MS,
  GEO_LIVE_FALLBACK_INTERVAL_MS,
  GEO_LIVE_SCAN_FALLBACK_INTERVAL_MS,
  GEO_MODEL_CATALOG_STALE_MS,
  GEO_SCAN_POLL_INTERVAL_MS,
  GEO_START_SCAN_MUTATION_KEY,
  GEO_TRAFFIC_LIVE_INTERVAL_MS,
} from "@notra/geo-core/constants/geo";
import type { AgentReadinessResponse } from "@notra/geo-core/types/agent-readiness";
import type {
  AiTrafficResponse,
  WebAnalyticsResponse,
  GeoBrandSearchResponse,
  GeoChangesResponse,
  GeoCompetitorDetailResponse,
  GeoCompetitorEngineMatrixResponse,
  GeoCompetitorShareResponse,
  GeoCompetitorSuggestionsResponse,
  GeoDiscoverWebsiteResult,
  GeoJourneyDetailResponse,
  GeoLanguageShareResponse,
  GeoOnboardingBrandInput,
  GeoOnboardingBrandResult,
  GeoOverviewResponse,
  GeoIngestSetupResponse,
  GeoPromptHistoryResponse,
  GeoPromptResultSummariesResponse,
  GeoPromptRescanInput,
  GeoSequenceResultsResponse,
  GeoSettingsResponse,
  GeoSettingsUpsertInput,
  GeoTimeseriesResponse,
  GeoJourneyStatsResponse,
  GeoTrafficJourneysResponse,
  GeoTrafficLogFilters,
  GeoTrafficLogResponse,
  GeoTrafficPagesResponse,
  GeoTrafficSitesMode,
  AiTrafficSourcesResponse,
} from "@notra/geo-core/types/geo";
import type {
  GeoCompetitorImportRow,
  GeoPromptImportRow,
} from "@notra/geo-core/types/geo-import";
import type {
  GeoSearchConsoleStatus,
  GscKeywordsResponse,
  GscSelectSiteInput,
  GscSitesResponse,
  GscSyncResult,
} from "@notra/geo-core/types/google-search-console";
import { isGeoOlostepEngine } from "@notra/geo-core/utils/geo-olostep";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import type { QueryClient } from "@tanstack/react-query";
import {
  keepPreviousData,
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useEffectEvent, useRef } from "react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { useGeoLive } from "@/components/providers/geo-live-provider";
import { useGeoProjectScope } from "@/components/providers/geo-project-provider";
import { GEO_COMPETITOR_DETAIL_QUERY_KEY } from "@/constants/geo-competitors";
import {
  trackFirstScanCompleted,
  trackFirstScanStarted,
} from "@/lib/analytics/first-scan";
import { trackEvent } from "@/lib/analytics/posthog-client";
import { emitAutumnRefresh } from "@/lib/billing/autumn-refresh";
import { geoDbOrgQueryKey, geoDbQueryKey } from "@/lib/db/geo-collections";
import { usePathname, useRouter, useSearchParams } from "@/lib/navigation";
import type { GeoScanTrigger } from "@/types/analytics/geo-events";
import type {
  GeoGenerateFromWebsiteInput,
  GeoPromptSuggestionsResponse,
  GeoPromptTableRow,
  GeoRangeQuery,
  GeoSettingsUpsertOptions,
  GeoSuggestionIdInput,
  GeoTrafficLogQueryOptions,
  GscSyncResultMessage,
} from "@/types/geo";
import { loadCompetitorDetailView } from "@/utils/competitor-detail-chunk";
import { toErrorMessage } from "@/utils/error-message";
import { describeGeoImportResult } from "@/utils/geo-import";
import { withGeoProject } from "@/utils/geo-paths";
import {
  latestPromptResults,
  withoutSupersededNoSearchResults,
} from "@/utils/geo-prompt-history";
import {
  geoHostQueryInput,
  geoOverviewQueryInput,
  geoSettingsQueryInput,
  geoTrafficJourneysQueryInput,
  geoTrafficLogQueryInput,
  geoTrafficPagesQueryInput,
} from "@/utils/geo-query-input";
import { toGeoWindowInput } from "@/utils/geo-range";
import {
  invalidateGeoScanResultQueries,
  refreshSettingsAfterScanStart,
} from "@/utils/geo-scan-results";
import { formatGscSiteUrl } from "@/utils/gsc-site-url";
import { loadGeoPromptAnswerThread } from "@/utils/prompt-answer-thread-chunk";

import { dashboardOrpc } from "../orpc/query";
import { useScopedPreviousData } from "./use-scoped-previous-data";

const GSC_ANALYZE_MUTATION_KEY = "gsc-analyze" as const;

function gscAnalyzeMutationKey(organizationId: string, projectId?: string) {
  return [GSC_ANALYZE_MUTATION_KEY, organizationId, projectId] as const;
}

async function invalidateCompetitorQueries(
  queryClient: QueryClient,
  organizationId: string,
  projectId: string | undefined
) {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: dashboardOrpc.geo.promptTranslations.queryKey({
        input: { organizationId, projectId },
      }),
    }),
    queryClient.invalidateQueries({
      queryKey: dashboardOrpc.geo.competitors.queryKey({
        input: { organizationId, projectId },
      }),
    }),
    queryClient.invalidateQueries({
      queryKey: dashboardOrpc.geo.settings.queryKey({
        input: { organizationId, projectId },
      }),
    }),
    queryClient.invalidateQueries({
      queryKey: geoDbQueryKey("competitors", { organizationId, projectId }),
    }),
  ]);
}

async function invalidatePromptQueries(
  queryClient: QueryClient,
  organizationId: string,
  projectId: string | undefined
) {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: dashboardOrpc.geo.promptTranslations.queryKey({
        input: { organizationId, projectId },
      }),
    }),
    queryClient.invalidateQueries({
      queryKey: dashboardOrpc.geo.promptsList.queryKey({
        input: { organizationId, projectId },
      }),
    }),
    queryClient.invalidateQueries({
      queryKey: geoDbQueryKey("prompts", { organizationId, projectId }),
    }),
  ]);
}

function geoStartScanMutationKey(
  organizationId: string,
  projectId: string | undefined
) {
  return [GEO_START_SCAN_MUTATION_KEY, organizationId, projectId] as const;
}

export function useGeoModelCatalog(organizationId: string) {
  const tToast = useTranslations("geo.toasts");
  return useQuery({
    ...dashboardOrpc.geo.modelCatalog.queryOptions({
      input: { organizationId },
    }),
    enabled: !!organizationId,
    staleTime: GEO_MODEL_CATALOG_STALE_MS,
    meta: { errorMessage: tToast("loadModelCatalogFailed") },
  });
}

export function useGeoSettings(organizationId: string) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  const queryClient = useQueryClient();
  const live = useGeoLive();
  const wasScanningRef = useRef<boolean | null>(null);
  const firstScanRunningRef = useRef(false);
  const scanPollInterval = live
    ? GEO_LIVE_SCAN_FALLBACK_INTERVAL_MS
    : GEO_SCAN_POLL_INTERVAL_MS;

  const query = useQuery<GeoSettingsResponse>({
    ...dashboardOrpc.geo.settings.queryOptions({
      input: geoSettingsQueryInput({ organizationId, projectId }),
    }),
    enabled: !!organizationId,
    refetchInterval: (current) =>
      current.state.data?.settings?.isScanning ? scanPollInterval : false,
    refetchIntervalInBackground: false,
    meta: { errorMessage: tToast("loadAIVisibilitySettingsFailed") },
  });

  const isScanning = query.data?.settings?.isScanning ?? false;
  const lastScanAt = query.data?.settings?.lastScanAt ?? null;

  useEffect(() => {
    const wasScanning = wasScanningRef.current;
    wasScanningRef.current = isScanning;
    if (isScanning && lastScanAt === null) {
      firstScanRunningRef.current = true;
    }
    if (wasScanning === true && !isScanning) {
      invalidateGeoScanResultQueries(queryClient, {
        organizationId,
        projectId,
      }).catch(() => undefined);
      if (firstScanRunningRef.current && lastScanAt !== null) {
        trackFirstScanCompleted(projectId ?? organizationId);
      }
      firstScanRunningRef.current = false;
    }
  }, [isScanning, lastScanAt, organizationId, projectId, queryClient]);

  return query;
}

export function useGeoSettingsUpsert(
  organizationId: string,
  options?: GeoSettingsUpsertOptions
) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GeoSettingsUpsertInput) =>
      dashboardOrpc.geo.settingsUpsert.call({
        ...input,
        organizationId,
        projectId,
      }),
    onSuccess: async () => {
      await invalidateCompetitorQueries(queryClient, organizationId, projectId);
      if (!options?.silentSuccess) {
        toast.success(tToast("aiVisibilitySettingsSaved"));
      }
    },
    onError: (error) => {
      trackEvent(POSTHOG_EVENTS.GEO_SETTINGS_SAVE_FAILED);
      toast.error(toErrorMessage(error, tToast("saveSettingsFailed")));
    },
  });
}

/**
 * Dismisses a suggested competitor (or restores it). The settings cache is
 * patched first so the suggestion leaves the list on click.
 */
export function useGeoCompetitorIgnore(organizationId: string) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  const queryClient = useQueryClient();
  const settingsKey = dashboardOrpc.geo.settings.queryKey({
    input: geoSettingsQueryInput({ organizationId, projectId }),
  });
  return useMutation({
    mutationFn: (input: { name: string; ignored: boolean }) =>
      dashboardOrpc.geo.competitorIgnore.call({
        ...input,
        organizationId,
        projectId,
      }),
    onMutate: async ({ name, ignored }) => {
      await queryClient.cancelQueries({ queryKey: settingsKey });
      const previous =
        queryClient.getQueryData<GeoSettingsResponse>(settingsKey);
      const settings = previous?.settings;
      if (settings) {
        const key = name.trim().toLowerCase();
        const rest = settings.ignoredCompetitors.filter(
          (entry) => entry !== key
        );
        queryClient.setQueryData<GeoSettingsResponse>(settingsKey, {
          ...previous,
          settings: {
            ...settings,
            ignoredCompetitors: ignored ? [...rest, key] : rest,
          },
        });
      }
      return { previous };
    },
    onError: (error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(settingsKey, context.previous);
      }
      toast.error(toErrorMessage(error, tToast("updateCompetitorFailed")));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: settingsKey }),
  });
}

export function useGeoSettingsEngineAdd(organizationId: string) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (engine: string) =>
      dashboardOrpc.geo.settingsEngineAdd.call({
        organizationId,
        projectId,
        engine,
      }),
    onSuccess: () =>
      invalidateCompetitorQueries(queryClient, organizationId, projectId),
    onError: (error) => {
      trackEvent(POSTHOG_EVENTS.GEO_SETTINGS_SAVE_FAILED);
      toast.error(toErrorMessage(error, tToast("addModelTrackingFailed")));
    },
  });
}

export function useGeoSettingsLanguageAdd(organizationId: string) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (language: string) =>
      dashboardOrpc.geo.settingsLanguageAdd.call({
        organizationId,
        projectId,
        language,
      }),
    onSuccess: () =>
      invalidateCompetitorQueries(queryClient, organizationId, projectId),
    onError: (error) => {
      trackEvent(POSTHOG_EVENTS.GEO_SETTINGS_SAVE_FAILED);
      toast.error(toErrorMessage(error, tToast("addLanguageTrackingFailed")));
    },
  });
}

export function useGeoOverview(
  organizationId: string,
  range?: GeoRangeQuery,
  enabled = true
) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  return useQuery<GeoOverviewResponse>({
    ...dashboardOrpc.geo.overview.queryOptions({
      input: geoOverviewQueryInput({ organizationId, projectId }, range),
    }),
    enabled: enabled && !!organizationId,
    placeholderData: keepPreviousData,
    meta: { errorMessage: tToast("loadAIVisibilityOverviewFailed") },
  });
}

export function useGeoTimeseries(
  organizationId: string,
  range?: GeoRangeQuery,
  enabled = true
) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  return useQuery<GeoTimeseriesResponse>({
    ...dashboardOrpc.geo.timeseries.queryOptions({
      input: { organizationId, projectId, ...toGeoWindowInput(range) },
    }),
    enabled: enabled && !!organizationId,
    placeholderData: keepPreviousData,
    meta: { errorMessage: tToast("loadAIVisibilityTrendFailed") },
  });
}

export function useGeoPromptResults(
  organizationId: string,
  range?: GeoRangeQuery,
  enabled = true
) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  return useQuery<GeoPromptResultSummariesResponse>({
    ...dashboardOrpc.geo.promptResultSummaries.queryOptions({
      input: { organizationId, projectId, ...toGeoWindowInput(range) },
    }),
    enabled: enabled && !!organizationId,
    placeholderData: keepPreviousData,
    meta: { errorMessage: tToast("loadPromptResultsFailed") },
  });
}

function geoPromptResultDetailQueryOptions(input: {
  organizationId: string;
  checkId: string;
}) {
  return {
    ...dashboardOrpc.geo.promptResultDetail.queryOptions({ input }),
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: () => dashboardOrpc.geo.promptResultDetail.call(input),
  };
}

export function useGeoPromptResultDetail(
  organizationId: string,
  checkId: string | null
) {
  return useQuery({
    ...geoPromptResultDetailQueryOptions({
      organizationId,
      checkId: checkId ?? "",
    }),
    enabled: Boolean(organizationId && checkId),
  });
}

/**
 * Warms a stored answer before it is shown. Shares the query key with
 * `useGeoPromptResultDetail`, so the switch reads from cache.
 */
export function usePrefetchGeoPromptResultDetail(organizationId: string) {
  const queryClient = useQueryClient();
  return (checkId: string | null | undefined) => {
    if (!organizationId || !checkId) {
      return;
    }
    void queryClient.prefetchQuery(
      geoPromptResultDetailQueryOptions({ organizationId, checkId })
    );
  };
}

/**
 * Warms what the prompt sheet needs first: its history and the answer it
 * opens on. Meant for pointer/focus intent on a prompt row.
 */
export function usePrefetchGeoPromptAnswer(organizationId: string) {
  const queryClient = useQueryClient();
  const { projectId } = useGeoProjectScope();
  const prefetchDetail = usePrefetchGeoPromptResultDetail(organizationId);
  return (row: GeoPromptTableRow) => {
    if (!organizationId) {
      return;
    }
    const promptId = row.results[0]?.promptId ?? row.id;
    void queryClient.prefetchQuery(
      dashboardOrpc.geo.promptHistory.queryOptions({
        input: { organizationId, projectId, promptId },
      })
    );
    prefetchDetail(
      withoutSupersededNoSearchResults(
        latestPromptResults(row.results, [], promptId, row.prompt)
      )[0]?.checkId
    );
    loadGeoPromptAnswerThread().catch(() => undefined);
  };
}

export function useGeoPromptHistory(
  organizationId: string,
  promptId: string,
  options: { enabled: boolean; scanId?: string }
) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  return useQuery<GeoPromptHistoryResponse>({
    ...dashboardOrpc.geo.promptHistory.queryOptions({
      input: {
        organizationId,
        projectId,
        promptId,
        ...(options.scanId ? { scanId: options.scanId } : {}),
      },
    }),
    enabled: options.enabled && !!organizationId && !!promptId,
    meta: { errorMessage: tToast("loadPromptHistoryFailed") },
  });
}

export function useGeoChanges(organizationId: string) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  return useQuery<GeoChangesResponse>({
    ...dashboardOrpc.geo.changes.queryOptions({
      input: { organizationId, projectId },
    }),
    enabled: !!organizationId,
    placeholderData: useScopedPreviousData<GeoChangesResponse>(projectId),
    meta: { errorMessage: tToast("loadScanChangesFailed") },
  });
}

export function useGeoCompetitorShare(
  organizationId: string,
  range?: GeoRangeQuery,
  summaryOnly = false,
  enabled = true
) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  return useQuery<GeoCompetitorShareResponse>({
    ...dashboardOrpc.geo.competitorShare.queryOptions({
      input: {
        organizationId,
        projectId,
        ...toGeoWindowInput(range),
        summaryOnly: summaryOnly || undefined,
      },
    }),
    enabled: enabled && !!organizationId,
    placeholderData: keepPreviousData,
    meta: { errorMessage: tToast("loadCompetitorShareFailed") },
  });
}

function competitorEngineMatrixOptions(
  organizationId: string,
  projectId: string | undefined,
  range?: GeoRangeQuery
) {
  return dashboardOrpc.geo.competitorEngineMatrix.queryOptions({
    input: { organizationId, projectId, ...toGeoWindowInput(range) },
  });
}

export function useGeoCompetitorEngineMatrix(
  organizationId: string,
  range?: GeoRangeQuery
) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  return useQuery<GeoCompetitorEngineMatrixResponse>({
    ...competitorEngineMatrixOptions(organizationId, projectId, range),
    enabled: !!organizationId,
    placeholderData: keepPreviousData,
    meta: { errorMessage: tToast("loadCompetitorShareFailed") },
  });
}

/** Starts the matrix query with the page instead of when its card mounts. */
export function usePrefetchGeoCompetitorEngineMatrix(
  organizationId: string,
  range?: GeoRangeQuery
) {
  const queryClient = useQueryClient();
  const { projectId } = useGeoProjectScope();
  const options = competitorEngineMatrixOptions(
    organizationId,
    projectId,
    range
  );
  const key = JSON.stringify(options.queryKey);
  const prefetch = useEffectEvent(() => {
    void queryClient.prefetchQuery(options);
  });
  useEffect(() => {
    if (organizationId) {
      prefetch();
    }
  }, [organizationId, key]);
}

export function useGeoCompetitorDetail(
  organizationId: string,
  brand: string | null,
  range?: GeoRangeQuery
) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  return useQuery<GeoCompetitorDetailResponse>({
    ...dashboardOrpc.geo.competitorDetail.queryOptions({
      input: {
        organizationId,
        projectId,
        brand: brand ?? "",
        ...toGeoWindowInput(range),
      },
    }),
    enabled: !!organizationId && !!brand,
    staleTime: Number.POSITIVE_INFINITY,
    meta: { errorMessage: tToast("loadCompetitorDetailFailed") },
  });
}

export function useGeoCompetitorPromptSummary(
  organizationId: string,
  brand: string | null
) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  return useQuery<GeoCompetitorDetailResponse>({
    ...dashboardOrpc.geo.competitorDetail.queryOptions({
      input: {
        organizationId,
        projectId,
        brand: brand ?? "",
        summaryOnly: true,
      },
    }),
    enabled: !!organizationId && !!brand,
    staleTime: Number.POSITIVE_INFINITY,
    meta: { errorMessage: tToast("loadCompetitorSummaryFailed") },
  });
}

function usePrefetchGeoCompetitorDetail(organizationId: string) {
  const queryClient = useQueryClient();
  const { projectId } = useGeoProjectScope();

  return (brand: string) => {
    if (!organizationId || brand.length === 0) {
      return;
    }
    return queryClient.prefetchQuery(
      dashboardOrpc.geo.competitorDetail.queryOptions({
        input: {
          organizationId,
          projectId,
          brand,
          ...toGeoWindowInput(undefined),
        },
      })
    );
  };
}

/**
 * Row navigation for competitor lists/charts. The aggregated "Other" slice
 * routes to the competitors index; every other brand opens the detail sheet
 * over the current page via `?competitor=` (and prefetches its detail query
 * on hover).
 */
export function useGeoCompetitorRowNavigation(
  organizationSlug: string | undefined,
  organizationId: string | undefined
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { projectId } = useGeoProjectScope();
  const prefetchDetail = usePrefetchGeoCompetitorDetail(organizationId ?? "");
  const indexHref = organizationSlug
    ? withGeoProject(`/${organizationSlug}/geo/competitors`, projectId)
    : null;

  const openRow = (brand: string, aggregate = false) => {
    if (!indexHref) {
      return;
    }
    if (aggregate) {
      router.push(indexHref);
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set(GEO_COMPETITOR_DETAIL_QUERY_KEY, brand);
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const prefetchRow = (brand: string, aggregate = false) => {
    if (!indexHref) {
      return;
    }
    if (aggregate) {
      router.prefetch(indexHref);
      return;
    }
    prefetchDetail(brand);
    loadCompetitorDetailView().catch(() => undefined);
  };

  return { openRow, prefetchRow };
}

export function useGeoLanguageShare(
  organizationId: string,
  range?: GeoRangeQuery,
  enabled = true
) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  return useQuery<GeoLanguageShareResponse>({
    ...dashboardOrpc.geo.languageShare.queryOptions({
      input: { organizationId, projectId, ...toGeoWindowInput(range) },
    }),
    enabled: enabled && !!organizationId,
    placeholderData: keepPreviousData,
    meta: { errorMessage: tToast("loadLanguagePerformanceFailed") },
  });
}

export function useGeoGenerateFromWebsite(organizationId: string) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GeoGenerateFromWebsiteInput) =>
      dashboardOrpc.geo.generateFromWebsite.call({
        ...input,
        organizationId,
        projectId,
      }),
    onSuccess: async () => {
      await Promise.all([
        invalidateCompetitorQueries(queryClient, organizationId, projectId),
        invalidatePromptQueries(queryClient, organizationId, projectId),
      ]);
      toast.success(tToast("geoTrackingGeneratedWebsite"));
    },
    onError: (error) => {
      toast.error(
        toErrorMessage(error, tToast("generateGEOTrackingWebsiteFailed"))
      );
    },
  });
}

export function useGeoImportPrompts(organizationId: string) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rows: GeoPromptImportRow[]) =>
      dashboardOrpc.geo.promptsImport.call({ organizationId, projectId, rows }),
    onSuccess: async (result) => {
      await invalidatePromptQueries(queryClient, organizationId, projectId);
      toast.success(
        describeGeoImportResult(result)
          .map((part) =>
            tToast(`importResult.${part.key}`, {
              kind: "prompts",
              count: part.count,
            })
          )
          .join(", ")
      );
    },
    onError: (error) => {
      toast.error(toErrorMessage(error, tToast("importPromptsFailed")));
    },
  });
}

export function useGeoImportCompetitors(organizationId: string) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rows: GeoCompetitorImportRow[]) =>
      dashboardOrpc.geo.competitorsImport.call({
        organizationId,
        projectId,
        rows,
      }),
    onSuccess: async (result) => {
      await invalidateCompetitorQueries(queryClient, organizationId, projectId);
      toast.success(
        describeGeoImportResult(result)
          .map((part) =>
            tToast(`importResult.${part.key}`, {
              kind: "competitors",
              count: part.count,
            })
          )
          .join(", ")
      );
    },
    onError: (error) => {
      toast.error(toErrorMessage(error, tToast("importCompetitorsFailed")));
    },
  });
}

export function useGeoDiscoverWebsite(
  organizationId: string,
  url: string | null,
  language?: string
) {
  return useQuery<GeoDiscoverWebsiteResult>({
    ...dashboardOrpc.geo.discoverWebsite.queryOptions({
      input: { organizationId, url: url ?? "", language },
    }),
    enabled: !!organizationId && url !== null,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
}

export function useGeoOnboardingBrand(organizationId: string) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  return useMutation({
    mutationFn: (
      input: Omit<GeoOnboardingBrandInput, "organizationId" | "projectId">
    ): Promise<GeoOnboardingBrandResult> =>
      dashboardOrpc.geo.onboardingBrand.call({
        ...input,
        organizationId,
        projectId,
      }),
    onError: (error) => {
      toast.error(toErrorMessage(error, tToast("saveBrandFailed")));
    },
  });
}

export function useGeoCompetitorSuggestions(
  organizationId: string,
  domain: string | null
) {
  const { projectId } = useGeoProjectScope();
  return useQuery<GeoCompetitorSuggestionsResponse>({
    ...dashboardOrpc.geo.competitorSuggestions.queryOptions({
      input: { organizationId, projectId, domain: domain ?? "" },
    }),
    enabled: !!organizationId && domain !== null,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
}

export function useGeoBrandSearch(organizationId: string, query: string) {
  const { projectId } = useGeoProjectScope();
  const trimmed = query.trim();
  return useQuery<GeoBrandSearchResponse>({
    ...dashboardOrpc.geo.brandSearch.queryOptions({
      input: { organizationId, projectId, query: trimmed },
    }),
    enabled:
      !!organizationId && trimmed.length >= GEO_BRAND_SEARCH_MIN_QUERY_LENGTH,
    staleTime: GEO_BRAND_SEARCH_STALE_MS,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useGeoStartScan(organizationId: string) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: geoStartScanMutationKey(organizationId, projectId),
    mutationFn: (
      input?: GeoScanTrigger | { trigger?: GeoScanTrigger; engines?: string[] }
    ) => {
      const payload =
        typeof input === "string" ? { trigger: input } : (input ?? {});
      return dashboardOrpc.geo.startScan.call({
        organizationId,
        projectId,
        trigger: payload.trigger,
        engines: payload.engines,
      });
    },
    onMutate: (input) => {
      const trigger = typeof input === "string" ? input : input?.trigger;
      const cached = queryClient.getQueryData<GeoSettingsResponse>(
        dashboardOrpc.geo.settings.queryKey({
          input: geoSettingsQueryInput({ organizationId, projectId }),
        })
      );
      return {
        trigger,
        firstScan:
          trigger === "onboarding" ||
          (cached !== undefined && !cached.settings?.lastScanAt),
      };
    },
    onSuccess: async (_output, _input, context) => {
      if (context?.firstScan) {
        trackFirstScanStarted(context.trigger);
      }
      await queryClient.invalidateQueries({
        queryKey: dashboardOrpc.geo.scanRun.key({
          input: { organizationId, projectId },
        }),
      });
      await refreshSettingsAfterScanStart(
        queryClient,
        organizationId,
        projectId
      );
    },
    onError: (error) => {
      toast.error(toErrorMessage(error, tToast("startScanFailed")));
    },
  });
}

export function useGeoStartFreeScan(organizationId: string) {
  const { projectId } = useGeoProjectScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: geoStartScanMutationKey(organizationId, projectId),
    mutationFn: () =>
      dashboardOrpc.geo.startFreeScan.call({ organizationId, projectId }),
    onSuccess: async (result) => {
      if (!result.started) {
        return;
      }
      trackFirstScanStarted("onboarding");
      emitAutumnRefresh();
      await refreshSettingsAfterScanStart(
        queryClient,
        organizationId,
        projectId
      );
    },
  });
}

export function useGeoRescanPrompt(organizationId: string) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: geoStartScanMutationKey(organizationId, projectId),
    mutationFn: (
      input: string | Pick<GeoPromptRescanInput, "promptId" | "engines">
    ) => {
      const payload = typeof input === "string" ? { promptId: input } : input;
      return dashboardOrpc.geo.rescanPrompt.call({
        organizationId,
        projectId,
        promptId: payload.promptId,
        engines: payload.engines ? [...payload.engines] : undefined,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: dashboardOrpc.geo.scanRun.key({
          input: { organizationId, projectId },
        }),
      });
      await refreshSettingsAfterScanStart(
        queryClient,
        organizationId,
        projectId
      );
    },
    onError: (error) => {
      toast.error(toErrorMessage(error, tToast("startRescanFailed")));
    },
  });
}

export function useIsGeoScanning(organizationId: string) {
  const { projectId } = useGeoProjectScope();
  const { data } = useGeoSettings(organizationId);
  const pendingCount = useIsMutating({
    mutationKey: geoStartScanMutationKey(organizationId, projectId),
  });
  return pendingCount > 0 || Boolean(data?.settings?.isScanning);
}

/**
 * Manual conversation and persona runs hand tracked consumer apps to a scan,
 * and a project runs one scan at a time. While one is in flight, another run
 * would be refused or would quietly skip its consumer apps, so the run
 * controls wait for it.
 */
export function useIsGeoConsumerRunBlocked(organizationId: string) {
  const { data } = useGeoSettings(organizationId);
  const isScanning = useIsGeoScanning(organizationId);
  return isScanning && (data?.settings?.engines ?? []).some(isGeoOlostepEngine);
}

export function useAgentReadiness(organizationId: string) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  return useQuery<AgentReadinessResponse>({
    ...dashboardOrpc.geo.agentReadiness.queryOptions({
      input: { organizationId, projectId },
    }),
    enabled: !!organizationId,
    refetchInterval: (query) =>
      query.state.data?.scan?.status === "running"
        ? AGENT_READINESS_POLL_INTERVAL_MS
        : false,
    refetchIntervalInBackground: false,
    meta: { errorMessage: tToast("loadAgentReadinessFailed") },
  });
}

export function useAgentReadinessScan(organizationId: string) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      dashboardOrpc.geo.agentReadinessScan.call({ organizationId, projectId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: dashboardOrpc.geo.agentReadiness.queryKey({
          input: { organizationId, projectId },
        }),
      });
    },
    onError: (error) => {
      toast.error(toErrorMessage(error, tToast("startScanFailed")));
    },
  });
}

function useGeoTrafficPollInterval(): number {
  return useGeoLive()
    ? GEO_LIVE_FALLBACK_INTERVAL_MS
    : GEO_TRAFFIC_LIVE_INTERVAL_MS;
}

export function useAiTraffic(
  organizationId: string,
  range?: GeoRangeQuery,
  host?: string,
  path?: string,
  sites?: GeoTrafficSitesMode
) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  const trafficPollInterval = useGeoTrafficPollInterval();
  return useQuery<AiTrafficResponse>({
    ...dashboardOrpc.geo.aiTraffic.queryOptions({
      input: geoHostQueryInput(
        { organizationId, projectId },
        range,
        host,
        path,
        sites
      ),
    }),
    enabled: !!organizationId,
    placeholderData: useScopedPreviousData<AiTrafficResponse>(projectId),
    refetchInterval: trafficPollInterval,
    refetchIntervalInBackground: false,
    meta: { errorMessage: tToast("loadAITrafficFailed") },
  });
}

/** Per-source page counts; slower than useAiTraffic, so the table fills them in. */
export function useAiTrafficSources(
  organizationId: string,
  range?: GeoRangeQuery,
  host?: string,
  path?: string,
  sites?: GeoTrafficSitesMode
) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  const trafficPollInterval = useGeoTrafficPollInterval();
  return useQuery<AiTrafficSourcesResponse>({
    ...dashboardOrpc.geo.aiTrafficSources.queryOptions({
      input: geoHostQueryInput(
        { organizationId, projectId },
        range,
        host,
        path,
        sites
      ),
    }),
    enabled: !!organizationId,
    placeholderData: useScopedPreviousData<AiTrafficSourcesResponse>(projectId),
    refetchInterval: trafficPollInterval,
    refetchIntervalInBackground: false,
    meta: { errorMessage: tToast("loadAITrafficFailed") },
  });
}

export function useWebAnalytics(
  organizationId: string,
  range?: GeoRangeQuery,
  host?: string,
  path?: string,
  sites?: GeoTrafficSitesMode
) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  const trafficPollInterval = useGeoTrafficPollInterval();
  return useQuery<WebAnalyticsResponse>({
    ...dashboardOrpc.geo.webAnalytics.queryOptions({
      input: geoHostQueryInput(
        { organizationId, projectId },
        range,
        host,
        path,
        sites
      ),
    }),
    enabled: !!organizationId,
    placeholderData: useScopedPreviousData<WebAnalyticsResponse>(projectId),
    refetchInterval: trafficPollInterval,
    refetchIntervalInBackground: false,
    meta: { errorMessage: tToast("loadVisitorsFailed") },
  });
}

/** Breakdown tables for useWebAnalytics; slower, so they fill in after the summary. */
export function useWebAnalyticsBreakdowns(
  organizationId: string,
  range?: GeoRangeQuery,
  host?: string,
  path?: string,
  sites?: GeoTrafficSitesMode
) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  const trafficPollInterval = useGeoTrafficPollInterval();
  return useQuery<WebAnalyticsResponse>({
    ...dashboardOrpc.geo.webAnalyticsBreakdowns.queryOptions({
      input: geoHostQueryInput(
        { organizationId, projectId },
        range,
        host,
        path,
        sites
      ),
    }),
    enabled: !!organizationId,
    placeholderData: useScopedPreviousData<WebAnalyticsResponse>(projectId),
    refetchInterval: trafficPollInterval,
    refetchIntervalInBackground: false,
    meta: { errorMessage: tToast("loadVisitorsFailed") },
  });
}

export function useGeoTrafficLog(
  organizationId: string,
  filters: GeoTrafficLogFilters,
  options?: GeoTrafficLogQueryOptions
) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  const trafficPollInterval = useGeoTrafficPollInterval();
  return useQuery<GeoTrafficLogResponse>({
    ...dashboardOrpc.geo.trafficLog.queryOptions({
      input: geoTrafficLogQueryInput(
        { organizationId, projectId },
        filters,
        options?.host,
        options?.path,
        options?.sites
      ),
    }),
    enabled: !!organizationId,
    placeholderData: useScopedPreviousData<GeoTrafficLogResponse>(projectId),
    refetchInterval: trafficPollInterval,
    refetchIntervalInBackground: false,
    meta: { errorMessage: tToast("loadAITrackingLogFailed") },
  });
}

export function useGeoTrafficPages(
  organizationId: string,
  range?: GeoRangeQuery,
  host?: string,
  path?: string,
  sites?: GeoTrafficSitesMode
) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  const trafficPollInterval = useGeoTrafficPollInterval();
  return useQuery<GeoTrafficPagesResponse>({
    ...dashboardOrpc.geo.trafficPages.queryOptions({
      input: geoTrafficPagesQueryInput(
        { organizationId, projectId },
        range,
        host,
        path,
        sites
      ),
    }),
    enabled: !!organizationId,
    placeholderData: useScopedPreviousData<GeoTrafficPagesResponse>(projectId),
    refetchInterval: trafficPollInterval,
    refetchIntervalInBackground: false,
    meta: { errorMessage: tToast("loadTopAIPagesFailed") },
  });
}

export function useGeoTrafficJourneys(
  organizationId: string,
  range?: GeoRangeQuery,
  enabled = true
) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  return useQuery<GeoTrafficJourneysResponse>({
    ...dashboardOrpc.geo.trafficJourneys.queryOptions({
      input: geoTrafficJourneysQueryInput({ organizationId, projectId }, range),
    }),
    enabled: enabled && !!organizationId,
    placeholderData: keepPreviousData,
    meta: { errorMessage: tToast("loadAIJourneysFailed") },
  });
}

export function useGeoJourneyStats(
  organizationId: string,
  range?: GeoRangeQuery,
  enabled = true
) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  return useQuery<GeoJourneyStatsResponse>({
    ...dashboardOrpc.geo.journeyStats.queryOptions({
      input: geoOverviewQueryInput({ organizationId, projectId }, range),
    }),
    enabled: enabled && !!organizationId,
    placeholderData: keepPreviousData,
    meta: {
      errorMessage: tToast("loadJourneyTrendsFailed"),
      showRetryAction: true,
    },
  });
}

export function useGeoJourneyDetail(
  organizationId: string,
  journeyId: string | null,
  range?: GeoRangeQuery
) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  return useQuery<GeoJourneyDetailResponse>({
    ...dashboardOrpc.geo.journeyDetail.queryOptions({
      input: {
        organizationId,
        projectId,
        journeyId: journeyId ?? "",
        ...toGeoWindowInput(range),
      },
    }),
    enabled: !!organizationId && !!journeyId,
    meta: { errorMessage: tToast("loadJourneyDetailFailed") },
  });
}

export function usePrefetchGeoJourneyDetail(organizationId: string) {
  const queryClient = useQueryClient();
  const { projectId } = useGeoProjectScope();

  return (journeyId: string) => {
    if (!organizationId || journeyId.length === 0) {
      return;
    }
    return queryClient.prefetchQuery(
      dashboardOrpc.geo.journeyDetail.queryOptions({
        input: {
          organizationId,
          projectId,
          journeyId,
          ...toGeoWindowInput(undefined),
        },
      })
    );
  };
}

export function useGeoIngestSetup(organizationId: string) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  return useQuery<GeoIngestSetupResponse>({
    ...dashboardOrpc.geo.ingestSetup.queryOptions({
      input: geoSettingsQueryInput({ organizationId, projectId }),
    }),
    enabled: !!organizationId,
    meta: { errorMessage: tToast("loadTrackingSetupFailed") },
  });
}

export function useGeoIngestTokenRotate(organizationId: string) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (): Promise<GeoIngestSetupResponse> =>
      dashboardOrpc.geo.ingestTokenRotate.call({ organizationId, projectId }),
    onSuccess: async (setup) => {
      queryClient.setQueryData(
        dashboardOrpc.geo.ingestSetup.queryKey({
          input: { organizationId, projectId },
        }),
        setup
      );
      await queryClient.invalidateQueries({
        queryKey: dashboardOrpc.geo.ingestSetup.queryKey({
          input: { organizationId, projectId },
        }),
      });
      toast.success(tToast("trackingTokenRotated"));
    },
    onError: (error) => {
      toast.error(toErrorMessage(error, tToast("rotateTokenFailed")));
    },
  });
}

export function useGeoRunSequence(organizationId: string) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  const queryClient = useQueryClient();
  // isPending only disables the run controls after a re-render, so two clicks
  // in the same frame would both fire. Claim the run synchronously instead.
  const inFlight = useRef(false);
  const mutation = useMutation({
    mutationFn: (sequenceId: string) =>
      dashboardOrpc.geo.sequenceRun.call({
        organizationId,
        projectId,
        sequenceId,
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: dashboardOrpc.geo.sequenceResults.key(),
      });
      const engineCount = result.engines.length;
      if (engineCount > 0) {
        toast.success(tToast("conversationPlayed", { count: engineCount }));
      }
      if (result.queuedScanId) {
        toast.success(tToast("consumerAppsQueued"));
        await refreshSettingsAfterScanStart(
          queryClient,
          organizationId,
          projectId
        );
      }
    },
    onError: (error) => {
      toast.error(toErrorMessage(error, tToast("runConversationFailed")));
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });
  const mutate: typeof mutation.mutate = (sequenceId, options) => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    mutation.mutate(sequenceId, options);
  };
  return { ...mutation, mutate };
}

export function useGeoSequenceResults(
  organizationId: string,
  sequenceId?: string
) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  return useQuery<GeoSequenceResultsResponse>({
    ...dashboardOrpc.geo.sequenceResults.queryOptions({
      input: { organizationId, projectId, sequenceId },
    }),
    enabled: Boolean(organizationId && sequenceId),
    meta: { errorMessage: tToast("loadConversationResultsFailed") },
  });
}

function describeSyncResult(result: GscSyncResult): GscSyncResultMessage {
  if (result.status === "failed") {
    return { key: "failed", count: 0 };
  }
  if (result.status !== "completed") {
    return { key: "skipped", count: 0 };
  }
  const added = result.suggestionsAdded ?? 0;
  if (added === 0) {
    return (result.keywords ?? 0) === 0
      ? { key: "noData", count: 0 }
      : { key: "noNewSuggestions", count: 0 };
  }
  return { key: "suggestionsAdded", count: added };
}

export function useGscStatus(organizationId: string) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  return useQuery<GeoSearchConsoleStatus>({
    ...dashboardOrpc.geo.searchConsoleStatus.queryOptions({
      input: { organizationId, projectId },
    }),
    enabled: !!organizationId,
    meta: { errorMessage: tToast("loadSearchConsoleStatusFailed") },
  });
}

export function useGscKeywords(organizationId: string, enabled = true) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  return useQuery<GscKeywordsResponse>({
    ...dashboardOrpc.geo.searchConsoleKeywords.queryOptions({
      input: { organizationId, projectId },
    }),
    enabled: !!organizationId && enabled,
    meta: { errorMessage: tToast("loadSearchConsoleKeywordsFailed") },
  });
}

export function useGscSites(organizationId: string, enabled: boolean) {
  const tToast = useTranslations("geo.toasts");
  return useQuery<GscSitesResponse>({
    ...dashboardOrpc.geo.searchConsoleSites.queryOptions({
      input: { organizationId },
    }),
    enabled: !!organizationId && enabled,
    meta: { errorMessage: tToast("loadSearchConsolePropertiesFailed") },
  });
}

function useInvalidateGscQueries(organizationId: string, projectId?: string) {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: dashboardOrpc.geo.searchConsoleStatus.queryKey({
          input: projectId ? { organizationId, projectId } : { organizationId },
        }),
      }),
      queryClient.invalidateQueries({
        queryKey: dashboardOrpc.geo.suggestionsList.queryKey({
          input: projectId ? { organizationId, projectId } : { organizationId },
        }),
      }),
      queryClient.invalidateQueries({
        queryKey: dashboardOrpc.geo.searchConsoleKeywords.queryKey({
          input: projectId ? { organizationId, projectId } : { organizationId },
        }),
      }),
    ]);
  };
}

export function useGscAnalyzing(organizationId: string): boolean {
  const { projectId } = useGeoProjectScope();
  return (
    useIsMutating({
      mutationKey: gscAnalyzeMutationKey(organizationId, projectId),
      exact: true,
    }) > 0
  );
}

export function useGscSelectSite(organizationId: string) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  const invalidate = useInvalidateGscQueries(organizationId, projectId);
  const toastId = `gsc-select-site:${organizationId}:${projectId ?? "default"}`;
  return useMutation({
    mutationKey: gscAnalyzeMutationKey(organizationId, projectId),
    mutationFn: (input: GscSelectSiteInput) =>
      dashboardOrpc.geo.searchConsoleSelectSite.call({
        ...input,
        organizationId,
        projectId,
      }),
    onMutate: (input) => {
      toast.loading(
        tToast("connectingProperty", {
          property: formatGscSiteUrl(input.siteUrl),
        }),
        {
          description: tToast("connectingPropertyDescription"),
          id: toastId,
        }
      );
    },
    onSuccess: async (result) => {
      await invalidate();
      const message = describeSyncResult(result);
      const notify = result.status === "failed" ? toast.error : toast.success;
      notify(
        tToast(`searchConsoleSync.${message.key}`, { count: message.count }),
        { description: null, id: toastId }
      );
    },
    onError: (error) => {
      toast.error(toErrorMessage(error, tToast("selectPropertyFailed")), {
        description: null,
        id: toastId,
      });
    },
  });
}

export function useGscSync(organizationId: string) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  const invalidate = useInvalidateGscQueries(organizationId, projectId);
  return useMutation({
    mutationKey: gscAnalyzeMutationKey(organizationId, projectId),
    mutationFn: () =>
      dashboardOrpc.geo.searchConsoleSync.call({ organizationId, projectId }),
    onSuccess: async (result) => {
      await invalidate();
      if (result.status === "failed") {
        const message = describeSyncResult(result);
        toast.error(
          tToast(`searchConsoleSync.${message.key}`, { count: message.count })
        );
      } else {
        const message = describeSyncResult(result);
        toast.success(
          tToast(`searchConsoleSync.${message.key}`, { count: message.count })
        );
      }
    },
    onError: (error) => {
      toast.error(toErrorMessage(error, tToast("syncSearchConsoleFailed")));
    },
  });
}

export function useGscDisconnect(organizationId: string) {
  const tToast = useTranslations("geo.toasts");
  const invalidate = useInvalidateGscQueries(organizationId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      dashboardOrpc.geo.searchConsoleDisconnect.call({ organizationId }),
    onSuccess: async () => {
      await Promise.all([
        invalidate(),
        queryClient.invalidateQueries({
          queryKey: dashboardOrpc.geo.searchConsoleSites.queryKey({
            input: { organizationId },
          }),
        }),
      ]);
      toast.success(tToast("googleSearchConsoleDisconnected"));
    },
    onError: (error) => {
      toast.error(toErrorMessage(error, tToast("disconnectFailed")));
    },
  });
}

export function useGeoSuggestions(organizationId: string) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  return useQuery<GeoPromptSuggestionsResponse>({
    ...dashboardOrpc.geo.suggestionsList.queryOptions({
      input: { organizationId, projectId },
    }),
    enabled: !!organizationId,
    meta: { errorMessage: tToast("loadPromptSuggestionsFailed") },
  });
}

function useInvalidateSuggestionQueries(organizationId: string) {
  const { projectId } = useGeoProjectScope();
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: dashboardOrpc.geo.suggestionsList.queryKey({
          input: { organizationId, projectId },
        }),
      }),
      queryClient.invalidateQueries({
        queryKey: dashboardOrpc.geo.promptsList.queryKey({
          input: { organizationId, projectId },
        }),
      }),
      queryClient.invalidateQueries({
        queryKey: dashboardOrpc.geo.writerGaps.queryKey({
          input: { organizationId, projectId },
        }),
      }),
      queryClient.invalidateQueries({
        queryKey: geoDbOrgQueryKey("prompts", organizationId),
      }),
    ]);
  };
}

export function useGeoSequencesGenerate(organizationId: string) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      dashboardOrpc.geo.sequencesGenerate.call({ organizationId, projectId }),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({
        queryKey: geoDbOrgQueryKey("sequences", organizationId),
      });
      const count = response.sequences.length;
      toast.success(tToast("conversationsAdded", { count }));
    },
    onError: (error) => {
      toast.error(toErrorMessage(error, tToast("generateConversationsFailed")));
    },
  });
}

export function useGeoSuggestionAccept(
  organizationId: string,
  onViewPrompt: (promptId: string) => void
) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  const invalidate = useInvalidateSuggestionQueries(organizationId);
  return useMutation({
    mutationFn: (input: GeoSuggestionIdInput) =>
      dashboardOrpc.geo.suggestionAccept.call({
        ...input,
        organizationId,
        projectId,
      }),
    onSuccess: async (prompt) => {
      await invalidate();
      toast.success(tToast("promptAddedTracking"), {
        description: tToast("trackedPromptNextScan"),
        action: {
          label: tToast("viewTrackedPrompt"),
          onClick: () => onViewPrompt(prompt.id),
        },
      });
    },
    onError: (error) => {
      toast.error(toErrorMessage(error, tToast("addPromptFailed")));
    },
  });
}

export function useGeoSuggestionsAcceptAll(
  organizationId: string,
  onViewPrompts: () => void
) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  const invalidate = useInvalidateSuggestionQueries(organizationId);
  return useMutation({
    mutationFn: () =>
      dashboardOrpc.geo.suggestionsAcceptAll.call({
        organizationId,
        projectId,
      }),
    onSuccess: async (result) => {
      await invalidate();
      toast.success(
        tToast("promptsAddedTracking", { count: result.accepted }),
        {
          description: tToast("trackedPromptNextScan"),
          action: {
            label: tToast("viewTrackedPrompt"),
            onClick: onViewPrompts,
          },
        }
      );
    },
    onError: (error) => {
      toast.error(toErrorMessage(error, tToast("addPromptsFailed")));
    },
  });
}

export function useGeoAutopilotPromptSuggestions(organizationId: string) {
  const { projectId } = useGeoProjectScope();
  return useQuery({
    ...dashboardOrpc.geo.autopilotPromptSuggestionsList.queryOptions({
      input: { organizationId, projectId },
    }),
    enabled: !!organizationId,
  });
}

/** Accepting pauses the prompt; dismissing keeps it and stops the suggestion. */
export function useGeoAutopilotPromptSuggestionAction(organizationId: string) {
  const t = useTranslations("geo.autopilotPromptSuggestions");
  const { projectId } = useGeoProjectScope();
  const queryClient = useQueryClient();
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: dashboardOrpc.geo.autopilotPromptSuggestionsList.queryKey({
          input: { organizationId, projectId },
        }),
      }),
      queryClient.invalidateQueries({
        queryKey: dashboardOrpc.geo.promptsList.queryKey({
          input: { organizationId, projectId },
        }),
      }),
      // The prompts table reads the geo-db collection, not the oRPC list.
      queryClient.invalidateQueries({
        queryKey: geoDbOrgQueryKey("prompts", organizationId),
      }),
    ]);
  return useMutation({
    mutationFn: async ({
      suggestionId,
      action,
    }: {
      suggestionId: string;
      action: "pause" | "keep";
    }) => {
      const input = { suggestionId, organizationId, projectId };
      if (action === "pause") {
        await dashboardOrpc.geo.suggestionAccept.call(input);
      } else {
        await dashboardOrpc.geo.suggestionDismiss.call(input);
      }
    },
    onSuccess: async (_, { action }) => {
      await invalidate();
      if (action === "pause") {
        toast.success(t("paused"));
      }
    },
    onError: (error, { action }) => {
      toast.error(
        toErrorMessage(
          error,
          action === "pause" ? t("pauseFailed") : t("keepFailed")
        )
      );
    },
  });
}

export function useGeoSuggestionDismiss(organizationId: string) {
  const tToast = useTranslations("geo.toasts");
  const { projectId } = useGeoProjectScope();
  const invalidate = useInvalidateSuggestionQueries(organizationId);
  return useMutation({
    mutationFn: (input: GeoSuggestionIdInput) =>
      dashboardOrpc.geo.suggestionDismiss.call({
        ...input,
        organizationId,
        projectId,
      }),
    onSuccess: async () => {
      await invalidate();
    },
    onError: (error) => {
      toast.error(toErrorMessage(error, tToast("dismissSuggestionFailed")));
    },
  });
}
