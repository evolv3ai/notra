"use client";

import { formatDayLabel } from "@notra/geo-core/utils/day-label";
import { useState } from "react";
import { InstrumentEmpty, InstrumentModule } from "ui/card";
import { useLocale, useTranslations } from "use-intl";

import { EmptyStateTrendPreview } from "@/components/empty-state-preview";
import { EChartsAreaChart } from "@/components/evilcharts/charts/echarts-area-chart";
import { GeoRangePicker } from "@/components/geo/geo-range-picker";
import { GeoStatDelta } from "@/components/geo/geo-stat-delta";
import { PersonaActivityBodySkeleton } from "@/components/geo/persona-activity-skeleton";
import {
  GEO_PERSONA_CHART_FILL_ALPHA,
  GEO_PERSONA_ROLLING_DAYS,
} from "@/constants/geo-personas";
import { useIsGeoScanning } from "@/lib/hooks/use-geo";
import { useGeoPersonaActivity } from "@/lib/hooks/use-geo-personas";
import { useGeoRange } from "@/lib/hooks/use-geo-range";
import type { ChartConfig } from "@/types/charts";
import type { PersonasTableProps } from "@/types/geo-personas-ui";
import { formatFullDayLabel } from "@/utils/analytics-charts";
import {
  accountSeriesColorPair,
  accountSeriesColors,
} from "@/utils/chart-colors";
import { formatOneDecimal } from "@/utils/format";
import {
  buildPersonaActivityRows,
  buildPersonaActivitySeries,
  personaActivityAxisMax,
  personaActivityFetchFrom,
  personaActivityWithin,
  personaMentionRate,
  personaMentionRateDelta,
} from "@/utils/persona-activity";

export function PersonaActivityCard({
  organizationId,
  personas,
}: PersonasTableProps) {
  const t = useTranslations("geo.personaActivityCard");
  const tGeoShared = useTranslations("geo.shared");
  const tCommon = useTranslations("common.actions");
  const locale = useLocale();
  const [hiddenPersonas, setHiddenPersonas] = useState<string[]>([]);
  const hiddenPersonaIds = new Set(hiddenPersonas);
  const range = useGeoRange();
  const {
    data: fetched,
    isPending,
    isError,
    refetch,
  } = useGeoPersonaActivity(organizationId, {
    ...range.query,
    from: personaActivityFetchFrom(range.query.from),
  });
  const data = fetched
    ? personaActivityWithin(fetched, range.query.from)
    : undefined;
  const isScanning = useIsGeoScanning(organizationId);
  const series = data ? buildPersonaActivitySeries(data, personas) : [];
  const personaIndexes = new Map(
    personas.map((persona, index) => [persona.id, index])
  );
  const config: ChartConfig = {};
  for (const item of series) {
    const colors = accountSeriesColors(personaIndexes.get(item.personaId) ?? 0);
    config[item.dataKey] = { label: item.label, colors };
  }
  const rows = fetched
    ? buildPersonaActivityRows(fetched, series, range.query.from)
    : [];
  const visibleKeys = series
    .filter((item) => !hiddenPersonaIds.has(item.personaId))
    .map((item) => item.dataKey);
  const axisMax = personaActivityAxisMax(rows, visibleKeys);
  const hasResults = data?.points.some(
    (point) =>
      point.checks > 0 &&
      personas.some((persona) => persona.id === point.personaId)
  );
  return (
    <InstrumentModule
      eyebrow={t("eyebrow")}
      action={<GeoRangePicker control={range} />}
      variant="table"
      bodyClassName="px-4 pb-4 pt-2"
    >
      {isPending ? (
        <PersonaActivityBodySkeleton count={personas.length} />
      ) : null}
      {isError ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 text-sm">
          <p>{t("loadFailed")}</p>
          <button
            type="button"
            className="underline underline-offset-4"
            onClick={() => {
              refetch();
            }}
          >
            {tCommon("tryAgain")}
          </button>
        </div>
      ) : null}
      {!isPending && !isError && data && hasResults ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-x-4 gap-y-5 pt-3 sm:grid-cols-3 lg:grid-cols-5">
            {personas.map((persona, index) => {
              const currentSeries = series.find(
                (item) => item.personaId === persona.id && item.isCurrent
              );
              const rate = personaMentionRate(
                data,
                persona.id,
                currentSeries?.snapshotVersion
              );
              const delta = personaMentionRateDelta(
                data,
                persona.id,
                currentSeries?.snapshotVersion
              );
              const color = accountSeriesColorPair(index);
              const visible = !hiddenPersonaIds.has(persona.id);
              return (
                <div className="min-w-0 space-y-1" key={persona.id}>
                  <button
                    type="button"
                    aria-pressed={visible}
                    className="focus-visible:ring-ring flex min-h-6 max-w-full items-center gap-2 rounded-sm text-left text-sm font-medium focus-visible:ring-2 focus-visible:outline-none aria-[pressed=false]:opacity-40"
                    title={persona.name}
                    onClick={() =>
                      setHiddenPersonas((hidden) =>
                        visible
                          ? [...hidden, persona.id]
                          : hidden.filter((id) => id !== persona.id)
                      )
                    }
                  >
                    <span
                      aria-hidden="true"
                      className="size-2 shrink-0 rounded-sm dark:hidden"
                      style={{ backgroundColor: color.light }}
                    />
                    <span
                      aria-hidden="true"
                      className="hidden size-2 shrink-0 rounded-sm dark:block"
                      style={{ backgroundColor: color.dark }}
                    />
                    <span className="truncate">{persona.name}</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-semibold tabular-nums">
                      {rate === null
                        ? "—"
                        : `${formatOneDecimal(rate, locale)}%`}
                    </p>
                    <GeoStatDelta
                      delta={delta}
                      kind="rate"
                      label={t("changeLabel", { name: persona.name })}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <EChartsAreaChart
            renderer="svg"
            className="h-64 w-full cursor-crosshair"
            config={config}
            data={rows}
            xDataKey="day"
            animation={false}
            curveType="monotone"
          >
            <EChartsAreaChart.Grid variant="solid" />
            <EChartsAreaChart.XAxis
              dataKey="day"
              tickFormatter={(day: string) => formatDayLabel(day, locale)}
            />
            <EChartsAreaChart.YAxis
              min={0}
              max={axisMax}
              tickFormatter={(value) => `${value}%`}
            />
            {series.map((item) => (
              <EChartsAreaChart.Area
                key={item.dataKey}
                dataKey={item.dataKey}
                fillAlpha={GEO_PERSONA_CHART_FILL_ALPHA}
                variant={item.isCurrent ? "gradient" : "none"}
                visible={!hiddenPersonaIds.has(item.personaId)}
                strokeVariant={item.isCurrent ? "solid" : "dashed"}
                connectNulls
                gapMissing
                strokeWidth={item.isCurrent ? 2 : 1.5}
              >
                <EChartsAreaChart.ActiveDot variant="border" />
              </EChartsAreaChart.Area>
            ))}
            <EChartsAreaChart.Tooltip
              confine={false}
              labelFormatter={(day: string) => formatFullDayLabel(day, locale)}
              layout="activity"
              position="fixed"
              roundness="xl"
              scrub={rows.length > 1}
              valueFormatter={(value) =>
                `${formatOneDecimal(Number(value), locale)}%`
              }
            />
          </EChartsAreaChart>
          <p className="text-muted-foreground mt-2 text-right text-xs">
            {t("rollingNote", { days: GEO_PERSONA_ROLLING_DAYS })}
          </p>
        </>
      ) : null}
      {!isPending && !isError && !hasResults ? (
        <InstrumentEmpty
          busy={isScanning}
          className="min-h-64"
          message={isScanning ? tGeoShared("scanningEngines") : t("runScan")}
          preview={<EmptyStateTrendPreview />}
          seed="Persona visibility"
        />
      ) : null}
    </InstrumentModule>
  );
}
