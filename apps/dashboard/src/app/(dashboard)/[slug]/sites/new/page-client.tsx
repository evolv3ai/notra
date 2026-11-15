"use client";

import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { Navigate } from "@tanstack/react-router";
import { useTranslations } from "use-intl";

import { EmptyState } from "@/components/empty-state";
import { SiteCreateForm } from "@/components/sites/site-create-form";
import { SitesPageShell } from "@/components/sites/sites-page-shell";
import { SitesUnavailableState } from "@/components/sites/sites-unavailable-state";
import { useActiveProject } from "@/lib/hooks/use-active-project";
import {
  useSiteCreationLimit,
  useSitesOrganizationId,
  useSitesStatus,
} from "@/lib/hooks/use-sites";
import type { SitesPageClientProps } from "@/types/sites";
import { sitesHref } from "@/utils/site-links";

import { NewSitePageSkeleton } from "./skeleton";

export default function PageClient({ organizationSlug }: SitesPageClientProps) {
  const t = useTranslations("sites.new");
  const tSites = useTranslations("sites");
  const tLimits = useTranslations("sites.planLimits");
  const tCommon = useTranslations("common");
  const organizationId = useSitesOrganizationId(organizationSlug);
  const statusQuery = useSitesStatus(organizationId);
  const siteLimit = useSiteCreationLimit(
    organizationId,
    statusQuery.data?.configured === true
  );
  const { projectId, isResolved, isError } = useActiveProject();

  if (!statusQuery.data) {
    if (statusQuery.isError) {
      return (
        <SitesPageShell>
          <PageHeading description={t("description")} title={t("title")} />
          <EmptyState
            description={tSites("loadFailed.description")}
            title={tSites("loadFailed.title")}
          />
        </SitesPageShell>
      );
    }
    return <NewSitePageSkeleton />;
  }

  if (!statusQuery.data.configured) {
    return (
      <SitesPageShell>
        <PageHeading description={t("description")} title={t("title")} />
        <SitesUnavailableState />
      </SitesPageShell>
    );
  }

  if (isError || (isResolved && !projectId)) {
    const state = isError ? "projectLoadFailed" : "projectRequired";
    return (
      <SitesPageShell>
        <PageHeading description={t("description")} title={t("title")} />
        <EmptyState
          description={tSites(`${state}.description`)}
          title={tSites(`${state}.title`)}
        />
      </SitesPageShell>
    );
  }

  if (siteLimit.failed) {
    return (
      <SitesPageShell>
        <PageHeading description={t("description")} title={t("title")} />
        <EmptyState
          actionLabel={tCommon("actions.retry")}
          description={tLimits("unavailableDescription")}
          onActionClick={() => siteLimit.retry()}
          title={tLimits("unavailableTitle")}
        />
      </SitesPageShell>
    );
  }

  if (!isResolved || !projectId || !siteLimit.settled) {
    return <NewSitePageSkeleton />;
  }

  if (siteLimit.blocked) {
    return (
      <Navigate
        replace
        search={{ project: projectId }}
        to={sitesHref(organizationSlug)}
      />
    );
  }

  return (
    <SitesPageShell>
      <SiteCreateForm
        key={projectId}
        hostingDomain={statusQuery.data.hostingDomain}
        organizationId={organizationId}
        organizationSlug={organizationSlug}
      />
    </SitesPageShell>
  );
}
