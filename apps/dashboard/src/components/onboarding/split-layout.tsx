import { ScrollArea } from "@notra/ui/components/ui/scroll-area";
import { useContext, useState } from "react";

import { AuthWordmark } from "@/components/auth/auth-wordmark";
import { SkipOnboardingForm } from "@/components/onboarding/skip-onboarding-form";
import {
  OnboardingPreviewTargetContext,
  OnboardingSplitLayoutContext,
} from "@/components/onboarding/split-layout-context";
import { ONBOARDING_FLOW_VARIANTS } from "@/constants/analytics-events";
import { cn } from "@/lib/utils";
import type { OnboardingStepLayoutProps } from "@/types/onboarding";

export function OnboardingSplitLayout({
  children,
  step,
}: OnboardingStepLayoutProps) {
  const context = useContext(OnboardingSplitLayoutContext);
  const [previewTarget, setPreviewTarget] = useState<HTMLElement | null>(null);
  if (!context) {
    throw new Error("Onboarding layout requires its server-loaded context");
  }
  const { organizationSlug, canSkip, onboardingVariant } = context;
  const showPreview = onboardingVariant !== ONBOARDING_FLOW_VARIANTS.NO_PREVIEW;

  return (
    <div
      className={cn(
        "flex h-screen w-full justify-center",
        showPreview && "lg:grid lg:grid-cols-2"
      )}
    >
      <ScrollArea className="h-full min-h-0 w-full">
        <section className="flex min-h-screen w-full flex-col items-center justify-between px-6 py-5 lg:px-10 lg:py-6">
          <AuthWordmark />
          <div className="w-full max-w-md min-w-0 py-6">
            <OnboardingPreviewTargetContext value={previewTarget}>
              {children}
            </OnboardingPreviewTargetContext>
          </div>
          {organizationSlug && canSkip ? (
            <SkipOnboardingForm slug={organizationSlug} step={step} />
          ) : (
            <div aria-hidden="true" className="h-12" />
          )}
        </section>
      </ScrollArea>

      {showPreview ? (
        <div className="relative hidden lg:flex">
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div
              className="corner-squircle relative h-full w-full overflow-hidden rounded-md bg-[linear-gradient(200deg,#a78bfa_0%,#7c3aed_55%,#5b21b6_100%)] supports-[corner-shape:squircle]:rounded-2xl"
              ref={setPreviewTarget}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
