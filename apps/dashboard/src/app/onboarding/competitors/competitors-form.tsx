"use client";

import { GEO_MAX_COMPETITORS } from "@notra/geo-core/constants/geo";
import type { GeoCompetitor } from "@notra/geo-core/types/geo";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { AuthFormHeader } from "@notra/ui/components/shared/auth/auth-form-header";
import { CtaButton } from "@notra/ui/components/shared/cta-button";
import { Label } from "@notra/ui/components/ui/label";
import { ORPCError } from "@orpc/client";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "use-intl";

import { CompetitorSearch } from "@/components/onboarding/competitor-search";
import { CompetitorSuggestions } from "@/components/onboarding/competitor-suggestions";
import { OnboardingDashboardPreview } from "@/components/onboarding/dashboard-preview";
import { OnboardingProgress } from "@/components/onboarding/progress";
import { SelectedCompetitors } from "@/components/onboarding/selected-competitors";
import { OnboardingStepViewTracker } from "@/components/onboarding/step-view-tracker";
import { GeoProjectProvider } from "@/components/providers/geo-project-provider";
import {
  ONBOARDING_STEPS,
  SUGGESTION_OUTCOMES,
} from "@/constants/analytics-events";
import { ONBOARDING_STEP_COMPETITORS } from "@/constants/onboarding";
import { trackEvent } from "@/lib/analytics/posthog-client";
import {
  useGeoCompetitorSuggestions,
  useGeoStartFreeScan,
  useGeoStartScan,
} from "@/lib/hooks/use-geo";
import { useGeoCompetitorsDb } from "@/lib/hooks/use-geo-db";
import { useHasGeoFeature } from "@/lib/hooks/use-plan";
import { useRouter } from "@/lib/navigation";
import type { SuggestionOutcome } from "@/types/analytics/events";
import type {
  CompetitorsFormProps,
  CompetitorsPickerProps,
} from "@/types/onboarding";
import {
  createCompetitor,
  findCompetitor,
} from "@/utils/onboarding-competitors";

function leaveOnPaymentRequired(leave: () => void) {
  return (error: unknown) => {
    if (error instanceof ORPCError && error.code === "PAYMENT_REQUIRED") {
      leave();
    }
  };
}

function CompetitorsPicker({
  companyName,
  organizationId,
  domain,
  nextHref,
}: CompetitorsPickerProps) {
  const t = useTranslations("onboarding.competitors");
  const tCommon = useTranslations("common");
  const id = useId();
  const router = useRouter();
  const suggestions = useGeoCompetitorSuggestions(organizationId, domain);
  const { competitors, saveCompetitor, removeCompetitor } =
    useGeoCompetitorsDb(organizationId);
  const startScan = useGeoStartScan(organizationId);
  const startFreeScan = useGeoStartFreeScan(organizationId);
  const { isLocked: geoLocked } = useHasGeoFeature();
  const submitLabel = geoLocked
    ? tCommon("actions.continue")
    : t("startTracking");
  const [isLeaving, setIsLeaving] = useState(false);
  const busy = startScan.isPending || startFreeScan.isPending || isLeaving;
  const atLimit = competitors.length >= GEO_MAX_COMPETITORS;
  const suggested = suggestions.data?.competitors ?? [];
  const remainingSuggestions = suggested.filter(
    (entry) => !findCompetitor(competitors, entry.domain, entry.name)
  );
  const suggestionsTrackedRef = useRef(false);

  useEffect(() => {
    if (!domain || suggestions.isPending || suggestionsTrackedRef.current) {
      return;
    }
    suggestionsTrackedRef.current = true;
    let outcome: SuggestionOutcome = SUGGESTION_OUTCOMES.OK;
    if (suggestions.isError) {
      outcome = SUGGESTION_OUTCOMES.ERROR;
    } else if (suggested.length === 0) {
      outcome = SUGGESTION_OUTCOMES.EMPTY;
    }
    trackEvent(POSTHOG_EVENTS.COMPETITOR_SUGGESTIONS_LOADED, {
      suggestion_count: suggested.length,
      outcome,
    });
  }, [domain, suggestions.isPending, suggestions.isError, suggested.length]);

  const add = (name: string, competitorDomain: string | null) => {
    if (atLimit || findCompetitor(competitors, competitorDomain, name)) {
      return;
    }
    saveCompetitor(createCompetitor(name, competitorDomain));
  };

  const remove = (competitor: GeoCompetitor) => {
    removeCompetitor(competitor.id);
  };

  const addAllSuggestions = () => {
    const availableSlots = GEO_MAX_COMPETITORS - competitors.length;
    for (const entry of remainingSuggestions.slice(0, availableSlots)) {
      add(entry.name, entry.domain);
    }
  };

  const launch = () => {
    trackEvent(POSTHOG_EVENTS.ONBOARDING_COMPETITORS_SUBMITTED, {
      competitor_count: competitors.length,
      added_all: suggested.length > 0 && remainingSuggestions.length === 0,
      started_scan: !geoLocked,
    });
    const leave = () => {
      setIsLeaving(true);
      router.push(nextHref);
    };
    if (geoLocked) {
      startFreeScan.mutate(undefined, { onSettled: leave });
      return;
    }
    startScan.mutate("onboarding", {
      onSuccess: leave,
      onError: leaveOnPaymentRequired(leave),
    });
  };

  return (
    <div className="mt-2 space-y-5">
      <OnboardingDashboardPreview
        competitors={competitors}
        focus="competitors"
        name={companyName}
        website={domain ?? undefined}
      />
      <div className="grid gap-2">
        <Label htmlFor={`${id}-search`}>{t("addBrand")}</Label>
        <CompetitorSearch
          disabled={busy || atLimit}
          onAdd={(result) => add(result.name, result.domain)}
          organizationId={organizationId}
          ownDomain={domain}
          selected={competitors}
        />
      </div>

      {competitors.length > 0 ? (
        <SelectedCompetitors
          competitors={competitors}
          disabled={busy}
          onRemove={remove}
        />
      ) : null}

      {domain ? (
        <CompetitorSuggestions
          atLimit={atLimit}
          busy={busy}
          competitors={competitors}
          domain={domain}
          onAdd={add}
          onAddAll={addAllSuggestions}
          onRemove={remove}
          remainingCount={remainingSuggestions.length}
          suggestions={suggestions}
        />
      ) : null}

      <CtaButton
        className="w-full"
        loading={busy}
        onClick={launch}
        type="button"
      >
        {submitLabel}
      </CtaButton>
    </div>
  );
}

export function CompetitorsForm({
  organizationId,
  projectId,
  domain,
  companyName,
  nextHref,
  inOnboardingFlow,
  progressHrefs,
}: CompetitorsFormProps) {
  const t = useTranslations("onboarding.competitors");
  return (
    <GeoProjectProvider projectId={projectId}>
      <div className="flex w-full flex-col gap-5">
        <OnboardingStepViewTracker
          inOnboardingFlow={inOnboardingFlow}
          step={ONBOARDING_STEPS.COMPETITORS}
        />
        <div className="flex justify-center">
          <OnboardingProgress
            current={ONBOARDING_STEP_COMPETITORS}
            hrefs={progressHrefs}
          />
        </div>

        <AuthFormHeader
          description={
            companyName
              ? t("description", { companyName })
              : t("descriptionFallback")
          }
          title={t("title")}
        />

        <CompetitorsPicker
          companyName={companyName}
          domain={domain}
          nextHref={nextHref}
          organizationId={organizationId}
        />
      </div>
    </GeoProjectProvider>
  );
}
