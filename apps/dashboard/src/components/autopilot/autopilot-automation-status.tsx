"use client";

import { Github01Icon, HourglassIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { TABLE_BODY_CLASS, TABLE_FRAME_CLASS } from "ui/table/constants";

import { AutopilotMergeMenu } from "@/components/autopilot/autopilot-merge-menu";
import { Button } from "@/components/button";
import { cn } from "@/lib/utils";
import type { AutopilotAutomationStatusProps } from "@/types/autopilot";

/**
 * Why an automation that is on does nothing right now: its last pull request
 * still waits for review, the open pull request limit is reached, or there is
 * no repository to write to. Nothing shows while it can work.
 */
export function AutopilotAutomationStatus({
  kind,
  overview,
  merging,
  onMerge,
}: AutopilotAutomationStatusProps) {
  const { settings, findings } = overview;
  if (!(settings.enabled && settings.jobs[kind])) {
    return null;
  }
  const openedAt = (finding: (typeof findings)[number]) =>
    new Date(finding.openedAt ?? finding.createdAt).getTime();
  const open = findings.filter((finding) => finding.status === "proposed");
  const waiting = open
    .filter((finding) => finding.kind === kind)
    .toSorted((a, b) => openedAt(a) - openedAt(b))
    .at(0);

  let title: string;
  let description: string;
  if (!settings.repository) {
    title = "No repository connected";
    description = "Choose a website repository in Settings.";
  } else if (open.length >= settings.maxOpenPullRequests) {
    title = `${open.length} of ${settings.maxOpenPullRequests} pull requests are open`;
    description = "Merge or close a pull request to continue.";
  } else if (kind === "readiness" && waiting) {
    title = "Waiting on your review";
    description = "Review the current fix before Autopilot starts another.";
  } else {
    return null;
  }

  return (
    <div className={TABLE_FRAME_CLASS}>
      <div
        className={cn(
          TABLE_BODY_CLASS,
          "flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center"
        )}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <HugeiconsIcon
            aria-hidden="true"
            className="text-warning mt-0.5 size-4 shrink-0"
            icon={HourglassIcon}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-muted-foreground text-sm text-pretty">
              {description}
            </p>
          </div>
        </div>
        {waiting?.pullRequestUrl && overview.canManage ? (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              aria-label={`Open #${waiting.pullRequestNumber} on GitHub`}
              nativeButton={false}
              render={
                <a
                  href={waiting.pullRequestUrl}
                  rel="noreferrer"
                  target="_blank"
                />
              }
              size="sm"
              variant="secondary"
            >
              <HugeiconsIcon icon={Github01Icon} size={16} />#
              {waiting.pullRequestNumber}
            </Button>
            <AutopilotMergeMenu
              loading={merging}
              onMerge={(method) => onMerge(waiting, method)}
              size="sm"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
