import { SITE_ABUSE_EMAIL } from "@notra/sites-core/constants/sites";

import type {
  ModerationOutcome,
  OrganizationSuspensionMode,
  SiteAdminSuspendResponse,
  WorkspaceSiteCounts,
} from "@/types/moderation";

const COMPLETE: ModerationOutcome = {
  failedSites: 0,
  failedWorkspaces: 0,
  failedNotices: 0,
  sessionsRevoked: true,
};

export function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/** The unfinished parts of a site or workspace suspension response. */
export function suspensionOutcome(
  response: SiteAdminSuspendResponse
): ModerationOutcome {
  return {
    ...COMPLETE,
    failedSites: response.failed,
    failedNotices: response.noticeSent === false ? 1 : 0,
  };
}

/** Adds one workspace a ban suspended, or failed to, to the ban's outcome. */
export function addWorkspaceOutcome(
  outcome: ModerationOutcome,
  response: SiteAdminSuspendResponse | null
): ModerationOutcome {
  return {
    ...outcome,
    failedWorkspaces:
      outcome.failedWorkspaces + (!response || response.failed > 0 ? 1 : 0),
    failedNotices:
      outcome.failedNotices + (response?.noticeSent === false ? 1 : 0),
  };
}

export function emptyOutcome(): ModerationOutcome {
  return { ...COMPLETE };
}

/** One sentence per thing the admin still has to finish or do by hand. */
export function moderationWarnings(outcome: ModerationOutcome): string[] {
  const warnings: string[] = [];
  if (outcome.failedSites > 0) {
    warnings.push(
      `${plural(outcome.failedSites, "site", "sites")} couldn't be updated. Run the action again to finish.`
    );
  }
  if (outcome.failedWorkspaces > 0) {
    warnings.push(
      `${plural(outcome.failedWorkspaces, "workspace", "workspaces")} couldn't be fully suspended. Finish ${outcome.failedWorkspaces === 1 ? "it" : "them"} from the Workspaces tab.`
    );
  }
  if (outcome.failedNotices > 0) {
    warnings.push(
      `The owners of ${plural(outcome.failedNotices, "workspace", "workspaces")} couldn't be emailed. Email them the reason from ${SITE_ABUSE_EMAIL}.`
    );
  }
  if (!outcome.sessionsRevoked) {
    warnings.push(
      "WorkOS sessions couldn't be revoked, but the ban still blocks every request."
    );
  }
  return warnings;
}

/**
 * The workspace actions to offer. An unfinished action is offered again in
 * the same direction first, so a partial suspend or lift is finished rather
 * than reversed, with the reverse still available.
 */
export function organizationSuspensionModes(
  suspended: boolean,
  unfinished: boolean
): OrganizationSuspensionMode[] {
  if (suspended) {
    return unfinished ? ["finish-suspend", "lift"] : ["lift"];
  }
  return unfinished ? ["finish-lift", "suspend"] : ["suspend"];
}

/** Whether the workspace's last suspend or lift left sites behind. */
export function isWorkspaceActionUnfinished(
  suspended: boolean,
  counts: WorkspaceSiteCounts
): boolean {
  return suspended
    ? counts.activeSiteCount > 0
    : counts.pendingRestoreCount > 0;
}
