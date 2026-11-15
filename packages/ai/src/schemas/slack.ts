import { Schema } from "effect";
import { z } from "zod";

export class SlackConfigurationError extends Schema.TaggedError<SlackConfigurationError>()(
  "SlackConfigurationError",
  { variable: Schema.String }
) {}

export class SlackInputError extends Schema.TaggedError<SlackInputError>()(
  "SlackInputError",
  { message: Schema.String }
) {}

export class SlackRequestError extends Schema.TaggedError<SlackRequestError>()(
  "SlackRequestError",
  {
    cause: Schema.Defect(),
    operation: Schema.String,
    status: Schema.optional(Schema.Number),
  }
) {}

export class SlackResponseError extends Schema.TaggedError<SlackResponseError>()(
  "SlackResponseError",
  {
    cause: Schema.Defect(),
    operation: Schema.String,
  }
) {}

export class SlackApiError extends Schema.TaggedError<SlackApiError>()(
  "SlackApiError",
  {
    code: Schema.String,
    operation: Schema.String,
  }
) {}

export class SlackSetupError extends Schema.TaggedError<SlackSetupError>()(
  "SlackSetupError",
  {
    archiveCause: Schema.optional(Schema.Defect()),
    archived: Schema.Boolean,
    cause: Schema.Defect(),
    channelName: Schema.String,
  }
) {}

export const slackInviteSharedResponseSchema = z.looseObject({
  ok: z.boolean(),
  error: z.string().optional(),
  invite_id: z.string().optional(),
  is_legacy_shared_channel: z.boolean().optional(),
});

export const slackOkResponseSchema = z.looseObject({
  ok: z.boolean(),
  error: z.string().optional(),
});

export const slackCreateChannelResponseSchema = z.looseObject({
  ok: z.boolean(),
  error: z.string().optional(),
  channel: z
    .looseObject({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
});

const slackNextCursorSchema = z
  .looseObject({ next_cursor: z.string().optional() })
  .optional();

export const slackConversationsListResponseSchema = z.looseObject({
  ok: z.boolean(),
  error: z.string().optional(),
  channels: z
    .array(z.looseObject({ id: z.string(), name: z.string() }))
    .optional(),
  response_metadata: slackNextCursorSchema,
});

export const slackConversationMembersResponseSchema = z.looseObject({
  ok: z.boolean(),
  error: z.string().optional(),
  members: z.array(z.string()).optional(),
  response_metadata: slackNextCursorSchema,
});

export const slackUserInfoResponseSchema = z.looseObject({
  ok: z.boolean(),
  error: z.string().optional(),
  user: z
    .looseObject({
      is_bot: z.boolean().optional(),
      profile: z.looseObject({ email: z.string().optional() }).optional(),
    })
    .optional(),
});
