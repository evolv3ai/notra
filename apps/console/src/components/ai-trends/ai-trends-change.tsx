import { cn } from "@notra/ui/lib/utils";

import type { AiTrendsChangeProps } from "@/types/ai-trends";
import { changeTone, formatChange } from "@/utils/ai-trends";

/** A signed percentage, colored once it moves past `threshold`. */
export function AiTrendsChange({
  change,
  threshold,
  empty = "–",
  className,
}: AiTrendsChangeProps) {
  return (
    <span
      className={cn("tabular-nums", changeTone(change, threshold), className)}
    >
      {change === null ? empty : formatChange(change)}
    </span>
  );
}
