type SlackBlockValue =
  | string
  | number
  | boolean
  | null
  | readonly SlackBlockValue[]
  | { readonly [key: string]: SlackBlockValue };

export interface SlackBlock {
  readonly [key: string]: SlackBlockValue;
}

interface AutopilotSlackMessage {
  text: string;
  blocks: SlackBlock[];
}

/** A summary message and one thread reply per finding, so each can get its own reaction. */
export interface AutopilotFindingMessage extends AutopilotSlackMessage {
  findingId: string;
  status: "suggested" | "proposed";
}

export interface AutopilotBrief extends AutopilotSlackMessage {
  items: AutopilotFindingMessage[];
}

export interface AutopilotBriefDelivery {
  channel: string;
  ts: string;
  /** Only the replies Slack confirmed; the others are announced again next time. */
  items: { findingId: string; status: "suggested" | "proposed" }[];
}

export interface PostAutopilotSlackMessageInput {
  organizationId: string;
  encryptedBotToken: string;
  destination: { teamId: string; channelId: string };
  text: string;
  blocks: readonly SlackBlock[];
  /** Stable UUID reused when a run retries delivery; not an exactly-once guarantee. */
  clientMessageId?: string;
  /** Posts as a reply in this thread. */
  threadTs?: string;
}

export interface AutopilotSlackApiInput {
  organizationId: string;
  encryptedBotToken: string;
  /** Slack Web API method, e.g. `reactions.add`. */
  method: string;
  body: Record<string, unknown>;
}

export interface PostAutopilotSlackMessageResult {
  channel: string;
  ts: string;
  teamId: string;
}
