import { logWarn } from "@notra/ai/utils/server-log";

import type { TeamMembersLimitStatus } from "../types/billing";
import { autumn } from "./autumn";
import { FEATURES } from "./features";

export async function checkTeamMembersLimit(
  organizationId?: string | null
): Promise<TeamMembersLimitStatus> {
  if (!(organizationId && autumn)) {
    return "allowed";
  }

  let data: Awaited<ReturnType<typeof autumn.check>>;
  try {
    data = await autumn.check({
      customerId: organizationId,
      featureId: FEATURES.TEAM_MEMBERS,
      requiredBalance: 1,
    });
  } catch (error) {
    logWarn("[Autumn] Failed to check team member limits", {
      organizationId,
      error: error instanceof Error ? error.message : String(error),
    });

    return "check-unavailable";
  }

  return data.allowed === false ? "limit-reached" : "allowed";
}
