"use client";

import { TrendBadge } from "@notra/ui/components/trend-badge";
import { Badge } from "@notra/ui/components/ui/badge";
import { useTranslations } from "use-intl";

import type { AgentReadinessChangeBadgeProps } from "@/types/agent-readiness";

export function AgentReadinessChangeBadge({
  change,
}: AgentReadinessChangeBadgeProps) {
  const t = useTranslations("geo.agentReadiness.changes");

  if (!change) {
    return null;
  }
  if (change === "added") {
    return (
      <Badge shape="rounded" size="sm" variant="info">
        {t(change)}
      </Badge>
    );
  }
  return (
    <TrendBadge size="sm" tone={change === "improved" ? "up" : "down"}>
      {t(change)}
    </TrendBadge>
  );
}
