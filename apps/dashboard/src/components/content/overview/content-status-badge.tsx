"use client";

import { StatusBadge } from "@notra/ui/components/status-badge";
import { useTranslations } from "use-intl";

import { CONTENT_STATUS_BADGES } from "@/constants/content-overview";
import type { ContentStatusBadgeProps } from "@/types/content/overview";

export function ContentStatusBadge({ status }: ContentStatusBadgeProps) {
  const t = useTranslations("content.overview.status");
  const appearance = CONTENT_STATUS_BADGES[status];
  return <StatusBadge appearance={appearance} label={t(status)} />;
}
