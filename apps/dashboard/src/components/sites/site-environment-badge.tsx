"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@notra/ui/components/ui/badge";
import { useTranslations } from "use-intl";

import { SITE_ENVIRONMENT_ICONS } from "@/constants/sites";
import { cn } from "@/lib/utils";
import type { SiteEnvironmentBadgeProps } from "@/types/components/sites";

export function SiteEnvironmentBadge({
  kind,
  previewKey,
  className,
}: SiteEnvironmentBadgeProps) {
  const t = useTranslations("sites.kinds");
  return (
    <Badge
      className={cn("max-w-full", className)}
      shape="rounded"
      size="md"
      variant="secondary"
    >
      <HugeiconsIcon
        aria-hidden="true"
        icon={SITE_ENVIRONMENT_ICONS[kind]}
        strokeWidth={1.5}
      />
      <span className="min-w-0 truncate" title={previewKey ?? undefined}>
        {previewKey ?? t(kind)}
      </span>
    </Badge>
  );
}
