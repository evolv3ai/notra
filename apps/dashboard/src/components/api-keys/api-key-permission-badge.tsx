"use client";

import { StatusBadge } from "@notra/ui/components/status-badge";
import { useTranslations } from "use-intl";

import { API_KEY_PERMISSION_BADGES } from "@/constants/api-keys";
import type { ApiKeyPermissionBadgeProps } from "@/types/api-keys";

export function ApiKeyPermissionBadge({
  permission,
}: ApiKeyPermissionBadgeProps) {
  const t = useTranslations("apiKeys");
  return (
    <StatusBadge
      appearance={API_KEY_PERMISSION_BADGES[permission]}
      label={t("permissionSummary", { permission })}
    />
  );
}
