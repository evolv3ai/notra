"use client";

import {
  ArrowUpRight01Icon,
  ChartLineData01Icon,
  GitBranchIcon,
  GithubIcon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { trafficVisitDelta } from "@notra/geo-core/utils/ai-traffic";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@notra/ui/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { useState } from "react";
import { useLocale, useTranslations } from "use-intl";

import { Button } from "@/components/button";
import Link from "@/components/framework/link";
import { GeoStatDelta } from "@/components/geo/geo-stat-delta";
import { SiteDeleteDialog } from "@/components/sites/site-delete-dialog";
import { SiteListMenuItems } from "@/components/sites/site-list-menu-items";
import { SiteRelativeTime } from "@/components/sites/site-relative-time";
import {
  SiteOfflineStatus,
  SiteStatusBadge,
} from "@/components/sites/site-status-badge";
import { SITE_OVERVIEW_ANALYTICS_DAYS } from "@/constants/sites";
import { useRedeployDeployment } from "@/lib/hooks/use-site-deployments";
import { useSiteAnalytics } from "@/lib/hooks/use-sites";
import type {
  SiteListCardProps,
  SitesListProps,
  SiteVisitorsSummaryProps,
} from "@/types/components/sites";
import type { SiteListItem } from "@/types/sites";
import { formatMetric } from "@/utils/analytics-charts";
import { commitTitle } from "@/utils/site-deployments";
import { displayUrl, githubRepositoryUrl, siteHref } from "@/utils/site-links";

function SiteVisitorsSummary({
  organizationId,
  site,
}: SiteVisitorsSummaryProps) {
  const locale = useLocale();
  const t = useTranslations("sites.list");
  const query = useSiteAnalytics(organizationId, site.id, {
    days: SITE_OVERVIEW_ANALYTICS_DAYS,
  });
  const totals = query.data?.web.totals;
  if (!totals) {
    return null;
  }
  return (
    <span className="inline-flex items-center gap-2 text-xs whitespace-nowrap">
      <HugeiconsIcon
        aria-hidden="true"
        className="size-4"
        icon={ChartLineData01Icon}
        strokeWidth={1.5}
      />
      <span>
        <span className="text-foreground font-medium tabular-nums">
          {formatMetric(totals.visitors, locale, "-")}
        </span>{" "}
        {t("visitors")}
      </span>
      <GeoStatDelta
        delta={trafficVisitDelta(totals.visitors, totals.previousVisitors)}
      />
    </span>
  );
}

function SiteListCard({
  organizationId,
  organizationSlug,
  site,
}: SiteListCardProps) {
  const t = useTranslations("sites.list");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const redeploy = useRedeployDeployment({ organizationId, siteId: site.id });
  const latest = site.latestDeployment;
  const title = commitTitle(latest?.commitMessage ?? null);
  const href = siteHref(organizationSlug, site.id, "overview", site.projectId);
  const status = latest ? (
    <Tooltip>
      <TooltipTrigger className="focus-visible:outline-ring inline-flex rounded-md focus-visible:outline-2 focus-visible:outline-offset-2">
        <SiteStatusBadge status={latest.status} />
      </TooltipTrigger>
      <TooltipContent>
        {t.rich("deploymentCreated", {
          time: () => <SiteRelativeTime date={latest.createdAt} inline />,
        })}
      </TooltipContent>
    </Tooltip>
  ) : null;

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <li className="border-shell-border bg-shell relative isolate min-w-0 overflow-hidden rounded-2xl border px-0.5 pt-0.5" />
          }
        >
          <div className="border-table-card-border bg-table-card shadow-table-card grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-[14px] border px-4 py-3 sm:flex sm:flex-wrap sm:gap-x-4">
            <div className="col-start-1 row-start-1 min-w-0 flex-1 space-y-1 sm:basis-56">
              <h2 className="text-sm font-medium">
                <Link
                  className="block wrap-break-word after:absolute after:inset-0 after:rounded-2xl hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
                  href={href}
                >
                  {site.name}
                </Link>
              </h2>
              <a
                className="text-muted-foreground hover:text-foreground decoration-border relative z-10 block truncate text-xs underline underline-offset-4"
                href={site.liveUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                {displayUrl(site.liveUrl)}
              </a>
            </div>
            {site.repository ? (
              <a
                className="border-border text-foreground hover:bg-muted relative z-10 col-start-1 row-start-2 inline-flex max-w-full items-center gap-1.5 justify-self-start rounded-full border px-2.5 py-1 text-xs"
                href={githubRepositoryUrl(site.repository)}
                rel="noopener noreferrer"
                target="_blank"
              >
                <HugeiconsIcon
                  aria-hidden="true"
                  className="size-3.5 shrink-0"
                  icon={GithubIcon}
                  strokeWidth={1.5}
                />
                <span className="truncate">
                  {site.repository.owner}/{site.repository.name}
                </span>
              </a>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    aria-label={t("actionsLabel", { name: site.name })}
                    className="relative z-10 col-start-2 row-start-1 sm:order-last"
                    size="icon-sm"
                    variant="ghost"
                  />
                }
              >
                <HugeiconsIcon
                  aria-hidden="true"
                  icon={MoreHorizontalIcon}
                  size={16}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                <SiteListMenuItems
                  organizationSlug={organizationSlug}
                  site={site}
                  onDelete={() => setDeleteOpen(true)}
                  onRedeploy={() => latest && redeploy.mutate(latest.id)}
                  redeployPending={redeploy.isPending}
                  variant="dropdown"
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 px-3.5 py-2">
            <Link
              className="hover:text-foreground relative z-10 inline-flex min-w-0 flex-1 basis-full items-center gap-2 text-xs sm:basis-48"
              href={siteHref(
                organizationSlug,
                site.id,
                "deployments",
                site.projectId
              )}
            >
              <HugeiconsIcon
                aria-hidden="true"
                className="size-4 shrink-0"
                icon={title ? GitBranchIcon : ArrowUpRight01Icon}
                strokeWidth={1.5}
              />
              <span className="truncate">
                {title ?? t(latest ? "viewDeployments" : "noDeployments")}
              </span>
            </Link>
            <span className="relative z-10 inline-flex flex-wrap items-center gap-1.5">
              {site.status === "suspended" ? <SiteOfflineStatus /> : null}
              {status}
            </span>
            {site.status !== "suspended" && site.analyticsEnabled ? (
              <SiteVisitorsSummary
                organizationId={organizationId}
                site={site}
              />
            ) : null}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <SiteListMenuItems
            organizationSlug={organizationSlug}
            site={site}
            onDelete={() => setDeleteOpen(true)}
            onRedeploy={() => latest && redeploy.mutate(latest.id)}
            redeployPending={redeploy.isPending}
            variant="context"
          />
        </ContextMenuContent>
      </ContextMenu>
      {deleteOpen ? (
        <SiteDeleteDialog
          open
          organizationId={organizationId}
          organizationSlug={organizationSlug}
          siteId={site.id}
          siteName={site.name}
          onOpenChange={setDeleteOpen}
        />
      ) : null}
    </>
  );
}

function lastActivityAt(site: SiteListItem): number {
  return new Date(site.latestDeployment?.createdAt ?? site.createdAt).getTime();
}

export function SitesList({
  organizationId,
  organizationSlug,
  sites,
}: SitesListProps) {
  return (
    <ul className="space-y-3">
      {sites
        .toSorted((a, b) => lastActivityAt(b) - lastActivityAt(a))
        .map((site) => (
          <SiteListCard
            key={site.id}
            organizationId={organizationId}
            organizationSlug={organizationSlug}
            site={site}
          />
        ))}
    </ul>
  );
}
