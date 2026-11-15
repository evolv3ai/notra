import {
  SLACK_API_BASE_URL,
  SLACK_REQUEST_TIMEOUT_MS,
} from "@notra/ai/constants/slack";
import { getSlackIntegrationBotToken } from "@notra/ai/integrations/slack-workspace";
import { Effect } from "effect";

import { AutopilotSlackDeliveryError } from "@/lib/autopilot/errors";
import {
  slackApiResponseSchema,
  slackPostMessageResponseSchema,
} from "@/schemas/autopilot-slack";
import type {
  AutopilotSlackApiInput,
  PostAutopilotSlackMessageInput,
  PostAutopilotSlackMessageResult,
} from "@/types/autopilot-slack";

const callSlack = Effect.fn("Autopilot.callSlack")(function* (
  input: AutopilotSlackApiInput
) {
  const fail = (code: string, cause?: unknown) =>
    new AutopilotSlackDeliveryError({
      message: `Slack ${input.method} failed: ${code}`,
      code,
      organizationId: input.organizationId,
      cause,
    });

  const token = yield* Effect.try({
    try: () => getSlackIntegrationBotToken(input),
    catch: (cause) => fail("token_error", cause),
  });
  const response = yield* Effect.tryPromise({
    try: (signal) =>
      fetch(`${SLACK_API_BASE_URL}/${input.method}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(input.body),
        signal: AbortSignal.any([
          signal,
          AbortSignal.timeout(SLACK_REQUEST_TIMEOUT_MS),
        ]),
      }),
    catch: (cause) => fail("network_error", cause),
  });
  if (!response.ok) {
    return yield* Effect.fail(fail(`http_${response.status}`));
  }

  const body: unknown = yield* Effect.tryPromise({
    try: () => response.json(),
    catch: (cause) => fail("invalid_response", cause),
  });
  const parsed = slackApiResponseSchema.safeParse(body);
  if (!parsed.success) {
    return yield* Effect.fail(fail("invalid_response", parsed.error));
  }
  if (!parsed.data.ok) {
    return yield* Effect.fail(fail(parsed.data.error ?? "unknown_error"));
  }
  return { body, fail };
});

const postMessage = Effect.fn("Autopilot.postSlackMessage")(function* (
  input: PostAutopilotSlackMessageInput
) {
  const { body, fail } = yield* callSlack({
    organizationId: input.organizationId,
    encryptedBotToken: input.encryptedBotToken,
    method: "chat.postMessage",
    body: {
      channel: input.destination.channelId,
      text: input.text,
      blocks: input.blocks,
      ...(input.threadTs ? { thread_ts: input.threadTs } : {}),
      ...(input.clientMessageId
        ? { client_msg_id: input.clientMessageId }
        : {}),
    },
  });
  const parsed = slackPostMessageResponseSchema.safeParse(body);
  if (!(parsed.success && parsed.data.ok)) {
    return yield* Effect.fail(fail("invalid_response", parsed.error));
  }
  return {
    channel: parsed.data.channel,
    ts: parsed.data.ts,
    teamId: input.destination.teamId,
  };
});

/** Posts once; an uncertain provider write must not be automatically retried. */
export function postAutopilotSlackMessage(
  input: PostAutopilotSlackMessageInput
): Promise<PostAutopilotSlackMessageResult> {
  return Effect.runPromise(postMessage(input));
}

/** Any other Slack Web API call made with the workspace's bot token. */
export async function callAutopilotSlack(input: AutopilotSlackApiInput) {
  await Effect.runPromise(callSlack(input));
}
