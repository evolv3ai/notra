import {
  callSlackApi,
  type ExperimentalSlackActivityDestination,
  type ExperimentalSlackActivityRenderer,
  type SlackBotToken,
  type SlackInteractionAction,
} from "eve/channels/slack";

import {
  SLACK_CONTROL_MENTION_REGEX,
  SLACK_CONTROLS_METADATA_TYPE,
  SLACK_CONTROLS_RENDERER_ID,
  SLACK_CONTROLS_TEXT,
  SLACK_LEAVE_ACTION_ID,
  SLACK_LEAVE_MESSAGES,
  SLACK_STOP_ACTION_ID,
  SLACK_STOP_MESSAGES,
} from "../constants/slack-controls";
import { slackControlValueSchema } from "../schemas/slack-controls";
import type {
  SlackControl,
  SlackControlContext,
  SlackControlsPhase,
  SlackControlsPost,
  SlackControlsRendererState,
  SlackControlValue,
} from "../types/slack-controls";

export function parseSlackControlMessage(
  text: string,
  botMentioned = false
): SlackControl | null {
  if (SLACK_CONTROL_MENTION_REGEX.test(text.trim()) && !botMentioned) {
    return null;
  }
  const command = text
    .trim()
    .replace(SLACK_CONTROL_MENTION_REGEX, "")
    .replace(/[.!]+$/u, "")
    .trim()
    .toLowerCase();

  if (SLACK_LEAVE_MESSAGES.has(command)) {
    return "leave";
  }
  return SLACK_STOP_MESSAGES.has(command) ? "stop" : null;
}

export async function handleSlackControl(
  control: SlackControl,
  ctx: SlackControlContext,
  value?: SlackControlValue
): Promise<void> {
  const session = await ctx.resolveSession();
  if (!session || (value && value.sessionId !== session.id)) {
    await ctx.thread.post("This conversation is no longer active.");
    return;
  }

  if (control === "leave") {
    await session.reset({ reason: "Slack user opted out of thread replies" });
    await ctx.thread.post(
      "I'll stop replying in this thread. Mention @Notra to start a new conversation."
    );
    return;
  }

  const result = await session.cancel({
    tasks: true,
    ...(value ? { turnId: value.turnId } : {}),
  });
  await ctx.thread.post(
    result.status === "accepted"
      ? "Stop requested. An action already in progress may finish; this doesn't undo saved or published work."
      : "There isn't an active request to stop."
  );
}

export async function handleSlackControlAction(
  action: SlackInteractionAction,
  ctx: SlackControlContext
): Promise<void> {
  if (
    action.actionId !== SLACK_STOP_ACTION_ID &&
    action.actionId !== SLACK_LEAVE_ACTION_ID
  ) {
    return;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(action.value ?? "");
  } catch {
    return;
  }
  const value = slackControlValueSchema.safeParse(raw);
  if (!value.success) {
    return;
  }
  await handleSlackControl(
    action.actionId === SLACK_LEAVE_ACTION_ID ? "leave" : "stop",
    ctx,
    value.data
  );
}

export function buildSlackControlsPost(
  sessionId: string,
  turnId: string,
  phase: SlackControlsPhase
): SlackControlsPost {
  const text = SLACK_CONTROLS_TEXT[phase];
  const value = JSON.stringify({ sessionId, turnId });
  const button = (actionId: string, label: string) => ({
    type: "button",
    action_id: actionId,
    text: { type: "plain_text", text: label },
    value,
  });

  return {
    text,
    blocks: [
      {
        type: "actions",
        elements: [
          ...(phase === "working"
            ? [button(SLACK_STOP_ACTION_ID, "Stop request")]
            : []),
          button(SLACK_LEAVE_ACTION_ID, "Stop replying here"),
        ],
      },
    ],
  };
}

export function createSlackControlsRenderer(
  botToken: SlackBotToken | undefined
): ExperimentalSlackActivityRenderer<SlackControlsRendererState> {
  return {
    id: SLACK_CONTROLS_RENDERER_ID,
    async render({ destination, snapshot, state }) {
      const { channelId, threadTs, installationTeamId } = destination;
      if (!(channelId && threadTs)) {
        return state;
      }
      const roots = Object.values(snapshot.work)
        .filter((work) => work.kind === "root-turn")
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .map((root) => {
          const running = Object.values(snapshot.work).filter(
            (work) =>
              work.rootTurnId === root.rootTurnId && work.phase === "running"
          );
          const waiting = Object.values(snapshot.blockers).some(
            (blocker) =>
              blocker.rootTurnId === root.rootTurnId &&
              blocker.phase === "blocked"
          );
          let phase: SlackControlsPhase = "idle";
          if (
            running.some((work) => work.kind !== "root-turn") ||
            (running.length > 0 && !waiting)
          ) {
            phase = "working";
          } else if (waiting) {
            phase = "waiting";
          }
          return { ...root, phase };
        });
      const root =
        roots.find((work) => work.phase === "working") ??
        roots.find((work) => work.phase === "waiting") ??
        roots[0];
      if (!root) {
        return state;
      }
      const post = buildSlackControlsPost(
        root.rootSessionId,
        root.rootTurnId,
        root.phase
      );
      if (
        state?.sessionId === root.rootSessionId &&
        state.turnId === root.rootTurnId &&
        state.text === post.text
      ) {
        return state;
      }
      let messageTs =
        state?.sessionId === root.rootSessionId
          ? state.messageTs
          : await recoverSlackControlsMessage(
              botToken,
              destination,
              root.rootSessionId
            );
      const write = () =>
        callSlackApi({
          botToken,
          context: { teamId: installationTeamId ?? undefined },
          operation: messageTs ? "chat.update" : "chat.postMessage",
          body: {
            ...post,
            channel: channelId,
            ...(messageTs
              ? { ts: messageTs }
              : {
                  thread_ts: threadTs,
                  metadata: {
                    event_type: SLACK_CONTROLS_METADATA_TYPE,
                    event_payload: { session_id: root.rootSessionId },
                  },
                }),
          },
        });
      let result = await write();
      if (result.error === "message_not_found") {
        messageTs = await recoverSlackControlsMessage(
          botToken,
          destination,
          root.rootSessionId
        );
        result = await write();
      }
      if (!result.ok) {
        throw new Error(`Slack thread controls failed: ${result.error}`);
      }
      const returnedTs = result.ts ?? messageTs;
      if (typeof returnedTs !== "string" || returnedTs.length === 0) {
        throw new Error("Slack thread controls did not return a message id");
      }
      return {
        sessionId: root.rootSessionId,
        messageTs: returnedTs,
        text: post.text,
        turnId: root.rootTurnId,
      };
    },
    async dispose({ destination, snapshot, state }) {
      const sessionId =
        state?.sessionId ??
        Object.values(snapshot?.work ?? {}).find(
          (work) => work.kind === "root-turn"
        )?.rootSessionId;
      if (!sessionId || !destination.channelId) {
        return;
      }
      let messageTs =
        state?.messageTs ??
        (await recoverSlackControlsMessage(botToken, destination, sessionId));
      if (!messageTs) {
        return;
      }
      const cleanup = () =>
        callSlackApi({
          botToken,
          context: { teamId: destination.installationTeamId ?? undefined },
          operation: "chat.update",
          body: {
            channel: destination.channelId,
            ts: messageTs,
            text: "Notra is no longer replying in this thread. Mention @Notra to start a new conversation.",
            blocks: [],
          },
        });
      let result = await cleanup();
      if (result.error === "message_not_found") {
        messageTs = await recoverSlackControlsMessage(
          botToken,
          destination,
          sessionId
        );
        if (!messageTs) {
          return;
        }
        result = await cleanup();
      }
      if (!result.ok && result.error !== "message_not_found") {
        throw new Error(`Slack thread control cleanup failed: ${result.error}`);
      }
    },
  };
}

async function recoverSlackControlsMessage(
  botToken: SlackBotToken | undefined,
  destination: ExperimentalSlackActivityDestination,
  sessionId: string
): Promise<string | undefined> {
  let cursor: string | undefined;
  const seen = new Set<string>();
  for (;;) {
    const result = await callSlackApi({
      botToken,
      context: { teamId: destination.installationTeamId ?? undefined },
      operation: "conversations.replies",
      body: {
        channel: destination.channelId,
        ts: destination.threadTs,
        limit: 100,
        include_all_metadata: true,
        ...(cursor ? { cursor } : {}),
      },
    });
    if (!result.ok || !Array.isArray(result.messages)) {
      throw new Error(
        `Slack thread control recovery failed: ${result.error ?? "missing messages"}`
      );
    }
    for (const message of result.messages) {
      if (typeof message !== "object" || message === null) {
        continue;
      }
      const metadata = Reflect.get(message, "metadata");
      if (
        typeof metadata !== "object" ||
        metadata === null ||
        Reflect.get(metadata, "event_type") !== SLACK_CONTROLS_METADATA_TYPE
      ) {
        continue;
      }
      const payload = Reflect.get(metadata, "event_payload");
      const ts = Reflect.get(message, "ts");
      if (
        typeof payload === "object" &&
        payload !== null &&
        Reflect.get(payload, "session_id") === sessionId &&
        typeof ts === "string" &&
        ts.length > 0
      ) {
        return ts;
      }
    }
    const responseMetadata = result.response_metadata;
    const next =
      typeof responseMetadata === "object" && responseMetadata !== null
        ? Reflect.get(responseMetadata, "next_cursor")
        : undefined;
    if (typeof next !== "string" || next.length === 0) {
      return undefined;
    }
    if (seen.has(next)) {
      throw new Error(
        "Slack thread control recovery returned a repeated cursor"
      );
    }
    seen.add(next);
    cursor = next;
  }
}
