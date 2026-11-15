import type {
  SiteBranchStatus,
  SitePullRequestTone,
} from "@/types/site-branches";

function sitePublishChecksMessage(status: SiteBranchStatus) {
  const pr = status.pullRequest;
  if (pr?.mergeable === "CONFLICTING") {
    return "checksConflict" as const;
  }
  switch (pr?.mergeStateStatus) {
    case "CLEAN":
    case "HAS_HOOKS":
      return status.canMerge
        ? ("checksPassed" as const)
        : ("checksBlocked" as const);
    case "BLOCKED":
      return "checksBlocked" as const;
    case "BEHIND":
      return "checksBehind" as const;
    case "UNSTABLE":
      return "checksFailed" as const;
    case "DIRTY":
      return "checksConflict" as const;
    default:
      return "checksPending" as const;
  }
}

function sitePublishReviewMessage(status: SiteBranchStatus) {
  switch (status.pullRequest?.reviewDecision) {
    case "APPROVED":
      return "reviewApproved" as const;
    case "CHANGES_REQUESTED":
      return "reviewChangesRequested" as const;
    case "REVIEW_REQUIRED":
      return "reviewRequired" as const;
    default:
      return "reviewPending" as const;
  }
}

const CHECK_TONES: Record<
  ReturnType<typeof sitePublishChecksMessage>,
  SitePullRequestTone
> = {
  checksPassed: "success",
  checksConflict: "destructive",
  checksFailed: "destructive",
  checksBlocked: "warning",
  checksBehind: "warning",
  checksPending: "warning",
};

/** One status line for a branch's pull request: what blocks it, or that it's ready. */
export function sitePullRequestStatus(status: SiteBranchStatus) {
  const checks = sitePublishChecksMessage(status);
  const review = sitePublishReviewMessage(status);
  return {
    checks,
    review: review === "reviewPending" ? null : review,
    tone: CHECK_TONES[checks],
  };
}
