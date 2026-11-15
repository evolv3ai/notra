import type { VerifiedSessionAuth } from "./auth";

export interface ResolvedSlackInstallation {
  organizationId: string;
  organizationSlug: string | null;
  teamId: string;
  botToken: string;
  allowedChannelIds: string[] | null;
}

export interface InstallationCacheEntry {
  expiresAt: number;
  installation: ResolvedSlackInstallation | null;
}

export interface SlackDashboardRelay {
  channelId: string;
  threadTs: string;
  message: string;
  auth: VerifiedSessionAuth;
}

interface DraftCompletionState {
  count: number;
  turnId: string;
}

export interface PendingPostToX {
  organizationId: string;
  accountId: string;
  username: string;
  text: string;
}

export interface PostToXOutcome {
  turnId: string;
  postUrl: string | null;
  failed: boolean;
  confirmed: boolean;
}

export interface NotraSlackStateExtras {
  notraChartFailureTurnId?: string;
  notraChartFailureIsPermission?: boolean;
  notraDraftCompletion?: DraftCompletionState;
  notraContentPullRequestTurnIds?: string[];
  notraPostToXTurnId?: string;
  notraPostToXOutcome?: PostToXOutcome;
  notraReferenceCompletionTurnId?: string;
}
