import type { ZdrEntitlement, ZdrMode } from "@notra/ai/types/router";

import { autumn } from "./autumn";
import { FEATURES } from "./features";

/**
 * Look up the zero data retention entitlement. Without Autumn only
 * non-production environments count as entitled; a billing outage answers
 * `unknown` so each caller can decide how to fail.
 */
export async function resolveZdrEntitlement(
  organizationId: string
): Promise<ZdrEntitlement> {
  if (!autumn) {
    return process.env.NODE_ENV === "production" ? "not_entitled" : "entitled";
  }
  try {
    const data = await autumn.check({
      customerId: organizationId,
      featureId: FEATURES.ZDR,
    });
    return data.allowed === true ? "entitled" : "not_entitled";
  } catch {
    return "unknown";
  }
}

/**
 * Router default for callers that do not pick a ZDR mode. Entitled
 * organizations fail closed; organizations without the add-on do not get
 * the ZDR flag at all. A billing outage rejects: the router then keeps ZDR
 * strict so a paying organization never loses it to a blip, and retries
 * the lookup soon instead of caching the fallback for the full TTL.
 */
export async function resolveOrganizationZdrMode(
  organizationId: string
): Promise<ZdrMode> {
  const entitlement = await resolveZdrEntitlement(organizationId);
  if (entitlement === "unknown") {
    throw new Error("ZDR entitlement unavailable");
  }
  return entitlement === "not_entitled" ? "none" : "required";
}
