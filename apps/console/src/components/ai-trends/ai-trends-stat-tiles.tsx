import { AiTrendsChange } from "@/components/ai-trends/ai-trends-change";
import type { AiTrendsStatTilesProps } from "@/types/ai-trends";
import { changeOrNull } from "@/utils/ai-trends";

/** Readouts above a chart, inside the same card surface. */
export function AiTrendsStatTiles({ stats, format }: AiTrendsStatTilesProps) {
  return (
    <div className="border-border/80 grid gap-4 border-b pb-4 sm:grid-cols-2">
      {stats.map((stat) => (
        <div className="flex min-w-0 flex-col gap-1" key={stat.label}>
          <p className="text-muted-foreground text-xs">{stat.label}</p>
          <p className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums">
              {format(stat.value)}
            </span>
            <AiTrendsChange
              change={changeOrNull(stat.value, stat.previous)}
              className="text-sm font-medium"
              empty=""
            />
          </p>
          <p className="text-muted-foreground truncate text-xs">{stat.hint}</p>
        </div>
      ))}
    </div>
  );
}
