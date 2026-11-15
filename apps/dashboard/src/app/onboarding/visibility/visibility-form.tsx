"use client";

import { DEFAULT_LANGUAGE } from "@notra/ai/constants/languages";
import { promptKey } from "@notra/geo-core/geo/prompt-key";
import { buildBrandTerms } from "@notra/geo-core/geo/suggestion-keywords";
import { normalizeWebsiteUrl } from "@notra/geo-core/utils/geo-website";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { AuthFormHeader } from "@notra/ui/components/shared/auth/auth-form-header";
import { CtaButton } from "@notra/ui/components/shared/cta-button";
import { Input } from "@notra/ui/components/ui/input";
import { Label } from "@notra/ui/components/ui/label";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import Link from "@/components/framework/link";
import { GeoLanguagePicker } from "@/components/geo/geo-language-picker";
import { BrandReviewSkeleton } from "@/components/onboarding/brand-review-skeleton";
import { OnboardingDashboardPreview } from "@/components/onboarding/dashboard-preview";
import { OnboardingProgress } from "@/components/onboarding/progress";
import { PromptChoiceRow } from "@/components/onboarding/prompt-choice-row";
import { OnboardingStepViewTracker } from "@/components/onboarding/step-view-tracker";
import { WebsiteDiscoveryStatus } from "@/components/onboarding/website-discovery-status";
import { GeoProjectProvider } from "@/components/providers/geo-project-provider";
import { ONBOARDING_STEPS } from "@/constants/analytics-events";
import {
  ONBOARDING_FIELD_CLASS,
  ONBOARDING_STEP_VISIBILITY,
} from "@/constants/onboarding";
import { trackEvent } from "@/lib/analytics/posthog-client";
import {
  useGeoDiscoverWebsite,
  useGeoOnboardingBrand,
} from "@/lib/hooks/use-geo";
import { useLanguageLabel } from "@/lib/hooks/use-language-label";
import { useRouter } from "@/lib/navigation";
import type {
  OnboardingPreviewFocus,
  VisibilityFormProps,
  VisibilityReviewProps,
} from "@/types/onboarding";
import {
  onboardingPreviewFocusProps,
  stripWebsitePrefix,
} from "@/utils/onboarding";
import {
  selectedVisibilityPrompts,
  toVisibilityBrandInput,
  uniqueVisibilityPrompts,
} from "@/utils/onboarding-brand";

function VisibilityReview({
  organizationId,
  websiteUrl,
  discovery,
  fallbackCompanyName,
  languages,
  nextHref,
  skipHref,
  previewFocus,
  previewWebsite,
}: VisibilityReviewProps) {
  const t = useTranslations("onboarding.visibility");
  const tCommon = useTranslations("common");
  const id = useId();
  const router = useRouter();
  const [companyName, setCompanyName] = useState(
    () => discovery?.companyName ?? fallbackCompanyName
  );
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const companyInputRef = useRef<HTMLInputElement>(null);
  const [droppedKeys, setDroppedKeys] = useState(() => new Set<string>());
  const save = useGeoOnboardingBrand(organizationId);
  const [isLeaving, setIsLeaving] = useState(false);
  const busy = save.isPending || isLeaving;
  const prompts = uniqueVisibilityPrompts(
    discovery?.prompts ?? [],
    buildBrandTerms({
      companyName,
      aliases: [...(discovery?.aliases ?? [])],
    })
  );
  const selectedPrompts = selectedVisibilityPrompts(prompts, droppedKeys);
  const companyNameMissing = companyName.trim().length === 0;
  const websiteHost = stripWebsitePrefix(websiteUrl);

  const togglePrompt = (key: string) => {
    setDroppedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSubmit = () => {
    if (busy) {
      return;
    }
    if (companyNameMissing) {
      setAttemptedSubmit(true);
      requestAnimationFrame(() => companyInputRef.current?.focus());
      return;
    }
    const brandInput = toVisibilityBrandInput({
      companyName,
      aliases: discovery?.aliases ?? [],
      audienceType: discovery?.audienceType,
      prompts: selectedPrompts,
      languages,
    });
    save.mutate(brandInput, {
      onSuccess: () => {
        trackEvent(POSTHOG_EVENTS.ONBOARDING_BRAND_SAVED, {
          alias_count: brandInput.aliases.length,
          audience_type: brandInput.audienceType ?? null,
          prompt_count: brandInput.prompts.length,
          languages: brandInput.languages ?? [],
        });
        setIsLeaving(true);
        router.push(nextHref);
      },
    });
  };

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        handleSubmit();
      }}
    >
      <OnboardingDashboardPreview
        focus={previewFocus}
        name={companyName}
        defaultPage={selectedPrompts.length > 0 ? "prompts" : "overview"}
        prompts={selectedPrompts.map((entry) => entry.prompt)}
        website={previewWebsite}
      />
      <div className="grid gap-2" data-preview="brand">
        <Label htmlFor={`${id}-company`}>{t("brandName")}</Label>
        <Input
          aria-describedby={
            attemptedSubmit && companyNameMissing
              ? `${id}-company-error`
              : undefined
          }
          aria-invalid={attemptedSubmit && companyNameMissing}
          className={ONBOARDING_FIELD_CLASS}
          disabled={busy}
          id={`${id}-company`}
          onChange={(event) => setCompanyName(event.target.value)}
          placeholder={t("brandNamePlaceholder")}
          ref={companyInputRef}
          value={companyName}
        />
        {attemptedSubmit && companyNameMissing ? (
          <p className="text-destructive text-sm" id={`${id}-company-error`}>
            {t("brandNameRequired")}
          </p>
        ) : null}
      </div>

      {prompts.length > 0 ? (
        <div className="grid gap-2" data-preview="prompts">
          <p className="text-sm font-medium">
            {t.rich(websiteHost ? "questionsFrom" : "questions", {
              host: websiteHost,
              selected: selectedPrompts.length,
              total: prompts.length,
              muted: (chunks) => (
                <span className="text-muted-foreground text-xs font-normal">
                  {chunks}
                </span>
              ),
            })}
          </p>
          <ul className="w-full max-w-full min-w-0 space-y-1.5 overflow-hidden">
            {prompts.map((entry) => {
              const key = promptKey(entry.prompt);
              return (
                <PromptChoiceRow
                  disabled={busy}
                  key={key}
                  onToggle={() => togglePrompt(key)}
                  prompt={entry.prompt}
                  selected={!droppedKeys.has(key)}
                />
              );
            })}
          </ul>
        </div>
      ) : null}

      <CtaButton className="w-full" loading={busy} type="submit">
        {tCommon("actions.continue")}
      </CtaButton>

      <div className="text-center">
        <Button
          className="text-muted-foreground"
          disabled={busy}
          nativeButton={false}
          onClick={() =>
            trackEvent(POSTHOG_EVENTS.ONBOARDING_STEP_SKIPPED, {
              step: ONBOARDING_STEPS.VISIBILITY,
            })
          }
          render={<Link href={skipHref} />}
          size="sm"
          variant="link"
        >
          {t("skipStep")}
        </Button>
      </div>
    </form>
  );
}

export function VisibilityForm({
  organizationId,
  projectId,
  websiteUrl,
  companyName,
  initialLanguages,
  lockedLanguage,
  nextHref,
  skipHref,
  inOnboardingFlow,
  progressHrefs,
}: VisibilityFormProps) {
  const t = useTranslations("onboarding.visibility");
  const tCommon2 = useTranslations("common");
  const languageLabel = useLanguageLabel();
  const id = useId();
  const [retryUrl, setRetryUrl] = useState<string | null>(null);
  const analyzedUrl = retryUrl ?? normalizeWebsiteUrl(websiteUrl) ?? null;
  const [languages, setLanguages] = useState(initialLanguages);
  const [previewFocus, setPreviewFocus] =
    useState<OnboardingPreviewFocus | null>(null);
  const promptLanguage = languages[0] ?? DEFAULT_LANGUAGE;
  const discover = useGeoDiscoverWebsite(
    organizationId,
    analyzedUrl,
    promptLanguage
  );
  const isAnalyzing = analyzedUrl !== null && discover.isPending;
  const discoveredWebsite = analyzedUrl ?? websiteUrl;
  const analyzedHost = analyzedUrl ? stripWebsitePrefix(analyzedUrl) : "";
  const discoveryStartedAtRef = useRef<number | null>(null);
  const discoveryTrackedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      analyzedUrl &&
      discover.isPending &&
      discoveryStartedAtRef.current === null
    ) {
      discoveryStartedAtRef.current = Date.now();
    }
    if (
      !analyzedUrl ||
      discover.isPending ||
      discoveryTrackedUrlRef.current === analyzedUrl
    ) {
      return;
    }
    discoveryTrackedUrlRef.current = analyzedUrl;
    const durationMs =
      discoveryStartedAtRef.current === null
        ? undefined
        : Date.now() - discoveryStartedAtRef.current;
    if (discover.isError) {
      trackEvent(POSTHOG_EVENTS.WEBSITE_DISCOVERY_FAILED, {
        duration_ms: durationMs,
      });
      return;
    }
    trackEvent(POSTHOG_EVENTS.WEBSITE_DISCOVERED, {
      prompt_count_suggested: discover.data?.discovery?.prompts.length ?? 0,
      alias_count_suggested: discover.data?.discovery?.aliases.length ?? 0,
      duration_ms: durationMs,
    });
  }, [analyzedUrl, discover.isPending, discover.isError, discover.data]);

  return (
    <GeoProjectProvider projectId={projectId}>
      <div className="flex w-full flex-col gap-5">
        <OnboardingStepViewTracker
          inOnboardingFlow={inOnboardingFlow}
          step={ONBOARDING_STEPS.VISIBILITY}
        />
        <div className="flex justify-center">
          <OnboardingProgress
            current={ONBOARDING_STEP_VISIBILITY}
            hrefs={progressHrefs}
          />
        </div>

        <AuthFormHeader description={t("description")} title={t("title")} />

        <div
          {...onboardingPreviewFocusProps(setPreviewFocus)}
          className="mt-2 space-y-5"
        >
          <WebsiteDiscoveryStatus
            failed={discover.isError}
            host={analyzedHost}
            isReading={isAnalyzing}
            key={analyzedHost}
            onRetry={(url) => {
              discoveryStartedAtRef.current = Date.now();
              setRetryUrl(url);
            }}
          />

          <div className="grid gap-2" data-preview="prompts">
            <div className="space-y-1">
              <Label htmlFor={`${id}-languages`}>
                {tCommon2("labels.languages")}
              </Label>
              <p className="text-muted-foreground text-xs">
                {t("languagesHint", {
                  language: languageLabel(promptLanguage),
                })}
              </p>
            </div>
            <GeoLanguagePicker
              disabled={isAnalyzing}
              inputClassName="h-11 rounded-xl"
              inputId={`${id}-languages`}
              labeled={false}
              lockedLanguage={lockedLanguage}
              onChange={setLanguages}
              selected={languages}
            />
          </div>

          {isAnalyzing ? (
            <>
              <OnboardingDashboardPreview
                focus={previewFocus ?? "website"}
                name={companyName ?? ""}
                website={discoveredWebsite}
              />
              <BrandReviewSkeleton />
            </>
          ) : (
            <VisibilityReview
              discovery={discover.data?.discovery ?? null}
              fallbackCompanyName={companyName ?? ""}
              key={`${analyzedUrl ?? ""}:${promptLanguage}:${discover.status}`}
              languages={languages}
              nextHref={nextHref}
              organizationId={organizationId}
              previewFocus={previewFocus}
              previewWebsite={discoveredWebsite}
              skipHref={skipHref}
              websiteUrl={discoveredWebsite}
            />
          )}
        </div>
      </div>
    </GeoProjectProvider>
  );
}
