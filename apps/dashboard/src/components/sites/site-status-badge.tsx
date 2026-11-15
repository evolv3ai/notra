"use client";

import { StatusBadge } from "@notra/ui/components/status-badge";
import { Badge } from "@notra/ui/components/ui/badge";
import { useTranslations } from "use-intl";

import { SITE_STATUS_BADGES } from "@/constants/sites";
import { cn } from "@/lib/utils";
import type { SiteStatusBadgeProps } from "@/types/components/sites";

export function SiteStatusBadge({
  status,
  duration,
  className,
}: SiteStatusBadgeProps) {
  const t = useTranslations("sites.status");
  const label = t(status === "uploading" ? "building" : status);
  const appearance = SITE_STATUS_BADGES[status];
  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center gap-1.5 text-sm",
        className
      )}
    >
      <StatusBadge appearance={appearance} label={label} />
      {duration ? (
        <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
          {duration}
        </span>
      ) : null}
    </span>
  );
}

export function SiteOfflineStatus() {
  const t = useTranslations("sites.status");
  return (
    <Badge shape="rounded" size="md" variant="secondary">
      {t("offline")}
    </Badge>
  );
}
