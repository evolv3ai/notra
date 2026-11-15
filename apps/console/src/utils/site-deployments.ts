import { SITE_DEPLOYMENT_IN_PROGRESS_STATUSES } from "@notra/sites-core/constants/sites";

import {
  MS_PER_SECOND,
  SECONDS_PER_MINUTE,
} from "@/constants/site-deployments";
import { SITE_SHORT_SHA_LENGTH } from "@/constants/sites";
import type { SiteDeploymentStatus, SiteDeploymentTiming } from "@/types/sites";

const IN_PROGRESS: ReadonlySet<SiteDeploymentStatus> = new Set(
  SITE_DEPLOYMENT_IN_PROGRESS_STATUSES
);

export function isDeploymentInProgress(status: SiteDeploymentStatus): boolean {
  return IN_PROGRESS.has(status);
}

export function shortSha(sha: string): string {
  return sha.slice(0, SITE_SHORT_SHA_LENGTH);
}

export function commitTitle(message: string | null): string | null {
  const title = message?.split("\n", 1)[0]?.trim();
  return title ? title : null;
}

export function formatBuildDuration(ms: number | null): string | null {
  if (ms === null || ms < 0) {
    return null;
  }
  const totalSeconds = Math.max(1, Math.round(ms / MS_PER_SECOND));
  if (totalSeconds < SECONDS_PER_MINUTE) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

function deploymentElapsedMs(
  deployment: SiteDeploymentTiming,
  now = Date.now()
): number | null {
  if (deployment.buildDurationMs !== null) {
    return deployment.buildDurationMs;
  }
  if (!deployment.startedAt) {
    return null;
  }
  const end = deployment.finishedAt
    ? new Date(deployment.finishedAt).getTime()
    : now;
  return end - new Date(deployment.startedAt).getTime();
}

export function deploymentDuration(
  deployment: SiteDeploymentTiming & { status: SiteDeploymentStatus }
): string | null {
  if (deployment.status === "queued") {
    return null;
  }
  // Only a running build counts up to now; a finished one without an end time
  // (canceled before it ran, for example) has no meaningful duration.
  if (
    !(isDeploymentInProgress(deployment.status) || deployment.finishedAt) &&
    deployment.buildDurationMs === null
  ) {
    return null;
  }
  return formatBuildDuration(deploymentElapsedMs(deployment));
}

const URL_SCHEME = /^https?:\/\//;

export function displayUrl(url: string): string {
  return url.replace(URL_SCHEME, "");
}
