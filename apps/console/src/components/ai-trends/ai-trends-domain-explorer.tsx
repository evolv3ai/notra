"use client";

import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  InstrumentEmpty,
  InstrumentModule,
} from "@notra/ui/components/instrument/instrument-module";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@notra/ui/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { AiTrendsSeriesChart } from "@/components/ai-trends/ai-trends-series-chart-lazy";
import { AiTrendsShareButton } from "@/components/ai-trends/ai-trends-share-button";
import { AiTrendsStatTiles } from "@/components/ai-trends/ai-trends-stat-tiles";
import { SiteQueryError } from "@/components/sites/site-query-error";
import {
  AI_TRENDS_DOMAIN_STAT_PERIODS,
  AI_TRENDS_MAX_CHART_ENGINES,
  AI_TRENDS_STALE_MS,
} from "@/constants/ai-trends";
import { consoleOrpc } from "@/lib/orpc/query";
import type { AiTrendsDomainExplorerProps } from "@/types/ai-trends";
import {
  citingEngines,
  dayRange,
  domainShareSeries,
  domainShareStats,
  formatShare,
  formatShareTick,
  normalizeTrendsDomain,
  seriesChartConfig,
  seriesChartRows,
  seriesLogos,
} from "@/utils/ai-trends";
import { domainShareCard, shareFileName } from "@/utils/ai-trends-share";

const ALL_ENGINES = "all";
const SUGGESTIONS_ID = "ai-trends-domain-suggestions";

export function AiTrendsDomainExplorer({
  days,
  domain,
  engine,
  engineOrder,
  suggestions,
  initialShare,
  onDomainChange,
  onEngineChange,
}: AiTrendsDomainExplorerProps) {
  const [draft, setDraft] = useState(domain);
  const [syncedDomain, setSyncedDomain] = useState(domain);
  if (syncedDomain !== domain) {
    setSyncedDomain(domain);
    setDraft(domain);
  }

  const shareQuery = useQuery({
    ...consoleOrpc.aiTrends.domainShare.queryOptions({
      input: { days, domain },
    }),
    initialData: initialShare?.domain === domain ? initialShare : undefined,
    staleTime: AI_TRENDS_STALE_MS,
  });
  const data = shareQuery.data;

  // Rows reach back past the chart for the stat tiles; rank only what it shows.
  const engines = useMemo(
    () =>
      citingEngines(
        data?.days.filter((row) => row.day >= data.window.from) ?? []
      ),
    [data]
  );
  const selected =
    engine && engines.some((item) => item.id === engine) ? engine : null;

  const chart = useMemo(() => {
    if (!data) {
      return null;
    }
    const range = dayRange(data.window.from, data.window.toExclusive);
    const charted = selected
      ? engines.filter((item) => item.id === selected)
      : engines.slice(0, AI_TRENDS_MAX_CHART_ENGINES);
    return {
      config: seriesChartConfig(charted, engineOrder),
      logos: seriesLogos(charted.map((item) => ({ logo: item.id }))),
      rows: seriesChartRows(
        charted.map((item) => domainShareSeries(data.days, item.id, range))
      ),
      stats: domainShareStats(
        data.days,
        selected,
        data.window.toExclusive,
        AI_TRENDS_DOMAIN_STAT_PERIODS
      ),
    };
  }, [data, engineOrder, engines, selected]);

  const submit = () => {
    const next = normalizeTrendsDomain(draft);
    if (next && next !== domain) {
      onDomainChange(next);
    }
  };

  let body = (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
      </div>
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
  if (shareQuery.isError && !data) {
    body = (
      <SiteQueryError
        message="Could not load this domain's citations."
        onRetry={() => shareQuery.refetch()}
        retrying={shareQuery.isFetching}
      />
    );
  } else if (data && engines.length === 0) {
    body = (
      <InstrumentEmpty
        className="min-h-80"
        message={`No engine cited ${domain} in this period.`}
      />
    );
  } else if (chart) {
    body = (
      <div className="flex flex-col gap-4">
        <AiTrendsStatTiles format={formatShare} stats={chart.stats} />
        <AiTrendsSeriesChart
          config={chart.config}
          format={formatShare}
          formatTick={formatShareTick}
          logos={chart.logos}
          rows={chart.rows}
        />
      </div>
    );
  }

  return (
    <InstrumentModule
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <form
            className="w-full sm:w-56"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <InputGroup>
              <InputGroupAddon>
                <HugeiconsIcon icon={Search01Icon} />
              </InputGroupAddon>
              <InputGroupInput
                aria-label="Domain"
                autoCapitalize="none"
                autoComplete="off"
                list={SUGGESTIONS_ID}
                onBlur={submit}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="reddit.com"
                spellCheck={false}
                value={draft}
              />
            </InputGroup>
            <datalist id={SUGGESTIONS_ID}>
              {suggestions.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
          </form>
          <Select
            items={[
              { value: ALL_ENGINES, label: "All engines" },
              ...engines.map((item) => ({ value: item.id, label: item.label })),
            ]}
            onValueChange={(next) =>
              onEngineChange(
                typeof next === "string" && next !== ALL_ENGINES ? next : null
              )
            }
            value={selected ?? ALL_ENGINES}
          >
            <SelectTrigger aria-label="Engine" className="min-w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ENGINES}>All engines</SelectItem>
              {engines.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AiTrendsShareButton
            card={() =>
              data && chart
                ? domainShareCard({
                    domain,
                    engine: selected,
                    engineLabel:
                      engines.find((item) => item.id === selected)?.label ??
                      null,
                    stats: chart.stats,
                    window: data.window,
                    chart,
                  })
                : null
            }
            name={shareFileName(domain, "share", selected ?? "all engines")}
          />
        </div>
      }
      description="Daily share of all citations that point to one domain."
      eyebrow="Domain share"
      variant="table"
    >
      {body}
    </InstrumentModule>
  );
}
