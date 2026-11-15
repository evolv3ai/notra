"use client";

import { Badge } from "@notra/ui/components/ui/badge";
import { useTranslations } from "use-intl";

import { cn } from "@/lib/utils";
import type { BrandTrackingBadgeProps } from "@/types/geo";

export function BrandTrackingBadge({
  tracked,
  className,
}: BrandTrackingBadgeProps) {
  const tGeoShared = useTranslations("geo.shared");
  return (
    <Badge
      className={cn("text-muted-foreground shrink-0 font-normal", className)}
      variant={tracked ? "secondary" : "outline"}
    >
      {tracked ? tGeoShared("tracked") : tGeoShared("discovered")}
    </Badge>
  );
}
