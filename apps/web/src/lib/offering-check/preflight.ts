import { OFFERING_CHECK_PREFLIGHT_PATH } from "@/constants/offering-check";
import type {
  OfferingCheckInput,
  OfferingFailureStatus,
} from "@/types/offering-check";
import { failureStatusFor } from "@/utils/offering-report";

export async function preflightOfferingCheck(
  input: OfferingCheckInput
): Promise<OfferingFailureStatus | null> {
  const response = await fetch(OFFERING_CHECK_PREFLIGHT_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).catch(() => null);
  return response?.ok ? null : failureStatusFor(response);
}
