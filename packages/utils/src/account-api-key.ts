import { ACCOUNT_API_KEY_EXTERNAL_ID_PREFIX } from "./constants/account-api-key";

/** Unkey external ID for a key that belongs to a user instead of one organization. */
export function toAccountApiKeyExternalId(userId: string): string {
  return `${ACCOUNT_API_KEY_EXTERNAL_ID_PREFIX}${userId}`;
}

/** The user ID behind an account-wide key, or null for organization keys. */
export function parseAccountApiKeyUserId(
  externalId: string | null | undefined
): string | null {
  if (!externalId?.startsWith(ACCOUNT_API_KEY_EXTERNAL_ID_PREFIX)) {
    return null;
  }
  const userId = externalId.slice(ACCOUNT_API_KEY_EXTERNAL_ID_PREFIX.length);
  return userId.length > 0 ? userId : null;
}
