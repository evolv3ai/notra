import { OFFERING_WHITESPACE_RUN } from "@/constants/offering-check";
import type { OfferingCheckInput } from "@/types/offering-check";

function normalizeOfferingCheckText(input: string): string {
  return input.trim().toLowerCase().replace(OFFERING_WHITESPACE_RUN, " ");
}

export function getOfferingCheckBrandFeatureIdentity(
  input: OfferingCheckInput
): string {
  return JSON.stringify([
    input.domain.toLowerCase(),
    normalizeOfferingCheckText(input.feature),
  ]);
}

export function getOfferingCheckCacheIdentity(
  input: OfferingCheckInput
): string {
  return JSON.stringify([
    input.domain.toLowerCase(),
    normalizeOfferingCheckText(input.feature),
    normalizeOfferingCheckText(input.problem),
    input.webSearch,
  ]);
}
