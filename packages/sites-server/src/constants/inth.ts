export const INTH_API_URL = "https://api.inth.com";
export const INTH_OAUTH_AUTHORIZE_URL =
  "https://inth.com/api/auth/oauth2/authorize";
export const INTH_OAUTH_TOKEN_URL = "https://inth.com/api/auth/oauth2/token";
export const INTH_OAUTH_REVOKE_URL = "https://inth.com/api/auth/oauth2/revoke";
export const INTH_OAUTH_SCOPES = [
  "openid",
  "offline_access",
  "organizations.read",
  "projects.read",
  "projects.write",
] as const;
export const INTH_OAUTH_AUTHORIZE_PATH = "/api/integrations/inth/authorize";
export const INTH_OAUTH_CALLBACK_PATH = "/api/integrations/inth/callback";
export const INTH_OAUTH_STATE_KEY_PREFIX = "inth_oauth:";
export const INTH_OAUTH_STATE_TTL_SECONDS = 600;
export const INTH_DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 3600;
export const INTH_ACCESS_TOKEN_REFRESH_BUFFER_MS = 60_000;
export const INTH_PROJECTS_PAGE_SIZE = 100;
export const INTH_PROJECTS_MAX_PAGES = 5;
export const INTH_REQUEST_TIMEOUT_MS = 10_000;
export const INTH_REAUTH_ERROR_CODES = new Set([
  "invalid_grant",
  "invalid_token",
  "unauthorized_client",
]);
export const INTH_CALLBACK_PATH_MAX_LENGTH = 512;
