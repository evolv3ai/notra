import { SLACK_INFO_CHANNEL_TIMEOUT_MS } from "@/constants/slack-integration";
import { runAfterResponse } from "@/lib/after-response";
import type { SlackInfoChannelEvent } from "@/types/slack-info-channel";

const SLACK_CONTROL_CHARS_REGEX = /[&<>]/gu;
const LINE_BREAKS_REGEX = /[\r\n]+/gu;
const SLACK_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
};

function escapeSlack(value: string): string {
  return value
    .replace(LINE_BREAKS_REGEX, " ")
    .replace(SLACK_CONTROL_CHARS_REGEX, (char) => SLACK_ESCAPES[char] ?? char);
}

function formatInfoChannelMessage(
  event: SlackInfoChannelEvent,
  environment: string
): string {
  const suffix = environment === "production" ? "" : ` _(${environment})_`;
  const lines = Object.entries(event.fields).flatMap(([label, value]) =>
    value ? [`*${label}:* ${escapeSlack(value)}`] : []
  );
  return [`${event.emoji} *${event.title}*${suffix}`, ...lines].join("\n");
}

/**
 * The webhook body: plain text, plus Block Kit link buttons when the event
 * has links. The incoming webhook has no interactivity, so a button only
 * opens its URL and every action is confirmed in the console.
 */
function infoChannelPayload(event: SlackInfoChannelEvent, environment: string) {
  const text = formatInfoChannelMessage(event, environment);
  if (!event.links?.length) {
    return { text };
  }
  return {
    text,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text } },
      {
        type: "actions",
        elements: event.links.map((link) => ({
          type: "button",
          text: { type: "plain_text", text: link.label },
          url: link.url,
          ...(link.danger ? { style: "danger" } : {}),
        })),
      },
    ],
  };
}

/**
 * Posts a product event (signup, new site, ...) to the team's Slack info
 * channel after the response is sent. A no-op without SLACK_INFO_WEBHOOK_URL;
 * never throws or delays the request. Pass a loader when building the message
 * needs extra lookups, so they also run after the response.
 */
export function notifyInfoChannel(
  event: SlackInfoChannelEvent | (() => Promise<SlackInfoChannelEvent>)
): void {
  const webhook = process.env.SLACK_INFO_WEBHOOK_URL?.trim();
  if (!webhook) {
    return;
  }
  const environment =
    process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown";
  runAfterResponse("[SlackInfoChannel] Post failed", async () => {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        infoChannelPayload(
          typeof event === "function" ? await event() : event,
          environment
        )
      ),
      signal: AbortSignal.timeout(SLACK_INFO_CHANNEL_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Slack info channel returned HTTP ${response.status}`);
    }
  });
}
