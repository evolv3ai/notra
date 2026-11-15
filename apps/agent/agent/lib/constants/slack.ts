export const CREATE_POST_TOOL_NAMES = new Set([
  "create_blog_post",
  "create_changelog",
  "create_investor_update",
  "create_linkedin_post",
  "create_twitter_post",
]);

export const AUTOPILOT_VOTE_REACTIONS: Record<string, "up" | "down"> = {
  "+1": "up",
  thumbsup: "up",
  "-1": "down",
  thumbsdown: "down",
};

export const SLACK_SKIN_TONE_SUFFIX = /::skin-tone-\d$/;

export const AUTOPILOT_SLACK_ACTION_TIMEOUT_MS = 60_000;

/** Slack's limit for the `markdown_text` field eve uses to post replies. */
export const SLACK_MARKDOWN_TEXT_MAX_LENGTH = 12_000;

export const SLACK_LONG_REPLY_NOTICE =
  "That reply is too long for one Slack message, so here it is as a file.";

export const SLACK_PERMISSION_ERROR_PATTERN =
  /\b(?:missing_scope|not_allowed|no_permission)\b/;

export const SLACK_TURN_FAILED_MESSAGE =
  "Something went wrong while I was working on that. Please try again, or rephrase if it keeps failing.";

export const SLACK_SESSION_FAILED_MESSAGE =
  "This conversation hit an error I can't recover from. Mention me in a new thread to start over.";

export const POST_TO_X_NOT_PENDING_MESSAGE =
  "This tweet is no longer waiting to be posted. It may have expired or already been posted. Ask me to draft it again if you still want to post it.";

export const CHANNEL_NOT_ENABLED_MESSAGE =
  "The Notra agent is not enabled in this channel. An admin can enable it from the Slack integration settings in the Notra dashboard.";
