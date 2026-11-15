import { db } from "@notra/db/drizzle";
import {
  autopilotFindings,
  autopilotRuns,
  autopilotSettings,
} from "@notra/db/schema";
import { and, eq } from "drizzle-orm";

import { AUTOPILOT_LEASE_RENEW_INTERVAL_MS } from "@/constants/autopilot";
import { isAutopilotEnabledForOrganization } from "@/lib/autopilot/flag";
import type { AutopilotRunContext } from "@/types/autopilot";
import type { FindingClaim } from "@/types/autopilot-runtime";
import { withHeartbeat } from "@/utils/autopilot-leases";

export async function renewAutopilotRunLease(
  ctx: Pick<AutopilotRunContext, "organizationId" | "runId">
) {
  const rows = await db
    .update(autopilotRuns)
    .set({ heartbeatAt: new Date() })
    .where(
      and(
        eq(autopilotRuns.id, ctx.runId),
        eq(autopilotRuns.organizationId, ctx.organizationId),
        eq(autopilotRuns.status, "running")
      )
    )
    .returning({ id: autopilotRuns.id });
  return rows.length > 0;
}

export async function renewAutopilotFindingLease(claim: FindingClaim) {
  if (
    !claim.finding.runId ||
    !(await renewAutopilotRunLease({
      organizationId: claim.finding.organizationId,
      runId: claim.finding.runId,
    }))
  ) {
    return false;
  }
  const rows = await db
    .update(autopilotFindings)
    .set({ claimedAt: new Date() })
    .where(
      and(
        eq(autopilotFindings.id, claim.finding.id),
        eq(autopilotFindings.organizationId, claim.finding.organizationId),
        eq(autopilotFindings.claimToken, claim.token),
        eq(autopilotFindings.status, "open")
      )
    )
    .returning({ id: autopilotFindings.id });
  return rows.length > 0;
}

export async function assertAutopilotFindingLease(claim: FindingClaim) {
  if (
    !(await isAutopilotEnabledForOrganization(claim.finding.organizationId))
  ) {
    throw new Error("Autopilot is not available for this workspace.");
  }
  const settings = await db.query.autopilotSettings.findFirst({
    columns: { enabled: true },
    where: eq(autopilotSettings.organizationId, claim.finding.organizationId),
  });
  if (!settings?.enabled) {
    throw new Error("Autopilot is turned off for this workspace.");
  }
  if (!(await renewAutopilotFindingLease(claim))) {
    throw new Error("This draft's writer no longer owns its claim");
  }
}

export function withAutopilotRunLease<T>(
  ctx: Pick<AutopilotRunContext, "organizationId" | "runId">,
  operation: () => Promise<T>
) {
  return withHeartbeat(
    () => renewAutopilotRunLease(ctx),
    operation,
    AUTOPILOT_LEASE_RENEW_INTERVAL_MS
  );
}

export function withAutopilotFindingLease<T>(
  claim: FindingClaim,
  operation: () => Promise<T>
) {
  let started = false;
  return withHeartbeat(
    async () => {
      if (await renewAutopilotFindingLease(claim)) {
        started = true;
        return true;
      }
      if (!started) {
        return false;
      }
      // A finishing writer may settle its claim while a timer renewal is in flight.
      // Side-effect boundaries still use the strict assertion above.
      const current = await db.query.autopilotFindings.findFirst({
        columns: { runId: true, status: true, claimToken: true },
        where: and(
          eq(autopilotFindings.id, claim.finding.id),
          eq(autopilotFindings.organizationId, claim.finding.organizationId)
        ),
      });
      return (
        current?.runId === claim.finding.runId &&
        current.status !== "open" &&
        current.claimToken === null
      );
    },
    operation,
    AUTOPILOT_LEASE_RENEW_INTERVAL_MS
  );
}
