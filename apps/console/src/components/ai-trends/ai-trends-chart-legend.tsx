"use client";

import { EngineIcon } from "@notra/ui/components/geo/engine-icon";
import type { CSSProperties } from "react";

import type { AiTrendsChartLegendProps } from "@/types/ai-trends";

/** Series swatch, engine logo and label, so a line reads without the tooltip. */
export function AiTrendsChartLegend({
  payload,
  config,
  logos,
}: AiTrendsChartLegendProps) {
  if (!payload?.length) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-3 text-xs">
      {payload
        .filter((item) => item.type !== "none")
        .map((item) => {
          const key = String(item.dataKey ?? item.value);
          const logo = logos?.[key];
          return (
            <div className="flex items-center gap-1.5" key={key}>
              <span
                aria-hidden="true"
                className="h-0.5 w-3 shrink-0 rounded-full bg-(--swatch)"
                style={{ "--swatch": item.color } as CSSProperties}
              />
              {logo ? <EngineIcon className="size-3.5" engine={logo} /> : null}
              <span className="text-muted-foreground">
                {config[key]?.label ?? item.value}
              </span>
            </div>
          );
        })}
    </div>
  );
}
