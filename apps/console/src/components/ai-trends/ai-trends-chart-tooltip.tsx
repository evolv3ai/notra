"use client";

import { EngineIcon } from "@notra/ui/components/geo/engine-icon";
import type { CSSProperties } from "react";

import type { AiTrendsChartTooltipProps } from "@/types/ai-trends";
import { formatChartDay } from "@/utils/site-charts";

export function AiTrendsChartTooltip({
  active,
  payload,
  label,
  config,
  format,
  logos,
}: AiTrendsChartTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="border-border/50 bg-background grid min-w-40 gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{formatChartDay(String(label))}</div>
      {payload
        .filter((item) => item.type !== "none" && item.value != null)
        .sort((a, b) => Number(b.value) - Number(a.value))
        .map((item) => {
          const key = String(item.dataKey ?? item.name);
          const logo = logos?.[key];
          return (
            <div className="flex items-center gap-2" key={key}>
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-xs bg-(--swatch)"
                style={{ "--swatch": item.color } as CSSProperties}
              />
              {logo ? <EngineIcon className="size-3.5" engine={logo} /> : null}
              <span className="text-muted-foreground flex-1 truncate">
                {config[key]?.label ?? item.name}
              </span>
              <span className="text-foreground font-mono font-medium tabular-nums">
                {format(Number(item.value))}
              </span>
            </div>
          );
        })}
    </div>
  );
}
