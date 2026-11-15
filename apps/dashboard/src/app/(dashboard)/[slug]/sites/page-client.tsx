"use client";

import { PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { Navigate } from "@tanstack/react-router";
import { useTranslations } from "use-intl";

import { buttonVariants } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import Link from "@/components/framework/link";
import { SitesEmptyState } from "@/components/sites/sites-empty-state";
import { SitesList } from "@/components/sites/sites-list";
import { SitesPageShell } from "@/components/sites/sites-page-shell";
import { SitesUnavailableState } from "@/components/sites/sites-unavailable-state";
import { useActiveProject } from "@/lib/hooks/use-active-project";
import {
  useSitePlanLimitReached,
  useSitesList,
  useSitesOrganizationId,
} from "@/lib/hooks/use-sites";
import { cn } from "@/lib/utils";
import type { ProjectSitesListProps } from "@/types/components/sites";
import type { SitesPageClientProps } from "@/types/sites";
import { siteHref } from "@/utils/site-links";
import { resolvedSiteProjectId } from "@/utils/site-project";

import { SitesPageSkeleton } from "./skeleton";

export default function PageClient({
  organizationSlug,
  showAll = false,
}: SitesPageClientProps) {
  const t = useTranslations("sites");
  const organizationId = useSitesOrganizationId(organizationSlug);
  const activeProject = useActiveProject();
  const projectId = resolvedSiteProjectId(activeProject);

  if (activeProject.isError || (activeProject.isResolved && !projectId)) {
    const state = activeProject.isError
      ? "projectLoadFailed"
      : "projectRequired";
    return (
      <SitesPageShell>
        <PageHeading description={t("description")} title={t("title")} />
        <EmptyState
          description={t(`${state}.description`)}
          title={t(`${state}.title`)}
        />
      </SitesPageShell>
    );
  }

  if (!projectId) {
    return <SitesPageSkeleton />;
  }

  return (
    <ProjectSitesList
      organizationId={organizationId}
      organizationSlug={organizationSlug}
      projectId={projectId}
      showAll={showAll}
    />
  );
}

function ProjectSitesList({
  organizationId,
  organizationSlug,
  projectId,
  showAll,
}: ProjectSitesListProps) {
  const t = useTranslations("sites");
  const listQuery = useSitesList(organizationId, projectId);
  const siteLimitReached = useSitePlanLimitReached(organizationId, "sites");
  const newSiteHref = `/${organizationSlug}/sites/new?project=${encodeURIComponent(projectId)}`;

  if (!listQuery.data) {
    if (listQuery.isError) {
      return (
        <SitesPageShell>
          <PageHeading description={t("description")} title={t("title")} />
          <EmptyState
            description={t("loadFailed.description")}
            title={t("loadFailed.title")}
          />
        </SitesPageShell>
      );
    }
    return <SitesPageSkeleton />;
  }

  const { configured, sites } = listQuery.data;
  const [onlySite, ...otherSites] = sites;
  if (configured && !showAll && onlySite && otherSites.length === 0) {
    return (
      <Navigate
        replace
        search={{ project: onlySite.projectId }}
        to={siteHref(organizationSlug, onlySite.id)}
      />
    );
  }
  const newSiteButton = siteLimitReached ? null : (
    <Link
      className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
      href={newSiteHref}
    >
      <HugeiconsIcon className="size-4" icon={PlusSignIcon} />
      {t("newSite")}
    </Link>
  );

  if (!configured) {
    return (
      <SitesPageShell>
        <PageHeading description={t("description")} title={t("title")} />
        <SitesUnavailableState />
      </SitesPageShell>
    );
  }

  return (
    <SitesPageShell>
      <PageHeading description={t("description")} title={t("title")}>
        {sites.length > 0 ? newSiteButton : null}
      </PageHeading>
      {sites.length === 0 ? (
        <SitesEmptyState newSiteHref={siteLimitReached ? null : newSiteHref} />
      ) : (
        <SitesList
          organizationId={organizationId}
          organizationSlug={organizationSlug}
          sites={sites}
        />
      )}
    </SitesPageShell>
  );
}
