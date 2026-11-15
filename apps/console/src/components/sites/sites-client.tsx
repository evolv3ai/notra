"use client";

import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@notra/ui/components/ui/badge";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@notra/ui/components/ui/input-group";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@notra/ui/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@notra/ui/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/button";
import { SiteQueryError } from "@/components/sites/site-query-error";
import { SiteRelativeTime } from "@/components/sites/site-relative-time";
import {
  SiteStatCard,
  SiteStatCardSkeleton,
} from "@/components/sites/site-stat-card";
import { SiteStatusBadge } from "@/components/sites/site-status-badge";
import {
  SITE_ACTIVE_REFETCH_MS,
  SITE_IDLE_REFETCH_MS,
  SITE_LIST_FILTERS,
} from "@/constants/sites";
import { consoleOrpc } from "@/lib/orpc/query";
import type {
  SiteAdminListItem,
  SiteListFilter,
  SitesPageProps,
} from "@/types/sites";
import {
  commitTitle,
  deploymentDuration,
  isDeploymentInProgress,
  shortSha,
  displayUrl,
} from "@/utils/site-deployments";

const SiteBuildCharts = dynamic(
  () =>
    import("@/components/sites/site-build-charts").then(
      (module) => module.SiteBuildCharts
    ),
  { loading: () => <Skeleton className="h-64 rounded-xl" /> }
);

const OVERVIEW_LABELS = [
  "Sites",
  "Builds, last 24h",
  "Failed builds, last 24h",
  "Stuck jobs",
] as const;

function matchesFilter(site: SiteAdminListItem, filter: SiteListFilter) {
  const status = site.latestDeployment?.status;
  if (filter === "failing") {
    return status === "failed";
  }
  if (filter === "building") {
    return status ? isDeploymentInProgress(status) : false;
  }
  if (filter === "suspended") {
    return site.status === "suspended";
  }
  return true;
}

function matchesSearch(site: SiteAdminListItem, query: string) {
  if (!query) {
    return true;
  }
  const haystack = [
    site.name,
    site.slug,
    site.organization.name,
    site.organization.slug,
    site.repository ?? "",
    site.liveUrl,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function LoadingTable() {
  return (
    <div className="space-y-3 rounded-xl border p-4">
      {[0, 1, 2].map((item) => (
        <div className="flex items-center gap-3" key={item}>
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  );
}

function OverviewCards() {
  const overviewQuery = useQuery({
    ...consoleOrpc.sites.overview.queryOptions(),
    refetchInterval: SITE_IDLE_REFETCH_MS,
  });
  const overview = overviewQuery.data;

  if (overviewQuery.isError && !overview) {
    return (
      <SiteQueryError
        message="Could not load the sites overview."
        onRetry={() => overviewQuery.refetch()}
        retrying={overviewQuery.isFetching}
      />
    );
  }

  if (!overview) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {OVERVIEW_LABELS.map((label) => (
          <SiteStatCardSkeleton key={label} label={label} />
        ))}
      </div>
    );
  }

  const successRate =
    overview.deployments > 0
      ? `${Math.round((overview.readyDeployments / overview.deployments) * 100)}% successful`
      : "No builds yet";

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <SiteStatCard
        hint={
          overview.suspended > 0
            ? `${overview.suspended} suspended`
            : "None suspended"
        }
        label={OVERVIEW_LABELS[0]}
        value={overview.sites}
      />
      <SiteStatCard
        hint={successRate}
        label={OVERVIEW_LABELS[1]}
        value={overview.deployments}
      />
      <SiteStatCard
        hint={`${overview.inProgressDeployments} building now`}
        label={OVERVIEW_LABELS[2]}
        tone={overview.failedDeployments > 0 ? "destructive" : "default"}
        value={overview.failedDeployments}
      />
      <SiteStatCard
        hint={`${overview.pendingJobs} pending, ${overview.failedJobs} failed`}
        label={OVERVIEW_LABELS[3]}
        tone={overview.stuckJobs > 0 ? "warning" : "default"}
        value={overview.stuckJobs}
      />
    </div>
  );
}

export function SitesClient({ slug }: SitesPageProps) {
  const [filter, setFilter] = useState<SiteListFilter>("all");
  const [search, setSearch] = useState("");
  const sitesQuery = useQuery({
    ...consoleOrpc.sites.list.queryOptions(),
    refetchInterval: (query) =>
      query.state.data?.some(
        (site) =>
          site.latestDeployment &&
          isDeploymentInProgress(site.latestDeployment.status)
      )
        ? SITE_ACTIVE_REFETCH_MS
        : SITE_IDLE_REFETCH_MS,
  });

  const sites = sitesQuery.data;
  const query = search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      (sites ?? []).filter(
        (site) => matchesFilter(site, filter) && matchesSearch(site, query)
      ),
    [sites, filter, query]
  );
  const counts = useMemo(() => {
    const result: Record<SiteListFilter, number> = {
      all: 0,
      failing: 0,
      building: 0,
      suspended: 0,
    };
    for (const site of sites ?? []) {
      for (const { value } of SITE_LIST_FILTERS) {
        if (matchesFilter(site, value)) {
          result[value] += 1;
        }
      }
    }
    return result;
  }, [sites]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Sites</h1>
        <p className="text-muted-foreground text-sm">
          Every Notra hosted site across all organizations, with its latest
          build.
        </p>
      </div>

      <OverviewCards />

      <SiteBuildCharts />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          onValueChange={(value: SiteListFilter) => setFilter(value)}
          value={filter}
        >
          <TabsList
            aria-label="Filter sites"
            className="group-data-[orientation=horizontal]/tabs:h-8"
          >
            {SITE_LIST_FILTERS.map((option) => (
              <TabsTrigger key={option.value} value={option.value}>
                {option.label}
                <span className="tabular-nums opacity-60">
                  {counts[option.value]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <InputGroup className="sm:w-64">
          <InputGroupAddon>
            <HugeiconsIcon
              aria-hidden="true"
              className="size-4"
              icon={Search01Icon}
            />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search sites"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search sites, orgs, repos"
            value={search}
          />
        </InputGroup>
      </div>

      {sitesQuery.isPending ? <LoadingTable /> : null}
      {sitesQuery.isError && !sites ? (
        <div className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
          <p>Could not load sites.</p>
          <Button
            className="mt-3"
            onClick={() => sitesQuery.refetch()}
            size="sm"
            variant="outline"
          >
            Try again
          </Button>
        </div>
      ) : null}
      {sites && visible.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">
            {sites.length === 0 ? "No sites yet" : "No matching sites"}
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {sites.length === 0
              ? "Sites show up here once an organization creates one in the dashboard."
              : "Try another filter or search."}
          </p>
        </div>
      ) : null}
      {visible.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Site</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Latest build</TableHead>
                <TableHead>Commit</TableHead>
                <TableHead className="text-right">Domains</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((site) => {
                const latest = site.latestDeployment;
                return (
                  <TableRow className="relative" key={site.id}>
                    <TableCell className="max-w-72">
                      <Link
                        className="font-medium after:absolute after:inset-0 hover:underline"
                        href={`/${slug}/sites/${site.id}`}
                      >
                        {site.name}
                      </Link>
                      <div className="text-muted-foreground flex items-center gap-1.5 truncate text-xs">
                        <span className="truncate">
                          {displayUrl(site.liveUrl)}
                        </span>
                        {site.status === "suspended" ? (
                          <Badge className="rounded-md" variant="destructive">
                            Suspended
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {site.organization.name}
                    </TableCell>
                    <TableCell>
                      {latest ? (
                        <div className="flex flex-col gap-1">
                          <SiteStatusBadge
                            duration={deploymentDuration(latest)}
                            status={latest.status}
                          />
                          <SiteRelativeTime
                            className="text-muted-foreground text-xs"
                            date={latest.createdAt}
                          />
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          Never built
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-64">
                      {latest ? (
                        <div className="min-w-0">
                          <p className="truncate text-sm">
                            {commitTitle(latest.commitMessage) ??
                              shortSha(latest.commitSha)}
                          </p>
                          <p className="text-muted-foreground truncate font-mono text-xs">
                            {latest.branch} · {shortSha(latest.commitSha)}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          {site.repository ?? "No repository"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {site.domains === 0
                        ? "—"
                        : `${site.activeDomains}/${site.domains}`}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </main>
  );
}
