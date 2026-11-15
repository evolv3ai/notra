"use client";

import {
  ArrowRight02Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  GitPullRequestIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Fragment } from "react";
import { TABLE_BODY_CLASS, TABLE_FRAME_CLASS } from "ui/table/constants";

import { AUTOPILOT_HOUR_OPTIONS } from "@/constants/autopilot";
import { AUTOPILOT_AUTOMATIONS } from "@/constants/autopilot-ui";
import { cn } from "@/lib/utils";
import type { AutopilotAutomationFactsProps } from "@/types/autopilot";

/** How an automation works, as a small flow: what starts it, what it reads, what it hands you. */
export function AutopilotAutomationFacts({
  kind,
  settings,
}: AutopilotAutomationFactsProps) {
  const automation = AUTOPILOT_AUTOMATIONS[kind];
  const hour =
    AUTOPILOT_HOUR_OPTIONS.find(
      (option) => option.value === String(settings.briefHour)
    )?.label ?? `${settings.briefHour}:00`;
  const repository = settings.repository;
  const steps = [
    {
      icon: Clock01Icon,
      title: `Daily at ${hour}`,
      detail: automation.alsoOn ?? settings.timezone,
    },
    { icon: Search01Icon, title: "Reads", detail: automation.source },
    {
      icon: GitPullRequestIcon,
      title: automation.output,
      detail: repository ? repository.name : "No repository connected",
    },
    {
      icon: CheckmarkCircle02Icon,
      title: "You merge",
      detail: "Review before publishing",
    },
  ];

  return (
    <section aria-labelledby="automation-how" className="space-y-3">
      <h2 className="px-1 text-sm font-medium" id="automation-how">
        How it works
      </h2>
      <div className={TABLE_FRAME_CLASS}>
        <ol
          className={cn(
            TABLE_BODY_CLASS,
            "flex flex-col gap-2 p-4 md:flex-row md:items-stretch"
          )}
        >
          {steps.map((step, index) => (
            <Fragment key={step.title}>
              {index > 0 ? (
                <HugeiconsIcon
                  aria-hidden="true"
                  className="text-muted-foreground/60 hidden size-4 shrink-0 self-center md:block"
                  icon={ArrowRight02Icon}
                />
              ) : null}
              <li className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border px-3 py-2.5">
                <span className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <HugeiconsIcon className="size-4" icon={step.icon} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-pretty">
                    {step.title}
                  </span>
                  <span className="text-muted-foreground block text-xs text-pretty break-words">
                    {step.detail}
                  </span>
                </span>
              </li>
            </Fragment>
          ))}
        </ol>
      </div>
    </section>
  );
}
