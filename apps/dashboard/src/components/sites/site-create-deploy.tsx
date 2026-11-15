"use client";

import { useTranslations } from "use-intl";

import { SiteBuildLogs } from "@/components/sites/site-build-logs";
import { SiteCreateDeployActions } from "@/components/sites/site-create-deploy-actions";
import { SiteCreateDeployHeading } from "@/components/sites/site-create-deploy-heading";
import { SITE_CREATE_DEPLOY_PHASE_TONES } from "@/constants/site-create";
import { useNow } from "@/lib/hooks/use-now";
import { useSiteCreateDeployment } from "@/lib/hooks/use-site-create-deployment";
import type { SiteCreateDeployProps } from "@/types/components/sites";
import { toErrorMessage } from "@/utils/error-message";
import {
  deploymentFailureSummary,
  logWithFailure,
  siteCreateDeployHeadlineKey,
  siteCreateDeployState,
  siteCreateDeployTiming,
} from "@/utils/site-create-deploy";
import { siteHref } from "@/utils/site-links";

export function SiteCreateDeploy({
  organizationId,
  organizationSlug,
  site,
  deploymentQueued,
}: SiteCreateDeployProps) {
  const t = useTranslations("sites.new.deploy");
  const deploy = useSiteCreateDeployment({
    organizationId,
    siteId: site.id,
    deploymentQueued,
  });
  const { queued, record, lookupFailed, retry } = deploy;
  const state = siteCreateDeployState({ queued, lookupFailed, record });
  const { phase, status, inProgress, failed } = state;
  const buildLog = failed
    ? logWithFailure(
        deploy.log,
        deploymentFailureSummary(record) ?? t("failureRecovery")
      )
    : deploy.log;
  const now = useNow(inProgress);
  const { elapsed, startedSeconds } = siteCreateDeployTiming(record, now);
  const headline = t(siteCreateDeployHeadlineKey(state, queued, !!record), {
    seconds: startedSeconds,
    duration: elapsed ?? "",
  });
  const heading = (
    <SiteCreateDeployHeading
      headline={headline}
      tone={SITE_CREATE_DEPLOY_PHASE_TONES[phase]}
    />
  );

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border">
        {!lookupFailed ? (
          <SiteBuildLogs
            heading={heading}
            inProgress={inProgress}
            log={buildLog || null}
            queued={!failed && (!record || status === "queued")}
          />
        ) : (
          <div className="p-4 text-sm">{heading}</div>
        )}
        <div className="flex flex-wrap items-center justify-end gap-4 border-t px-4 py-3">
          <SiteCreateDeployActions
            isReloadingStatus={deploy.isReloadingStatus}
            isRetrying={retry.isPending}
            liveUrl={site.liveUrl}
            onReloadStatus={deploy.reloadStatus}
            onRetry={deploy.retryDeployment}
            overviewHref={siteHref(
              organizationSlug,
              site.id,
              "overview",
              site.projectId
            )}
            phase={phase}
            settingsHref={siteHref(
              organizationSlug,
              site.id,
              "settings",
              site.projectId
            )}
          />
        </div>
      </div>
      {retry.isError ? (
        <p
          className="text-foreground text-sm [overflow-wrap:anywhere]"
          role="alert"
        >
          {toErrorMessage(retry.error, t("retryFailed"))}
        </p>
      ) : null}
    </div>
  );
}
