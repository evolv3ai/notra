"use client";

import {
  InstrumentEmpty,
  InstrumentSection,
} from "@notra/ui/components/instrument/instrument-module";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@notra/ui/components/ui/tabs";
import { usePrefetchQuery, useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";

import { AiTrendsAdvertisers } from "@/components/ai-trends/ai-trends-advertisers";
import { AiTrendsAnomalyCard } from "@/components/ai-trends/ai-trends-anomaly-card";
import { AiTrendsDomainExplorer } from "@/components/ai-trends/ai-trends-domain-explorer";
import { AiTrendsEngineMetrics } from "@/components/ai-trends/ai-trends-engine-metrics";
import { AiTrendsTopDomains } from "@/components/ai-trends/ai-trends-top-domains";
import { AiTrendsTrafficSection } from "@/components/ai-trends/ai-trends-traffic-section";
import { SiteQueryError } from "@/components/sites/site-query-error";
import {
  AI_TRENDS_BASELINE_DAYS,
  AI_TRENDS_DAY_OPTIONS,
  AI_TRENDS_DEFAULT_DAYS,
  AI_TRENDS_DEFAULT_DOMAIN,
  AI_TRENDS_RECENT_DAYS,
  AI_TRENDS_STALE_MS,
} from "@/constants/ai-trends";
import { consoleOrpc } from "@/lib/orpc/query";
import type { AiTrendsAnomaly, AiTrendsDays } from "@/types/ai-trends";
import { formatWindow } from "@/utils/ai-trends";

function LoadingState() {
  return (
    <div className="flex flex-col gap-10">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <Skeleton className="h-56 rounded-2xl" key={item} />
        ))}
      </div>
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}

export function AiTrendsClient() {
  const [days, setDays] = useState<AiTrendsDays>(AI_TRENDS_DEFAULT_DAYS);
  const [domain, setDomain] = useState(AI_TRENDS_DEFAULT_DOMAIN);
  const [engine, setEngine] = useState<string | null>(null);
  const explorerRef = useRef<HTMLDivElement>(null);

  const overviewQuery = useQuery({
    ...consoleOrpc.aiTrends.overview.queryOptions({ input: { days } }),
    staleTime: AI_TRENDS_STALE_MS,
  });
  // The traffic section mounts once the overview is in; start its request
  // now so it loads alongside the overview instead of after it. The overview
  // carries the explorer's opening chart itself.
  usePrefetchQuery({
    ...consoleOrpc.aiTrends.traffic.queryOptions({ input: { days } }),
    staleTime: AI_TRENDS_STALE_MS,
  });
  const overview = overviewQuery.data;
  const engineOrder = useMemo(
    () => overview?.engines.map((item) => item.id) ?? [],
    [overview]
  );
  const suggestions = useMemo(
    () => overview?.topDomains.map((item) => item.domain) ?? [],
    [overview]
  );

  const showDomain = (nextDomain: string, nextEngine: string | null) => {
    setDomain(nextDomain);
    setEngine(nextEngine);
    explorerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const selectAnomaly = (anomaly: AiTrendsAnomaly) => {
    if (anomaly.domain) {
      showDomain(anomaly.domain, anomaly.engine);
    }
  };

  let content = <LoadingState />;
  if (overviewQuery.isError && !overview) {
    content = (
      <SiteQueryError
        message="Could not load AI search trends."
        onRetry={() => overviewQuery.refetch()}
        retrying={overviewQuery.isFetching}
      />
    );
  } else if (overview) {
    content = (
      <div className="flex flex-col gap-10">
        <InstrumentSection
          description={`Last ${AI_TRENDS_RECENT_DAYS} days against the ${AI_TRENDS_BASELINE_DAYS} days before, counting only prompts that ran in both periods. Customers adding or removing prompts don't show up here.`}
          eyebrow="Anomalies"
        >
          {overview.anomalies.length === 0 ? (
            <InstrumentEmpty
              className="min-h-40"
              message={`No significant changes in the last ${AI_TRENDS_RECENT_DAYS} days.`}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {overview.anomalies.map((anomaly) => (
                <AiTrendsAnomalyCard
                  anomaly={anomaly}
                  engineOrder={engineOrder}
                  key={anomaly.id}
                  onSelect={anomaly.domain ? selectAnomaly : undefined}
                  window={overview.window}
                />
              ))}
            </div>
          )}
        </InstrumentSection>

        <div className="scroll-mt-6" ref={explorerRef}>
          <AiTrendsDomainExplorer
            days={days}
            domain={domain}
            engine={engine}
            engineOrder={engineOrder}
            initialShare={overview.defaultDomainShare}
            onDomainChange={(next) => {
              setDomain(next);
              setEngine(null);
            }}
            onEngineChange={setEngine}
            suggestions={suggestions}
          />
        </div>

        <AiTrendsEngineMetrics overview={overview} />

        <AiTrendsTrafficSection days={days} />

        {overview.engines.some((item) => item.adReported > 0) ? (
          <InstrumentSection
            description="Brands buying sponsored blocks in consumer AI answers, across the whole period."
            eyebrow="Advertisers"
          >
            <AiTrendsAdvertisers advertisers={overview.advertisers} />
          </InstrumentSection>
        ) : null}

        <InstrumentSection
          description={`Across all engines, last ${AI_TRENDS_RECENT_DAYS} days. Pick a row to chart it.`}
          eyebrow="Most cited domains"
        >
          <AiTrendsTopDomains
            domains={overview.topDomains}
            onSelect={(next) => showDomain(next, null)}
          />
        </InstrumentSection>
      </div>
    );
  }

  return (
    <div className="@container/main mx-auto flex w-full max-w-6xl flex-col gap-8 p-6">
      <PageHeading
        description={
          overview
            ? `What AI engines cite and how they search, across every customer's tracked prompts. ${overview.answers.toLocaleString("en")} answers and ${overview.citations.toLocaleString("en")} citations, ${formatWindow(overview.window)}.`
            : "What AI engines cite and how they search, across every customer's tracked prompts."
        }
        title="AI Search Trends"
      >
        <Tabs
          onValueChange={(value) => {
            const next = AI_TRENDS_DAY_OPTIONS.find(
              (option) => option === value
            );
            if (next) {
              setDays(next);
            }
          }}
          value={days}
        >
          <TabsList>
            {AI_TRENDS_DAY_OPTIONS.map((option) => (
              <TabsTrigger key={option} value={option}>
                {option}d
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </PageHeading>
      {content}
    </div>
  );
}
