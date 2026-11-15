import { createHash } from "node:crypto";

import { getClientIp } from "@notra/utils/client-ip";

/** Rate-limit key for the visitor: a SHA-256 of their trusted IP, never the raw address. */
export function getClientIpHash(request: Request): string {
  return createHash("sha256")
    .update(getClientIp(request.headers) ?? "unknown")
    .digest("hex");
}
