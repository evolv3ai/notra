import { createHash } from "node:crypto";

import type { FindingClaim } from "@/types/autopilot-runtime";

/** Retries of one attempt reuse its branch; a new claim can never share it. */
export function autopilotDraftBranchSlug(
  prefix: "blog" | "readiness",
  claim: FindingClaim
) {
  const attempt = createHash("sha256")
    .update(claim.token)
    .digest("hex")
    .slice(0, 16);
  return `${prefix}-${claim.finding.id.toLowerCase()}-${attempt}`;
}
