"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCustomer } from "autumn-js/react";
import { useCallback } from "react";

import { useIsClient } from "@/lib/hooks/use-is-client";
import { dashboardOrpc } from "@/lib/orpc/query";
import { billingCustomerOptions } from "@/utils/billing-customer";

/**
 * The customer query never runs during SSR, and on the client it may already
 * be loading or even resolved by the time hydration reaches a component. Until
 * hydration is done, report "loading" so the server HTML and the first client
 * render agree (otherwise billing-gated UI throws React #418). `check` reads
 * the same cache, so it is masked too.
 */
export function useBillingCustomer(params?: Parameters<typeof useCustomer>[0]) {
  const customer = useCustomer(billingCustomerOptions(params));
  const hydrated = useIsClient();
  const queryClient = useQueryClient();
  const { refetch: refetchCustomer } = customer;
  const refetch = useCallback(
    async (...args: Parameters<typeof refetchCustomer>) => {
      const result = await refetchCustomer(...args);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: dashboardOrpc.geo.modelCatalog.key(),
        }),
        queryClient.invalidateQueries({
          queryKey: dashboardOrpc.geo.settings.key(),
        }),
      ]);
      return result;
    },
    [refetchCustomer, queryClient]
  );
  if (hydrated) {
    return { ...customer, refetch };
  }
  return {
    ...customer,
    refetch,
    data: undefined,
    check: (checkParams: Parameters<typeof customer.check>[0]) => ({
      ...customer.check(checkParams),
      allowed: false,
    }),
    error: null,
    isLoading: true,
    isFetching: false,
  };
}
