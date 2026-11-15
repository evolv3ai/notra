import type { ScheduledPublicationOutcome } from "@notra/ai/types/scheduled-publications";

export interface ScheduledPublicationPost {
  contentType: string;
  title: string;
  slug: string | null;
  markdown: string | null;
  githubPublish: unknown;
  sourceMetadata: unknown;
  coverImage?: unknown;
  tags?: string[];
  excerpt?: string | null;
  authorIds?: string[];
  featured?: boolean;
  hidden?: boolean;
  noindex?: boolean;
  displayDate?: Date | null;
}

/** A pull request a scheduled GitHub destination pushed. */
export interface ScheduledPullRequest {
  pullRequestNumber: number;
  pullRequestUrl: string;
  headSha: string | null;
  /**
   * Hash of the post as pushed. Kept on every stored result, so a retry after
   * an edit pushes again instead of merging the old commit.
   */
  contentHash?: string;
}

export interface ScheduledPublicationWorkflowInput {
  scheduledPublicationId: string;
  claimToken: string;
}

export interface ScheduledPublicationSweepResult {
  claimed: number;
  started: number;
  released: number;
}

export interface ScheduledPublicationAttemptResult {
  attempts: number;
  destination: string;
  organizationId: string;
  postId: string;
  outcome: ScheduledPublicationOutcome;
}
