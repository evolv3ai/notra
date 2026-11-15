import { TruncateWithTooltip } from "@notra/ui/components/shared/truncate-with-tooltip";
import { useTranslations } from "use-intl";

import type { JourneyPathSummaryProps } from "@/types/geo";
import { normalizeGeoJourneyPath } from "@/utils/geo-journey";

export function JourneyPathSummary({
  entryPath,
  paths,
  distinctPaths,
}: JourneyPathSummaryProps) {
  const t = useTranslations("geo.journeyPathSummary");
  if (!entryPath) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  const sampled = new Set(paths.map(normalizeGeoJourneyPath)).size;
  const more = Math.max(distinctPaths, sampled) - 1;

  return (
    <span className="flex min-w-0 items-center gap-2">
      <TruncateWithTooltip className="w-auto font-mono text-sm">
        {normalizeGeoJourneyPath(entryPath)}
      </TruncateWithTooltip>
      {more > 0 ? (
        <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
          {t("morePages", { count: more })}
        </span>
      ) : null}
    </span>
  );
}
