export const IMPERSONATION_BANNER_HEIGHT = "2.5rem";
export const IMPERSONATION_SEARCH_DEBOUNCE_MS = 250;
export const IMPERSONATION_USER_RESULT_LIMIT = 50;

export const CONSOLE_AUTH_TTL_SECONDS = 600;
export const CONSOLE_SOCIAL_COOKIE = "notra_console_social";
export const CONSOLE_PENDING_AUTH_COOKIE = "notra_console_pending_auth";
export const CONSOLE_SOCIAL_CALLBACK_PATH = "/auth/social/callback";
export const CONSOLE_SOCIAL_PROVIDERS = {
  google: "GoogleOAuth",
  github: "GitHubOAuth",
} as const;
