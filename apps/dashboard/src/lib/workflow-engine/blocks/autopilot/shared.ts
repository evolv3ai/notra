import { createHash } from "node:crypto";

import type { GitHubMentionBillingReservation } from "@notra/ai/types/billing";
import type { WorkflowBlockContext } from "@notra/workflows/types/blocks";
import { FatalError } from "workflow";

import { WORKFLOW_RUN_STOPPED_MESSAGE } from "@/constants/workflow-engine";
import {
  reserveAutopilotDraftCredits,
  settleAutopilotBilling,
  sumAutopilotUsage,
} from "@/lib/autopilot/billing";
import { failDraft } from "@/lib/autopilot/blog";
import {
  markFindingFailed,
  markFindingSuggested,
} from "@/lib/autopilot/findings";
import {
  renewAutopilotRunLease,
  withAutopilotRunLease,
} from "@/lib/autopilot/leases";
import { createAutopilotLogger } from "@/lib/autopilot/log";
import {
  AutopilotUnavailableError,
  buildAutopilotRunContext,
} from "@/lib/autopilot/run";
import { isWorkflowRunStopped } from "@/lib/workflow-engine/store";
import type { AutopilotRunContext } from "@/types/autopilot";
import type {
  AutopilotPlanActed,
  FindingClaim,
} from "@/types/autopilot-runtime";
import type {
  AutopilotBlockContext,
  WorkflowBlockFinalizerContext,
} from "@/types/autopilot-workflow";
import { toErrorMessage } from "@/utils/error-message";

export async function loadAutopilotContext(context: AutopilotBlockContext) {
  try {
    return await buildAutopilotRunContext(
      context.organizationId,
      context.config.autopilotRunId
    );
  } catch (error) {
    throw error instanceof AutopilotUnavailableError
      ? new FatalError(error.message)
      : error;
  }
}

export async function autopilotUnavailableReason(
  context: AutopilotBlockContext
) {
  try {
    await loadAutopilotContext(context);
    return null;
  } catch (error) {
    if (error instanceof FatalError) {
      return error.message;
    }
    throw error;
  }
}

export async function withRunLease<T>(
  ctx: AutopilotRunContext,
  work: () => Promise<T>
): Promise<T | null> {
  if (!(await renewAutopilotRunLease(ctx))) {
    return null;
  }
  return await withAutopilotRunLease(ctx, work);
}

export function autopilotLogScope(context: AutopilotBlockContext) {
  return {
    organizationId: context.organizationId,
    runId: context.config.autopilotRunId,
  };
}

export function stepClaimToken(context: WorkflowBlockContext<unknown>) {
  return createHash("sha256")
    .update(context.idempotencyKey)
    .digest("hex")
    .slice(0, 32);
}

export function actedOn(
  claim: FindingClaim,
  status: AutopilotPlanActed["status"],
  pullRequestUrl: string | null = null
): AutopilotPlanActed {
  return { findingId: claim.finding.id, status, pullRequestUrl };
}

export async function holdAutopilotCredits(params: {
  ctx: AutopilotRunContext;
  claim: FindingClaim;
  whenUnavailable: "fail" | "suggest";
}): Promise<
  | { reservation: GitHubMentionBillingReservation }
  | { reason: string; acted?: AutopilotPlanActed }
> {
  const { ctx, claim, whenUnavailable } = params;
  const log = createAutopilotLogger(ctx, claim.finding.kind);
  const reservation = await reserveAutopilotDraftCredits({
    claim,
    log,
    onReservationFailure: "fail",
  }).catch(async (error: unknown) => {
    await log.error("Could not check the credit balance", {
      error: toErrorMessage(error, String(error)),
    });
    return undefined;
  });
  if (reservation === undefined) {
    return { reason: "The credit check failed; the next run tries again" };
  }
  if (reservation) {
    return { reservation };
  }
  if (whenUnavailable === "suggest") {
    await markFindingSuggested(claim);
    return { reason: "No credits left", acted: actedOn(claim, "ready") };
  }
  // Tried again tomorrow, when there may be credits again.
  await markFindingFailed(claim, "No credits left", { count: false });
  return { reason: "No credits left" };
}

export async function settleClaimedDraft(
  context: WorkflowBlockFinalizerContext
) {
  const { claim, reservation, usage } = context.state;
  if (!claim) {
    return;
  }
  const { outcome } = context;
  const log = createAutopilotLogger(
    autopilotLogScope(context),
    claim.finding.kind
  );
  if (reservation) {
    await settleAutopilotBilling({
      reservation,
      usage: sumAutopilotUsage(usage ?? []),
      charge:
        outcome.status === "success" &&
        (outcome.output as { opened?: unknown } | undefined)?.opened === true,
      log,
      properties: { finding_id: claim.finding.id },
    });
  }
  if (outcome.status === "success") {
    return;
  }
  if (await isWorkflowRunStopped(context.runId)) {
    await markFindingFailed(claim, WORKFLOW_RUN_STOPPED_MESSAGE, {
      count: false,
    });
    return;
  }
  if (outcome.status === "error") {
    await failDraft({ claim, log, error: outcome.error, onFailure: "fail" });
  }
}
