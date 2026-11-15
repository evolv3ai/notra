import { HugeiconsIcon } from "@hugeicons/react";
import { StatusBadge } from "@notra/ui/components/status-badge";
import { Badge } from "@notra/ui/components/ui/badge";

import { AUTOPILOT_FINDING_STATUS_BADGES } from "@/constants/autopilot";
import { AUTOPILOT_PULL_REQUEST_STATES } from "@/constants/autopilot-ui";
import { cn } from "@/lib/utils";
import type { AutopilotFindingStatusProps } from "@/types/autopilot";

/**
 * A finding with a pull request shows it as a status badge in GitHub's state
 * colours, with the state icon and the number, linking to the pull request. Ideas, writes and failures without
 * one keep their badge.
 */
export function AutopilotFindingStatus({
  finding,
}: AutopilotFindingStatusProps) {
  const state = AUTOPILOT_PULL_REQUEST_STATES[finding.status];
  if (!(state && finding.pullRequestUrl)) {
    const badge = AUTOPILOT_FINDING_STATUS_BADGES[finding.status];
    return <StatusBadge appearance={badge.appearance} label={badge.label} />;
  }
  return (
    <Badge
      aria-label={`${state.label}: pull request #${finding.pullRequestNumber}`}
      className={cn("tabular-nums", state.className)}
      render={
        <a
          href={finding.pullRequestUrl}
          rel="noreferrer"
          target="_blank"
          title={state.label}
        />
      }
      shape="rounded"
      size="md"
      variant={state.variant}
    >
      <HugeiconsIcon aria-hidden="true" icon={state.icon} strokeWidth={1.5} />#
      {finding.pullRequestNumber}
    </Badge>
  );
}
