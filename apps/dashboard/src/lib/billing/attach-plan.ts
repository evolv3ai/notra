import { POSTHOG_EVENTS } from "@notra/posthog/events";

import { billingInterval } from "@/lib/analytics/billing-events";
import { flushTrackEvent } from "@/lib/analytics/posthog-client";
import type { AttachPlanParams, AttachPlanResult } from "@/types/billing/plan";
import { isAnnualPlanId, zdrAddonPlanId } from "@/utils/billing-plans";
import { getDatabuddyPaymentMetadata } from "@/utils/databuddy";

export async function attachPlanWithAddons({
  attach,
  multiAttach,
  planId,
  includeZdr,
  successUrl,
  analytics,
}: AttachPlanParams): Promise<AttachPlanResult> {
  const zdrPlanId = includeZdr ? zdrAddonPlanId(planId) : null;
  const metadata = getDatabuddyPaymentMetadata();
  const checkoutProperties = {
    ...analytics,
    plan_id: planId,
    interval: billingInterval(isAnnualPlanId(planId)),
  };

  if (zdrPlanId) {
    const result = await multiAttach({
      plans: [{ planId }, { planId: zdrPlanId }],
      checkoutSessionParams: { metadata, subscription_data: { metadata } },
      redirectMode: "if_required",
      successUrl,
    });
    if (result.paymentUrl) {
      await flushTrackEvent(POSTHOG_EVENTS.CHECKOUT_REDIRECTED, {
        ...checkoutProperties,
        zdr: true,
      });
    }
    return { paymentUrl: result.paymentUrl ?? null };
  }

  const result = await attach({
    planId,
    metadata,
    redirectMode: "if_required",
    successUrl,
  });
  if (result.paymentUrl) {
    await flushTrackEvent(POSTHOG_EVENTS.CHECKOUT_REDIRECTED, {
      ...checkoutProperties,
      zdr: false,
    });
  }
  return { paymentUrl: result.paymentUrl ?? null };
}
