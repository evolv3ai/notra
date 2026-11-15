"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@notra/ui/components/ui/badge";
import { useState } from "react";
import { DataTable, type TableColumn } from "ui/table";
import { useTranslations } from "use-intl";

import { useSite } from "@/components/sites/site-context";
import { SiteDeploymentMenu } from "@/components/sites/site-deployment-menu";
import { SiteEnvironmentBadge } from "@/components/sites/site-environment-badge";
import { SitePreviewDeleteDialog } from "@/components/sites/site-preview-delete-dialog";
import { SitePromoteDialog } from "@/components/sites/site-promote-dialog";
import { SiteRelativeTime } from "@/components/sites/site-relative-time";
import { SiteRollbackDialog } from "@/components/sites/site-rollback-dialog";
import { SiteStatusBadge } from "@/components/sites/site-status-badge";
import {
  SITE_DEPLOYMENT_ROW_HEIGHT,
  SITE_MANUAL_TRIGGER_ICONS,
  SITE_TABLE_EMPTY_HEIGHT,
} from "@/constants/sites";
import { useNow } from "@/lib/hooks/use-now";
import { useRedeployDeployment } from "@/lib/hooks/use-site-deployments";
import { useSitePreviewLinks } from "@/lib/hooks/use-site-preview-links";
import { useRouter } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import type { SiteDeploymentsTableProps } from "@/types/components/sites";
import type { SiteDeployment, SitePreviewRow } from "@/types/sites";
import {
  commitTitle,
  deploymentElapsedMs,
  formatBuildDuration,
  hasDeploymentInProgress,
  isFromSiteRepository,
  isPinnedLiveDeployment,
  shortSha,
} from "@/utils/site-deployments";
import { siteDeploymentHref } from "@/utils/site-links";
import { servedPreviewForDeployment } from "@/utils/site-previews";

export function SiteDeploymentsTable({
  organizationId,
  organizationSlug,
  siteId,
  deployments,
  allDeployments = deployments,
  emptyState,
  withActions = false,
  highlightNewRows = false,
  emptyHeight = SITE_TABLE_EMPTY_HEIGHT,
  pageSize,
  previewRows = [],
}: SiteDeploymentsTableProps) {
  const t = useTranslations("sites.deploymentsPage");
  const tTriggers = useTranslations("sites.triggers");
  const tDeployments = useTranslations("sites.deployments");
  const tDeployment = useTranslations("sites.deployment");
  const router = useRouter();
  const scope = { organizationId, siteId };
  const { detail } = useSite();
  const redeploy = useRedeployDeployment(scope);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const { openPreview, copyShareLink } = useSitePreviewLinks(scope);
  const [deleteTarget, setDeleteTarget] = useState<SitePreviewRow | null>(null);
  const now = useNow(hasDeploymentInProgress(deployments));
  const [rollbackTarget, setRollbackTarget] = useState<SiteDeployment | null>(
    null
  );
  const [mountedAt] = useState(() => Date.now());
  const href = (deployment: SiteDeployment) =>
    siteDeploymentHref(organizationSlug, siteId, deployment.id);

  const [requestedPage, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(deployments.length / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const pageRowCount = Math.min(
    pageSize,
    deployments.length - (page - 1) * pageSize
  );
  const tableHeight =
    deployments.length > 0
      ? (pageRowCount + 1) * SITE_DEPLOYMENT_ROW_HEIGHT
      : emptyHeight;

  const columns: TableColumn<SiteDeployment>[] = [
    {
      key: "deployment",
      header: t("columns.deployment"),
      width: "1fr",
      minWidth: "16rem",
      sortable: true,
      sortValue: (deployment) => commitTitle(deployment.commitMessage) ?? "",
      cell: (deployment) => {
        const title = commitTitle(deployment.commitMessage);
        const triggerIcon = SITE_MANUAL_TRIGGER_ICONS[deployment.trigger];
        return (
          <span className="flex min-w-0 flex-col gap-0.5">
            <span
              className={cn(
                "truncate text-sm font-medium",
                !title && "text-muted-foreground font-normal"
              )}
              title={title ?? undefined}
            >
              {title ??
                tDeployment("title", { sha: shortSha(deployment.commitSha) })}
            </span>
            <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs">
              <span className="shrink-0 font-mono">
                {shortSha(deployment.commitSha)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="truncate font-mono" title={deployment.branch}>
                {deployment.branch}
              </span>
              {triggerIcon ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="flex shrink-0 items-center gap-1">
                    <HugeiconsIcon
                      aria-hidden="true"
                      className="size-3"
                      icon={triggerIcon}
                      strokeWidth={2}
                    />
                    {tTriggers(deployment.trigger)}
                  </span>
                </>
              ) : null}
            </span>
          </span>
        );
      },
    },
    {
      key: "environment",
      verticalAlign: "middle",
      header: t("columns.environment"),
      width: "11rem",
      collapsePriority: 2,
      sortable: true,
      sortValue: (deployment) => deployment.kind,
      cell: (deployment) => (
        <SiteEnvironmentBadge
          kind={deployment.kind}
          previewKey={deployment.previewKey}
        />
      ),
    },
    {
      key: "status",
      verticalAlign: "middle",
      header: t("columns.status"),
      width: "12rem",
      minWidth: "8rem",
      sortable: true,
      sortValue: (deployment) => deployment.status,
      cell: (deployment) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <SiteStatusBadge
            duration={
              deployment.status === "ready" ||
              deployment.status === "building" ||
              deployment.status === "uploading"
                ? formatBuildDuration(deploymentElapsedMs(deployment, now))
                : null
            }
            status={deployment.status}
          />
          {isPinnedLiveDeployment(deployment, allDeployments) ? (
            <Badge shape="rounded" variant="success">
              {tDeployments("live")}
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      key: "author",
      verticalAlign: "middle",
      header: t("columns.author"),
      width: "10rem",
      collapsePriority: 3,
      sortable: true,
      sortValue: (deployment) =>
        deployment.commitAuthor ?? tTriggers(deployment.trigger),
      cell: (deployment) => (
        <span
          className="text-muted-foreground block truncate text-xs"
          title={tTriggers(deployment.trigger)}
        >
          {deployment.commitAuthor ?? tTriggers(deployment.trigger)}
        </span>
      ),
    },
    {
      key: "created",
      verticalAlign: "middle",
      header: t("columns.created"),
      width: "8rem",
      align: "right",
      collapsePriority: 1,
      sortable: true,
      sortValue: (deployment) => new Date(deployment.createdAt).getTime(),
      cell: (deployment) => (
        <SiteRelativeTime
          className="text-muted-foreground text-xs whitespace-nowrap tabular-nums"
          date={deployment.createdAt}
        />
      ),
    },
  ];

  if (withActions) {
    columns.push({
      key: "actions",
      verticalAlign: "middle",
      header: <span className="sr-only">{t("columns.actions")}</span>,
      width: "3.25rem",
      align: "right",
      cell: (deployment) => {
        const preview = servedPreviewForDeployment(deployment, previewRows);
        return (
          <span
            className="-my-1 flex justify-end"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <SiteDeploymentMenu
              canRollback={deployment.canRollback}
              canPromote={deployment.canPromote}
              canUndoRollback={deployment.canUndoRollback}
              canRedeploy={isFromSiteRepository(deployment, detail.site)}
              deployment={deployment}
              detailHref={href(deployment)}
              onRedeploy={() => redeploy.mutate(deployment.id)}
              onRollback={() => setRollbackTarget(deployment)}
              onPromote={() => setPromoteOpen(true)}
              redeployPending={redeploy.isPending}
              preview={preview}
              onOpenPreview={preview ? () => openPreview(preview) : undefined}
              onCopyShareLink={
                preview ? () => copyShareLink(preview) : undefined
              }
              onDeletePreview={
                preview ? () => setDeleteTarget(preview) : undefined
              }
            />
          </span>
        );
      },
    });
  }

  return (
    <>
      <DataTable
        autoHeight
        columns={columns}
        data={deployments}
        emptyState={emptyState}
        getRowClassName={(deployment) =>
          highlightNewRows &&
          new Date(deployment.createdAt).getTime() > mountedAt
            ? "motion-safe:animate-[geo-log-row-glow_2.4s_ease-out_backwards]"
            : undefined
        }
        defaultSort={{ key: "created", direction: "desc" }}
        getRowId={(deployment) => deployment.id}
        height={tableHeight}
        onRowClick={(deployment) => router.push(href(deployment))}
        onRowPointerEnter={(deployment) => router.prefetch(href(deployment))}
        pagination={
          deployments.length > pageSize
            ? {
                page,
                pageSize,
                onPageChange: (next) =>
                  setPage(Math.min(Math.max(1, next), pageCount)),
              }
            : undefined
        }
        resizable
        rowSizing="content"
        scrollFade={false}
      />
      {withActions ? (
        <SitePreviewDeleteDialog
          onOpenChange={(open) => {
            if (!open) {
              setDeleteTarget(null);
            }
          }}
          organizationId={organizationId}
          preview={deleteTarget}
          siteId={siteId}
        />
      ) : null}
      {withActions ? (
        <SiteRollbackDialog
          deployment={rollbackTarget}
          onOpenChange={(open) => {
            if (!open) {
              setRollbackTarget(null);
            }
          }}
          organizationId={organizationId}
          siteId={siteId}
        />
      ) : null}
      {withActions ? (
        <SitePromoteDialog
          onOpenChange={setPromoteOpen}
          open={promoteOpen}
          organizationId={organizationId}
          siteId={siteId}
        />
      ) : null}
    </>
  );
}
