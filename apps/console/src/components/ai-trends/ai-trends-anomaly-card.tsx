"use client";

import {
  ArrowDownRight01Icon,
  ArrowUpRight01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { EngineIcon } from "@notra/ui/components/geo/engine-icon";
import { cn } from "@notra/ui/lib/utils";
import { useMemo } from "react";

import { AiTrendsSparkline } from "@/components/ai-trends/ai-trends-series-chart-lazy";
import { AiTrendsShareButton } from "@/components/ai-trends/ai-trends-share-button";
import type { AiTrendsAnomalyCardProps } from "@/types/ai-trends";
import {
  anomalyHeadline,
  anomalySitesLabel,
  formatAnomalyChange,
  formatAnomalyValue,
  seriesChartConfig,
  seriesChartRows,
} from "@/utils/ai-trends";
import { anomalyShareCard, shareFileName } from "@/utils/ai-trends-share";

export function AiTrendsAnomalyCard({
  anomaly,
  engineOrder,
  window,
  onSelect,
}: AiTrendsAnomalyCardProps) {
  const rising = anomaly.change > 0;
  const config = useMemo(
    () =>
      seriesChartConfig(
        [{ id: anomaly.engine, label: anomaly.engineLabel }],
        engineOrder
      ),
    [anomaly.engine, anomaly.engineLabel, engineOrder]
  );
  const rows = useMemo(
    () => seriesChartRows([anomaly.series]),
    [anomaly.series]
  );
  const headline = anomalyHeadline(anomaly);
  const sites = anomalySitesLabel(anomaly);
  const format = (value: number) => formatAnomalyValue(anomaly.kind, value);
  const body = (
    <>
      <p className="text-sm font-medium text-balance">{headline}</p>
      <AiTrendsSparkline
        compact
        config={config}
        format={format}
        markDay={window.recentFrom}
        rows={rows}
      />
      <p className="text-muted-foreground text-xs tabular-nums">
        <span className="text-foreground font-medium">
          {formatAnomalyValue(anomaly.kind, anomaly.recent)}
        </span>{" "}
        last 7 days · {formatAnomalyValue(anomaly.kind, anomaly.baseline)}{" "}
        {sites ? `before · ${sites}` : "the 3 weeks before"}
      </p>
    </>
  );
  const surface =
    "border-table-card-border bg-table-card shadow-table-card flex flex-1 flex-col gap-3 rounded-[14px] border p-4 text-left";

  return (
    <div className="border-shell-border bg-shell flex min-w-0 flex-col rounded-2xl border p-0.5">
      <div className="flex min-h-9 items-center gap-2 pr-1.5 pl-3.5">
        <EngineIcon className="size-3.5" engine={anomaly.engine} />
        <p className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
          {anomaly.engineLabel}
        </p>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-0.5 text-xs font-medium tabular-nums",
            rising ? "text-geo-up" : "text-geo-down"
          )}
        >
          <HugeiconsIcon
            className="size-3.5"
            icon={rising ? ArrowUpRight01Icon : ArrowDownRight01Icon}
          />
          {formatAnomalyChange(anomaly)}
        </span>
        <AiTrendsShareButton
          card={() => anomalyShareCard(anomaly, window, { config, rows })}
          name={shareFileName(anomaly.engineLabel, headline)}
        />
      </div>
      {onSelect ? (
        <button
          className={cn(
            surface,
            "hover:border-foreground/20 focus-visible:ring-ring cursor-pointer transition-colors focus-visible:ring-2 focus-visible:outline-none"
          )}
          onClick={() => onSelect(anomaly)}
          type="button"
        >
          {body}
        </button>
      ) : (
        <div className={surface}>{body}</div>
      )}
    </div>
  );
}
