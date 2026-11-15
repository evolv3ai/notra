"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { startGitHubInstall } from "@/lib/integrations/github/install";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { AutopilotSettingsPanelProps } from "@/types/autopilot";

/** Shared connections for first setup and the autosaving settings panel. */
export function useAutopilotConnections({
  organizationId,
  callbackPath,
  overview,
}: AutopilotSettingsPanelProps) {
  const [installing, setInstalling] = useState(false);
  const githubConnected = overview.github.accounts.length > 0;
  const slackIntegration =
    overview.slack.integrations.find(
      (integration) => integration.id === overview.settings.slackIntegrationId
    ) ??
    overview.slack.integrations.at(0) ??
    null;
  const repositoriesQuery = useQuery(
    dashboardOrpc.autopilot.repositories.queryOptions({
      input: { organizationId },
      enabled: githubConnected,
    })
  );
  const channelsQuery = useQuery(
    dashboardOrpc.integrations.slack.listChannels.queryOptions({
      input: { organizationId, integrationId: slackIntegration?.id ?? "" },
      enabled: Boolean(slackIntegration),
    })
  );

  const installGitHub = async () => {
    setInstalling(true);
    const result = await startGitHubInstall({ organizationId, callbackPath });
    if (!result.started) {
      setInstalling(false);
      toast.error(result.message ?? "Could not start the GitHub install");
    }
  };
  return {
    githubConnected,
    slackIntegration,
    repositories: repositoriesQuery.data ?? [],
    channels: channelsQuery.data?.channels ?? [],
    installing,
    installGitHub,
    slackAuthorizeUrl: `/api/integrations/slack/authorize?organizationId=${organizationId}&callbackPath=${encodeURIComponent(callbackPath)}`,
  };
}
