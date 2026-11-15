import {
  DELETED_ANALYTICS_PURGE_DELAY_MS,
  DELETED_ANALYTICS_PURGE_ROUTE_PATH,
} from "@notra/ai/constants/deleted-analytics-purge";
import type { DeletedAnalyticsPurgeInput } from "@notra/analytics/types/purge";
import { isDemoMode } from "@notra/utils/demo-mode";

import { publishQstashRouteMessage } from "../qstash/triggers";

/**
 * Queues a second purge after the ingest flush window, so rows buffered at
 * delete time are removed too. QStash retries it until it succeeds.
 */
export async function scheduleDeletedAnalyticsPurge(
  input: DeletedAnalyticsPurgeInput
): Promise<void> {
  if (isDemoMode()) {
    return;
  }
  if (!process.env.QSTASH_TOKEN) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "QSTASH_TOKEN is not set, delayed analytics purge skipped"
      );
    }
    return;
  }
  const scope =
    input.siteId ?? (input.projectId ? `project-${input.projectId}` : "org");
  await publishQstashRouteMessage({
    path: DELETED_ANALYTICS_PURGE_ROUTE_PATH,
    body: input,
    notBefore: new Date(Date.now() + DELETED_ANALYTICS_PURGE_DELAY_MS),
    deduplicationId: `analytics-purge-${input.organizationId}-${scope}`,
  });
}
