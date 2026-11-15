import { redis } from "@notra/ai/utils/redis";
import type { GeoIngestIdentity } from "@notra/geo-core/types/geo";

import {
  GEO_INGEST_FIRST_HIT_KEY_PREFIX,
  GEO_INGEST_FIRST_HIT_MEMO_MAX_ENTRIES,
} from "../constants/ingest";

const confirmed = new Set<string>();
const pending = new Map<string, Promise<boolean>>();

/** Redis remains the cross-replica arbiter; memoize only a completed NX response. */
export async function claimFirstIngestHit(
  identity: GeoIngestIdentity
): Promise<boolean> {
  if (!redis) {
    return false;
  }
  const key = `${GEO_INGEST_FIRST_HIT_KEY_PREFIX}:${identity.organizationId}:${identity.projectId ?? "-"}`;
  if (confirmed.has(key)) {
    return false;
  }
  const existing = pending.get(key);
  if (existing) {
    await existing;
    return false;
  }
  const attempt = redis
    .set(key, "1", { nx: true })
    .then((result) => {
      if (result === "OK" || result === null) {
        if (confirmed.size >= GEO_INGEST_FIRST_HIT_MEMO_MAX_ENTRIES) {
          confirmed.clear();
        }
        confirmed.add(key);
      }
      return result === "OK";
    })
    .catch(() => false)
    .finally(() => pending.delete(key));
  pending.set(key, attempt);
  return attempt;
}
