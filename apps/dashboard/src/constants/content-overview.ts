import {
  GitMergeIcon,
  GitPullRequestClosedIcon,
  GitPullRequestDraftIcon,
  GitPullRequestIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import type { ContentResponse } from "@notra/schemas/dashboard/content";

import type { SiteStatusBadgeConfig } from "@/types/sites";

export const CONTENT_METADATA_DEBOUNCE_MS = 600;

export const CONTENT_COVER_WIDTH = 1200;
export const CONTENT_COVER_HEIGHT = 630;

export const TAG_SUGGESTION_COUNT = 6;
export const AUTHOR_AVATAR_STACK_MAX = 3;
export const TAG_SUGGESTIONS_LIMIT = 50;

export const CONTENT_AUTHOR_LINK_FIELDS = [
  "url",
  "x",
  "linkedin",
  "github",
] as const;

export const CONTENT_AUTHOR_SLUG_FALLBACK = "author";
export const CONTENT_AUTHOR_ENSURE_SELF_ATTEMPTS = 3;

export const TRAILING_DASHES = /-+$/;

export const CONTENT_STATUS_BADGES = {
  published: { variant: "success", icon: Tick02Icon, square: true },
  draft: { variant: "secondary" },
} as const satisfies Record<ContentResponse["status"], SiteStatusBadgeConfig>;

/** GitHub's own pull request colours: green open, grey draft, purple merged, red closed. */
export const CONTENT_PULL_REQUEST_STATES = {
  open: { icon: GitPullRequestIcon, className: "text-success" },
  draft: { icon: GitPullRequestDraftIcon, className: "text-muted-foreground" },
  merged: { icon: GitMergeIcon, className: "text-primary" },
  closed: { icon: GitPullRequestClosedIcon, className: "text-destructive" },
} as const;

export const CONTENT_PULL_REQUEST_BADGES = {
  open: { variant: "success", icon: GitPullRequestIcon },
  draft: { variant: "secondary", icon: GitPullRequestDraftIcon },
  merged: { variant: "merged", icon: GitMergeIcon },
  closed: { variant: "destructive", icon: GitPullRequestClosedIcon },
} as const satisfies Record<
  keyof typeof CONTENT_PULL_REQUEST_STATES,
  SiteStatusBadgeConfig
>;

export const CONTENT_PANEL_TABS = [
  { id: "overview" },
  { id: "agent" },
  { id: "preview" },
] as const;
