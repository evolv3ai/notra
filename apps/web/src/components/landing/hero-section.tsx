import { track, useFlag } from "@databuddy/sdk/react";
import { CtaButton } from "@notra/ui/components/shared/cta-button";
import { useIsMobile } from "@notra/ui/hooks/use-mobile";
import { cn } from "@notra/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useReducedMotion } from "motion/react";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect, useRef, useState } from "react";

import { HeroDither } from "@/components/landing/hero-dither";
import { HeroHeadline, useIsClient } from "@/components/landing/hero-headline";
import { HeroVariantSwitcher } from "@/components/landing/hero-variant-switcher";
import { LiveDemoLink } from "@/components/landing/live-demo-link";
import { TrackedSignupLink } from "@/components/tracked-signup-link";
import {
  HERO_CONTROL_VARIANT,
  HERO_EXPERIMENT_FLAG,
  HERO_HEADLINE_CYCLE,
  HERO_HEADLINE_CYCLE_MOBILE,
  HERO_HEADLINE_CYCLE_MS,
  HERO_PREVIEW_ENABLED,
  HERO_PREVIEW_VARIANT_PARAM,
  HERO_SIGNUP_SOURCE,
  HERO_VARIANTS,
} from "@/constants/landing/hero";
import {
  DATABUDDY_EXPERIMENT_EXPOSED_EVENT,
  DATABUDDY_HERO_CTA_CLICKED_EVENT,
} from "@/utils/databuddy";
import { rememberLandingExperimentVariant } from "@/utils/signup";

const CTA_BUTTON_CLASSNAME =
  "h-auto rounded-[2.5625rem] px-4 py-3 font-display font-medium text-[1.125rem] leading-[1.14] tracking-[-0.015em] sm:px-6";

export function HeroSection() {
  const reduceMotion = useReducedMotion();
  const cycle = useIsMobile()
    ? HERO_HEADLINE_CYCLE_MOBILE
    : HERO_HEADLINE_CYCLE;
  const [index, setIndex] = useState(0);
  const word = cycle[index % cycle.length] ?? cycle[0];
  const experiment = useFlag(HERO_EXPERIMENT_FLAG);
  const isClient = useIsClient();
  const [preview] = useQueryState(HERO_PREVIEW_VARIANT_PARAM, parseAsString);
  const previewVariant =
    HERO_PREVIEW_ENABLED && preview && HERO_VARIANTS[preview] ? preview : null;
  const flagVariant =
    isClient && experiment.variant && HERO_VARIANTS[experiment.variant]
      ? experiment.variant
      : HERO_CONTROL_VARIANT;
  const variant = previewVariant ?? flagVariant;
  const copy = HERO_VARIANTS[variant] ?? HERO_VARIANTS[HERO_CONTROL_VARIANT];
  const exposureTracked = useRef(false);

  useEffect(() => {
    if (
      !isClient ||
      previewVariant ||
      experiment.loading ||
      exposureTracked.current
    ) {
      return;
    }
    exposureTracked.current = true;
    rememberLandingExperimentVariant(variant);
    track(DATABUDDY_EXPERIMENT_EXPOSED_EVENT, {
      flag_key: HERO_EXPERIMENT_FLAG,
      variant,
    });
  }, [experiment.loading, isClient, previewVariant, variant]);

  useEffect(() => {
    if (reduceMotion !== false) {
      return;
    }
    const interval = window.setInterval(() => {
      setIndex((current) => current + 1);
    }, HERO_HEADLINE_CYCLE_MS);
    return () => window.clearInterval(interval);
  }, [reduceMotion]);

  function trackPrimaryClick() {
    if (previewVariant || !copy) {
      return;
    }
    track(DATABUDDY_HERO_CTA_CLICKED_EVENT, {
      flag_key: HERO_EXPERIMENT_FLAG,
      variant: experiment.loading ? null : variant,
      cta: "primary",
      label: copy.cta,
    });
  }

  function trackSecondaryClick() {
    if (previewVariant || !copy) {
      return;
    }
    track(DATABUDDY_HERO_CTA_CLICKED_EVENT, {
      flag_key: HERO_EXPERIMENT_FLAG,
      variant,
      cta: "secondary",
      label: copy.secondaryLabel,
      href: copy.secondaryHref,
    });
  }

  if (!word || !copy) {
    return null;
  }

  return (
    <section className="w-full px-6 pt-6 antialiased [font-synthesis:none]">
      {HERO_PREVIEW_ENABLED ? <HeroVariantSwitcher /> : null}
      <div className="relative isolate overflow-clip rounded-3xl bg-[#C8B2EE40] lg:h-[59.9375rem] dark:bg-[#2a2140]">
        <div className="pointer-events-none absolute inset-0 overflow-clip rounded-3xl">
          <HeroDither eager />
        </div>

        <div className="relative flex h-full w-full flex-col items-center">
          <div className="flex w-full min-w-0 flex-col items-center gap-7 px-3 pt-22 pb-2 sm:gap-10 sm:px-6 sm:pt-28 lg:pt-[7.5rem]">
            <div className="flex w-full min-w-0 flex-col items-center gap-5 sm:gap-7">
              <HeroHeadline
                lineOne={copy.headlineLineOne}
                lineTwo={copy}
                word={word}
              />
              <p className="max-w-[42.875rem] text-center font-sans text-[0.9375rem]/[1.45] font-medium tracking-[-0.005em] text-pretty text-[#1E1E1EBF] sm:text-[1.25rem]/[1.14] dark:text-white/70">
                {copy.subhead}
              </p>
            </div>

            <div className="flex flex-row items-center justify-center gap-4 sm:gap-7">
              <CtaButton
                className={CTA_BUTTON_CLASSNAME}
                nativeButton={false}
                render={
                  <TrackedSignupLink
                    onClick={trackPrimaryClick}
                    source={HERO_SIGNUP_SOURCE}
                  />
                }
                variant="primary"
              >
                {copy.cta}
              </CtaButton>
              <CtaButton
                className={cn(CTA_BUTTON_CLASSNAME, "max-sm:hidden")}
                nativeButton={false}
                render={
                  copy.secondaryHref.startsWith("https://") ? (
                    <Link
                      onClick={trackSecondaryClick}
                      rel="noopener noreferrer"
                      target="_blank"
                      to={copy.secondaryHref}
                    />
                  ) : (
                    <Link
                      onClick={trackSecondaryClick}
                      to={copy.secondaryHref}
                    />
                  )
                }
                variant="light"
              >
                {copy.secondaryLabel}
              </CtaButton>
            </div>
          </div>

          <div className="mt-8 flex w-full flex-1 flex-col items-center overflow-clip py-3.75 sm:mt-16.25 lg:pb-0">
            <div className="flex w-full flex-1 flex-col items-center px-3">
              <LiveDemoLink />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
