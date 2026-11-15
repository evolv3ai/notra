"use client";

import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { COMPANY_LOGO_STALE_TIME_MS } from "@/constants/company-logo";
import {
  AGENT_RUN_IDLE_REFETCH_INTERVAL_MS,
  AGENT_RUN_REFETCH_INTERVAL_MS,
  AGENT_RUN_STALE_TIME_MS,
  SUGGESTIONS_STALE_TIME_MS,
} from "@/constants/onboarding-agent";
import { localStorageKeys } from "@/constants/storage";
import type {
  InitialOnboardingAgentRun,
  OnboardingRunSnapshot,
  OnboardingStatus,
  UseOnboardingStatusOptions,
  UseOnboardingSuggestionsOptions,
} from "@/types/hooks/onboarding";
import {
  isOnboardingBannerDismissedFromClient,
  setOnboardingBannerDismissedCookie,
} from "@/utils/cookies";

import { dashboardOrpc } from "../orpc/query";

export function useOnboardingStatus(
  organizationId: string,
  options?: UseOnboardingStatusOptions
) {
  return useQuery<OnboardingStatus>(
    dashboardOrpc.onboarding.get.queryOptions({
      input: { organizationId },
      enabled: !!organizationId,
      refetchInterval: (query) => {
        const status = query.state.data;
        if (status?.onboardingCompleted || status?.onboardingDismissed) {
          return false;
        }
        return options?.refetchInterval ?? false;
      },
    })
  );
}

function companyLogoQueryOptions(domain: string | null, name?: string | null) {
  const query = domain ?? name?.trim() ?? "";
  return dashboardOrpc.onboarding.companyLogo.queryOptions({
    input: { query, searchByName: !domain },
    enabled: !domain && query.length > 0,
    staleTime: COMPANY_LOGO_STALE_TIME_MS,
    retry: false,
  });
}

export function useCompanyLogo(domain: string | null, name?: string | null) {
  return useQuery(companyLogoQueryOptions(domain, name));
}

/** Name lookups for many brands; shares the cache with `useCompanyLogo`. */
export function useCompanyLogosByName(names: readonly string[]) {
  return useQueries({
    queries: names.map((name) => companyLogoQueryOptions(null, name)),
  });
}

export function useOnboardingAgentRun(
  organizationId: string,
  initialRun?: InitialOnboardingAgentRun
) {
  const queryClient = useQueryClient();
  const previousRunRef = useRef<OnboardingRunSnapshot | null>(null);

  const query = useQuery(
    dashboardOrpc.onboarding.agentRun.queryOptions({
      input: { organizationId },
      enabled: !!organizationId,
      initialData:
        initialRun?.organizationId === organizationId
          ? initialRun.state
          : undefined,
      staleTime: AGENT_RUN_STALE_TIME_MS,
      refetchInterval: (current) =>
        current.state.data?.running
          ? AGENT_RUN_REFETCH_INTERVAL_MS
          : AGENT_RUN_IDLE_REFETCH_INTERVAL_MS,
    })
  );

  const running = query.data?.running ?? false;

  useEffect(() => {
    const previous = previousRunRef.current;
    if (
      organizationId &&
      previous?.organizationId === organizationId &&
      previous.running &&
      !running
    ) {
      queryClient.invalidateQueries({
        queryKey: dashboardOrpc.onboarding.get.queryKey({
          input: { organizationId },
        }),
      });
      queryClient.invalidateQueries({
        queryKey: dashboardOrpc.onboarding.suggestions.queryKey({
          input: { organizationId },
        }),
      });
    }
    previousRunRef.current = organizationId
      ? { organizationId, running }
      : null;
  }, [running, organizationId, queryClient]);

  return query;
}

export function useOnboardingSuggestions(
  organizationId: string,
  options?: UseOnboardingSuggestionsOptions
) {
  return useQuery(
    dashboardOrpc.onboarding.suggestions.queryOptions({
      input: { organizationId },
      enabled: !!organizationId,
      staleTime: SUGGESTIONS_STALE_TIME_MS,
      refetchInterval: options?.agentRunning
        ? AGENT_RUN_REFETCH_INTERVAL_MS
        : false,
    })
  );
}

const bannerDismissListeners = new Set<() => void>();

function subscribeToBannerDismissal(callback: () => void) {
  bannerDismissListeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    bannerDismissListeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

/**
 * The dismissal lives in a cookie the shell loader reads, so the server render
 * already leaves the banner out. `serverDismissed` is that cookie's value.
 */
export function useOnboardingAgentBannerDismissal(
  organizationId: string,
  serverDismissed: boolean
) {
  const legacyKey =
    localStorageKeys.onboardingAgentBannerDismissed(organizationId);
  const dismissed = useSyncExternalStore(
    subscribeToBannerDismissal,
    () =>
      isOnboardingBannerDismissedFromClient(organizationId) ||
      localStorage.getItem(legacyKey) === "true",
    () => serverDismissed
  );

  useEffect(() => {
    if (
      localStorage.getItem(legacyKey) === "true" &&
      !isOnboardingBannerDismissedFromClient(organizationId)
    ) {
      setOnboardingBannerDismissedCookie(organizationId).catch(() => undefined);
    }
  }, [legacyKey, organizationId]);

  const dismiss = () => {
    setOnboardingBannerDismissedCookie(organizationId)
      .catch(() => undefined)
      .finally(() => {
        for (const listener of bannerDismissListeners) {
          listener();
        }
      });
  };
  return { dismiss, dismissed };
}

export function useRunOnboardingAgent() {
  const queryClient = useQueryClient();
  return useMutation(
    dashboardOrpc.onboarding.runAgent.mutationOptions({
      onSettled: (_data, _error, variables) => {
        queryClient.invalidateQueries({
          queryKey: dashboardOrpc.onboarding.agentRun.queryKey({
            input: { organizationId: variables.organizationId },
          }),
        });
      },
    })
  );
}

export function useDismissOnboardingSuggestion() {
  const queryClient = useQueryClient();
  return useMutation(
    dashboardOrpc.onboarding.dismissSuggestion.mutationOptions({
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({
          queryKey: dashboardOrpc.onboarding.suggestions.queryKey({
            input: { organizationId: variables.organizationId },
          }),
        });
      },
    })
  );
}
