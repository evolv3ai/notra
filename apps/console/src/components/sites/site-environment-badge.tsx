"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@notra/ui/components/ui/badge";
import { cn } from "@notra/ui/lib/utils";

import { SITE_ENVIRONMENT_ICONS, SITE_KIND_LABELS } from "@/constants/sites";
import type { SiteEnvironmentBadgeProps } from "@/types/sites";

export function SiteEnvironmentBadge({
  kind,
  previewKey,
  className,
}: SiteEnvironmentBadgeProps) {
  return (
    <Badge
      className={cn("max-w-full rounded-md", className)}
      variant="secondary"
    >
      <HugeiconsIcon
        aria-hidden="true"
        icon={SITE_ENVIRONMENT_ICONS[kind]}
        strokeWidth={1.5}
      />
      <span className="min-w-0 truncate" title={previewKey ?? undefined}>
        {previewKey ?? SITE_KIND_LABELS[kind]}
      </span>
    </Badge>
  );
}
