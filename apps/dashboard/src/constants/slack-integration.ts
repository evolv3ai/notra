export const SLACK_OAUTH_STATE_TTL_SECONDS = 600;

export const SLACK_BOT_SCOPES = [
  "assistant:write",
  "app_mentions:read",
  "chat:write",
  "channels:history",
  "channels:read",
  "channels:manage",
  "groups:history",
  "groups:read",
  "im:history",
  "files:read",
  "files:write",
  "reactions:read",
  "reactions:write",
].join(",");

export const SLACK_CHANNEL_CACHE_TTL_SECONDS = 60 * 60;

export const NOTRA_CONSOLE_DEFAULT_URL = "https://console.usenotra.com";

export const SLACK_INFO_CHANNEL_TIMEOUT_MS = 5000;
