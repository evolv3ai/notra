import { API_KEY_EXPIRING_SOON_MS } from "@/constants/api-keys";
import type { ApiKeyListItem, ApiKeyStatus } from "@/types/api-keys";

export function apiKeyStatus(
  key: Pick<ApiKeyListItem, "enabled" | "expires">,
  now = Date.now()
): ApiKeyStatus {
  if (key.expires !== null && key.expires <= now) {
    return "expired";
  }
  if (!key.enabled) {
    return "disabled";
  }
  if (key.expires !== null && key.expires - now <= API_KEY_EXPIRING_SOON_MS) {
    return "expiringSoon";
  }
  return "active";
}
