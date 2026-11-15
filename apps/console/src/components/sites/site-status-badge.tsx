"use client";

import { cn } from "@notra/ui/lib/utils";

import { StatusBadge } from "@/components/status-badge";
import { SITE_STATUS_BADGES, SITE_STATUS_LABELS } from "@/constants/sites";
import type { SiteStatusBadgeProps } from "@/types/sites";

export function SiteStatusBadge({
  status,
  duration,
  className,
}: SiteStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center gap-1.5 text-sm",
        className
      )}
    >
      <StatusBadge
        appearance={SITE_STATUS_BADGES[status]}
        label={SITE_STATUS_LABELS[status]}
      />
      {duration ? (
        <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
          {duration}
        </span>
      ) : null}
    </span>
  );
}
