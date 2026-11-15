"use client";

import {
  InstrumentEmpty,
  InstrumentSection,
} from "@notra/ui/components/instrument/instrument-module";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { AiTrendsAnomalyCard } from "@/components/ai-trends/ai-trends-anomaly-card";
import { AiTrendsTrafficChart } from "@/components/ai-trends/ai-trends-traffic-chart";
import { AiTrendsTrafficSources } from "@/components/ai-trends/ai-trends-traffic-sources";
import { SiteQueryError } from "@/components/sites/site-query-error";
import {
  AI_TRENDS_BASELINE_DAYS,
  AI_TRENDS_RECENT_DAYS,
  AI_TRENDS_STALE_MS,
} from "@/constants/ai-trends";
import { consoleOrpc } from "@/lib/orpc/query";
import type {
  AiTrendsTrafficSectionProps,
  AiTrendsTrafficSourceOrder,
} from "@/types/ai-trends";
import { trafficWindowSources } from "@/utils/ai-trends-traffic";

export function AiTrendsTrafficSection({ days }: AiTrendsTrafficSectionProps) {
  const trafficQuery = useQuery({
    ...consoleOrpc.aiTrends.traffic.queryOptions({ input: { days } }),
    staleTime: AI_TRENDS_STALE_MS,
  });
  const traffic = trafficQuery.data;
  const chartSources = useMemo(
    () => trafficWindowSources(traffic?.days ?? []),
    [traffic]
  );
  const sourceOrder = useMemo(() => {
    const order: AiTrendsTrafficSourceOrder = { crawler: [], ai_referral: [] };
    for (const item of chartSources) {
      order[item.visitorType].push(item.id);
    }
    return order;
  }, [chartSources]);

  let body = (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-48 rounded-2xl" />
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
  if (trafficQuery.isError && !traffic) {
    body = (
      <SiteQueryError
        message="Could not load AI traffic."
        onRetry={() => trafficQuery.refetch()}
        retrying={trafficQuery.isFetching}
      />
    );
  } else if (traffic && chartSources.length === 0) {
    // A quiet last week still charts the window, which is the drop to see.
    body = (
      <InstrumentEmpty
        className="min-h-40"
        message={
          traffic.configured
            ? `No AI traffic in the last ${days} days.`
            : "Tinybird isn't configured on the dashboard."
        }
      />
    );
  } else if (traffic) {
    body = (
      <div className="flex flex-col gap-3">
        {traffic.anomalies.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {traffic.anomalies.map((anomaly) => (
              <AiTrendsAnomalyCard
                anomaly={anomaly}
                engineOrder={
                  sourceOrder[anomaly.traffic?.visitorType ?? "crawler"]
                }
                key={anomaly.id}
                window={traffic.window}
              />
            ))}
          </div>
        ) : null}
        <AiTrendsTrafficChart
          sourceOrder={sourceOrder}
          sources={chartSources}
          traffic={traffic}
        />
        {traffic.sources.length > 0 ? (
          <AiTrendsTrafficSources sources={traffic.sources} />
        ) : null}
      </div>
    );
  }

  return (
    <InstrumentSection
      description={
        traffic?.configured
          ? `AI crawlers and AI referrals on ${traffic.sites.toLocaleString("en")} customer sites with the tracker installed, ${traffic.visits.toLocaleString("en")} visits in the last ${AI_TRENDS_RECENT_DAYS} days. Changes compare the last ${AI_TRENDS_RECENT_DAYS} days with the ${AI_TRENDS_BASELINE_DAYS} before on sites with traffic in both.`
          : "AI crawlers and AI referrals on customer sites with the tracker installed."
      }
      eyebrow="AI traffic"
    >
      {body}
    </InstrumentSection>
  );
}
