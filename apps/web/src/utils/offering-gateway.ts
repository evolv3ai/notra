import { OFFERING_CHECK_GATEWAY_TAG } from "@/constants/offering-check";

export function offeringGatewayOptions(step: string, runId?: string) {
  return (
    withUsageAttribution(
      {
        gateway: {
          tags: [
            OFFERING_CHECK_GATEWAY_TAG,
            `${OFFERING_CHECK_GATEWAY_TAG}-${step}`,
          ],
        },
      },
      { runId }
    ).gateway ?? {}
  );
}
import { withUsageAttribution } from "@notra/ai/utils/usage-attribution";
