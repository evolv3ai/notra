"use client";

import {
  ArrowLeft01Icon,
  ArrowTurnBackwardIcon,
  LinkSquare02Icon,
  RepeatIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@notra/ui/components/ui/badge";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/button";
import { SiteBuildLogs } from "@/components/sites/site-build-logs";
import { SiteEnvironmentBadge } from "@/components/sites/site-environment-badge";
import { SiteRelativeTime } from "@/components/sites/site-relative-time";
import { SiteStatusBadge } from "@/components/sites/site-status-badge";
import { SITE_ACTIVE_REFETCH_MS, SITE_TRIGGER_LABELS } from "@/constants/sites";
import { useSiteActions } from "@/hooks/use-site-actions";
import { consoleOrpc } from "@/lib/orpc/query";
import type { SiteDeploymentClientProps } from "@/types/sites";
import {
  commitTitle,
  deploymentDuration,
  formatBuildDuration,
  isDeploymentInProgress,
  shortSha,
  displayUrl,
} from "@/utils/site-deployments";

const BYTES_PER_KB = 1024;
const BYTE_UNITS = ["B", "KB", "MB", "GB"] as const;

function formatBytes(bytes: number | null): string | null {
  if (bytes === null) {
    return null;
  }
  let value = bytes;
  let unit = 0;
  while (value >= BYTES_PER_KB && unit < BYTE_UNITS.length - 1) {
    value /= BYTES_PER_KB;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${BYTE_UNITS[unit]}`;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="min-w-0 truncate text-sm">{children}</dd>
    </div>
  );
}

export function SiteDeploymentClient({
  slug,
  siteId,
  deploymentId,
}: SiteDeploymentClientProps) {
  const { redeploy, rollback } = useSiteActions();
  const deploymentQuery = useQuery({
    ...consoleOrpc.sites.deployments.get.queryOptions({
      input: { siteId, deploymentId },
    }),
    refetchInterval: (query) => {
      const status = query.state.data?.deployment.status;
      return status && isDeploymentInProgress(status)
        ? SITE_ACTIVE_REFETCH_MS
        : false;
    },
  });

  const backLink = (
    <Link
      className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm"
      href={`/${slug}/sites/${siteId}`}
    >
      <HugeiconsIcon className="-ms-1 size-4" icon={ArrowLeft01Icon} />
      {deploymentQuery.data?.site.name ?? "Back to site"}
    </Link>
  );

  if (deploymentQuery.isPending) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
        {backLink}
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </main>
    );
  }
  if (deploymentQuery.isError && !deploymentQuery.data) {
    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
        {backLink}
        <div className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
          <p>
            {deploymentQuery.error.message || "Could not load this deployment."}
          </p>
          <Button
            className="mt-3"
            onClick={() => deploymentQuery.refetch()}
            size="sm"
            variant="outline"
          >
            Try again
          </Button>
        </div>
      </main>
    );
  }

  const { deployment, requestedBy, log, metrics } = deploymentQuery.data;
  const inProgress = isDeploymentInProgress(deployment.status);
  const canRollback =
    deployment.kind === "production" &&
    deployment.status === "ready" &&
    !deployment.live;
  const phases = Object.entries(metrics?.phases ?? {})
    .filter((entry): entry is [string, number] => typeof entry[1] === "number")
    .sort(([, a], [, b]) => b - a);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
      <div className="flex flex-col gap-4">
        {backLink}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {commitTitle(deployment.commitMessage) ??
                `Deployment #${deployment.generation}`}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <SiteStatusBadge
                duration={deploymentDuration(deployment)}
                status={deployment.status}
              />
              <SiteEnvironmentBadge
                kind={deployment.kind}
                previewKey={deployment.previewKey}
              />
              {deployment.live ? (
                <Badge className="rounded-md" variant="outline">
                  Live
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canRollback ? (
              <Button
                disabled={rollback.isPending}
                onClick={() => rollback.mutate({ siteId, deploymentId })}
                size="sm"
                variant="outline"
              >
                <HugeiconsIcon icon={ArrowTurnBackwardIcon} />
                Restore to production
              </Button>
            ) : null}
            <Button
              disabled={redeploy.isPending}
              onClick={() => redeploy.mutate({ siteId, deploymentId })}
              size="sm"
              variant="outline"
            >
              <HugeiconsIcon icon={RepeatIcon} />
              Redeploy
            </Button>
          </div>
        </div>
      </div>

      <dl className="bg-card ring-foreground/10 grid grid-cols-2 gap-4 rounded-xl p-4 ring-1 md:grid-cols-4">
        <Fact label="Commit">
          <span className="font-mono text-xs">
            {deployment.branch} · {shortSha(deployment.commitSha)}
          </span>
        </Fact>
        <Fact label="Trigger">
          {SITE_TRIGGER_LABELS[deployment.trigger]}
          {deployment.pullRequestNumber
            ? ` · #${deployment.pullRequestNumber}`
            : ""}
        </Fact>
        <Fact label="Requested by">
          {requestedBy?.name ?? deployment.commitAuthor ?? "GitHub"}
        </Fact>
        <Fact label="Created">
          <SiteRelativeTime date={deployment.createdAt} />
        </Fact>
        <Fact label="URL">
          <a
            className="inline-flex max-w-full items-center gap-1 hover:underline"
            href={deployment.url}
            rel="noopener noreferrer"
            target="_blank"
            title={deployment.url}
          >
            <span className="truncate">{displayUrl(deployment.url)}</span>
            <HugeiconsIcon
              className="size-3.5 shrink-0"
              icon={LinkSquare02Icon}
            />
          </a>
        </Fact>
        <Fact label="Output">
          {deployment.fileCount === null
            ? "—"
            : `${deployment.fileCount} files · ${formatBytes(deployment.totalBytes) ?? "—"}`}
        </Fact>
        <Fact label="Toolchain">{deployment.toolchainVersion ?? "—"}</Fact>
        <Fact label="Sandbox">
          {metrics?.sandboxId ? (
            <span className="font-mono text-xs">{metrics.sandboxId}</span>
          ) : (
            "—"
          )}
        </Fact>
      </dl>

      {deployment.errorMessage ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-xl border p-4 text-sm">
          <p className="font-medium">Build failed</p>
          <p className="mt-1 font-mono text-xs whitespace-pre-wrap">
            {deployment.errorMessage}
          </p>
        </div>
      ) : null}

      {deployment.diagnostics.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Diagnostics</h2>
          <ul className="bg-card ring-foreground/10 divide-y rounded-xl ring-1">
            {deployment.diagnostics.map((diagnostic, index) => (
              <li
                className="flex flex-col gap-0.5 p-3 text-sm"
                key={`${diagnostic.code}:${diagnostic.file}:${diagnostic.line}:${index}`}
              >
                <span
                  className={
                    diagnostic.severity === "error"
                      ? "text-destructive font-medium"
                      : "font-medium text-amber-600 dark:text-amber-400"
                  }
                >
                  {diagnostic.code}
                </span>
                <span>{diagnostic.message}</span>
                {diagnostic.file ? (
                  <span className="text-muted-foreground font-mono text-xs">
                    {diagnostic.file}
                    {diagnostic.line ? `:${diagnostic.line}` : ""}
                    {diagnostic.column ? `:${diagnostic.column}` : ""}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {phases.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Build phases</h2>
          <div className="flex flex-wrap gap-2">
            {phases.map(([phase, ms]) => (
              <Badge className="rounded-md" key={phase} variant="secondary">
                {phase}
                <span className="tabular-nums opacity-70">
                  {formatBuildDuration(ms)}
                </span>
              </Badge>
            ))}
          </div>
        </section>
      ) : null}

      <SiteBuildLogs
        inProgress={inProgress}
        log={log}
        queued={deployment.status === "queued"}
        startAtEnd={deployment.status === "failed"}
      />
    </main>
  );
}
