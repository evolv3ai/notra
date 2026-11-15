"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@notra/ui/components/ui/button";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { AutopilotAutomationChoices } from "@/components/autopilot/autopilot-automation-choices";
import { AutopilotRepositoryList } from "@/components/autopilot/autopilot-repository-list";
import {
  AutopilotScheduleRow,
  AutopilotSlackRow,
} from "@/components/autopilot/autopilot-setup-rows";
import { SiteCreateStage } from "@/components/sites/site-create-stage";
import { SiteCreateStep } from "@/components/sites/site-create-step";
import { SiteCreateStepList } from "@/components/sites/site-create-step-list";
import {
  AUTOPILOT_SETUP_HIGHLIGHTS,
  AUTOPILOT_SETUP_STEP_IDS,
  AUTOPILOT_SETUP_STEPS,
} from "@/constants/autopilot-ui";
import { useAutopilotSetup } from "@/lib/hooks/use-autopilot-setup";
import type {
  AutopilotSetupFormProps,
  AutopilotSetupStepId,
} from "@/types/autopilot";
import type { SiteCreateStepState } from "@/types/components/sites";

/** First setup on the Autopilot page: what it is, what it does, where it works. */
export function AutopilotSetupFlow({
  submitLabel,
  ...props
}: AutopilotSetupFormProps) {
  // In the URL so the GitHub and Slack connect redirects come back to the step.
  const [activeStep, setActiveStep] = useQueryState(
    "setup",
    parseAsStringLiteral(AUTOPILOT_SETUP_STEP_IDS)
      .withDefault("intro")
      .withOptions({ clearOnDefault: true })
  );
  const setup = useAutopilotSetup({
    ...props,
    callbackPath: `${props.callbackPath}?setup=${activeStep}`,
  });
  const activeIndex = AUTOPILOT_SETUP_STEP_IDS.indexOf(activeStep);
  const stateOf = (step: AutopilotSetupStepId): SiteCreateStepState => {
    const index = AUTOPILOT_SETUP_STEP_IDS.indexOf(step);
    if (index === activeIndex) {
      return "active";
    }
    return index < activeIndex ? "done" : "locked";
  };
  const goTo = (step: AutopilotSetupStepId) => {
    if (!setup.save.isPending) {
      void setActiveStep(step);
    }
  };
  const side = AUTOPILOT_SETUP_STEPS[activeStep];

  return (
    <div
      className="flex min-h-[36rem] min-w-0 flex-1 flex-col"
      data-autopilot-fill
    >
      <SiteCreateStage
        activeIndex={activeIndex}
        left={
          <div
            aria-hidden="true"
            className="animate-in fade-in motion-safe:slide-in-from-bottom-1 space-y-1.5 pt-1 duration-500"
            key={activeStep}
          >
            <p className="text-lg font-semibold tracking-tight">{side.title}</p>
            <p className="text-muted-foreground text-sm text-pretty">
              {side.description}
            </p>
          </div>
        }
        right={
          <SiteCreateStepList
            onSelect={goTo}
            steps={AUTOPILOT_SETUP_STEP_IDS.map((step) => ({
              id: step,
              label: AUTOPILOT_SETUP_STEPS[step].label,
              state: stateOf(step),
            }))}
          />
        }
      >
        <SiteCreateStep
          description={AUTOPILOT_SETUP_STEPS.intro.description}
          footer={
            <Button onClick={() => goTo("automations")} size="sm">
              Get started
            </Button>
          }
          onActivate={() => goTo("intro")}
          state={stateOf("intro")}
          title={AUTOPILOT_SETUP_STEPS.intro.title}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {AUTOPILOT_SETUP_HIGHLIGHTS.map((item) => (
              <div
                className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
                key={item.title}
              >
                <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <HugeiconsIcon className="size-4" icon={item.icon} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </SiteCreateStep>

        <SiteCreateStep
          description={AUTOPILOT_SETUP_STEPS.automations.description}
          footer={
            <Button
              disabled={!setup.hasAutomation}
              onClick={() => goTo("connect")}
              size="sm"
            >
              Continue
            </Button>
          }
          onActivate={() => goTo("automations")}
          state={stateOf("automations")}
          title={AUTOPILOT_SETUP_STEPS.automations.title}
        >
          <AutopilotAutomationChoices setup={setup} />
        </SiteCreateStep>

        <SiteCreateStep
          description={AUTOPILOT_SETUP_STEPS.connect.description}
          footer={
            <Button
              disabled={!(setup.hasRepository && setup.hasAutomation)}
              loading={setup.save.isPending}
              onClick={() => setup.save.mutate()}
              size="sm"
            >
              {submitLabel}
            </Button>
          }
          state={stateOf("connect")}
          title={AUTOPILOT_SETUP_STEPS.connect.title}
        >
          <div className="space-y-4">
            <AutopilotRepositoryList setup={setup} />
            <div className="divide-border divide-y border-t pt-2.5">
              <AutopilotSlackRow setup={setup} />
              <AutopilotScheduleRow setup={setup} />
            </div>
          </div>
        </SiteCreateStep>
      </SiteCreateStage>
    </div>
  );
}
