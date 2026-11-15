import type { IconSvgElement } from "@hugeicons/react";
import type { SITE_JOB_KINDS } from "@notra/db/constants/sites";
import type { siteDeployments } from "@notra/db/schema";
import type {
  SITE_DEPLOYMENT_KINDS,
  SITE_DEPLOYMENT_STATUSES,
  SITE_DEPLOYMENT_TRIGGERS,
  SITE_DOMAIN_KINDS,
  SITE_DOMAIN_STATUSES,
  SITE_STATUSES,
} from "@notra/sites-core/constants/sites";
import type { SiteDiagnostic } from "@notra/sites-core/types/build";
import type {
  SiteBuildLogEntry,
  SiteBuildLogFold,
  SiteBuildLogLine,
} from "@notra/sites-core/types/build-log";
import type { SiteBuildMetrics } from "@notra/sites-core/types/build-metrics";
import type {
  SiteConsoleAction,
  SiteSuspender,
  SiteSuspensionCategory,
} from "@notra/sites-core/types/sites";
import type { ChartConfig } from "@notra/ui/components/ui/chart";
import type { ReactNode } from "react";
import type { TooltipProps } from "recharts";
// biome-ignore lint/performance/noNamespaceImport: Zod recommended way to import
import type * as z from "zod";

import type { siteServingStateSchema } from "@/schemas/sites";
import type { ModerationUser, WorkspaceSiteCounts } from "@/types/moderation";

export type SiteDeploymentKind = (typeof SITE_DEPLOYMENT_KINDS)[number];

export interface SiteQueryErrorProps {
  message: string;
  retrying: boolean;
  onRetry: () => void;
}

export type SiteChartTooltipProps = TooltipProps<number, string> & {
  config: ChartConfig;
};
export type SiteDeploymentStatus = (typeof SITE_DEPLOYMENT_STATUSES)[number];
export type SiteDeploymentTrigger = (typeof SITE_DEPLOYMENT_TRIGGERS)[number];
type SiteDomainKind = (typeof SITE_DOMAIN_KINDS)[number];
export type SiteDomainStatus = (typeof SITE_DOMAIN_STATUSES)[number];
type SiteJobKind = (typeof SITE_JOB_KINDS)[number];
type SiteStatus = (typeof SITE_STATUSES)[number];

export type SiteServingState = z.infer<typeof siteServingStateSchema>;

export type SiteDeploymentRow = typeof siteDeployments.$inferSelect;

/* Console read models. */

interface SiteOrganizationRef {
  id: string;
  name: string;
  slug: string;
}

export interface SiteAdminDeployment {
  id: string;
  kind: SiteDeploymentKind;
  previewKey: string | null;
  trigger: SiteDeploymentTrigger;
  status: SiteDeploymentStatus;
  live: boolean;
  generation: number;
  branch: string;
  commitSha: string;
  commitMessage: string | null;
  commitAuthor: string | null;
  pullRequestNumber: number | null;
  url: string;
  toolchainVersion: string | null;
  fileCount: number | null;
  totalBytes: number | null;
  buildDurationMs: number | null;
  diagnostics: SiteDiagnostic[];
  errorMessage: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

export type SiteDeploymentTiming = Pick<
  SiteAdminDeployment,
  "buildDurationMs" | "startedAt" | "finishedAt"
>;

export interface SiteAdminOverview {
  sites: number;
  suspended: number;
  deployments: number;
  failedDeployments: number;
  readyDeployments: number;
  inProgressDeployments: number;
  failedJobs: number;
  stuckJobs: number;
  pendingJobs: number;
}

export interface SiteAdminListItem {
  id: string;
  name: string;
  slug: string;
  status: SiteStatus;
  organization: SiteOrganizationRef;
  repository: string | null;
  liveUrl: string;
  domains: number;
  activeDomains: number;
  latestDeployment: SiteAdminDeployment | null;
  createdAt: Date;
}

interface SiteAdminDomain {
  id: string;
  hostname: string;
  kind: SiteDomainKind;
  status: SiteDomainStatus;
  lastError: string | null;
  lastCheckedAt: Date | null;
  verifiedAt: Date | null;
  isPrimary: boolean;
}

interface SiteAdminFailedJob {
  id: string;
  kind: SiteJobKind;
  deploymentId: string | null;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  createdAt: Date;
}

export interface SiteAdminDetail {
  site: {
    id: string;
    name: string;
    slug: string;
    status: SiteStatus;
    suspendedReason: string | null;
    suspendedBy: SiteSuspender | null;
    /** Taken offline by a workspace suspension rather than on its own. */
    suspendedWithOrganization: boolean;
    organization: SiteOrganizationRef &
      WorkspaceSiteCounts & { suspendedAt: Date | null };
    /** The workspace owner the "Ban owner" action targets. */
    owner: ModerationUser | null;
    repository: { owner: string; name: string } | null;
    productionBranch: string;
    rootDirectory: string;
    publicOrigin: string;
    liveUrl: string;
    previewsEnabled: boolean;
    analyticsEnabled: boolean;
    liveSince: string | null;
    createdAt: Date;
  };
  domains: SiteAdminDomain[];
  deployments: SiteAdminDeployment[];
  failedJobs: SiteAdminFailedJob[];
}

export interface SiteAdminDeploymentDetail {
  site: { id: string; name: string };
  deployment: SiteAdminDeployment;
  requestedBy: { id: string; name: string; email: string } | null;
  log: string | null;
  metrics: SiteBuildMetrics | null;
}

export interface SiteBuildActivityDay {
  /** UTC day, `YYYY-MM-DD`. */
  day: string;
  ready: number;
  failed: number;
  /** Superseded, skipped, canceled, expired or still running. */
  other: number;
}

export interface SiteRecentBuild {
  id: string;
  siteId: string;
  siteName: string;
  status: "ready" | "failed";
  kind: SiteDeploymentKind;
  commitSha: string;
  commitMessage: string | null;
  durationMs: number;
  createdAt: Date;
}

export interface SiteBuildDurationTooltipProps {
  active?: boolean;
  payload?: { payload?: SiteRecentBuild }[];
  showSite: boolean;
}

export interface SiteBuildDurationChartProps {
  builds: SiteRecentBuild[];
  /** Hide the site name in tooltips when every build is from one site. */
  showSite: boolean;
}

export type SiteListFilter = "all" | "failing" | "building" | "suspended";

/* Dashboard internal route (`/api/internal/sites/admin`). */

export type SiteAdminRequest =
  | { action: "deployLatest"; siteId: string; actorId: string }
  | {
      action: "redeploy" | "rollback";
      siteId: string;
      deploymentId: string;
      actorId: string;
    }
  | {
      action: "setOrganizationSuspended";
      organizationId: string;
      actorId: string;
      suspended: boolean;
      reason: string;
      category?: SiteSuspensionCategory;
    }
  | {
      action: "setSuspended";
      siteId: string;
      actorId: string;
      suspended: boolean;
      reason: string;
      category?: SiteSuspensionCategory;
    }
  | { action: "analytics"; siteId: string; actorId: string; days?: number };

/** Mirrors `SiteAnalyticsResponse` in `packages/geo-core/src/types/geo.ts`. */
export interface SiteAnalytics {
  web: {
    configured: boolean;
    totals: {
      views: number;
      previousViews: number;
      visitors: number;
      previousVisitors: number;
      sessions: number;
      aiVisitors: number;
    };
    points: { day: string; views: number; visitors: number }[];
    pages: { host: string; path: string; views: number; visitors: number }[];
    sources: { group: string; source: string; visitors: number }[];
  };
  traffic: {
    configured: boolean;
    totals: {
      crawler: number;
      cited: number;
      aiReferral: number;
      conversions: number | null;
    };
    sources: { source: string; agent: string; visits: number }[];
  };
  engagement: { views: number; avgSeconds: number };
}

/* Component props. */

export interface SiteStatusBadgeConfig {
  variant?: "secondary" | "destructive";
  tone?: string;
  icon?: IconSvgElement;
  spin?: boolean;
  square?: boolean;
}

export interface StatusBadgeProps {
  label: string;
  appearance: SiteStatusBadgeConfig;
}

export interface SiteStatusBadgeProps {
  status: SiteDeploymentStatus;
  duration?: string | null;
  className?: string;
}

export interface SiteEnvironmentBadgeProps {
  kind: SiteDeploymentKind;
  previewKey: string | null;
  className?: string;
}

export interface SiteRelativeTimeProps {
  date: Date | string;
  className?: string;
  inline?: boolean;
}

export interface SiteBuildLogHighlightProps {
  text: string;
  query: string;
  /** `[start, end)` range rendered in the muted tag color. */
  muted?: readonly [start: number, end: number];
}

export interface SiteBuildLogPlainProps {
  text: string;
  /** Where `text` starts within the full line, to place the muted range. */
  offset: number;
  muted?: readonly [start: number, end: number];
}

export interface SiteBuildLogLineTextProps {
  line: SiteBuildLogLine;
  query: string;
}

export interface SiteBuildLogLineProps {
  line: SiteBuildLogLine;
  offset: string | undefined;
  query: string;
}

export interface SiteBuildLogFoldRowProps {
  entry: SiteBuildLogFold;
  offsets: Map<number, string>;
}

export interface SiteBuildLogRowsProps {
  entries: SiteBuildLogEntry[];
  matchingLines: SiteBuildLogLine[];
  matchOffsets: Map<number, string>;
  offsets: Map<number, string>;
  query: string;
}

export interface SiteBuildLogFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export interface SiteBuildLogEmptyProps {
  inProgress: boolean;
  queued: boolean;
  showSpinner?: boolean;
}

export interface SiteBuildLogCopyButtonProps {
  log: string | null;
}

export interface SiteBuildLogsProps {
  log: string | null;
  heading?: ReactNode;
  inProgress: boolean;
  queued: boolean;
  startAtEnd?: boolean;
}

export interface SitesPageProps {
  slug: string;
}

export interface SiteDetailClientProps {
  slug: string;
  siteId: string;
  /** Opens this moderation dialog on load, e.g. from a Slack link. */
  action?: SiteConsoleAction;
}

export interface SiteModerationActionsProps {
  site: SiteAdminDetail["site"];
  action?: SiteConsoleAction;
  canDeploy: boolean;
}

export interface SiteDeploymentClientProps {
  slug: string;
  siteId: string;
  deploymentId: string;
}

export interface SiteStatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "destructive" | "warning";
}

export interface SiteStatCardSkeletonProps {
  label: string;
}

export interface SiteDeploymentsTableProps {
  slug: string;
  siteId: string;
  deployments: SiteAdminDeployment[];
}

export interface SiteAnalyticsCardProps {
  siteId: string;
  enabled: boolean;
}

export interface SiteBuildChartsProps {
  /** Omit for every site. */
  siteId?: string;
}

export interface SiteChartCardProps {
  title: string;
  description: string;
  children: ReactNode;
}

export interface SiteTrafficChartProps {
  points: { day: string; views: number; visitors: number }[];
}

export interface SiteSuspendDialogProps {
  siteId: string;
  siteName: string;
  /** Offer to reactivate instead of to suspend. */
  reactivates: boolean;
  /** Disables the action and says why, e.g. while the workspace is suspended. */
  disabledReason?: string;
  defaultOpen?: boolean;
}
