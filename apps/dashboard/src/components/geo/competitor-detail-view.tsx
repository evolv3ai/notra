"use client";

import {
  ArrowUpRight01Icon,
  PencilEdit02Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  COMPETITOR_PROMPTS_TABLE_HEIGHT,
  COMPETITORS_TABLE_ROW_HEIGHT,
  GEO_COMPETITOR_DETAIL_CHART_HEIGHT_CLASS,
  GEO_COMPETITOR_DETAIL_MIN_POINTS,
  GEO_COMPETITOR_DETAIL_SERIES_KEY,
} from "@notra/geo-core/constants/geo";
import type {
  GeoCompetitorPromptRow,
  GeoCompetitorPromptSummary,
} from "@notra/geo-core/types/geo";
import { formatAiTrafficTimestamp } from "@notra/geo-core/utils/ai-traffic";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { useEffect, useMemo, useRef, useState } from "react";
import { InstrumentModule, InstrumentSection } from "ui/card";
import { DataTable, type TableColumn } from "ui/table";
import { useLocale, useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { EChartsBarChart } from "@/components/evilcharts/charts/echarts-bar-chart";
import { CompetitorEditDialog } from "@/components/geo/competitor-edit-dialog";
import { CompetitorLogo } from "@/components/geo/competitor-logo";
import { EngineIcon } from "@/components/geo/engine-icon";
import { PromptDetailDialog } from "@/components/geo/prompt-detail-dialog";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import { CHART_PRIMARY_COLOR } from "@/constants/charts";
import { GEO_PROMPT_DETAIL_SURFACES } from "@/constants/geo-analytics";
import {
  COMPETITOR_MENTIONS_BAR_MAX_WIDTH_PX,
  COMPETITOR_MENTIONS_BAR_RADIUS_PX,
} from "@/constants/geo-competitors";
import { trackEvent } from "@/lib/analytics/posthog-client";
import {
  useGeoCompetitorDetail,
  useGeoPromptResults,
  useGeoSettings,
} from "@/lib/hooks/use-geo";
import { useGeoActiveProject } from "@/lib/hooks/use-geo-active-project";
import { useGeoCompetitorsDb } from "@/lib/hooks/use-geo-db";
import { useCompanyLogo } from "@/lib/hooks/use-onboarding";
import { cn } from "@/lib/utils";
import type { ChartConfig } from "@/types/charts";
import type {
  CompetitorDetailViewProps,
  CompetitorPromptAppearancesProps,
  CompetitorSummaryStatsProps,
  GeoCompetitorDetailPoint,
} from "@/types/geo";
import { seriesColors } from "@/utils/chart-colors";
import { formatEngineFamily } from "@/utils/geo-charts";
import {
  buildGeoCompetitorPoints,
  competitorChartHasIncompleteTail,
} from "@/utils/geo-competitor";
import {
  competitorPromptSummary,
  isOwnBrandName,
} from "@/utils/geo-competitors";
import { promptTableRowForId } from "@/utils/geo-prompts";
import { tableHeightFor } from "@/utils/table";

function CompetitorMentionsChart({
  competitor,
  points,
  incompleteTail,
  showLoading,
  unavailable,
}: {
  competitor: string;
  points: GeoCompetitorDetailPoint[];
  incompleteTail: boolean;
  showLoading: boolean;
  unavailable: boolean;
}) {
  const t = useTranslations("geo.competitorDetailView");
  const tGeoShared = useTranslations("geo.shared");
  const chartConfig: ChartConfig = {
    [GEO_COMPETITOR_DETAIL_SERIES_KEY]: {
      label: tGeoShared("mentionsLabel"),
      colors: seriesColors(CHART_PRIMARY_COLOR),
    },
  };

  if (unavailable) {
    return (
      <p className="text-muted-foreground text-sm">
        {t("mentionsUnavailable", { competitor })}
      </p>
    );
  }

  if (showLoading) {
    return (
      <Skeleton
        className={cn("w-full", GEO_COMPETITOR_DETAIL_CHART_HEIGHT_CLASS)}
      />
    );
  }

  if (points.length >= GEO_COMPETITOR_DETAIL_MIN_POINTS) {
    return (
      <EChartsBarChart
        barMaxWidth={COMPETITOR_MENTIONS_BAR_MAX_WIDTH_PX}
        barRadius={COMPETITOR_MENTIONS_BAR_RADIUS_PX}
        className={cn("w-full", GEO_COMPETITOR_DETAIL_CHART_HEIGHT_CLASS)}
        config={chartConfig}
        data={points}
        key={competitor}
        xDataKey="day"
      >
        <EChartsBarChart.Grid />
        <EChartsBarChart.XAxis dataKey="day" hideDots />
        <EChartsBarChart.YAxis hideDots />
        <EChartsBarChart.Bar
          bufferBar={incompleteTail}
          dataKey={GEO_COMPETITOR_DETAIL_SERIES_KEY}
        />
        <EChartsBarChart.Tooltip />
      </EChartsBarChart>
    );
  }

  return (
    <p className="text-muted-foreground text-sm">
      {t("notEnoughScans", { competitor })}
    </p>
  );
}

function CompetitorSummaryStats({
  competitor,
  summary,
  unavailable,
}: CompetitorSummaryStatsProps) {
  const tGeoShared = useTranslations("geo.shared");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const withYouShare =
    summary && summary.answers > 0
      ? Math.round((summary.ownMentioned / summary.answers) * 100)
      : null;
  const missing = unavailable ? "—" : undefined;
  const stats = [
    {
      label: tGeoShared("answers"),
      value: summary?.answers.toLocaleString(locale) ?? missing,
      aside: null,
    },
    {
      label: tCommon("labels.prompts"),
      value: summary?.prompts.toLocaleString(locale) ?? missing,
      aside: null,
    },
    {
      label: tGeoShared("engines"),
      value: summary?.engines.toLocaleString(locale) ?? missing,
      aside: null,
    },
    {
      label: tGeoShared("withYourBrand"),
      value: summary ? `${withYouShare ?? 0}%` : missing,
      aside: summary
        ? `${summary.ownMentioned.toLocaleString(locale)}/${summary.answers.toLocaleString(locale)}`
        : null,
    },
  ];
  return (
    <dl
      aria-label={competitor}
      className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4"
    >
      {stats.map((stat) => (
        <div className="flex min-w-0 flex-col gap-2" key={stat.label}>
          <dt className="text-muted-foreground text-xs">{stat.label}</dt>
          <dd className="flex items-baseline gap-1.5">
            {stat.value === undefined ? (
              <Skeleton className="h-6 w-12" />
            ) : (
              <span className="text-2xl leading-none font-semibold tracking-tight tabular-nums">
                {stat.value}
              </span>
            )}
            {stat.aside ? (
              <span className="text-muted-foreground text-xs tabular-nums">
                {stat.aside}
              </span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function CompetitorPromptAppearances({
  competitor,
  prompts,
  columns,
  tableHeight,
  showLoading,
  unavailable,
  onRowClick,
}: CompetitorPromptAppearancesProps) {
  const t = useTranslations("geo.competitorDetailView");
  return (
    <InstrumentSection
      description={t("whereShowsUpDescription", { competitor })}
      eyebrow={t("whereShowsUp", { competitor })}
    >
      <DataTable
        columns={columns}
        data={prompts}
        defaultSort={{ key: "capturedAt", direction: "desc" }}
        emptyState={
          unavailable
            ? t("promptsUnavailable")
            : t("promptsEmpty", { competitor })
        }
        getRowId={(row) => `${row.promptId}-${row.engine}`}
        height={showLoading ? tableHeightFor(3) : tableHeight}
        key={competitor}
        loading={showLoading}
        onRowClick={onRowClick}
        rowHeight={COMPETITORS_TABLE_ROW_HEIGHT}
      />
    </InstrumentSection>
  );
}

export function CompetitorDetailView({
  organizationSlug,
  competitor,
}: CompetitorDetailViewProps) {
  const t = useTranslations("geo.competitorDetailView");
  const tGeoShared = useTranslations("geo.shared");
  const locale = useLocale();
  const { getOrganization, activeOrganization } = useOrganizationsContext();
  const orgFromList = getOrganization(organizationSlug);
  const organization =
    activeOrganization?.slug === organizationSlug
      ? activeOrganization
      : orgFromList;
  const organizationId = organization?.id ?? "";
  const viewedRef = useRef(false);

  useEffect(() => {
    if (viewedRef.current) {
      return;
    }
    viewedRef.current = true;
    trackEvent(POSTHOG_EVENTS.GEO_COMPETITOR_DETAIL_VIEWED, {
      surface: "modal",
    });
  }, []);

  const { competitors } = useGeoCompetitorsDb(organizationId);
  const { data: settingsData } = useGeoSettings(organizationId);
  const entry =
    competitors.find(
      (item) => item.name.toLowerCase() === competitor.toLowerCase()
    ) ?? null;
  const ownBrand = isOwnBrandName(
    competitor,
    settingsData?.settings?.companyName,
    settingsData?.settings?.aliases
  );
  const discovered = entry === null && !ownBrand;
  const { domain: projectDomain } = useGeoActiveProject(organizationId);
  const knownDomain = ownBrand ? projectDomain : (entry?.domain ?? null);
  const { data: brandLookup } = useCompanyLogo(
    knownDomain,
    knownDomain ? null : competitor
  );
  const domain = knownDomain ?? brandLookup?.domain ?? null;
  let brandStatus = tGeoShared("tracked");
  if (ownBrand) {
    brandStatus = tGeoShared("yourBrand");
  } else if (discovered) {
    brandStatus = t("foundInAnswers");
  }
  const [editOpen, setEditOpen] = useState(false);
  const { data, isPending, isError } = useGeoCompetitorDetail(
    organizationId,
    competitor
  );
  const showLoading = !organizationId || (isPending && !data);
  const unavailable = isError && data === undefined;
  const { data: promptResults } = useGeoPromptResults(organizationId);
  const [selectedAnswer, setSelectedAnswer] = useState<{
    promptId: string;
    engine: string;
  } | null>(null);
  const selectedPromptRow = selectedAnswer
    ? promptTableRowForId(selectedAnswer.promptId, promptResults?.results ?? [])
    : null;
  const points = useMemo(
    () => buildGeoCompetitorPoints(data?.points ?? [], locale),
    [data, locale]
  );
  const incompleteTail = competitorChartHasIncompleteTail(points);
  const prompts = data?.prompts ?? [];
  const promptSummary: GeoCompetitorPromptSummary | null =
    showLoading || unavailable ? null : competitorPromptSummary(prompts);

  const columns: TableColumn<GeoCompetitorPromptRow>[] = [
    {
      key: "prompt",
      header: (
        <span className="inline-flex items-center gap-1.5">
          {tGeoShared("prompt")}
          <span className="text-muted-foreground font-normal tabular-nums">
            ({prompts.length.toLocaleString(locale)})
          </span>
        </span>
      ),
      sortable: true,
      width: "1fr",
      cell: (row) => (
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="block w-full min-w-0 truncate">
                {row.prompt}
              </span>
            }
          />
          <TooltipContent className="max-w-sm">{row.prompt}</TooltipContent>
        </Tooltip>
      ),
    },
    {
      key: "engine",
      header: tGeoShared("engine"),
      width: "11rem",
      sortable: true,
      cell: (row) => (
        <span className="inline-flex min-w-0 items-center gap-2">
          <EngineIcon className="size-4 shrink-0" engine={row.engine} />
          <span className="truncate">{formatEngineFamily(row.engine)}</span>
        </span>
      ),
    },
    {
      key: "position",
      header: tGeoShared("yourBrand"),
      width: "8.5rem",
      sortable: true,
      cell: (row) => {
        if (!row.mentioned) {
          return <span className="text-muted-foreground">{t("absent")}</span>;
        }
        return (
          <span className="tabular-nums">
            {row.position === null
              ? tGeoShared("mentioned")
              : `#${row.position}`}
          </span>
        );
      },
      sortValue: (row) => {
        if (!row.mentioned) {
          return Number.MAX_SAFE_INTEGER;
        }
        return row.position ?? Number.MAX_SAFE_INTEGER - 1;
      },
    },
    {
      key: "capturedAt",
      header: tGeoShared("lastSeen"),
      width: "9.375rem",
      sortable: true,
      cell: (row) => (
        <span className="text-muted-foreground text-xs tabular-nums">
          {formatAiTrafficTimestamp(row.capturedAt, locale)}
        </span>
      ),
    },
  ];

  const tableHeight = Math.min(
    COMPETITOR_PROMPTS_TABLE_HEIGHT,
    tableHeightFor(prompts.length)
  );

  return (
    <div className="space-y-6">
      <div className="flex min-w-0 items-center gap-3 pr-10">
        <CompetitorLogo
          className="size-11 rounded-xl outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
          domain={domain}
          name={competitor}
        />
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex min-w-0 items-center gap-1">
            <p className="truncate text-lg leading-tight font-semibold">
              {competitor}
            </p>
            {entry ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      aria-label={t("editNamed", { competitor })}
                      className="text-muted-foreground size-7 shrink-0"
                      onClick={() => setEditOpen(true)}
                      size="icon-sm"
                      variant="ghost"
                    />
                  }
                >
                  <HugeiconsIcon
                    className="size-4"
                    icon={PencilEdit02Icon}
                    strokeWidth={1.5}
                  />
                </TooltipTrigger>
                <TooltipContent>{t("editCompetitor")}</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
          <p className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
            {domain ? (
              <a
                className="group hover:text-foreground inline-flex min-w-0 items-center gap-0.5 transition-colors"
                href={`https://${domain}`}
                rel="noopener"
                target="_blank"
              >
                <span className="min-w-0 truncate" title={domain}>
                  {domain}
                </span>
                <HugeiconsIcon
                  aria-hidden="true"
                  className="shrink-0 opacity-60 transition-opacity group-hover:opacity-100"
                  icon={ArrowUpRight01Icon}
                  size={12}
                />
              </a>
            ) : null}
            {domain ? <span aria-hidden="true">·</span> : null}
            <span className="shrink-0">{brandStatus}</span>
          </p>
        </div>
        {discovered ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  className="shrink-0"
                  onClick={() => setEditOpen(true)}
                  size="sm"
                  variant="outline"
                />
              }
            >
              <HugeiconsIcon
                aria-hidden="true"
                className="size-4"
                icon={PlusSignIcon}
              />
              {t("trackCompetitor")}
            </TooltipTrigger>
            <TooltipContent className="max-w-64">
              {tGeoShared("discoveredBrandsComeFromScan")}
            </TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      <CompetitorSummaryStats
        competitor={competitor}
        summary={promptSummary}
        unavailable={unavailable}
      />

      <InstrumentModule
        bodyClassName="p-4"
        eyebrow={tGeoShared("mentionsOverTime")}
        hint={t("mentionsHint", { competitor })}
        variant="table"
      >
        <CompetitorMentionsChart
          competitor={competitor}
          incompleteTail={incompleteTail}
          points={points}
          showLoading={showLoading}
          unavailable={unavailable}
        />
      </InstrumentModule>

      <CompetitorPromptAppearances
        columns={columns}
        competitor={competitor}
        onRowClick={(row) =>
          setSelectedAnswer({ promptId: row.promptId, engine: row.engine })
        }
        prompts={prompts}
        showLoading={showLoading}
        tableHeight={tableHeight}
        unavailable={unavailable}
      />
      <PromptDetailDialog
        initialEngine={selectedAnswer?.engine ?? null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSelectedAnswer(null);
          }
        }}
        open={selectedPromptRow !== null}
        organizationId={organizationId || undefined}
        row={selectedPromptRow}
        surface={GEO_PROMPT_DETAIL_SURFACES.COMPETITOR_DETAIL}
      />
      {ownBrand ? null : (
        <CompetitorEditDialog
          competitor={entry}
          initialDomain={entry ? null : domain}
          initialName={competitor}
          onOpenChange={setEditOpen}
          open={editOpen}
          organizationId={organizationId}
        />
      )}
    </div>
  );
}
