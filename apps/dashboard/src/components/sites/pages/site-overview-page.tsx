"use client";

import {
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  PlusSignIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { InstrumentSection } from "ui/card";
import { useTranslations } from "use-intl";

import { Button, buttonVariants } from "@/components/button";
import Link from "@/components/framework/link";
import { useSite } from "@/components/sites/site-context";
import { SiteDeploymentsTable } from "@/components/sites/site-deployments-table";
import { SiteOverviewHero } from "@/components/sites/site-overview-hero";
import { SitePreviewsTable } from "@/components/sites/site-previews-table";
import { SiteVisitorsCard } from "@/components/sites/site-visitors-card";
import {
  SITE_OVERVIEW_PREVIEWS_LIMIT,
  SITE_RECENT_DEPLOYMENTS_LIMIT,
  SITE_TABLE_COMPACT_EMPTY_HEIGHT,
} from "@/constants/sites";
import { useDeployLatest } from "@/lib/hooks/use-site-deployments";
import { useSitePlanLimitReached } from "@/lib/hooks/use-sites";
import type { SiteViewAllLinkProps } from "@/types/components/sites";
import { siteHref, sitePreviewDeploymentsHref } from "@/utils/site-links";
import { sitePreviewRows } from "@/utils/site-previews";

function ViewAllLink({ href, label }: SiteViewAllLinkProps) {
  return (
    <Link
      className={buttonVariants({ size: "sm", variant: "ghost" })}
      href={href}
    >
      {label}
      <HugeiconsIcon
        aria-hidden="true"
        data-icon="inline-end"
        icon={ArrowRight01Icon}
        strokeWidth={1.5}
      />
    </Link>
  );
}

export function SiteOverviewPage() {
  const tSites = useTranslations("sites");
  const t = useTranslations("sites.overviewPage");
  const tDetail = useTranslations("sites.detail");
  const tStatus = useTranslations("sites.status");
  const { organizationId, organizationSlug, siteId, detail, liveDeployment } =
    useSite();
  const { site, deployments } = detail;
  const suspended = site.status === "suspended";
  const siteLimitReached = useSitePlanLimitReached(organizationId, "sites");
  const deployLatest = useDeployLatest({ organizationId, siteId });
  const previews = sitePreviewRows(detail);
  const latestProduction =
    deployments.find((deployment) => deployment.kind === "production") ?? null;

  return (
    <div className="space-y-6">
      <PageHeading title={site.name}>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {liveDeployment ? (
            <a
              className={buttonVariants({ variant: "secondary" })}
              href={site.liveUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              {t("visitSite")}
              <HugeiconsIcon
                aria-hidden="true"
                data-icon="inline-end"
                icon={ArrowUpRight01Icon}
                strokeWidth={1.5}
              />
            </a>
          ) : null}
          {siteLimitReached ? null : (
            <Link
              className={buttonVariants()}
              href={`/${organizationSlug}/sites/new?project=${encodeURIComponent(site.projectId)}`}
            >
              <HugeiconsIcon
                aria-hidden="true"
                data-icon="inline-start"
                icon={PlusSignIcon}
                strokeWidth={1.5}
              />
              {tSites("newSite")}
            </Link>
          )}
        </div>
      </PageHeading>
      <span aria-live="polite" className="sr-only">
        {latestProduction
          ? tDetail("statusAnnouncement", {
              status: tStatus(latestProduction.status),
            })
          : null}
      </span>

      <SiteOverviewHero />

      {site.analyticsEnabled ? <SiteVisitorsCard /> : null}

      <InstrumentSection
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ViewAllLink
              href={siteHref(organizationSlug, siteId, "deployments")}
              label={tSites("list.viewDeployments")}
            />
            <Button
              disabled={suspended}
              loading={deployLatest.isPending}
              onClick={() => deployLatest.mutate()}
              size="sm"
              variant="outline"
            >
              <HugeiconsIcon
                aria-hidden="true"
                data-icon="inline-start"
                icon={RefreshIcon}
                strokeWidth={1.5}
              />
              {tDetail("deployLatest")}
            </Button>
          </div>
        }
        eyebrow={t("activity")}
      >
        <SiteDeploymentsTable
          deployments={deployments}
          emptyHeight={SITE_TABLE_COMPACT_EMPTY_HEIGHT}
          emptyState={
            <p className="text-sm text-pretty">
              {t("activityEmptyDescription", {
                branch: site.productionBranch,
              })}
            </p>
          }
          organizationId={organizationId}
          organizationSlug={organizationSlug}
          pageSize={SITE_RECENT_DEPLOYMENTS_LIMIT}
          siteId={siteId}
        />
      </InstrumentSection>

      {previews.length > 0 ? (
        <InstrumentSection
          action={
            <ViewAllLink
              href={sitePreviewDeploymentsHref(organizationSlug, siteId)}
              label={t("viewAll")}
            />
          }
          eyebrow={t("previews")}
        >
          <SitePreviewsTable
            compact
            organizationId={organizationId}
            organizationSlug={organizationSlug}
            repository={site.repository}
            rows={previews.slice(0, SITE_OVERVIEW_PREVIEWS_LIMIT)}
            siteId={siteId}
          />
        </InstrumentSection>
      ) : null}
    </div>
  );
}
