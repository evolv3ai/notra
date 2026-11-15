import {
  GitPullRequestIcon,
  LinkSquare02Icon,
} from "@hugeicons/core-free-icons";
import { StatusBadge } from "@notra/ui/components/status-badge";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "use-intl";

import {
  CONTENT_PULL_REQUEST_BADGES,
  CONTENT_STATUS_BADGES,
} from "@/constants/content-overview";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { ContentGitStatusProps } from "@/types/content/git-publishing";

export function ContentGitStatus({
  organizationId,
  contentId,
  githubPublish,
}: ContentGitStatusProps) {
  const t = useTranslations("content.gitPublishing");
  const header = useTranslations("content.header");
  const { data } = useQuery({
    ...dashboardOrpc.content.pullRequestState.queryOptions({
      input: { organizationId, contentId },
    }),
    refetchInterval: 10_000,
  });
  const live = githubPublish.direct || data?.status === "merged";
  const liveLabel = t("live", {
    target:
      data?.siteName ??
      githubPublish.baseBranch ??
      `${githubPublish.owner}/${githubPublish.repo}`,
  });
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {live ? (
        <span className="max-w-full overflow-hidden" title={liveLabel}>
          <StatusBadge
            appearance={CONTENT_STATUS_BADGES.published}
            label={liveLabel}
          />
        </span>
      ) : null}
      {githubPublish.pullRequestUrl ? (
        <a
          href={githubPublish.pullRequestUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <StatusBadge
            appearance={
              data?.status
                ? CONTENT_PULL_REQUEST_BADGES[data.status]
                : { variant: "secondary", icon: GitPullRequestIcon }
            }
            label={
              data?.status
                ? header(`pullRequestState.${data.status}`)
                : `#${githubPublish.pullRequestNumber}`
            }
          />
        </a>
      ) : null}
      {data?.previewUrl ? (
        <a href={data.previewUrl} target="_blank" rel="noopener noreferrer">
          <StatusBadge
            appearance={{ variant: "secondary", icon: LinkSquare02Icon }}
            label={t("preview")}
          />
        </a>
      ) : null}
    </div>
  );
}
