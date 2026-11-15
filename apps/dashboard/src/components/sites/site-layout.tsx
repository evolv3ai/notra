"use client";

import { CloudOffIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@notra/ui/components/ui/alert";
import { ORPCError } from "@orpc/client";
import { useEffect } from "react";
import { useTranslations } from "use-intl";

import { buttonVariants } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import Link from "@/components/framework/link";
import { SkeletonCrossfade } from "@/components/skeleton-crossfade";
import { useGeoProjectQueryState } from "@/lib/hooks/use-geo-project-query";
import { useIsClient } from "@/lib/hooks/use-is-client";
import { usePrefetchSiteWorkspace } from "@/lib/hooks/use-prefetch-site-workspace";
import { useSiteDetail, useSitesOrganizationId } from "@/lib/hooks/use-sites";
import type {
  SiteLayoutProps,
  SiteLoadErrorProps,
} from "@/types/components/sites";
import { siteHref } from "@/utils/site-links";

import { SiteChangesBanner } from "./site-changes-banner";
import { SiteContext } from "./site-context";
import { SiteHeader } from "./site-header";
import { SitePublishConfetti } from "./site-publish-confetti";
import { SitePageSkeleton } from "./site-route-skeleton";
import { SiteMobileNav, SiteSidebar } from "./site-sidebar";
import { SiteWorkspace } from "./site-workspace";
import { SitesPageShell } from "./sites-page-shell";
import { SitesUnavailableState } from "./sites-unavailable-state";

export function SiteLayout({
  organizationSlug,
  siteId,
  children,
}: SiteLayoutProps) {
  const t = useTranslations("sites.detail");
  const organizationId = useSitesOrganizationId(organizationSlug);
  const detailQuery = useSiteDetail(organizationId, siteId);
  const [projectParam, setProjectParam] = useGeoProjectQueryState();
  const owningProjectId = detailQuery.data?.site.projectId;
  usePrefetchSiteWorkspace(organizationId, siteId, owningProjectId ?? "");
  const hydrated = useIsClient();
  // Links inside the site (deployment rows, "View logs") carry no ?project;
  // the effect below adds it. Only another project's param hides the layout,
  // otherwise every such click would remount it behind a skeleton.
  const ready =
    hydrated &&
    Boolean(detailQuery.data) &&
    (projectParam === null || projectParam === owningProjectId);

  useEffect(() => {
    if (owningProjectId && projectParam !== owningProjectId) {
      setProjectParam(owningProjectId);
    }
  }, [owningProjectId, projectParam, setProjectParam]);

  if (!detailQuery.data && detailQuery.error) {
    return (
      <SiteLoadError
        error={detailQuery.error}
        organizationSlug={organizationSlug}
      />
    );
  }

  const detail = detailQuery.data;
  const liveDeployment =
    detail?.deployments.find(
      (deployment) => deployment.id === detail.site.liveDeploymentId
    ) ?? null;

  return (
    <>
      <SkeletonCrossfade
        loading={!ready || !detail}
        skeleton={<SitePageSkeleton />}
      >
        {ready && detail ? (
          <SiteContext
            value={{
              organizationId,
              organizationSlug,
              siteId,
              detail,
              liveDeployment,
            }}
          >
            <SitePublishConfetti />
            <SiteWorkspace>
              <div
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
                data-site-frame=""
              >
                <SiteHeader
                  organizationId={organizationId}
                  site={detail.site}
                  slug={organizationSlug}
                />
                <div className="flex min-h-0 flex-1">
                  <SiteSidebar />
                  <div className="scrollbar-stable flex min-h-0 min-w-0 flex-1 scrollbar-thin flex-col overflow-x-hidden overflow-y-auto">
                    <SiteMobileNav />
                    <SiteChangesBanner />
                    <SitesPageShell>
                      {detail.site.status === "suspended" ? (
                        <Alert role="status">
                          <HugeiconsIcon
                            aria-hidden="true"
                            icon={CloudOffIcon}
                            strokeWidth={1.5}
                          />
                          <AlertTitle>{t("offline")}</AlertTitle>
                          <AlertDescription>
                            {t("offlineDescription")}{" "}
                            <Link
                              href={siteHref(
                                organizationSlug,
                                siteId,
                                "settings"
                              )}
                            >
                              {t("offlineAction")}
                            </Link>
                          </AlertDescription>
                        </Alert>
                      ) : null}
                      {children}
                    </SitesPageShell>
                  </div>
                </div>
              </div>
            </SiteWorkspace>
          </SiteContext>
        ) : null}
      </SkeletonCrossfade>
    </>
  );
}

function SiteLoadError({ error, organizationSlug }: SiteLoadErrorProps) {
  const t = useTranslations("sites.detail");
  if (error instanceof ORPCError && error.code === "SERVICE_UNAVAILABLE") {
    return (
      <SitesPageShell>
        <SitesUnavailableState />
      </SitesPageShell>
    );
  }
  const state =
    error instanceof ORPCError && error.code === "NOT_FOUND"
      ? "notFound"
      : "loadFailed";
  return (
    <SitesPageShell>
      <EmptyState
        action={
          <Link
            className={buttonVariants({ variant: "outline" })}
            href={`/${organizationSlug}/sites?view=all`}
          >
            {t("backToSites")}
          </Link>
        }
        description={t(`${state}.description`)}
        title={t(`${state}.title`)}
      />
    </SitesPageShell>
  );
}
