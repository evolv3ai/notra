"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { AUTOPILOT_AUTOMATION_KINDS } from "@notra/db/constants/autopilot";
import { Switch } from "@notra/ui/components/ui/switch";
import { useId } from "react";

import {
  AUTOPILOT_AUTOMATIONS,
  AUTOPILOT_KIND_META,
} from "@/constants/autopilot-ui";
import type { AutopilotSetupRowsProps } from "@/types/autopilot";

/** The automations Autopilot can run, each switchable before it is turned on. */
export function AutopilotAutomationChoices({ setup }: AutopilotSetupRowsProps) {
  const id = useId();
  return (
    <ul className="divide-border divide-y">
      {AUTOPILOT_AUTOMATION_KINDS.map((kind) => (
        <li
          className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
          key={kind}
        >
          <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
            <HugeiconsIcon
              className="size-4"
              icon={AUTOPILOT_KIND_META[kind].icon}
            />
          </div>
          <div className="min-w-0 flex-1">
            <label className="text-sm font-medium" htmlFor={`${id}-${kind}`}>
              {AUTOPILOT_AUTOMATIONS[kind].name}
            </label>
            <p className="text-muted-foreground text-xs text-pretty">
              {AUTOPILOT_AUTOMATIONS[kind].description}
            </p>
          </div>
          <Switch
            checked={setup.jobs[kind]}
            id={`${id}-${kind}`}
            onCheckedChange={(checked) => setup.setJob(kind, checked)}
          />
        </li>
      ))}
    </ul>
  );
}
