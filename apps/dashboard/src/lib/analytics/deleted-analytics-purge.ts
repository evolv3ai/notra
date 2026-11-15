import { scheduleDeletedAnalyticsPurge } from "@notra/ai/utils/deleted-analytics-purge";
import { logError } from "@notra/ai/utils/server-log";
import {
  purgeDeletedOrganizationAnalytics,
  purgeDeletedProjectAnalytics,
  purgeDeletedSiteAnalytics,
} from "@notra/analytics/tinybird/purge";

import type { DeletedAnalyticsPurgeInput } from "@/types/deleted-analytics-purge";

export function runDeletedAnalyticsPurge(
  { organizationId, siteId, projectId }: DeletedAnalyticsPurgeInput,
  waitForJobs = false
): Promise<void> {
  if (siteId) {
    return purgeDeletedSiteAnalytics({ organizationId, siteId }, waitForJobs);
  }
  if (projectId) {
    return purgeDeletedProjectAnalytics(
      { organizationId, projectId },
      waitForJobs
    );
  }
  return purgeDeletedOrganizationAnalytics({ organizationId }, waitForJobs);
}

export async function purgeDeletedAnalytics(
  input: DeletedAnalyticsPurgeInput
): Promise<void> {
  await Promise.all([
    runDeletedAnalyticsPurge(input).catch((error) => {
      logError("[Analytics Purge] Immediate purge failed", error, input);
    }),
    scheduleDeletedAnalyticsPurge(input).catch((error) => {
      logError("[Analytics Purge] Failed to queue delayed purge", error, input);
    }),
  ]);
}
