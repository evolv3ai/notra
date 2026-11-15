import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { TABLE_BODY_CLASS, TABLE_FRAME_CLASS } from "ui/table/constants";

import { cn } from "@/lib/utils";
import type { AutopilotStatStripProps } from "@/types/autopilot";

/** A row of numbers in the same grey shell and lifted card as the tables. */
export function AutopilotStatStrip({ stats, busy }: AutopilotStatStripProps) {
  return (
    <div className={TABLE_FRAME_CLASS}>
      <dl
        aria-busy={busy}
        className={cn(
          TABLE_BODY_CLASS,
          "divide-border grid grid-cols-2 divide-x overflow-hidden",
          stats.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4"
        )}
      >
        {stats.map((stat) => (
          <div
            className="flex min-w-0 flex-col gap-0.5 px-4 py-3"
            key={stat.label}
          >
            <dt className="text-muted-foreground truncate text-xs">
              {stat.label}
            </dt>
            <dd className="order-first flex items-center gap-2 text-base font-semibold tracking-tight tabular-nums">
              {busy ? <Skeleton className="h-6 w-10" /> : (stat.value ?? "—")}
              {busy ? null : stat.trend}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
