"use client";

import { StatusBadge } from "@notra/ui/components/status-badge";
import { useTranslations } from "use-intl";

import { API_KEY_STATUS_BADGES } from "@/constants/api-keys";
import type { ApiKeyStatusBadgeProps } from "@/types/api-keys";

export function ApiKeyStatusBadge({ status }: ApiKeyStatusBadgeProps) {
  const t = useTranslations("apiKeys.status");
  return (
    <StatusBadge appearance={API_KEY_STATUS_BADGES[status]} label={t(status)} />
  );
}
