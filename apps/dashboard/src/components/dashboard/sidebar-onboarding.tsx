"use client";

import {
  OnboardingChecklistItem,
  OnboardingChecklistItems,
} from "@notra/ui/components/ui/onboarding-checklist";
import { Progress } from "@notra/ui/components/ui/progress";
import { SidebarGroup } from "@notra/ui/components/ui/sidebar";
import { cn } from "@notra/ui/lib/utils";
import { useSyncExternalStore } from "react";
import { useTranslations } from "use-intl";

import { AgentLoader } from "@/components/icons/agent-loader";
import { useOrganizationsContext } from "@/components/providers/organization-provider";
import {
  AGENT_RUN_REFETCH_INTERVAL_MS,
  ONBOARDING_STATUS_REFETCH_INTERVAL_MS,
} from "@/constants/onboarding-agent";
import { localStorageKeys } from "@/constants/storage";
import { useBillingCustomer } from "@/lib/hooks/use-billing-customer";
import {
  useOnboardingAgentRun,
  useOnboardingStatus,
} from "@/lib/hooks/use-onboarding";

const collapsedListeners = new Set<() => void>();

function subscribeToCollapsedStorage(callback: () => void) {
  collapsedListeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    collapsedListeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function setStoredCollapsed(storageKey: string, value: boolean) {
  localStorage.setItem(storageKey, String(value));
  for (const listener of collapsedListeners) {
    listener();
  }
}

export function SidebarOnboarding() {
  const t = useTranslations("nav.onboarding");
  const tCommon = useTranslations("common");
  const { activeOrganization } = useOrganizationsContext();
  const orgId = activeOrganization?.id ?? "";
  const slug = activeOrganization?.slug ?? "";

  const { data: agentRun } = useOnboardingAgentRun(orgId);
  const agentRunning = agentRun?.running ?? false;
  const { data: customer } = useBillingCustomer({
    expand: ["subscriptions.plan"],
  });
  const hasActiveSubscription = customer?.subscriptions.some(
    (subscription) => !subscription.addOn && subscription.status === "active"
  );
  const checklistHidden = !!customer && !hasActiveSubscription;
  const { data } = useOnboardingStatus(orgId, {
    refetchInterval: agentRunning
      ? AGENT_RUN_REFETCH_INTERVAL_MS
      : !checklistHidden && ONBOARDING_STATUS_REFETCH_INTERVAL_MS,
  });

  const storageKey = localStorageKeys.sidebarOnboardingCollapsed(orgId);
  const storedCollapsed = useSyncExternalStore(
    subscribeToCollapsedStorage,
    () => localStorage.getItem(storageKey),
    () => null
  );
  const hasCompletedStep =
    data?.hasPrompt ||
    data?.hasCompetitor ||
    data?.hasScan ||
    data?.hasAgentReadiness;
  const collapsed =
    storedCollapsed === null ? !!hasCompletedStep : storedCollapsed === "true";

  const toggleCollapsed = () => {
    setStoredCollapsed(storageKey, !collapsed);
  };

  if (!data || data.onboardingCompleted || data.onboardingDismissed) {
    return null;
  }

  if (checklistHidden) {
    return null;
  }

  const steps = [
    {
      label: t("steps.prompt"),
      href: `/${slug}/geo/prompts`,
      completed: data.hasPrompt,
    },
    {
      label: t("steps.competitor"),
      href: `/${slug}/geo/competitors`,
      completed: data.hasCompetitor,
    },
    {
      label: t("steps.scan"),
      href: `/${slug}/geo`,
      completed: data.hasScan,
    },
    {
      label: t("steps.agentReadiness"),
      href: `/${slug}/geo/agent-readiness`,
      completed: data.hasAgentReadiness,
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const progress = (completedCount / steps.length) * 100;

  return (
    <SidebarGroup className="px-3 pb-2 group-data-[collapsible=icon]:hidden">
      <div
        className={cn(
          "duration-slow overflow-hidden transition-[background-color,border-color,border-radius] ease-out",
          collapsed ? "bg-transparent" : "bg-sidebar-accent/40 rounded-xl"
        )}
      >
        <button
          aria-label={collapsed ? t("expand") : tCommon("actions.close")}
          className={cn(
            "duration-slow flex w-full cursor-pointer items-center gap-2 text-left transition-[padding,background-color,border-color,border-radius,color] ease-out",
            collapsed
              ? "text-muted-foreground hover:bg-muted rounded-md px-2 py-1.5 text-xs"
              : "bg-muted/50 text-foreground rounded-t-xl border-b px-3 py-3 text-sm"
          )}
          onClick={toggleCollapsed}
          type="button"
        >
          <span className="flex-1 truncate font-medium">
            {collapsed
              ? t("titleWithProgress", {
                  completed: completedCount,
                  total: steps.length,
                })
              : t("title")}
          </span>
          {agentRunning && (
            <AgentLoader className="text-muted-foreground size-3.5" />
          )}
          <svg
            aria-hidden="true"
            className="size-3.5 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <title>
              {collapsed ? t("expandShort") : tCommon("actions.close")}
            </title>
            {collapsed ? (
              <path d="m18 15-6-6-6 6" />
            ) : (
              <path d="M18 6 6 18M6 6l12 12" />
            )}
          </svg>
        </button>
        <span className="sr-only" role="status">
          {agentRunning ? tCommon("states.loading") : ""}
        </span>

        <div
          aria-hidden={collapsed}
          className={cn(
            "duration-slow grid transition-[grid-template-rows] ease-out",
            collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
          )}
          inert={collapsed}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="px-3 pt-3 text-sm font-medium">
              {t("description")}
            </div>
          </div>
        </div>

        <div
          className={cn(
            "duration-slow transition-[margin] ease-out",
            collapsed ? "mt-1" : "mx-3 mt-3"
          )}
        >
          <Progress className={cn(collapsed && "h-1")} value={progress} />
        </div>

        <div
          aria-hidden={collapsed}
          className={cn(
            "duration-slow grid transition-[grid-template-rows] ease-out",
            collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
          )}
          inert={collapsed}
        >
          <div className="min-h-0 overflow-hidden">
            <p className="text-muted-foreground px-3 pt-1 text-xs tabular-nums">
              {t("percentCompleted", { percent: Math.round(progress) })}
            </p>
            <OnboardingChecklistItems className="px-3 pt-3 pb-3">
              {steps.map((step) => (
                <OnboardingChecklistItem
                  completed={step.completed}
                  href={step.href}
                  key={step.href}
                >
                  {step.label}
                </OnboardingChecklistItem>
              ))}
            </OnboardingChecklistItems>
          </div>
        </div>
      </div>
    </SidebarGroup>
  );
}
