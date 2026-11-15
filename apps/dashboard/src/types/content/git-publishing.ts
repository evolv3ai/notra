import type { PostGitHubPublish } from "@notra/db/types/post-github-publish";

import type { dashboardOrpc } from "@/lib/orpc/query";

export type ContentPublishingConfig = Awaited<
  ReturnType<
    typeof dashboardOrpc.integrations.repositories.contentDirectory.get.call
  >
>;
export interface ContentPublishingTargetProps {
  config: ContentPublishingConfig;
  siteId?: string;
  branch: string;
  disabled?: boolean;
  onSiteChange: (siteId: string) => void;
}
export interface ContentDeleteDialogProps {
  contentId: string;
  organizationId: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  onConfirm: (remove: boolean) => Promise<void>;
}

export interface ContentGitStatusProps {
  organizationId: string;
  contentId: string;
  githubPublish: PostGitHubPublish;
}
