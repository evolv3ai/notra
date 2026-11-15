import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import { autopilotFindings, autopilotSettings } from "@notra/db/schema";
import { and, eq } from "drizzle-orm";

import { withAutopilotDraftBilling } from "@/lib/autopilot/billing";
import { writeFindingPost } from "@/lib/autopilot/blog";
import { reportAutopilotWriteInSlack } from "@/lib/autopilot/brief";
import {
  claimSuggestedFinding,
  returnFindingToSuggested,
  recoverStaleFindings,
} from "@/lib/autopilot/findings";
import { isAutopilotEnabledForOrganization } from "@/lib/autopilot/flag";
import { renewAutopilotRunLease } from "@/lib/autopilot/leases";
import { createAutopilotLogger } from "@/lib/autopilot/log";
import {
  buildAutopilotRunContext,
  createItemAutopilotRun,
  finishAutopilotRun,
} from "@/lib/autopilot/run";
import type { FindingClaim } from "@/types/autopilot-runtime";
import { toErrorMessage } from "@/utils/error-message";

class AutopilotSuggestionError extends Error {
  override name = "AutopilotSuggestionError";
}

/** Shared admission check for the HTTP caller and the queued worker. */
export async function loadSuggestedPost(
  organizationId: string,
  findingId: string
) {
  if (!(await isAutopilotEnabledForOrganization(organizationId))) {
    throw new AutopilotSuggestionError(
      "Autopilot is not available for this workspace."
    );
  }
  const settings = await db.query.autopilotSettings.findFirst({
    columns: { enabled: true },
    where: eq(autopilotSettings.organizationId, organizationId),
  });
  if (!settings?.enabled) {
    throw new AutopilotSuggestionError(
      "Turn on Autopilot before writing this post."
    );
  }
  // A writer that died after the response left its claim behind; past the
  // lease the suggestion is offered again instead of staying stuck.
  await recoverStaleFindings(organizationId);
  const finding = await db.query.autopilotFindings.findFirst({
    where: and(
      eq(autopilotFindings.organizationId, organizationId),
      eq(autopilotFindings.id, findingId)
    ),
  });
  const brief = finding?.evidence.brief;
  if (!(finding?.status === "suggested" && brief)) {
    throw new AutopilotSuggestionError("This suggestion can't be written.");
  }
  return { finding, brief };
}

/**
 * Claims and reserves credits only once the suggestion workflow starts.
 * Write now passes the run it created at enqueue time so polling sees it.
 */
export async function writeSuggestedPost(
  organizationId: string,
  findingId: string,
  queuedRunId?: string
) {
  const runId =
    queuedRunId ?? (await createItemAutopilotRun(organizationId, "suggestion"));
  let error: string | undefined;
  // Not a failure of the run, but the person who asked still needs to hear why.
  let skipped: string | undefined;
  let claim: FindingClaim | null = null;
  try {
    const { finding, brief } = await loadSuggestedPost(
      organizationId,
      findingId
    );
    if (!(await renewAutopilotRunLease({ organizationId, runId }))) {
      throw new AutopilotSuggestionError(
        "This queued write is no longer active. Try again."
      );
    }
    const kind = finding.kind === "keywords" ? "keywords" : "commits";
    const log = createAutopilotLogger({ organizationId, runId }, kind);
    const acquired = await claimSuggestedFinding(
      organizationId,
      findingId,
      runId
    );
    claim = acquired;
    if (!acquired) {
      throw new AutopilotSuggestionError("This post is already being written.");
    }
    // Match the daily writer: claim first, then hold credits, charge only for a PR.
    const billed = await withAutopilotDraftBilling<
      Awaited<ReturnType<typeof writeFindingPost>>
    >({
      claim: acquired,
      onReservationFailure: "suggest",
      log,
      opened: (outcome) => outcome.status === "proposed",
      run: async (onUsage) => {
        const ctx = await buildAutopilotRunContext(organizationId, runId);
        await log.info(`Writing the suggestion "${brief.topic}"`, {
          confidence: finding.evidence.confidence ?? null,
        });
        return writeFindingPost({
          ctx,
          log,
          claim: acquired,
          brief,
          onFailure: "suggest",
          // An explicit request bypasses the automatic open-draft cap.
          draftLimit: null,
          onUsage,
        });
      },
    });
    if (!billed.allowed) {
      throw new AutopilotSuggestionError(
        "No credits left to write this post. Add AI credits in Notra and try again."
      );
    }
    if (billed.value.status === "failed") {
      throw new AutopilotSuggestionError(billed.value.error);
    }
    if (billed.value.status === "suggested") {
      skipped =
        "the workspace's Autopilot rules don't allow this post, so it stays an idea.";
    }
  } catch (failure) {
    error = toErrorMessage(failure, String(failure));
    if (claim) {
      await returnFindingToSuggested(claim, failure);
    }
    throw failure;
  } finally {
    await finishAutopilotRun({
      organizationId,
      runId,
      results: claim ? [{ findingIds: [claim.finding.id], insights: [] }] : [],
      slackMessageTs: null,
      scheduled: false,
      error,
    });
    // Only the run that got to write answers; a duplicate request stays quiet.
    if (claim) {
      await reportAutopilotWriteInSlack(
        organizationId,
        findingId,
        error ?? skipped
      ).catch((failure) =>
        logError("Autopilot Slack write report failed", failure, {
          organizationId,
          findingId,
        })
      );
    }
  }
}
