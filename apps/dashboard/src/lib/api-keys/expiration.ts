import type { ApiKeyExpiration } from "@/types/api-keys";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The expiration option a key was most likely created with, from its lifetime. */
export function inferApiKeyExpiration(
  createdAt: number,
  expires: number | null
): ApiKeyExpiration {
  if (expires === null) {
    return "never";
  }

  const ttl = Math.max(0, expires - createdAt);

  if (ttl <= 7 * DAY_MS) {
    return "7d";
  }

  if (ttl <= 30 * DAY_MS) {
    return "30d";
  }

  if (ttl <= 60 * DAY_MS) {
    return "60d";
  }

  return "90d";
}
