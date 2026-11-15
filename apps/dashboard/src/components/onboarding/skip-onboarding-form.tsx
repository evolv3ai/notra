import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { useServerFn } from "@tanstack/react-start";
import { useTranslations } from "use-intl";

import { Button } from "@/components/button";
import { trackOnboardingFunnelEvent } from "@/lib/analytics/onboarding-funnel";
import { skipOnboarding } from "@/lib/onboarding/skip";
import type { SkipOnboardingFormProps } from "@/types/onboarding";

export function SkipOnboardingForm({ slug, step }: SkipOnboardingFormProps) {
  const t = useTranslations("onboarding.shared");
  const skip = useServerFn(skipOnboarding);
  return (
    <form
      action={async () => {
        trackOnboardingFunnelEvent(POSTHOG_EVENTS.ONBOARDING_STEP_SKIPPED, {
          step,
          scope: "onboarding",
        });
        await skip(slug, step);
      }}
      className="flex justify-center py-2"
    >
      <Button className="text-muted-foreground" type="submit" variant="ghost">
        {t("skipOnboarding")}
      </Button>
    </form>
  );
}
