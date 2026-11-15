"use client";

import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Badge } from "@notra/ui/components/ui/badge";
import { useLocale, useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { SitePublishChange } from "@/components/sites/site-publish-change";
import { SITE_PULL_REQUEST_TONE_BADGES } from "@/constants/site-publish";
import type { SitePublishReviewProps } from "@/types/site-publish-review";
import { siteBranchLabel } from "@/utils/site-branch-label";
import { siteDraftChange } from "@/utils/site-drafts";
import { sitePullRequestStatus } from "@/utils/site-publish-status";

export function SitePublishProblems({ review, props }: SitePublishReviewProps) {
  const t = useTranslations("sites.writing");
  const { validation, status } = review;
  const failed = validation.isError || status.isError;
  const diagnostics = validation.data?.diagnostics ?? [];
  if (
    !(props.unsaved || failed || diagnostics.length || props.conflicts?.length)
  ) {
    return null;
  }
  return (
    <div className="space-y-2 text-sm">
      {props.unsaved ? (
        <p className="text-destructive" role="alert">
          {t("saveFirst")}
        </p>
      ) : null}
      {failed ? (
        <div role="alert">
          <p className="text-destructive">{t("statusUnavailable")}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void validation.refetch();
              void status.refetch();
            }}
          >
            {t("retry")}
          </Button>
        </div>
      ) : null}
      {diagnostics.map((diagnostic) => (
        <p
          className="text-destructive text-xs"
          key={`${diagnostic.file}:${diagnostic.line}:${diagnostic.message}`}
          role="alert"
        >
          {diagnostic.file}: {diagnostic.message}
        </p>
      ))}
      {props.conflicts?.length ? (
        <div role="alert" className="space-y-2">
          <p className="text-destructive">{t("conflict")}</p>
          <p className="text-muted-foreground break-all">
            {props.conflicts.join(", ")}
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={props.unsaved || props.rebasePending}
            loading={props.rebasePending}
            onClick={props.onRebase}
          >
            {t("rebase")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function SitePublishPullRequest({
  review,
  props,
}: SitePublishReviewProps) {
  const t = useTranslations("sites.writing");
  const branches = useTranslations("sites.branches");
  const locale = useLocale();
  const { data } = review.status;
  const pr = data?.pullRequest;
  if (!(data && pr)) {
    return null;
  }
  const status = sitePullRequestStatus(data);
  const commits = pr.commits?.totalCount;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="min-w-0 truncate font-medium">
        {siteBranchLabel(props.branch ?? "", locale, (date) =>
          branches("draftFrom", { date })
        )}
      </span>
      <Badge
        shape="rounded"
        variant={
          SITE_PULL_REQUEST_TONE_BADGES[pr.isDraft ? "muted" : status.tone]
        }
      >
        {pr.isDraft ? t("branchState.draft") : t(status.checks)}
      </Badge>
      {!pr.isDraft && status.review ? (
        <Badge shape="rounded" variant="secondary">
          {t(status.review)}
        </Badge>
      ) : null}
      {pr.isDraft && commits ? (
        <span className="text-muted-foreground shrink-0 text-xs">
          {t("branchCommits", { count: commits })}
        </span>
      ) : null}
      <a
        className="text-muted-foreground hover:text-foreground ms-auto inline-flex shrink-0 items-center gap-0.5 text-xs transition-colors"
        href={pr.url}
        target="_blank"
        rel="noreferrer"
      >
        #{pr.number}
        <HugeiconsIcon
          aria-hidden="true"
          className="size-3.5"
          icon={ArrowUpRight01Icon}
        />
      </a>
    </div>
  );
}

export function SitePublishDrafts({ props, review }: SitePublishReviewProps) {
  const t = useTranslations("sites.writing");
  if (!props.drafts.length && review.feature) {
    return null;
  }
  if (!props.drafts.length) {
    return <p className="text-muted-foreground text-sm">{t("noChanges")}</p>;
  }
  return (
    <div className="divide-border divide-y rounded-lg border">
      {props.drafts.map((draft) => (
        <SitePublishChange
          key={draft.path}
          organizationId={props.organizationId}
          siteId={props.siteId}
          branch={props.branch}
          path={draft.path}
          change={siteDraftChange(draft, props.sourcePaths)}
          defaultOpen={false}
        />
      ))}
    </div>
  );
}
