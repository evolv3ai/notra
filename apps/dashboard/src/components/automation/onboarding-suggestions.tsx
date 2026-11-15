"use client";

import {
  Calendar03Icon,
  Cancel01Icon,
  Rocket01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@notra/ui/components/ui/tooltip";
import { toast } from "sonner";
import { InstrumentSection } from "ui/card";
import { useTranslations } from "use-intl";

import { AutomationCard } from "@/components/automation/automation-template-gallery";
import { Button } from "@/components/button";
import { AgentLoader } from "@/components/icons/agent-loader";
import { trackEvent } from "@/lib/analytics/posthog-client";
import {
  useDismissOnboardingSuggestion,
  useOnboardingAgentRun,
  useOnboardingSuggestions,
} from "@/lib/hooks/use-onboarding";
import type {
  OnboardingSuggestionsProps,
  SuggestionType,
} from "@/types/components/onboarding-suggestions";

const SUGGESTION_TYPES: readonly SuggestionType[] = [
  "schedule_automation",
  "event_automation",
];

const isAutomationSuggestion = (type: string): type is SuggestionType =>
  (SUGGESTION_TYPES as readonly string[]).includes(type);

export function OnboardingSuggestions({
  organizationId,
  onCreate,
}: OnboardingSuggestionsProps) {
  const t = useTranslations("automation.suggestions");
  const tCommon = useTranslations("common");
  const { data: agentRun } = useOnboardingAgentRun(organizationId);
  const agentRunning = agentRun?.running ?? false;
  const { data: suggestions } = useOnboardingSuggestions(organizationId, {
    agentRunning,
  });
  const dismissMutation = useDismissOnboardingSuggestion();

  const dismissPendingId = dismissMutation.isPending
    ? (dismissMutation.variables?.suggestionId ?? null)
    : null;

  const dismissSuggestion = (suggestionId: string, type: SuggestionType) => {
    dismissMutation.mutate(
      { organizationId, suggestionId },
      {
        onError: () => toast.error(t("dismissFailed")),
        onSuccess: () => {
          trackEvent(POSTHOG_EVENTS.ONBOARDING_SUGGESTION_DISMISSED, {
            suggestion_id: suggestionId,
            suggestion_kind: type,
          });
        },
      }
    );
  };

  const createFromSuggestion = (suggestionId: string, type: SuggestionType) => {
    trackEvent(POSTHOG_EVENTS.ONBOARDING_SUGGESTION_USED, {
      suggestion_id: suggestionId,
      suggestion_kind: type,
    });
    onCreate(suggestionId, type);
  };

  const matching = (suggestions ?? []).flatMap((suggestion) => {
    const { type } = suggestion;
    return isAutomationSuggestion(type) ? [{ ...suggestion, type }] : [];
  });

  if (matching.length === 0) {
    return null;
  }

  return (
    <TooltipProvider delay={400}>
      <InstrumentSection
        eyebrow={tCommon("labels.suggestions")}
        readout={
          <>
            <span className="sr-only" role="status">
              {agentRunning ? tCommon("states.loading") : ""}
            </span>
            {agentRunning ? (
              <AgentLoader className="text-muted-foreground size-3.5" />
            ) : null}
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {matching.map((suggestion) => {
            const isEvent = suggestion.type === "event_automation";
            return (
              <AutomationCard
                action="content"
                corner={
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          aria-label={t("dismissLabel", {
                            title: suggestion.title,
                          })}
                          disabled={dismissPendingId === suggestion.id}
                          onClick={() =>
                            dismissSuggestion(suggestion.id, suggestion.type)
                          }
                          size="icon-sm"
                          variant="ghost"
                        />
                      }
                    >
                      <HugeiconsIcon className="size-4" icon={Cancel01Icon} />
                    </TooltipTrigger>
                    <TooltipContent>{t("dismissTooltip")}</TooltipContent>
                  </Tooltip>
                }
                description={suggestion.description}
                icon={isEvent ? Rocket01Icon : Calendar03Icon}
                key={suggestion.id}
                onSelect={() =>
                  createFromSuggestion(suggestion.id, suggestion.type)
                }
                title={suggestion.title}
                tone={isEvent ? "success" : "info"}
                trigger={isEvent ? "github" : "schedule"}
              />
            );
          })}
        </div>
      </InstrumentSection>
    </TooltipProvider>
  );
}
