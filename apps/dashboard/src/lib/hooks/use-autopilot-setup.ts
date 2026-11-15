"use client";

import { AUTOPILOT_AUTOMATION_KINDS } from "@notra/db/constants/autopilot";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { parseAsArrayOf, parseAsStringLiteral, useQueryState } from "nuqs";
import { useState } from "react";
import { toast } from "sonner";

import { useAutopilotConnections } from "@/lib/hooks/use-autopilot-connections";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { AutopilotSetupFormProps } from "@/types/autopilot";
import type { AutopilotAutomationKind } from "@/types/autopilot-metrics";
import { toErrorMessage } from "@/utils/error-message";

/** Choices of the first Autopilot setup, saved together when it is turned on. */
export function useAutopilotSetup({
  organizationId,
  callbackPath,
  overview,
  projectId,
  onSaved,
}: Omit<AutopilotSetupFormProps, "submitLabel">) {
  const queryClient = useQueryClient();
  const { settings } = overview;
  // The automations switched on, kept in the URL so the GitHub and Slack
  // connect redirects don't bring back one the user turned off.
  const [enabledKinds, setEnabledKinds] = useQueryState(
    "jobs",
    parseAsArrayOf(parseAsStringLiteral(AUTOPILOT_AUTOMATION_KINDS))
  );
  const jobs = enabledKinds
    ? {
        ...settings.jobs,
        ...Object.fromEntries(
          AUTOPILOT_AUTOMATION_KINDS.map((kind) => [
            kind,
            enabledKinds.includes(kind),
          ])
        ),
      }
    : settings.jobs;
  const separator = callbackPath.includes("?") ? "&" : "?";
  const connections = useAutopilotConnections({
    organizationId,
    callbackPath: enabledKinds
      ? `${callbackPath}${separator}jobs=${enabledKinds.join(",")}`
      : callbackPath,
    overview,
  });
  const { repositories, channels, slackIntegration } = connections;

  const [repositoryKey, setRepositoryKey] = useState<string | null>(
    settings.repository
      ? `${settings.repository.owner}/${settings.repository.name}`
      : null
  );
  const [channelId, setChannelId] = useState<string | null>(
    settings.slackChannelId ?? slackIntegration?.notificationChannelId ?? null
  );
  const [briefHour, setBriefHour] = useState(settings.briefHour);
  // Keep the saved timezone; only the first setup takes the browser's.
  const timezone = settings.configured
    ? settings.timezone
    : Intl.DateTimeFormat().resolvedOptions().timeZone || settings.timezone;
  const selectedRepository =
    repositories.find((repository) => repository.fullName === repositoryKey) ??
    null;
  const selectedChannel =
    channels.find((channel) => channel.id === channelId) ?? null;

  const save = useMutation({
    mutationFn: () =>
      dashboardOrpc.autopilot.save.call({
        organizationId,
        enabled: true,
        // Settings are workspace-wide; keep a saved project over the one in scope.
        projectId: settings.projectId ?? projectId ?? undefined,
        repository: selectedRepository
          ? {
              owner: selectedRepository.owner,
              name: selectedRepository.name,
              branch:
                settings.repository?.owner === selectedRepository.owner &&
                settings.repository.name === selectedRepository.name
                  ? settings.repository.branch
                  : selectedRepository.defaultBranch,
            }
          : settings.repository,
        contentPath: settings.contentPath,
        slack:
          slackIntegration && channelId
            ? {
                integrationId: slackIntegration.id,
                channelId,
                channelName:
                  selectedChannel?.name ?? settings.slackChannelName ?? null,
              }
            : null,
        briefHour,
        timezone,
        jobs,
        maxOpenPullRequests: settings.maxOpenPullRequests,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: dashboardOrpc.autopilot.key(),
      });
      onSaved?.();
    },
    onError: (error) => {
      toast.error(toErrorMessage(error, "Could not save Autopilot"));
    },
  });

  return {
    organizationId,
    ...connections,
    repositoryKey,
    setRepositoryKey,
    channelId,
    setChannelId,
    briefHour,
    setBriefHour,
    timezone,
    jobs,
    setJob: (kind: AutopilotAutomationKind, enabled: boolean) => {
      setEnabledKinds(
        AUTOPILOT_AUTOMATION_KINDS.filter((other) =>
          other === kind ? enabled : jobs[other]
        )
      );
    },
    hasAutomation: AUTOPILOT_AUTOMATION_KINDS.some((kind) => jobs[kind]),
    // Slack is optional: without it the brief only shows up on the Autopilot page.
    hasRepository: Boolean(selectedRepository || settings.repository),
    save,
  };
}
