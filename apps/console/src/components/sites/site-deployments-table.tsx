"use client";

import {
  ArrowTurnBackwardIcon,
  MoreVerticalIcon,
  RepeatIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@notra/ui/components/ui/badge";
import { Button } from "@notra/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@notra/ui/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@notra/ui/components/ui/table";
import Link from "next/link";

import { SiteEnvironmentBadge } from "@/components/sites/site-environment-badge";
import { SiteRelativeTime } from "@/components/sites/site-relative-time";
import { SiteStatusBadge } from "@/components/sites/site-status-badge";
import { SITE_TRIGGER_LABELS } from "@/constants/sites";
import { useSiteActions } from "@/hooks/use-site-actions";
import type { SiteDeploymentsTableProps } from "@/types/sites";
import {
  commitTitle,
  deploymentDuration,
  shortSha,
} from "@/utils/site-deployments";

export function SiteDeploymentsTable({
  slug,
  siteId,
  deployments,
}: SiteDeploymentsTableProps) {
  const { redeploy, rollback } = useSiteActions();

  if (deployments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center">
        <p className="font-medium">No deployments yet</p>
        <p className="text-muted-foreground mt-1 text-sm">
          The first build starts when the repository is connected.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Environment</TableHead>
            <TableHead>Commit</TableHead>
            <TableHead>Trigger</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-10">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deployments.map((deployment) => {
            const canRollback =
              deployment.kind === "production" &&
              deployment.status === "ready" &&
              !deployment.live;
            return (
              <TableRow className="relative" key={deployment.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Link
                      aria-label={`Open deployment ${deployment.generation}`}
                      className="after:absolute after:inset-0"
                      href={`/${slug}/sites/${siteId}/deployments/${deployment.id}`}
                    >
                      <SiteStatusBadge
                        duration={deploymentDuration(deployment)}
                        status={deployment.status}
                      />
                    </Link>
                    {deployment.live ? (
                      <Badge className="rounded-md" variant="outline">
                        Live
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <SiteEnvironmentBadge
                    kind={deployment.kind}
                    previewKey={deployment.previewKey}
                  />
                </TableCell>
                <TableCell className="max-w-72">
                  <p className="truncate text-sm">
                    {commitTitle(deployment.commitMessage) ??
                      shortSha(deployment.commitSha)}
                  </p>
                  <p className="text-muted-foreground truncate font-mono text-xs">
                    {deployment.branch} · {shortSha(deployment.commitSha)}
                    {deployment.commitAuthor
                      ? ` · ${deployment.commitAuthor}`
                      : ""}
                  </p>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {SITE_TRIGGER_LABELS[deployment.trigger]}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  <SiteRelativeTime date={deployment.createdAt} />
                </TableCell>
                <TableCell className="relative z-10">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          aria-label={`Actions for deployment ${deployment.generation}`}
                          size="icon-sm"
                          variant="ghost"
                        >
                          <HugeiconsIcon
                            className="size-4"
                            icon={MoreVerticalIcon}
                          />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end" className="min-w-48">
                      <DropdownMenuItem
                        disabled={redeploy.isPending}
                        onClick={() =>
                          redeploy.mutate({
                            siteId,
                            deploymentId: deployment.id,
                          })
                        }
                      >
                        <HugeiconsIcon className="size-4" icon={RepeatIcon} />
                        Redeploy
                      </DropdownMenuItem>
                      {canRollback ? (
                        <DropdownMenuItem
                          disabled={rollback.isPending}
                          onClick={() =>
                            rollback.mutate({
                              siteId,
                              deploymentId: deployment.id,
                            })
                          }
                        >
                          <HugeiconsIcon
                            className="size-4"
                            icon={ArrowTurnBackwardIcon}
                          />
                          Restore to production
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
