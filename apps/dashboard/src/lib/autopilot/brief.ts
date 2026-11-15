import { logError } from "@notra/ai/utils/server-log";
import { getAppUrl } from "@notra/ai/utils/url";
import { db } from "@notra/db/drizzle";
import {
  autopilotFindings,
  autopilotSettings,
  organizations,
  slackIntegrations,
} from "@notra/db/schema";
import { and, eq, sql } from "drizzle-orm";

import { AUTOPILOT_NAV_LINK } from "@/constants/autopilot";
import { AUTOPILOT_SLACK_KIND_LABELS } from "@/constants/autopilot-slack";
import { isAutopilotEnabledForOrganization } from "@/lib/autopilot/flag";
import { createAutopilotLogger } from "@/lib/autopilot/log";
import {
  callAutopilotSlack,
  postAutopilotSlackMessage,
} from "@/lib/autopilot/slack";
import type { AutopilotFindingRow as FindingRow } from "@/types/autopilot-runtime";
import type {
  AutopilotBrief,
  AutopilotBriefDelivery,
  AutopilotFindingMessage,
  SlackBlock,
} from "@/types/autopilot-slack";
import { autopilotSlackMessageId } from "@/utils/autopilot-delivery";
import { findingDisplayTitle } from "@/utils/autopilot-findings";
import { compactSlackText, slackMrkdwn } from "@/utils/autopilot-slack";

function bulletList(title: string, items: string[]) {
  if (items.length === 0) {
    return null;
  }
  const more = items.length > 3 ? `\n+${items.length - 3} more in Notra` : "";
  return `*${title}*\n${items
    .slice(0, 3)
    .map((item) => `• ${item}`)
    .join("\n")}${more}`;
}

function findingSummary(finding: FindingRow) {
  const target = finding.evidence.target;
  if (target?.kind === "prompt") {
    const competitors = finding.evidence.competitors?.slice(0, 3) ?? [];
    return `Your brand appears in ${Math.round(target.before * 100)}% of AI answers for this question.${competitors.length ? ` Competing with ${competitors.join(", ")}.` : ""}`;
  }
  if (finding.kind === "commits") {
    return "A blog post based on your recently shipped changes.";
  }
  return finding.summary;
}

function findingMessage(
  slug: string,
  finding: FindingRow
): AutopilotFindingMessage {
  const isIdea = finding.status === "suggested";
  const title = compactSlackText(findingDisplayTitle(finding), 100);
  const meta = [
    isIdea ? "Idea" : "Ready to merge",
    AUTOPILOT_SLACK_KIND_LABELS[finding.kind],
    finding.pullRequestUrl
      ? `<${finding.pullRequestUrl}|PR #${finding.pullRequestNumber}>`
      : null,
    finding.pullRequestUrl
      ? `<${finding.pullRequestUrl}/files|View diff>`
      : null,
  ].filter(Boolean);
  return {
    findingId: finding.id,
    status: isIdea ? "suggested" : "proposed",
    text: title,
    blocks: [
      {
        type: "section",
        text: slackMrkdwn(
          `*${title}*\n${compactSlackText(findingSummary(finding), 180)}`
        ),
        accessory: {
          type: "button",
          text: { type: "plain_text", text: "Open" },
          url: `${getAppUrl() ?? ""}/${slug}${AUTOPILOT_NAV_LINK}/findings/${finding.id}`,
          action_id: `autopilot_open_${finding.id}`,
        },
      },
      { type: "context", elements: [slackMrkdwn(meta.join("  ·  "))] },
      {
        type: "context",
        elements: [
          slackMrkdwn(
            isIdea
              ? "React 👍 to write it or 👎 if you don't want it"
              : "React 👍 to merge or 👎 to close it"
          ),
        ],
      },
    ],
  };
}

export function buildAutopilotBrief(params: {
  organizationSlug: string;
  proposed: FindingRow[];
  suggested?: FindingRow[];
  merged: FindingRow[];
  insights: string[];
}): AutopilotBrief | null {
  const {
    organizationSlug,
    proposed,
    merged,
    insights,
    suggested = [],
  } = params;
  if (
    proposed.length === 0 &&
    suggested.length === 0 &&
    merged.length === 0 &&
    insights.length === 0
  ) {
    return null;
  }
  const autopilotUrl = `${getAppUrl() ?? ""}/${organizationSlug}${AUTOPILOT_NAV_LINK}`;
  const summary =
    [
      proposed.length > 0 ? `${proposed.length} ready to merge` : null,
      suggested.length > 0
        ? `${suggested.length} ${suggested.length === 1 ? "idea" : "ideas"}`
        : null,
      merged.length > 0 ? `${merged.length} merged` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Nothing to review today";
  // Keep the digest short; the dashboard lists the rest.
  const visible = [...proposed, ...suggested].slice(0, 5);
  const remaining = proposed.length + suggested.length - visible.length;
  const blocks: SlackBlock[] = [
    {
      type: "section",
      text: slackMrkdwn(`*Autopilot daily brief*\n${summary}`),
      accessory: {
        type: "button",
        text: { type: "plain_text", text: "Open Autopilot" },
        url: autopilotUrl,
        action_id: "autopilot_open",
      },
    },
  ];
  if (visible.length > 0) {
    blocks.push({
      type: "context",
      elements: [
        slackMrkdwn(
          `Each item is in the thread. React 👍 or 👎 on it.${remaining > 0 ? ` <${autopilotUrl}|+${remaining} more in Notra>` : ""}`
        ),
      ],
    });
  }
  const notes = [
    bulletList(
      "Merged since your last brief",
      merged.map((finding) =>
        compactSlackText(findingDisplayTitle(finding), 100)
      )
    ),
    bulletList(
      "Worth knowing",
      insights.map((insight) => compactSlackText(insight, 180))
    ),
  ].filter(Boolean);
  if (notes.length > 0) {
    blocks.push({ type: "section", text: slackMrkdwn(notes.join("\n\n")) });
  }
  return {
    text: `Autopilot: ${summary}`,
    blocks,
    items: visible.map((finding) => findingMessage(organizationSlug, finding)),
  };
}

/** The Autopilot channel and bot token, or null when Slack is off for Autopilot. */
async function loadSlackDestination(organizationId: string) {
  if (!(await isAutopilotEnabledForOrganization(organizationId))) {
    return null;
  }
  const [destination] = await db
    .select({
      teamId: slackIntegrations.slackTeamId,
      encryptedBotToken: slackIntegrations.encryptedBotToken,
      channelId: autopilotSettings.slackChannelId,
    })
    .from(autopilotSettings)
    .innerJoin(
      slackIntegrations,
      and(
        eq(slackIntegrations.id, autopilotSettings.slackIntegrationId),
        eq(slackIntegrations.organizationId, organizationId),
        eq(slackIntegrations.enabled, true)
      )
    )
    .where(
      and(
        eq(autopilotSettings.organizationId, organizationId),
        eq(autopilotSettings.enabled, true)
      )
    );
  if (!destination?.channelId) {
    return null;
  }
  return {
    organizationId,
    encryptedBotToken: destination.encryptedBotToken,
    destination: {
      teamId: destination.teamId,
      channelId: destination.channelId,
    },
  };
}

type SlackDestination = NonNullable<
  Awaited<ReturnType<typeof loadSlackDestination>>
>;

/**
 * Posts one votable item into a thread. Its address is saved before the
 * reactions go on, so an early 👍 already finds the item.
 */
async function postFindingReply(
  send: SlackDestination,
  item: AutopilotFindingMessage,
  threadTs: string,
  clientMessageId?: string
) {
  const reply = await postAutopilotSlackMessage({
    ...send,
    text: item.text,
    blocks: item.blocks,
    threadTs,
    clientMessageId,
  });
  const slackMessage = JSON.stringify({
    channel: reply.channel,
    ts: reply.ts,
    threadTs,
    status: item.status,
  });
  const saved = await db
    .update(autopilotFindings)
    .set({
      evidence: sql`(${autopilotFindings.evidence} - 'slackActingAt') || jsonb_build_object('slackMessage', ${slackMessage}::jsonb)`,
    })
    .where(
      and(
        eq(autopilotFindings.organizationId, send.organizationId),
        eq(autopilotFindings.id, item.findingId),
        // A slow, older reply must not replace the address of a newer one or
        // of a finding that has moved on (e.g. an idea that is now a PR).
        eq(autopilotFindings.status, item.status),
        sql`coalesce((${autopilotFindings.evidence}->'slackMessage'->>'ts')::numeric, 0) < ${reply.ts}::numeric`
      )
    )
    .returning({ id: autopilotFindings.id });
  if (saved.length === 0) {
    // Votes on this reply could never be matched, so it must not stay up.
    await callAutopilotSlack({
      ...send,
      method: "chat.delete",
      body: { channel: reply.channel, ts: reply.ts },
    }).catch(() => undefined);
    throw new Error("The item changed while its Slack reply was posted");
  }
  // Pre-filled votes make it one tap; in order, so 👍 comes first. Older installs lack reactions:write.
  for (const name of ["+1", "-1"]) {
    await callAutopilotSlack({
      ...send,
      method: "reactions.add",
      body: { channel: reply.channel, timestamp: reply.ts, name },
    }).catch(() => undefined);
  }
}

/** Posts to the Slack channel picked for Autopilot; returns null when none is set. */
export async function postAutopilotBrief(
  organizationId: string,
  brief: AutopilotBrief,
  runId?: string
): Promise<AutopilotBriefDelivery | null> {
  const send = await loadSlackDestination(organizationId);
  if (!send) {
    return null;
  }
  const delivered = await postAutopilotSlackMessage({
    ...send,
    text: brief.text,
    blocks: brief.blocks,
    clientMessageId: runId ? autopilotSlackMessageId(runId) : undefined,
  });
  const items: AutopilotBriefDelivery["items"] = [];
  // One at a time so the thread keeps the brief's order.
  for (const item of brief.items) {
    try {
      await postFindingReply(
        send,
        item,
        delivered.ts,
        runId
          ? autopilotSlackMessageId(`${runId}:${item.findingId}`)
          : undefined
      );
      items.push({ findingId: item.findingId, status: item.status });
    } catch (error) {
      logError("Autopilot brief reply failed", error, {
        organizationId,
        findingId: item.findingId,
      });
    }
  }
  if (runId) {
    await createAutopilotLogger({ organizationId, runId }, null).action(
      "Delivered the Slack message",
      {
        url: `https://app.slack.com/client/${encodeURIComponent(delivered.teamId)}/${encodeURIComponent(delivered.channel)}/thread/${encodeURIComponent(delivered.channel)}-${encodeURIComponent(delivered.ts)}`,
      }
    );
  }
  return { channel: delivered.channel, ts: delivered.ts, items };
}

/**
 * After a write someone asked for from Slack, answers in that item's thread:
 * the new pull request as a votable reply, or why nothing was written (a
 * failure, or rules that kept it an idea).
 */
export async function reportAutopilotWriteInSlack(
  organizationId: string,
  findingId: string,
  reason?: string
) {
  const finding = await db.query.autopilotFindings.findFirst({
    where: and(
      eq(autopilotFindings.organizationId, organizationId),
      eq(autopilotFindings.id, findingId)
    ),
  });
  const thread = finding?.evidence.slackMessage;
  if (!(finding && thread)) {
    return;
  }
  const send = await loadSlackDestination(organizationId);
  if (send?.destination.channelId !== thread.channel) {
    return;
  }
  if (finding.status === "proposed") {
    const organization = await db.query.organizations.findFirst({
      columns: { slug: true },
      where: eq(organizations.id, organizationId),
    });
    if (organization) {
      await postFindingReply(
        send,
        findingMessage(organization.slug, finding),
        thread.threadTs
      );
      // Announced here, so the next brief does not post the same PR again.
      await db
        .update(autopilotFindings)
        .set({
          evidence: sql`jsonb_set(${autopilotFindings.evidence}, '{briefed}', coalesce(${autopilotFindings.evidence}->'briefed', '[]'::jsonb) || '["proposed"]'::jsonb)`,
        })
        .where(eq(autopilotFindings.id, finding.id));
    }
    return;
  }
  await db
    .update(autopilotFindings)
    .set({ evidence: sql`${autopilotFindings.evidence} - 'slackActingAt'` })
    .where(eq(autopilotFindings.id, finding.id));
  if (reason) {
    const text = `Couldn't write this one: ${compactSlackText(reason, 200)}`;
    await postAutopilotSlackMessage({
      ...send,
      threadTs: thread.threadTs,
      text,
      blocks: [{ type: "section", text: slackMrkdwn(text) }],
    });
  }
}
