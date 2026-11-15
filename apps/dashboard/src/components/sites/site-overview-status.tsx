"use client";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTranslations } from "use-intl";

import Link from "@/components/framework/link";
import { useSite } from "@/components/sites/site-context";
import {
  SiteOfflineStatus,
  SiteStatusBadge,
} from "@/components/sites/site-status-badge";
import { useNow } from "@/lib/hooks/use-now";
import type {
  SiteOverviewStatusProps,
  SiteProductionBuildProps,
} from "@/types/components/sites";
import {
  deploymentElapsedMs,
  formatBuildDuration,
  isDeploymentInProgress,
} from "@/utils/site-deployments";
import { siteDeploymentHref } from "@/utils/site-links";

function ProductionBuild({ deployment }: SiteProductionBuildProps) {
  const t = useTranslations("sites.overviewPage");
  const { organizationSlug, siteId } = useSite();
  const inProgress = isDeploymentInProgress(deployment.status);
  const now = useNow(inProgress);
  const duration = inProgress
    ? formatBuildDuration(deploymentElapsedMs(deployment, now))
    : null;

  return (
    <Link
      className="group text-foreground hover:bg-background/70 -me-2 inline-flex min-h-7 items-center gap-2 rounded-md px-2 text-sm transition-colors duration-150"
      href={siteDeploymentHref(organizationSlug, siteId, deployment.id)}
    >
      <SiteStatusBadge duration={duration} status={deployment.status} />
      {!inProgress && (
        <span className="text-muted-foreground group-hover:text-foreground inline-flex items-center gap-1 transition-colors duration-150 max-sm:hidden">
          {t("viewLogs")}
          <HugeiconsIcon
            aria-hidden="true"
            className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
            icon={ArrowRight01Icon}
            strokeWidth={1.5}
          />
        </span>
      )}
    </Link>
  );
}

export function SiteOverviewStatus({
  deployment,
  suspended,
}: SiteOverviewStatusProps) {
  if (suspended) {
    return <SiteOfflineStatus />;
  }
  return deployment ? <ProductionBuild deployment={deployment} /> : null;
}
