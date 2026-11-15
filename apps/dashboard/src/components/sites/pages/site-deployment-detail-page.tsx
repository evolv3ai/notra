"use client";

import {
  ArrowTurnBackwardIcon,
  ArrowUpRight01Icon,
  InformationCircleIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { PageHeading } from "@notra/ui/components/shared/page-heading";
import { ORPCError } from "@orpc/client";
import { useEffect, useRef, useState } from "react";
import { TABLE_FRAME_CLASS } from "ui/table/constants";
import { useTranslations } from "use-intl";

import { Button, buttonVariants } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import Link from "@/components/framework/link";
import { SiteBuildLogs } from "@/components/sites/site-build-logs";
import { useSite } from "@/components/sites/site-context";
import { SiteDeploymentFailure } from "@/components/sites/site-deployment-failure";
import { SiteDeploymentSummary } from "@/components/sites/site-deployment-summary";
import { SiteDeploymentTimeline } from "@/components/sites/site-deployment-timeline";
import { SiteDeploymentSkeleton } from "@/components/sites/site-page-skeleton";
import { SitePreviewDeleteDialog } from "@/components/sites/site-preview-delete-dialog";
import { SitePreviewRowMenu } from "@/components/sites/site-preview-row-menu";
import { SitePromoteDialog } from "@/components/sites/site-promote-dialog";
import { SiteRelativeTime } from "@/components/sites/site-relative-time";
import { SiteRollbackDialog } from "@/components/sites/site-rollback-dialog";
import { SkeletonCrossfade } from "@/components/skeleton-crossfade";
import { SITE_DEPLOYMENT_LOG_SURFACE_CLASS } from "@/constants/sites";
import {
  useRedeployDeployment,
  useSiteDeployment,
} from "@/lib/hooks/use-site-deployments";
import { useSitePreviewLinks } from "@/lib/hooks/use-site-preview-links";
import { useInvalidateSites } from "@/lib/hooks/use-sites";
import { useRouter } from "@/lib/navigation";
import type {
  SiteDeploymentActionsProps,
  SiteDeploymentDetailPageProps,
  SiteDeploymentDetailProps,
  SiteDeploymentRecordProps,
} from "@/types/components/sites";
import type { SiteDeployment, SitePreviewRow } from "@/types/sites";
import {
  commitTitle,
  deploymentServedUrls,
  isDeploymentInProgress,
  isFromSiteRepository,
  shortSha,
} from "@/utils/site-deployments";
import { siteDeploymentHref, siteHref } from "@/utils/site-links";
import {
  servedPreviewForDeployment,
  sitePreviewRows,
} from "@/utils/site-previews";

export function SiteDeploymentDetailPage({
  deploymentId,
}: SiteDeploymentDetailPageProps) {
  const { organizationId, organizationSlug, siteId, detail } = useSite();
  const t = useTranslations("sites.deployment");
  const query = useSiteDeployment({ organizationId, siteId, deploymentId });

  if (!query.data && query.error) {
    const notFound =
      query.error instanceof ORPCError && query.error.code === "NOT_FOUND";
    return (
      <EmptyState
        action={
          <Link
            className={buttonVariants({ variant: "outline" })}
            href={siteHref(organizationSlug, siteId, "deployments")}
          >
            {t("back")}
          </Link>
        }
        description={notFound ? t("notFound.description") : t("loadFailed")}
        title={notFound ? t("notFound.title") : t("loadFailedTitle")}
      />
    );
  }

  return (
    <SkeletonCrossfade
      loading={!query.data}
      skeleton={<SiteDeploymentSkeleton />}
    >
      {query.data ? (
        <DeploymentDetail
          deployment={query.data.deployment}
          detail={detail}
          key={deploymentId}
          log={query.data.log}
          organizationId={organizationId}
          siteId={siteId}
        />
      ) : null}
    </SkeletonCrossfade>
  );
}

function DeploymentDetail({
  organizationId,
  siteId,
  detail,
  deployment,
  log,
}: SiteDeploymentDetailProps) {
  const t = useTranslations("sites.deploymentPage");
  const tStatus = useTranslations("sites.status");
  const tDeployment = useTranslations("sites.deployment");
  const invalidateSites = useInvalidateSites();
  const inProgress = isDeploymentInProgress(deployment.status);
  const live = deployment.live;
  const [rollbackTarget, setRollbackTarget] = useState<SiteDeployment | null>(
    null
  );
  const wasInProgress = useRef(inProgress);

  useEffect(() => {
    if (wasInProgress.current && !inProgress) {
      invalidateSites();
    }
    wasInProgress.current = inProgress;
  }, [inProgress, invalidateSites]);

  const urls = deploymentServedUrls(deployment, detail, live);
  const primaryUrl = urls[0] ?? deployment.url;
  const title = commitTitle(deployment.commitMessage);
  const byline = deployment.commitAuthor
    ? t(`byline.${deployment.trigger}`, { author: deployment.commitAuthor })
    : t(`bylineAnonymous.${deployment.trigger}`);

  return (
    <div className="space-y-6">
      <span aria-live="polite" className="sr-only">
        {tDeployment("statusAnnouncement", {
          status: tStatus(deployment.status),
        })}
      </span>

      <PageHeading
        description={
          <>
            {byline} · <SiteRelativeTime date={deployment.createdAt} inline />
            <DeploymentNote deployment={deployment} />
          </>
        }
        title={
          <span className="line-clamp-2" title={title ?? undefined}>
            {title ??
              tDeployment("title", { sha: shortSha(deployment.commitSha) })}
          </span>
        }
      >
        <DeploymentActions
          deployment={deployment}
          live={live}
          onRollback={() => setRollbackTarget(deployment)}
          organizationId={organizationId}
          primaryUrl={primaryUrl}
          siteId={siteId}
        />
      </PageHeading>

      <SiteDeploymentSummary
        deployment={deployment}
        detail={detail}
        live={live}
        primaryUrl={primaryUrl}
        urls={urls}
      />

      <SiteDeploymentFailure
        deployment={deployment}
        log={log}
        site={detail.site}
      />

      <section aria-label={t("log.title")}>
        <div className={TABLE_FRAME_CLASS}>
          <div className={SITE_DEPLOYMENT_LOG_SURFACE_CLASS}>
            <div className="p-4">
              <SiteDeploymentTimeline deployment={deployment} log={log} />
            </div>
            <div className="border-t p-4">
              <SiteBuildLogs
                inProgress={inProgress}
                log={log}
                queued={deployment.status === "queued"}
                startAtEnd={deployment.status === "failed"}
              />
            </div>
          </div>
        </div>
      </section>

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
    </div>
  );
}

function DeploymentActions({
  organizationId,
  siteId,
  deployment,
  live,
  primaryUrl,
  onRollback,
}: SiteDeploymentActionsProps) {
  const t = useTranslations("sites.deployments.actions");
  const tPage = useTranslations("sites.deploymentPage");
  const redeploy = useRedeployDeployment({ organizationId, siteId });
  const [promoteOpen, setPromoteOpen] = useState(false);
  const { detail, organizationSlug } = useSite();
  const router = useRouter();
  const { openPreview, copyShareLink } = useSitePreviewLinks({
    organizationId,
    siteId,
  });
  const preview = servedPreviewForDeployment(
    { ...deployment, live },
    sitePreviewRows(detail)
  );
  const [deleteTarget, setDeleteTarget] = useState<SitePreviewRow | null>(null);
  const inProgress = isDeploymentInProgress(deployment.status);
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {deployment.canRollback ? (
        <Button onClick={onRollback} variant="outline">
          <HugeiconsIcon
            aria-hidden="true"
            data-icon="inline-start"
            icon={ArrowTurnBackwardIcon}
            strokeWidth={1.5}
          />
          {t("rollback")}
        </Button>
      ) : null}
      {deployment.canPromote || deployment.canUndoRollback ? (
        <Button onClick={() => setPromoteOpen(true)} variant="outline">
          {t(deployment.canUndoRollback ? "undoRollback" : "promote")}
        </Button>
      ) : null}
      {inProgress || !isFromSiteRepository(deployment, detail.site) ? null : (
        <Button
          loading={redeploy.isPending}
          onClick={() => redeploy.mutate(deployment.id)}
          variant="outline"
        >
          <HugeiconsIcon
            aria-hidden="true"
            data-icon="inline-start"
            icon={RefreshIcon}
            strokeWidth={1.5}
          />
          {t("redeploy")}
        </Button>
      )}
      {live && deployment.kind === "production" ? (
        <a
          className={buttonVariants()}
          href={primaryUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          {tPage("visit")}
          <HugeiconsIcon
            aria-hidden="true"
            data-icon="inline-end"
            icon={ArrowUpRight01Icon}
            strokeWidth={1.5}
          />
        </a>
      ) : null}
      {preview ? (
        <>
          <Button onClick={() => openPreview(preview)}>
            {tPage("visit")}
            <HugeiconsIcon
              aria-hidden="true"
              data-icon="inline-end"
              icon={ArrowUpRight01Icon}
              strokeWidth={1.5}
            />
          </Button>
          <SitePreviewRowMenu
            onCopyShareLink={() => copyShareLink(preview)}
            onDelete={() => setDeleteTarget(preview)}
            onViewDeployment={() =>
              router.push(
                siteDeploymentHref(organizationSlug, siteId, deployment.id)
              )
            }
            row={preview}
          />
        </>
      ) : null}
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
      <SitePromoteDialog
        onOpenChange={setPromoteOpen}
        open={promoteOpen}
        organizationId={organizationId}
        siteId={siteId}
      />
    </div>
  );
}

function DeploymentNote({ deployment }: SiteDeploymentRecordProps) {
  const t = useTranslations("sites.deploymentPage.notice");
  if (
    deployment.status !== "canceled" &&
    deployment.status !== "superseded" &&
    deployment.status !== "skipped" &&
    deployment.status !== "expired"
  ) {
    return null;
  }
  return (
    <span className="mt-1.5 flex items-start gap-1.5" role="status">
      <HugeiconsIcon
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0"
        icon={InformationCircleIcon}
        strokeWidth={1.5}
      />
      {t(deployment.status)}
    </span>
  );
}
