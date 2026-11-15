import { stripAnsi } from "@notra/sites-core/utils/build-log";

import { MS_PER_SECOND } from "@/constants/site-deployments";
import type { SiteCreateDeployPhase } from "@/types/components/sites";
import type {
  SiteCreateDeployHeadlineKey,
  SiteCreateDeployTiming,
  SiteCreateDeployState,
  SiteCreateDeployStateInput,
} from "@/types/site-create-deploy";
import type { SiteDeploymentRecord } from "@/types/sites";
import {
  deploymentElapsedMs,
  formatBuildDuration,
  isDeploymentInProgress,
} from "@/utils/site-deployments";

export function siteCreateDeployState({
  queued,
  lookupFailed,
  record,
}: SiteCreateDeployStateInput): SiteCreateDeployState {
  const status = record?.status ?? "queued";
  const inProgress = !lookupFailed && queued && isDeploymentInProgress(status);
  const failed =
    !lookupFailed && (!queued || status === "failed" || status === "canceled");
  const ready = !lookupFailed && record !== null && !(inProgress || failed);
  let phase: SiteCreateDeployPhase = "pending";
  if (lookupFailed) {
    phase = "lookupFailed";
  } else if (ready) {
    phase = "ready";
  } else if (failed) {
    phase = "failed";
  }
  return { phase, status, inProgress, failed, ready };
}

export function siteCreateDeployHeadlineKey(
  state: SiteCreateDeployState,
  queued: boolean,
  hasRecord: boolean
): SiteCreateDeployHeadlineKey {
  if (state.phase === "lookupFailed") {
    return "statusLoadFailed";
  }
  if (!queued) {
    return "notStarted";
  }
  if (hasRecord && state.inProgress) {
    return "started";
  }
  if (state.ready) {
    return "ready";
  }
  return state.failed ? "failed" : "waiting";
}

export function deploymentFailureSummary(
  record: SiteDeploymentRecord | null
): string | null {
  return (
    record?.errorMessage?.trim() ||
    record?.diagnostics
      .find(
        (diagnostic) =>
          diagnostic.severity === "error" && diagnostic.message.trim()
      )
      ?.message.trim() ||
    null
  );
}

export function logWithFailure(log: string, summary: string): string {
  if (stripAnsi(log).includes(summary)) {
    return log;
  }
  return `${log.trimEnd()}${log.trim() ? "\n" : ""}[error] ${summary}`;
}

export function siteCreateDeployTiming(
  record: SiteDeploymentRecord | null,
  now: number
): SiteCreateDeployTiming {
  if (!record) {
    return { elapsed: null, startedSeconds: 0 };
  }
  return {
    elapsed: formatBuildDuration(deploymentElapsedMs(record, now)),
    startedSeconds: Math.max(
      0,
      Math.round((now - new Date(record.createdAt).getTime()) / MS_PER_SECOND)
    ),
  };
}
