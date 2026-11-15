import {
  confirmGitHubMentionBilling,
  createGitHubMentionUsageCollector,
  releaseGitHubMentionBilling,
  reserveGitHubMentionBilling,
} from "@notra/ai/billing/github-mention-billing";
import type { AgentTokenUsage } from "@notra/ai/types/agents";
import type { GitHubMentionBillingReservation } from "@notra/ai/types/billing";

import { AUTOPILOT_CREDITS_CHARGED_EVENT } from "@/constants/autopilot";
import {
  markFindingFailed,
  returnFindingToSuggested,
} from "@/lib/autopilot/findings";
import type { AutopilotLogger, FindingClaim } from "@/types/autopilot-runtime";

/**
 * Charges what the work cost when `charge` is set, otherwise gives the hold
 * back. The charge is logged with its job, which is where the dashboard reads
 * credits per automation from. Never throws: billing must not fail the work.
 */
export async function settleAutopilotBilling(params: {
  reservation: GitHubMentionBillingReservation;
  usage: AgentTokenUsage | null;
  charge: boolean;
  log: AutopilotLogger;
  properties?: Record<string, string | number | boolean>;
}) {
  try {
    if (!(params.charge && params.usage)) {
      await releaseGitHubMentionBilling(params.reservation);
      return 0;
    }
    const credits =
      (await confirmGitHubMentionBilling({
        reservation: params.reservation,
        usage: params.usage,
        properties: { source: "autopilot", ...params.properties },
      })) ?? 0;
    if (credits > 0) {
      await params.log.action(`Charged ${credits} credits`, {
        event: AUTOPILOT_CREDITS_CHARGED_EVENT,
        credits,
      });
    }
    return credits;
  } catch {
    return 0;
  }
}

export async function reserveAutopilotDraftCredits(params: {
  claim: FindingClaim;
  onReservationFailure: "fail" | "suggest";
  log: AutopilotLogger;
}) {
  const reservation = await reserveGitHubMentionBilling({
    organizationId: params.claim.finding.organizationId,
    // Replaying this claim is idempotent; a new attempt needs a fresh balance check.
    mentionKey: `autopilot-draft:${params.claim.finding.id}:${params.claim.token}`,
  }).catch(async (error: unknown) => {
    // No writer has started. Release ownership without consuming a write attempt.
    if (params.onReservationFailure === "suggest") {
      await returnFindingToSuggested(params.claim, error);
    } else {
      await markFindingFailed(params.claim, error, { count: false });
    }
    throw error;
  });
  if (!reservation.allowed) {
    await params.log.skip("No credits left to write this", {
      reason: reservation.reason ?? null,
    });
    return null;
  }
  return reservation;
}

export function sumAutopilotUsage(
  usages: (AgentTokenUsage | null | undefined)[]
) {
  const collector = createGitHubMentionUsageCollector();
  for (const usage of usages) {
    if (usage) {
      collector.add(usage);
    }
  }
  return collector.get();
}

/**
 * Runs one draft under its own credit hold. Refuses when nothing is left and charges only when a
 * pull request was opened: a run that found nothing worth changing is free.
 */
export async function withAutopilotDraftBilling<T>(params: {
  claim: FindingClaim;
  onReservationFailure: "fail" | "suggest";
  log: AutopilotLogger;
  opened: (value: T) => boolean;
  run: (onUsage: (usage: AgentTokenUsage) => void) => Promise<T>;
}): Promise<{ allowed: false } | { allowed: true; value: T }> {
  const reservation = await reserveAutopilotDraftCredits(params);
  if (!reservation) {
    return { allowed: false };
  }
  const usage = createGitHubMentionUsageCollector();
  let value: T | undefined;
  try {
    value = await params.run((next) => usage.add(next));
    return { allowed: true, value };
  } finally {
    await settleAutopilotBilling({
      reservation,
      usage: usage.get(),
      charge: value !== undefined && params.opened(value),
      log: params.log,
      properties: { finding_id: params.claim.finding.id },
    });
  }
}
