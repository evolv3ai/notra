import { createHmac } from "node:crypto";

import { getClientNetworkKey } from "@notra/utils/client-ip";

/**
 * The visitor's network for demo rate limits, from the shared trusted client
 * IP. IPv6 visitors are grouped by their /64, which a single subscriber
 * controls entirely.
 */
export function getDemoClientIp(headersList: Headers): string {
  return getClientNetworkKey(headersList) ?? "unknown";
}

/** Rate-limit key for sandbox creation; the raw IP is never stored. */
export function hashDemoClientIp(ip: string): string {
  const secret = process.env.WORKOS_COOKIE_PASSWORD;
  if (!secret) {
    throw new Error("WORKOS_COOKIE_PASSWORD must be defined");
  }
  return createHmac("sha256", secret)
    .update(`demo-ip:${ip}`)
    .digest("hex")
    .slice(0, 32);
}
