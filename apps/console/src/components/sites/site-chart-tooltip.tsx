"use client";

import type { SiteChartTooltipProps } from "@/types/sites";
import { formatChartDay } from "@/utils/site-charts";

export function SiteChartTooltip({
  active,
  payload,
  label,
  config,
}: SiteChartTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="border-border/50 bg-background grid min-w-32 gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{formatChartDay(String(label))}</div>
      {payload
        .filter((item) => item.type !== "none")
        .map((item) => (
          <div
            className="flex items-center gap-2"
            key={String(item.dataKey ?? item.name)}
          >
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-xs"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-muted-foreground flex-1">
              {config[String(item.dataKey ?? item.name)]?.label ?? item.name}
            </span>
            {item.value == null ? null : (
              <span className="text-foreground font-mono font-medium tabular-nums">
                {item.value.toLocaleString("en")}
              </span>
            )}
          </div>
        ))}
    </div>
  );
}
