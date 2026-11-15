"use client";

import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@notra/ui/components/shared/responsive-dialog";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { SiteBranchPublishActions } from "@/components/sites/branches/site-branch-publish-actions";
import {
  SitePublishDrafts,
  SitePublishProblems,
  SitePublishPullRequest,
} from "@/components/sites/site-publish-review";
import { useSitePublishReview } from "@/lib/hooks/use-site-publish-review";
import type { SitePublishDialogProps } from "@/types/components/sites";

export function SitePublishDialog(props: SitePublishDialogProps) {
  const t = useTranslations("sites.publish");
  const branches = useTranslations("sites.branches");
  const common = useTranslations("common");
  const writing = useTranslations("sites.writing");
  const review = useSitePublishReview(props);
  return (
    <ResponsiveDialog
      open={props.open}
      onOpenChange={(next) => {
        if (!review.publish.isPending) {
          props.onOpenChange(next);
        }
      }}
    >
      <ResponsiveDialogContent className="flex max-h-[85svh] flex-col overflow-hidden sm:max-w-xl">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {review.feature
              ? branches(
                  review.status.data?.pullRequest?.isDraft
                    ? "requestReview"
                    : "merge"
                )
              : writing("publishTo", { branch: review.target })}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {review.feature
              ? writing(
                  review.status.data?.pullRequest?.isDraft
                    ? "requestReviewHint"
                    : "mergeHint",
                  { branch: review.target }
                )
              : t("description", { count: props.draftCount })}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className="min-h-0 space-y-4 overflow-y-auto py-1">
          <SitePublishProblems review={review} props={props} />
          <SitePublishDrafts review={review} props={props} />
          <SitePublishPullRequest review={review} props={props} />
        </div>
        <div className="flex shrink-0 justify-end gap-2 pt-2">
          <Button
            variant="outline"
            disabled={review.publish.isPending}
            onClick={() => props.onOpenChange(false)}
          >
            {common("actions.cancel")}
          </Button>
          {review.direct ? (
            <Button
              data-dialog-confirm
              disabled={!review.canPublish}
              loading={review.publish.isPending}
              onClick={() => {
                if (review.canPublish) {
                  review.publish.mutate();
                }
              }}
            >
              {t("commit")}
            </Button>
          ) : null}
          {!review.direct && props.branchControls ? (
            <SiteBranchPublishActions
              controls={props.branchControls}
              status={review.status.data}
              invalid={!review.ready}
            />
          ) : null}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
