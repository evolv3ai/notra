import type { autopilotSlackActionRequestSchema } from "@notra/ai/schemas/autopilot-slack-action";
import { logError } from "@notra/ai/utils/server-log";
import { db } from "@notra/db/drizzle";
import {
  autopilotFindings,
  autopilotSettings,
  slackIntegrations,
} from "@notra/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type * as z from "zod";

import { AUTOPILOT_SLACK_ACTION_STALE_SECONDS } from "@/constants/autopilot-slack";
import { dismissFinding, mergeFinding } from "@/lib/autopilot/findings";
import { isAutopilotEnabledForOrganization } from "@/lib/autopilot/flag";
import { rememberFeedback } from "@/lib/autopilot/memory";
import {
  createItemAutopilotRun,
  finishAutopilotRun,
} from "@/lib/autopilot/run";
import { postAutopilotSlackMessage } from "@/lib/autopilot/slack";
import { loadSuggestedPost } from "@/lib/autopilot/suggestions";
import type { AutopilotFindingRow } from "@/types/autopilot-runtime";
import { compactSlackText, slackMrkdwn } from "@/utils/autopilot-slack";
import { toErrorMessage } from "@/utils/error-message";

type SlackVote = z.infer<typeof autopilotSlackActionRequestSchema>;

/** Only the workspace and channel Autopilot posts to can act on its findings. */
async function loadDestination(vote: SlackVote) {
  const [destination] = await db
    .select({
      organizationId: autopilotSettings.organizationId,
      encryptedBotToken: slackIntegrations.encryptedBotToken,
    })
    .from(autopilotSettings)
    .innerJoin(
      slackIntegrations,
      and(
        eq(slackIntegrations.id, autopilotSettings.slackIntegrationId),
        eq(slackIntegrations.organizationId, autopilotSettings.organizationId),
        eq(slackIntegrations.slackTeamId, vote.teamId),
        eq(slackIntegrations.enabled, true)
      )
    )
    .where(
      and(
        eq(autopilotSettings.enabled, true),
        eq(autopilotSettings.slackChannelId, vote.channelId)
      )
    );
  if (
    !(
      destination &&
      (await isAutopilotEnabledForOrganization(destination.organizationId))
    )
  ) {
    return null;
  }
  return destination;
}

function pullRequestLabel(finding: AutopilotFindingRow) {
  return finding.pullRequestUrl
    ? `<${finding.pullRequestUrl}|PR #${finding.pullRequestNumber}>`
    : "the pull request";
}

function failure(error: unknown) {
  return compactSlackText(toErrorMessage(error, "unknown error"), 200);
}

/** Acts on a 👍/👎 on an Autopilot item in the Autopilot Slack channel. */
export async function handleAutopilotSlackAction(vote: SlackVote) {
  const destination = await loadDestination(vote);
  if (!destination) {
    return;
  }
  const { organizationId } = destination;
  const finding = await db.query.autopilotFindings.findFirst({
    where: and(
      eq(autopilotFindings.organizationId, organizationId),
      sql`${autopilotFindings.evidence}->'slackMessage'->>'channel' = ${vote.channelId}`,
      sql`${autopilotFindings.evidence}->'slackMessage'->>'ts' = ${vote.messageTs}`
    ),
  });
  const message = finding?.evidence.slackMessage;
  // A vote only counts for what its message offered: once an idea is being
  // written or a PR is merged, votes on the old reply do nothing.
  if (!(finding && message?.status === finding.status)) {
    return;
  }
  const { threadTs } = message;
  const user = `<@${vote.userId}>`;
  const reply = (text: string) =>
    postAutopilotSlackMessage({
      organizationId,
      encryptedBotToken: destination.encryptedBotToken,
      destination: { teamId: vote.teamId, channelId: vote.channelId },
      threadTs,
      text,
      blocks: [{ type: "section", text: slackMrkdwn(text) }],
    });

  if (vote.vote === "down") {
    await dismissFinding(organizationId, finding.id);
    await rememberFeedback({
      organizationId,
      id: `autopilot-slack-dismiss-${finding.id}`,
      text: `The workspace dismissed this specific suggestion: ${finding.title}. Reason: none given (thumbs down in Slack), not a standing topic ban.`,
      sourceUrl: null,
      createdBy: "a Slack user",
      origin: "slack",
    }).catch((error) =>
      logError("Autopilot Slack feedback failed", error, { organizationId })
    );
    await reply(
      finding.status === "proposed"
        ? `${user} dismissed this and ${pullRequestLabel(finding)} was closed.`
        : `${user} dismissed this idea. Autopilot won't write it.`
    );
    return;
  }

  // Claim first so two quick 👍 act and reply only once. The claim expires, so
  // an action stopped halfway can be retried; mergeFinding checks GitHub's
  // current state first, and the writer re-checks the idea.
  const [claimed] = await db
    .update(autopilotFindings)
    .set({
      evidence: sql`${autopilotFindings.evidence} || jsonb_build_object('slackActingAt', now()::text)`,
    })
    .where(
      and(
        eq(autopilotFindings.id, finding.id),
        eq(autopilotFindings.status, finding.status),
        sql`(not (${autopilotFindings.evidence} ? 'slackActingAt') or (${autopilotFindings.evidence}->>'slackActingAt')::timestamptz < now() - make_interval(secs => ${AUTOPILOT_SLACK_ACTION_STALE_SECONDS}))`
      )
    )
    .returning({ id: autopilotFindings.id });
  if (!claimed) {
    return;
  }
  const release = () =>
    db
      .update(autopilotFindings)
      .set({ evidence: sql`${autopilotFindings.evidence} - 'slackActingAt'` })
      .where(eq(autopilotFindings.id, finding.id));

  if (finding.status === "proposed") {
    try {
      await mergeFinding(organizationId, finding.id);
    } catch (error) {
      await release();
      await reply(
        `Couldn't merge ${pullRequestLabel(finding)}: ${failure(error)}`
      );
      return;
    }
    await reply(`${user} merged ${pullRequestLabel(finding)}.`);
    return;
  }

  try {
    await loadSuggestedPost(organizationId, finding.id);
    const runId = await createItemAutopilotRun(organizationId, "suggestion");
    try {
      const { startAutopilotSuggestionWorkflowRun } =
        await import("@/lib/workflows/start");
      await startAutopilotSuggestionWorkflowRun({
        organizationId,
        findingId: finding.id,
        runId,
      });
    } catch (startFailure) {
      await finishAutopilotRun({
        organizationId,
        runId,
        results: [],
        slackMessageTs: null,
        scheduled: false,
        error: toErrorMessage(startFailure, "Could not start the writer"),
      });
      throw startFailure;
    }
  } catch (error) {
    await release();
    await reply(`Couldn't start writing: ${failure(error)}`);
    return;
  }
  // Outside the try: once the writer runs, a failed Slack post must not free the claim.
  await reply(
    `${user} asked for this one. Autopilot queued it and will post the pull request, or why it couldn't write it, here.`
  );
}
