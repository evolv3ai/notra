"use client";

import { TrendBadge } from "@notra/ui/components/trend-badge";
import { useTranslations } from "use-intl";

import type { DirectionDeltaProps } from "@/types/geo-directions";
import {
  directionDeltaTone,
  formatDirectionDelta,
} from "@/utils/geo-directions";

export function DirectionDelta({ delta, className }: DirectionDeltaProps) {
  const t = useTranslations("geo.directions.delta");
  const tone = directionDeltaTone(delta);

  return (
    <TrendBadge className={className} tone={tone}>
      {t("points", { delta: formatDirectionDelta(delta) })}
    </TrendBadge>
  );
}
