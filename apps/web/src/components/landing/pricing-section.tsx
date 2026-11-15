import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { CtaButton } from "@notra/ui/components/shared/cta-button";
import { SPRING } from "@notra/ui/lib/motion";
import { cn } from "@notra/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import {
  AnimatePresence,
  domMax,
  LazyMotion,
  m,
  useReducedMotion,
} from "motion/react";
import { useRef, useState } from "react";

import { PricingGiftIcon } from "@/components/landing/pricing-icons";
import { PricingProShader } from "@/components/landing/pricing-pro-shader";
import { TrackedSignupLink } from "@/components/tracked-signup-link";
import {
  PRICING_ANNUAL_BADGE,
  PRICING_BILLING_OPTIONS,
  PRICING_CAROUSEL_LABEL,
  PRICING_CAROUSEL_PLANS,
  PRICING_DEFAULT_BILLING,
  PRICING_FREE_PLAN,
  PRICING_HEADING,
  PRICING_PLANS,
  PRICING_SUBHEADING,
  pricingCarouselDotLabel,
  TRACKED_ENGINES,
  TRACKED_ENGINES_CAPTION,
} from "@/constants/landing/pricing";
import { PRICING_ICONS } from "@/constants/landing/pricing-icons";
import type {
  BillingPeriod,
  LandingPricingSectionProps,
  PricingBillingToggleProps,
  PricingCardProps,
} from "@/types/landing/pricing";
import { activeSnapIndex, scrollToSnapIndex } from "@/utils/scroll-snap";
import { pricingPlanHref } from "@/utils/signup";

function PricingBillingToggle({
  value,
  onValueChange,
}: PricingBillingToggleProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(180deg,#FFFFFF,#F2F2F2)] p-1.75 shadow-[0_0.0625rem_0.125rem_#28282814,0_0_0_0.0625rem_#ECECEC] dark:bg-white/[0.06] dark:bg-none dark:shadow-[0_0_0_0.0625rem] dark:shadow-white/10">
      {PRICING_BILLING_OPTIONS.map((option) => {
        const isActive = option.value === value;

        return (
          <button
            aria-pressed={isActive}
            className={cn(
              "focus-visible:ring-ring/50 relative flex h-8 cursor-pointer touch-manipulation items-center justify-center rounded-full px-3.5 py-1.75 font-sans text-base leading-6 tracking-[-0.01em] focus-visible:ring-[0.1875rem]",
              isActive ? "text-white" : "text-[#1E1E1E] dark:text-white"
            )}
            key={option.value}
            onClick={() => onValueChange(option.value)}
            type="button"
          >
            {isActive ? (
              <m.span
                className="cta-gradient-primary absolute inset-0 rounded-full"
                layoutId="pricing-billing-thumb"
                style={{
                  boxShadow:
                    "0 0.0625rem 0.125rem #28282814, 0 0 0 0.0625rem #1E1E1E40",
                }}
                transition={
                  shouldReduceMotion ? { duration: 0 } : SPRING.snappy
                }
              />
            ) : null}
            <span className="duration-normal relative z-10 transition-colors">
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TrackedEnginesRow() {
  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-center font-sans text-sm font-medium tracking-[-0.01em] text-[#1E1E1EB3] dark:text-white/50">
        {TRACKED_ENGINES_CAPTION}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-9 gap-y-5">
        {TRACKED_ENGINES.map((engine) =>
          engine.darkSrc ? (
            <span className="inline-flex" key={engine.name} title={engine.name}>
              <img
                decoding="async"
                loading="lazy"
                alt={engine.name}
                className="h-7 w-auto dark:hidden"
                height={28}
                src={engine.src}
                width={engine.width}
              />
              <img
                decoding="async"
                loading="lazy"
                alt={engine.name}
                className="hidden h-7 w-auto dark:block"
                height={28}
                src={engine.darkSrc}
                width={engine.width}
              />
            </span>
          ) : (
            <img
              decoding="async"
              loading="lazy"
              alt={engine.name}
              className="h-7 w-auto"
              height={28}
              key={engine.name}
              src={engine.src}
              title={engine.name}
              width={engine.width}
            />
          )
        )}
      </div>
    </div>
  );
}

function PricingCardHeader({ plan, billingPeriod }: PricingCardProps) {
  const isFeatured = plan.variant === "featured";
  const showBadge = Boolean(plan.hasAnnualBadge) && billingPeriod === "yearly";

  return (
    <div
      className={cn(
        "m-1.75 flex flex-col gap-2 rounded-2xl px-4.25 py-5 lg:h-34 lg:py-8.25",
        isFeatured
          ? "border border-white/5 bg-white/10 shadow-[inset_0_0_1.29375rem_#FFFFFF1A]"
          : "bg-white shadow-[0_0.125rem_0.3125rem_#00000008] dark:bg-white/[0.04]"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3
          className={cn(
            "font-display text-[1.375rem] leading-7 font-medium tracking-[0.01em]",
            isFeatured
              ? "font-semibold text-white"
              : "text-black dark:text-white"
          )}
        >
          {plan.name}
        </h3>
        <AnimatePresence initial={false}>
          {showBadge ? (
            <m.span
              animate={{ y: 0, opacity: 1 }}
              className={cn(
                "flex items-center gap-0.75 overflow-clip rounded-full py-1 pr-2 pl-1.25 font-sans text-[0.8125rem] leading-[1.125rem] font-medium outline -outline-offset-1 [backdrop-filter:blur(0.15rem)]",
                isFeatured
                  ? "bg-white/10 text-white outline-[#F6F8FA80]"
                  : "bg-[#6D28D9] text-white outline-[#1E1E1E0D]"
              )}
              exit={{ y: "-0.75rem", opacity: 0 }}
              initial={{ y: "-0.75rem", opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <PricingGiftIcon className="size-4 shrink-0" />
              {PRICING_ANNUAL_BADGE}
            </m.span>
          ) : null}
        </AnimatePresence>
      </div>
      <p
        className={cn(
          "font-sans text-[0.9375rem] leading-[1.125rem] font-normal tracking-[-0.015em]",
          isFeatured ? "text-white/90" : "text-[#6B6B6B] dark:text-white/60"
        )}
      >
        {plan.description}
      </p>
    </div>
  );
}

function PricingCardPrice({ plan, billingPeriod }: PricingCardProps) {
  const isFeatured = plan.variant === "featured";

  return (
    <AnimatePresence initial={false} mode="wait">
      <m.div
        animate={{ y: 0, opacity: 1 }}
        className="flex items-baseline gap-2"
        exit={{ y: "0.75rem", opacity: 0 }}
        initial={{ y: "0.75rem", opacity: 0 }}
        key={plan.price[billingPeriod]}
        transition={{ duration: 0.2, ease: "easeInOut" }}
      >
        <span
          className={cn(
            "font-display text-[2.625rem] leading-13 font-normal tracking-[-0.01em]",
            isFeatured ? "text-white" : "text-[#1E1E1E] dark:text-white"
          )}
        >
          {plan.price[billingPeriod]}
        </span>
        {plan.priceSuffix ? (
          <span
            className={cn(
              "font-sans text-sm leading-[1.125rem] font-normal tracking-[-0.015em]",
              isFeatured
                ? "text-white/90"
                : "text-[#1E1E1EB3] dark:text-white/60"
            )}
          >
            {plan.priceSuffix[billingPeriod]}
          </span>
        ) : null}
      </m.div>
    </AnimatePresence>
  );
}

function PricingCard({ plan, billingPeriod }: PricingCardProps) {
  const isFeatured = plan.variant === "featured";

  const ctaLink =
    plan.cta.kind === "signup" ? (
      <TrackedSignupLink
        href={pricingPlanHref(plan.cta.href, plan.id, billingPeriod)}
        source={plan.cta.source}
      />
    ) : (
      <Link to={plan.cta.href} />
    );

  return (
    <article
      className={cn(
        "relative flex w-[82%] max-w-[22rem] shrink-0 snap-start flex-col overflow-clip rounded-3xl sm:w-full sm:max-w-none lg:order-none lg:h-184",
        isFeatured
          ? "order-first bg-[#6D28D9]"
          : "bg-[#F7F7F7] dark:bg-white/[0.04]"
      )}
    >
      {isFeatured && <PricingProShader />}

      <div className="relative z-10 flex h-full flex-col">
        <PricingCardHeader billingPeriod={billingPeriod} plan={plan} />

        <div className="flex flex-1 flex-col px-6 pt-4.5 pb-7 lg:pb-0">
          <div className="flex flex-col items-start gap-3.25">
            <PricingCardPrice billingPeriod={billingPeriod} plan={plan} />

            <CtaButton
              className="w-full"
              nativeButton={false}
              render={ctaLink}
              variant={isFeatured ? "light" : "primary"}
            >
              <span>{plan.cta.label}</span>
              {plan.cta.showArrow ? (
                <HugeiconsIcon className="size-4" icon={ArrowRight02Icon} />
              ) : null}
            </CtaButton>
          </div>

          <div
            className={cn(
              "mt-6 h-px w-full lg:mt-8",
              isFeatured ? "bg-white/20" : "bg-black/20 dark:bg-white/15"
            )}
          />

          <ul className="mt-6 flex flex-col gap-3 lg:mt-10.5">
            {plan.features.map((feature) => {
              const Icon = PRICING_ICONS[feature.icon];

              return (
                <li className="flex items-center gap-2" key={feature.label}>
                  <span
                    className={cn(
                      "shrink-0",
                      isFeatured
                        ? "text-white"
                        : "text-[#1E1E1EBF] dark:text-white/60"
                    )}
                  >
                    <Icon className="size-6" />
                  </span>
                  <div className="flex flex-col">
                    <span
                      className={cn(
                        "font-sans text-sm leading-[1.125rem] font-normal",
                        isFeatured
                          ? "text-white"
                          : "text-[#1E1E1EBF] dark:text-white/70"
                      )}
                    >
                      {feature.label}
                    </span>
                    {feature.subtitle ? (
                      <span
                        className={cn(
                          "font-sans text-xs leading-4 font-normal",
                          isFeatured
                            ? "text-white/90"
                            : "text-[#1E1E1EB3] dark:text-white/50"
                        )}
                      >
                        {feature.subtitle}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </article>
  );
}

function PricingFreeTier() {
  const plan = PRICING_FREE_PLAN;

  return (
    <article className="flex w-full flex-col gap-6 rounded-3xl bg-[#F7F7F7] p-6 lg:flex-row lg:items-center lg:gap-10 lg:px-8 dark:bg-white/[0.04]">
      <div className="flex flex-col gap-2 lg:max-w-[26rem] lg:flex-1">
        <div className="flex items-baseline gap-3">
          <h3 className="font-display text-[1.375rem] leading-7 font-medium tracking-[0.01em] text-black dark:text-white">
            {plan.name}
          </h3>
          <span className="font-display text-[1.375rem] leading-7 font-normal tracking-[-0.01em] text-[#1E1E1EB3] dark:text-white/60">
            {plan.price}
          </span>
        </div>
        <p className="font-sans text-[0.9375rem] leading-[1.125rem] font-normal tracking-[-0.015em] text-[#6B6B6B] dark:text-white/60">
          {plan.description}
        </p>
      </div>

      <ul className="flex flex-col gap-3 sm:flex-row sm:gap-8 lg:flex-1 lg:justify-center">
        {plan.features.map((feature) => {
          const Icon = PRICING_ICONS[feature.icon];

          return (
            <li className="flex items-center gap-2" key={feature.label}>
              <Icon className="size-6 shrink-0 text-[#1E1E1EBF] dark:text-white/60" />
              <span className="font-sans text-sm leading-[1.125rem] font-normal text-[#1E1E1EBF] dark:text-white/70">
                {feature.label}
              </span>
            </li>
          );
        })}
      </ul>

      <CtaButton
        className="w-full lg:w-auto lg:min-w-48"
        nativeButton={false}
        render={
          <TrackedSignupLink href={plan.cta.href} source={plan.cta.source} />
        }
        variant="primary"
      >
        <span>{plan.cta.label}</span>
        <HugeiconsIcon className="size-4" icon={ArrowRight02Icon} />
      </CtaButton>
    </article>
  );
}

export function LandingPricingSection({
  showHeader = true,
}: LandingPricingSectionProps) {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>(
    PRICING_DEFAULT_BILLING
  );
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activePlan, setActivePlan] = useState(0);

  function handleCarouselScroll() {
    if (carouselRef.current) {
      setActivePlan(activeSnapIndex(carouselRef.current));
    }
  }

  return (
    <LazyMotion features={domMax}>
      <section
        className={cn(
          "flex w-full flex-col items-center gap-10 px-6 pb-20 sm:gap-13.5 sm:pb-24",
          showHeader ? "pt-20 sm:pt-24" : "pt-6"
        )}
        id="pricing"
      >
        {showHeader ? (
          <div className="flex flex-col items-center gap-3 sm:gap-4">
            <h2 className="font-display max-w-[59rem] text-center text-[2rem] leading-[1.12] font-medium tracking-[-0.02em] text-balance text-[#1E1E1E] sm:text-[2.875rem] sm:leading-13 dark:text-white">
              {PRICING_HEADING}
            </h2>
            <p className="max-w-[43rem] text-center font-sans text-base/6 font-medium text-balance text-[#1E1E1EBF] sm:text-xl/7 dark:text-white/70">
              {PRICING_SUBHEADING}
            </p>
          </div>
        ) : null}

        <div className="flex w-full flex-col items-center gap-6">
          <PricingBillingToggle
            onValueChange={setBillingPeriod}
            value={billingPeriod}
          />

          <div className="flex w-full flex-col items-center gap-4">
            <div
              aria-label={PRICING_CAROUSEL_LABEL}
              className="relative -mx-6 flex w-[calc(100%+3rem)] snap-x snap-mandatory scroll-px-6 [scrollbar-width:none] gap-3 overflow-x-auto overscroll-x-contain px-6 sm:mx-0 sm:grid sm:w-full sm:max-w-[48rem] sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 lg:max-w-[80rem] lg:grid-cols-4 [&::-webkit-scrollbar]:hidden"
              onScroll={handleCarouselScroll}
              ref={carouselRef}
              role="region"
            >
              {PRICING_PLANS.map((plan) => (
                <PricingCard
                  billingPeriod={billingPeriod}
                  key={plan.id}
                  plan={plan}
                />
              ))}
            </div>
            <div className="flex items-center sm:hidden">
              {PRICING_CAROUSEL_PLANS.map((plan, index) => (
                <button
                  aria-current={index === activePlan}
                  aria-label={pricingCarouselDotLabel(plan.name)}
                  className="group flex size-6 cursor-pointer items-center justify-center"
                  key={plan.id}
                  onClick={() => {
                    if (carouselRef.current) {
                      scrollToSnapIndex(carouselRef.current, index);
                    }
                  }}
                  type="button"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#1E1E1E33] transition-[width,background-color] duration-200 ease-out group-aria-current:w-4 group-aria-current:bg-[#1E1E1E] dark:bg-white/25 dark:group-aria-current:bg-white" />
                </button>
              ))}
            </div>
          </div>

          <div className="w-full sm:max-w-[48rem] lg:max-w-[80rem]">
            <PricingFreeTier />
          </div>
        </div>

        <TrackedEnginesRow />
      </section>
    </LazyMotion>
  );
}
