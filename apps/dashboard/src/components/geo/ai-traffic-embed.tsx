"use client";

import { GEO_TRAFFIC_OTHER_GROUP } from "@notra/geo-core/constants/geo";
import {
  toGeoTrafficPreviousTotals,
  trafficSparklineDays,
} from "@notra/geo-core/utils/ai-traffic";
import { useEffect, useMemo, useRef } from "react";
import { InstrumentEmpty } from "ui/card";
import { useTranslations } from "use-intl";

import { TrafficHero } from "@/components/geo/traffic-hero";
import { TRAFFIC_EMBED_RESIZE_MESSAGE } from "@/constants/traffic-embed";
import type { PublicTrafficEmbed } from "@/types/traffic-embed";
import { groupTrafficSources } from "@/utils/ai-traffic-groups";
import { trafficEmbedParts } from "@/utils/traffic-embed";

/**
 * Reports the content height to the framing page, where `embed.js` sizes the
 * iframe. The height isn't sensitive, so any parent may read it.
 */
function useReportHeight(embedId: string) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || window.parent === window) {
      return;
    }
    const post = () =>
      window.parent.postMessage(
        {
          type: TRAFFIC_EMBED_RESIZE_MESSAGE,
          id: embedId,
          height: Math.ceil(node.getBoundingClientRect().height),
        },
        "*"
      );
    const observer = new ResizeObserver(post);
    observer.observe(node);
    post();
    return () => observer.disconnect();
  }, [embedId]);
  return ref;
}

export function AiTrafficEmbed({
  embedId,
  embed,
  parts: partsParam,
}: {
  embedId: string;
  embed: PublicTrafficEmbed;
  parts: string | undefined;
}) {
  const tCommon = useTranslations("common");
  const t = useTranslations("geo.trafficEmbed");
  const ref = useReportHeight(embedId);
  const { traffic, from, to } = embed;
  const parts = trafficEmbedParts(partsParam);
  const groups = useMemo(
    () =>
      groupTrafficSources(traffic.sources).map((group) =>
        group.key === GEO_TRAFFIC_OTHER_GROUP.key
          ? { ...group, label: tCommon("labels.other") }
          : group
      ),
    [traffic.sources, tCommon]
  );
  const previousTotals = useMemo(
    () =>
      toGeoTrafficPreviousTotals(traffic.sources, traffic.previousConversions),
    [traffic.sources, traffic.previousConversions]
  );
  const days = useMemo(
    () => trafficSparklineDays(traffic.points, from, to),
    [traffic.points, from, to]
  );
  const showMetrics = parts.includes("metrics");
  // Without points there is no series to draw, so the chart part says so
  // instead of collapsing to an empty frame.
  const showEmpty = parts.includes("chart") && days.length === 0;

  return (
    <div className="flex flex-col gap-2" ref={ref}>
      {showMetrics || !showEmpty ? (
        <TrafficHero
          days={days}
          groups={groups}
          points={traffic.points}
          previousTotals={previousTotals}
          showChart={parts.includes("chart")}
          showMetrics={showMetrics}
          totals={traffic.totals}
        />
      ) : null}
      {showEmpty ? (
        <div className="border-shell-border bg-shell rounded-2xl border">
          <InstrumentEmpty message={t("empty")} seed="geo-traffic-embed" />
        </div>
      ) : null}
      <a
        className="text-muted-foreground hover:text-foreground self-end px-1 text-xs transition-colors"
        href="https://www.usenotra.com"
        rel="noopener"
        target="_blank"
      >
        {t("poweredBy")}
      </a>
    </div>
  );
}
