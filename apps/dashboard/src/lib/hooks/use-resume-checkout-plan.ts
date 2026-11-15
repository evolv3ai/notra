import { useEffect, useEffectEvent, useRef } from "react";

import type { ResumeCheckoutPlanOptions } from "@/types/billing/checkout";
import { checkoutPlanId, isAnnualPlanId } from "@/utils/billing-plans";

export function useResumeCheckoutPlan({
  planParam,
  clearPlanParam,
  loading,
  customer,
  activePlanId,
  busyPlanId,
  checkout,
}: ResumeCheckoutPlanOptions): string | null {
  const handledRef = useRef(false);
  const resumePlanId = customer && !loading ? checkoutPlanId(planParam) : null;
  const hasPaid = Boolean(
    customer?.invoices?.length || checkoutPlanId(activePlanId)
  );
  const autoCheckoutPlanId = resumePlanId && !hasPaid ? resumePlanId : null;

  const resume = useEffectEvent(async () => {
    if (!resumePlanId || handledRef.current) {
      return;
    }
    handledRef.current = true;
    if (autoCheckoutPlanId) {
      await checkout(autoCheckoutPlanId, isAnnualPlanId(autoCheckoutPlanId));
    }
    clearPlanParam();
  });

  useEffect(() => {
    resume();
  }, [resumePlanId]);

  return busyPlanId ?? autoCheckoutPlanId;
}
