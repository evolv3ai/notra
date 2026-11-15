"use client";

import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ResponsiveDialogClose } from "@notra/ui/components/shared/responsive-dialog";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import Link from "@/components/framework/link";
import type { GitHubPublishDialogFooterProps } from "@/types/content/detail";

function RecoveryActions({
  publishRecovery,
  organizationSlug,
}: GitHubPublishDialogFooterProps) {
  const t = useTranslations("content.githubPublish");
  if (!publishRecovery) {
    return null;
  }
  const permissionsUrl =
    publishRecovery.code === "github_app_permissions_required"
      ? publishRecovery.permissionsUrl
      : undefined;
  return (
    <>
      {publishRecovery.publishingPaused || !permissionsUrl ? (
        <Button
          nativeButton={false}
          render={
            <Link href={`/${organizationSlug}/integrations/github`}>
              {t("openIntegration")}
            </Link>
          }
        />
      ) : null}
      {permissionsUrl ? (
        <Button
          nativeButton={false}
          render={
            <a href={permissionsUrl} rel="noopener noreferrer" target="_blank">
              {t("reviewOnGitHub")}
              <HugeiconsIcon className="size-4" icon={ArrowUpRight01Icon} />
            </a>
          }
        />
      ) : null}
    </>
  );
}

export function GitHubPublishDialogFooter(
  props: GitHubPublishDialogFooterProps
) {
  const {
    onPublish,
    hasSelectedRepository,
    isPublishing,
    publishRecovery,
    pullRequest,
    selectedPublishingEnabled,
  } = props;
  const t = useTranslations("content.githubPublish");
  const common = useTranslations("common.actions");
  const git = useTranslations("content.gitPublishing");
  let label = git("publish");
  if (isPublishing) {
    label = git("publishing");
  }
  if (publishRecovery) {
    label = common("tryAgain");
  }
  const canSubmit = !pullRequest && !publishRecovery?.publishingPaused;
  return (
    <>
      <ResponsiveDialogClose
        disabled={isPublishing}
        render={<Button variant="outline" />}
      >
        {common("close")}
      </ResponsiveDialogClose>
      <RecoveryActions {...props} />
      {pullRequest?.pullRequestUrl ? (
        <Button
          nativeButton={false}
          render={
            <a
              href={pullRequest.pullRequestUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              {t("openPullRequest")}
              <HugeiconsIcon className="size-4" icon={ArrowUpRight01Icon} />
            </a>
          }
        />
      ) : null}
      {canSubmit ? (
        <Button
          disabled={!hasSelectedRepository || !selectedPublishingEnabled}
          data-dialog-confirm
          loading={isPublishing}
          onClick={onPublish}
          type="button"
        >
          {label}
        </Button>
      ) : null}
    </>
  );
}
