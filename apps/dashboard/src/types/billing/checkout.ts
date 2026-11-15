import type { useBillingCustomer } from "@/lib/hooks/use-billing-customer";

export interface ResumeCheckoutPlanOptions {
  planParam: string | null;
  clearPlanParam: () => unknown;
  loading: boolean;
  customer: ReturnType<typeof useBillingCustomer>["data"];
  activePlanId: string | undefined;
  busyPlanId: string | null;
  checkout: (planId: string, yearly: boolean) => Promise<void>;
}
