"use client";

import { GitPullRequestIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { AutopilotFindingStatus } from "@/components/autopilot/autopilot-finding-status";
import {
  AutopilotRunPanel,
  AutopilotRunSection,
} from "@/components/autopilot/autopilot-run-panel";
import { AUTOPILOT_RUN_SECTIONS } from "@/constants/autopilot";
import { AUTOPILOT_RUN_RESULT_CLASS } from "@/constants/autopilot-ui";
import type { AutopilotFindingTranscriptProps } from "@/types/autopilot";

/** The run behind a finding as one agent panel that ends in its pull request. */
export function AutopilotFindingTranscript({
  finding,
  events,
  children,
}: AutopilotFindingTranscriptProps) {
  const live = finding.status === "open";
  return (
    <AutopilotRunPanel>
      <AutopilotRunSection
        events={events}
        id={`finding-${finding.id}`}
        label={
          AUTOPILOT_RUN_SECTIONS.find((section) => section.job === finding.kind)
            ?.label ?? finding.title
        }
        live={live}
        result={
          finding.pullRequestUrl ? (
            <div className={AUTOPILOT_RUN_RESULT_CLASS}>
              <HugeiconsIcon
                aria-hidden="true"
                className="text-muted-foreground size-4 shrink-0"
                icon={GitPullRequestIcon}
                strokeWidth={1.5}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{finding.title}</p>
                <p className="text-muted-foreground truncate text-xs">
                  {finding.repository}
                </p>
              </div>
              <AutopilotFindingStatus finding={finding} />
            </div>
          ) : null
        }
      >
        {live ? null : children}
      </AutopilotRunSection>
    </AutopilotRunPanel>
  );
}
