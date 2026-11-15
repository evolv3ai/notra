import { AUTOPILOT_AUTOMATION_KINDS } from "@notra/db/constants/autopilot";

import { AUTOPILOT_AUTOMATION_SLUGS } from "@/constants/autopilot-ui";
import type { AutopilotAutomationKind } from "@/types/autopilot-metrics";

export function automationKindFromSlug(
  slug: string
): AutopilotAutomationKind | null {
  return (
    AUTOPILOT_AUTOMATION_KINDS.find(
      (kind) => AUTOPILOT_AUTOMATION_SLUGS[kind] === slug
    ) ?? null
  );
}
