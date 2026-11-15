"use client";

import { isGeoStatDeltaNew } from "@notra/geo-core/utils/ai-traffic";
import { FadeSwap } from "@notra/ui/components/fade-swap";
import { TrendBadge } from "@notra/ui/components/trend-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { useLocale, useTranslations } from "use-intl";

import type { GeoStatDeltaProps } from "@/types/geo";
import { formatGeoStatDelta, geoStatDeltaTone } from "@/utils/geo-charts";

export function GeoStatDelta({
  delta,
  kind = "mentions",
  variant = "pill",
  animated = false,
  label,
  hint,
  className,
}: GeoStatDeltaProps) {
  const locale = useLocale();
  const tCommon = useTranslations("common");
  const tUnits = useTranslations("common.units");
  if (delta === null) {
    return null;
  }

  const tone = geoStatDeltaTone(delta, kind);
  const formatted = formatGeoStatDelta(delta, kind, locale, {
    new: tCommon("labels.new"),
    points: (value) => tUnits("points", { value }),
  });
  const isNew = isGeoStatDeltaNew(delta);
  const displayedValue =
    variant === "plain" ? formatted.replace(/^[+-]/, "") : formatted;
  const staticContent = (
    <TrendBadge
      appearance={variant === "plain" ? "plain" : "badge"}
      className={className}
      showIcon={!isNew}
      tone={tone}
    >
      {displayedValue}
    </TrendBadge>
  );
  const content = animated ? (
    <FadeSwap swapKey={`${tone}:${formatted}`} value={delta}>
      {staticContent}
    </FadeSwap>
  ) : (
    staticContent
  );

  if (!hint) {
    return content;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            aria-label={
              label ? `${label} ${formatted} ${hint}` : `${formatted} ${hint}`
            }
            className="inline-flex shrink-0 cursor-help"
            type="button"
          />
        }
      >
        {content}
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}
