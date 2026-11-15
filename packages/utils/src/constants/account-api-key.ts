// Unkey external IDs only allow [a-zA-Z0-9_.-], so the prefix cannot use a colon.
export const ACCOUNT_API_KEY_EXTERNAL_ID_PREFIX = "user_";

/** Headers an account-wide key uses to pick the organization it acts on. */
export const ACCOUNT_API_KEY_ORGANIZATION_HEADERS = [
  "x-notra-organization-id",
  "x-organization-id",
] as const;
