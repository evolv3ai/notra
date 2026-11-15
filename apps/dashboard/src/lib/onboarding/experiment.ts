import { isDemoMode } from "@notra/utils/demo-mode";

import {
  ONBOARDING_FLOW_FLAG_KEY,
  ONBOARDING_FLOW_VARIANTS,
} from "@/constants/analytics-events";
import { getFlagsManager } from "@/lib/geo/flag";

export async function resolveOnboardingVariant(
  userId: string
): Promise<string> {
  const manager = getFlagsManager();
  if (!manager || isDemoMode()) {
    return ONBOARDING_FLOW_VARIANTS.CONTROL;
  }
  try {
    const result = await manager.getFlag(ONBOARDING_FLOW_FLAG_KEY, { userId });
    return result.enabled && result.variant
      ? result.variant
      : ONBOARDING_FLOW_VARIANTS.CONTROL;
  } catch {
    return ONBOARDING_FLOW_VARIANTS.CONTROL;
  }
}
