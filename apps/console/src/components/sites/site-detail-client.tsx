"use client";

import {
  ArrowLeft01Icon,
  GitBranchIcon,
  LinkSquare02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@notra/ui/components/ui/badge";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Link from "next/link";

import { Button } from "@/components/button";
import { SiteAnalyticsCard } from "@/components/sites/site-analytics-card";
import { SiteDeploymentsTable } from "@/components/sites/site-deployments-table";
import { SiteModerationActions } from "@/components/sites/site-moderation-actions";
import { SiteRelativeTime } from "@/components/sites/site-relative-time";
import { StatusBadge } from "@/components/status-badge";
import {
  SITE_ACTIVE_REFETCH_MS,
  SITE_DOMAIN_STATUS_BADGES,
  SITE_DOMAIN_STATUS_LABELS,
  SITE_IDLE_REFETCH_MS,
} from "@/constants/sites";
import { consoleOrpc } from "@/lib/orpc/query";
import type { SiteDetailClientProps } from "@/types/sites";
import { isDeploymentInProgress, displayUrl } from "@/utils/site-deployments";

const SiteBuildCharts = dynamic(
  () =>
    import("@/components/sites/site-build-charts").then(
      (module) => module.SiteBuildCharts
    ),
  { loading: () => <Skeleton className="h-64 rounded-xl" /> }
);

function SectionHeading({ children }: { children: string }) {
  return <h2 className="text-base font-medium">{children}</h2>;
}

export function SiteDetailClient({
  slug,
  siteId,
  action,
}: SiteDetailClientProps) {
  const siteQuery = useQuery({
    ...consoleOrpc.sites.get.queryOptions({ input: { siteId } }),
    refetchInterval: (query) =>
      query.state.data?.deployments.some((deployment) =>
        isDeploymentInProgress(deployment.status)
      )
        ? SITE_ACTIVE_REFETCH_MS
        : SITE_IDLE_REFETCH_MS,
  });

  const backLink = (
    <Link
      className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm"
      href={`/${slug}/sites`}
    >
      <HugeiconsIcon className="-ms-1 size-4" icon={ArrowLeft01Icon} />
      All sites
    </Link>
  );

  if (siteQuery.isPending) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
        {backLink}
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </main>
    );
  }
  if (siteQuery.isError && !siteQuery.data) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
        {backLink}
        <div className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
          <p>{siteQuery.error.message || "Could not load this site."}</p>
          <Button
            className="mt-3"
            onClick={() => siteQuery.refetch()}
            size="sm"
            variant="outline"
          >
            Try again
          </Button>
        </div>
      </main>
    );
  }

  const { site, domains, deployments, failedJobs } = siteQuery.data;
  const repository = site.repository
    ? `${site.repository.owner}/${site.repository.name}`
    : null;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-6 lg:px-6">
      <div className="flex flex-col gap-4">
        {backLink}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight">
                {site.name}
              </h1>
              {site.status === "suspended" ? (
                <Badge className="rounded-md" variant="destructive">
                  Suspended
                </Badge>
              ) : null}
            </div>
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span>
                {site.organization.name}
                {site.organization.suspendedAt ? " (workspace suspended)" : ""}
              </span>
              <a
                className="hover:text-foreground inline-flex items-center gap-1"
                href={site.liveUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                {displayUrl(site.liveUrl)}
                <HugeiconsIcon
                  className="size-3.5 shrink-0"
                  icon={LinkSquare02Icon}
                />
              </a>
              {repository ? (
                <a
                  className="hover:text-foreground inline-flex items-center gap-1 font-mono text-xs"
                  href={`https://github.com/${repository}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <HugeiconsIcon className="size-3.5" icon={GitBranchIcon} />
                  {repository}@{site.productionBranch}
                </a>
              ) : (
                <span>No repository connected</span>
              )}
              {site.liveSince ? (
                <span>
                  Live since <SiteRelativeTime date={site.liveSince} inline />
                </span>
              ) : null}
            </div>
            {site.suspendedReason ? (
              <p className="text-destructive text-sm">
                Suspended: {site.suspendedReason}
              </p>
            ) : null}
          </div>
          <SiteModerationActions
            action={action}
            canDeploy={repository !== null}
            site={site}
          />
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <SectionHeading>Traffic</SectionHeading>
        <SiteAnalyticsCard enabled={site.analyticsEnabled} siteId={site.id} />
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading>Builds</SectionHeading>
        <SiteBuildCharts siteId={site.id} />
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading>Deployments</SectionHeading>
        <SiteDeploymentsTable
          deployments={deployments}
          siteId={site.id}
          slug={slug}
        />
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <section className="flex flex-col gap-3">
          <SectionHeading>Domains</SectionHeading>
          {domains.length === 0 ? (
            <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
              Only served on the Notra subdomain.
            </p>
          ) : (
            <ul className="bg-card ring-foreground/10 divide-y rounded-xl ring-1">
              {domains.map((domain) => (
                <li className="flex flex-col gap-1 p-3" key={domain.id}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-mono text-sm">
                      {domain.hostname}
                      {domain.isPrimary ? (
                        <span className="text-muted-foreground font-sans">
                          {" "}
                          · primary
                        </span>
                      ) : null}
                    </span>
                    <StatusBadge
                      appearance={SITE_DOMAIN_STATUS_BADGES[domain.status]}
                      label={SITE_DOMAIN_STATUS_LABELS[domain.status]}
                    />
                  </div>
                  {domain.lastError ? (
                    <p className="text-destructive text-xs">
                      {domain.lastError}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeading>Failed jobs</SectionHeading>
          {failedJobs.length === 0 ? (
            <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
              No failed jobs.
            </p>
          ) : (
            <ul className="bg-card ring-foreground/10 divide-y rounded-xl ring-1">
              {failedJobs.map((job) => (
                <li className="flex flex-col gap-1 p-3" key={job.id}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-mono">{job.kind}</span>
                    <span className="text-muted-foreground text-xs">
                      {job.attempts}/{job.maxAttempts} attempts ·{" "}
                      <SiteRelativeTime date={job.createdAt} inline />
                    </span>
                  </div>
                  {job.lastError ? (
                    <p className="text-destructive line-clamp-3 font-mono text-xs">
                      {job.lastError}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
