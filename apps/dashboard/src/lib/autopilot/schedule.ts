import { db } from "@notra/db/drizzle";
import { autopilotSettings } from "@notra/db/schema";
import { mapWithConcurrency } from "@notra/sites-server/utils/concurrency";
import { eq } from "drizzle-orm";

import {
  AUTOPILOT_CRON_CONCURRENCY,
  AUTOPILOT_REACTION_LOOKBACK_DAYS,
} from "@/constants/autopilot";
import { syncOfferReactionFeedback } from "@/lib/autopilot/findings";
import { isAutopilotEnabledForOrganization } from "@/lib/autopilot/flag";
import { purgeExpiredAutopilotTraceDetails } from "@/lib/autopilot/log";
import { startAutopilot } from "@/lib/autopilot/start";
import { isAutopilotDue } from "@/utils/autopilot-schedule";

export async function runDueAutopilots() {
  const now = new Date();
  const [, rows] = await Promise.all([
    purgeExpiredAutopilotTraceDetails(now),
    db.query.autopilotSettings.findMany({
      where: eq(autopilotSettings.enabled, true),
    }),
  ]);
  let started = 0;
  let failed = 0;
  await mapWithConcurrency(rows, AUTOPILOT_CRON_CONCURRENCY, async (row) => {
    try {
      if (!(await isAutopilotEnabledForOrganization(row.organizationId))) {
        return;
      }
      try {
        await syncOfferReactionFeedback(
          row.organizationId,
          new Date(now.getTime() - AUTOPILOT_REACTION_LOOKBACK_DAYS * 86400000)
        );
      } catch {
        // Feedback retries must not block unrelated daily work.
        failed += 1;
      }
      if (!isAutopilotDue(row, now)) {
        return;
      }
      const claim = await startAutopilot(row.organizationId, "cron");
      if (!claim.alreadyRunning) {
        started += 1;
      }
    } catch {
      failed += 1;
    }
  });
  return { checked: rows.length, started, failed };
}
