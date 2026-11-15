import { API_KEY_STATUS_REFRESH_MS } from "@/constants/api-keys";
import { useNow } from "@/lib/hooks/use-now";
import type { ApiKeyListItem } from "@/types/api-keys";

/** Re-renders a key table as expiries pass, and stays idle when no key expires. */
export function useApiKeyStatusNow(
  keys: readonly Pick<ApiKeyListItem, "expires">[]
): number {
  return useNow(
    keys.some((key) => key.expires !== null),
    API_KEY_STATUS_REFRESH_MS
  );
}
