import {
  Cancel01Icon,
  Clock01Icon,
  GitPullRequestIcon,
  Loading03Icon,
  Rocket01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

import type {
  SiteDeploymentKind,
  SiteDeploymentStatus,
  SiteDeploymentTrigger,
  SiteDomainStatus,
  SiteListFilter,
  SiteStatusBadgeConfig,
} from "@/types/sites";

/** Badge tones for the shared status palette the dashboard badge uses. */
const SUCCESS_TONE =
  "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400";
const WARNING_TONE =
  "bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400";
const INFO_TONE =
  "bg-sky-500/10 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400";

export const SITE_STATUS_BADGES: Record<
  SiteDeploymentStatus,
  SiteStatusBadgeConfig
> = {
  queued: { tone: INFO_TONE, icon: Clock01Icon },
  building: { tone: WARNING_TONE, icon: Loading03Icon, spin: true },
  uploading: { tone: WARNING_TONE, icon: Loading03Icon, spin: true },
  ready: { tone: SUCCESS_TONE, icon: Tick02Icon, square: true },
  failed: { variant: "destructive", icon: Cancel01Icon, square: true },
  superseded: { variant: "secondary" },
  skipped: { variant: "secondary" },
  canceled: { variant: "secondary" },
  expired: { variant: "secondary" },
};

export const SITE_STATUS_LABELS: Record<SiteDeploymentStatus, string> = {
  queued: "Queued",
  building: "Building",
  uploading: "Uploading",
  ready: "Successful",
  superseded: "Superseded",
  failed: "Failed",
  canceled: "Canceled",
  expired: "Expired",
  skipped: "Skipped",
};

export const SITE_DOMAIN_STATUS_BADGES: Record<
  SiteDomainStatus,
  SiteStatusBadgeConfig
> = {
  pending: { tone: INFO_TONE, icon: Clock01Icon },
  verifying: { tone: WARNING_TONE, icon: Loading03Icon, spin: true },
  active: { tone: SUCCESS_TONE, icon: Tick02Icon, square: true },
  failed: { variant: "destructive", icon: Cancel01Icon, square: true },
};

export const SITE_DOMAIN_STATUS_LABELS: Record<SiteDomainStatus, string> = {
  pending: "Pending",
  verifying: "Verifying",
  active: "Active",
  failed: "Failed",
};

export const SITE_ENVIRONMENT_ICONS: Record<
  SiteDeploymentKind,
  IconSvgElement
> = {
  production: Rocket01Icon,
  preview: GitPullRequestIcon,
};

export const SITE_KIND_LABELS: Record<SiteDeploymentKind, string> = {
  production: "Production",
  preview: "Preview",
};

export const SITE_TRIGGER_LABELS: Record<SiteDeploymentTrigger, string> = {
  push: "Push",
  pull_request: "Pull request",
  manual: "Manual update",
  redeploy: "Redeploy",
  config: "Settings change",
};

export const SITE_LIST_FILTERS: { value: SiteListFilter; label: string }[] = [
  { value: "all", label: "All sites" },
  { value: "failing", label: "Last build failed" },
  { value: "building", label: "Building" },
  { value: "suspended", label: "Suspended" },
];

export const SITE_SHORT_SHA_LENGTH = 7;
export const SITE_DEPLOYMENTS_LIMIT = 50;
export const SITE_FAILED_JOBS_LIMIT = 10;
export const SITE_OVERVIEW_WINDOW_MS = 24 * 60 * 60 * 1000;
export const SITE_ANALYTICS_DAYS = 30;
export const SITE_ACTIVITY_DAYS = 30;
export const SITE_RECENT_BUILDS_LIMIT = 60;
export const SITE_TOP_ROWS = 5;

/** Poll while anything is building so statuses and live logs stay current. */
export const SITE_ACTIVE_REFETCH_MS = 3000;
export const SITE_IDLE_REFETCH_MS = 30_000;

export const SITE_BUILD_LOG_FOLLOW_THRESHOLD = 32;
export const SITE_BUILD_LOG_ROW_GRID =
  "grid grid-cols-[2rem_0.875rem_minmax(0,1fr)] gap-x-2 px-3 sm:grid-cols-[2.5rem_0.875rem_minmax(0,1fr)] group-data-[timestamps=false]/log:grid-cols-[0.875rem_minmax(0,1fr)]";

export const SITE_MAX_SUSPENSION_REASON_LENGTH = 500;
