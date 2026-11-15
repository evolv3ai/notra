import type { autopilotSaveInputSchema } from "@notra/schemas/dashboard/autopilot";
import type * as z from "zod";

import { AUTOPILOT_STALE_PULL_REQUEST_DAY_OPTIONS } from "@/constants/autopilot";
import type { AutopilotSettingsView } from "@/types/autopilot";

type AutopilotSaveInput = z.input<typeof autopilotSaveInputSchema>;
type StaleDays = (typeof AUTOPILOT_STALE_PULL_REQUEST_DAY_OPTIONS)[number];

export function toStaleDays(value: number | null): StaleDays | null {
  return (
    AUTOPILOT_STALE_PULL_REQUEST_DAY_OPTIONS.find((days) => days === value) ??
    null
  );
}

/**
 * The saved settings as a save input, so one change can be sent on its own.
 * Jobs are left out: they change through their own endpoint, and resending
 * them here could undo a toggle that landed in between.
 */
export function toAutopilotSaveInput(
  organizationId: string,
  settings: AutopilotSettingsView
): AutopilotSaveInput {
  return {
    organizationId,
    enabled: settings.enabled,
    projectId: settings.projectId ?? undefined,
    repository: settings.repository,
    contentPath: settings.contentPath,
    slack:
      settings.slackIntegrationId && settings.slackChannelId
        ? {
            integrationId: settings.slackIntegrationId,
            channelId: settings.slackChannelId,
            channelName: settings.slackChannelName,
          }
        : null,
    briefHour: settings.briefHour,
    timezone: settings.timezone,
    maxOpenPullRequests: settings.maxOpenPullRequests,
    stalePullRequestDays: toStaleDays(settings.stalePullRequestDays),
  };
}
