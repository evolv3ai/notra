"use client";

import {
  AiChat01Icon,
  Archive02Icon,
  Clock01Icon,
  Github01Icon,
  PowerIcon,
  SlackIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@notra/ui/components/ui/select";
import { Switch } from "@notra/ui/components/ui/switch";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AutopilotReleaseFiltersSection } from "@/components/autopilot/autopilot-release-filters-section";
import { AutopilotRepositoryPicker } from "@/components/autopilot/autopilot-repository-picker";
import { AutopilotRulesSection } from "@/components/autopilot/autopilot-rules-section";
import { Button } from "@/components/button";
import {
  AUTOPILOT_HOUR_OPTIONS,
  AUTOPILOT_STALE_OPTIONS,
} from "@/constants/autopilot";
import { AUTOPILOT_SLACK_CHANNEL_HINT } from "@/constants/autopilot-slack";
import { useAutopilotConnections } from "@/lib/hooks/use-autopilot-connections";
import { dashboardOrpc } from "@/lib/orpc/query";
import type {
  AutopilotSettingsRowProps,
  AutopilotSettingsPanelProps,
} from "@/types/autopilot";
import { toAutopilotSaveInput, toStaleDays } from "@/utils/autopilot-settings";
import { toErrorMessage } from "@/utils/error-message";

function SettingsRow({
  icon,
  label,
  description,
  htmlFor,
  children,
}: AutopilotSettingsRowProps) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">
      <HugeiconsIcon
        aria-hidden="true"
        className="text-muted-foreground size-4 shrink-0"
        icon={icon}
        strokeWidth={1.75}
      />
      <div className="min-w-0 flex-1">
        <label className="text-sm font-medium" htmlFor={htmlFor}>
          {label}
        </label>
        {description ? (
          <p className="text-muted-foreground text-xs text-pretty">
            {description}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  );
}

/** Every change saves on its own; there is no form to submit. */
export function AutopilotSettingsPanel({
  organizationId,
  callbackPath,
  overview,
}: AutopilotSettingsPanelProps) {
  const queryClient = useQueryClient();
  const { settings } = overview;
  const {
    githubConnected,
    slackIntegration,
    repositories,
    channels,
    installing,
    installGitHub,
    slackAuthorizeUrl,
  } = useAutopilotConnections({ organizationId, callbackPath, overview });

  const overviewKey = dashboardOrpc.autopilot.get.queryKey({
    input: { organizationId },
  });
  // Saves run one after another, each on top of the refetched settings, so a
  // quick second change never resends the value the first one replaced.
  const save = useMutation({
    scope: { id: `autopilot-settings:${organizationId}` },
    mutationFn: (patch: Partial<ReturnType<typeof toAutopilotSaveInput>>) =>
      dashboardOrpc.autopilot.save.call({
        ...toAutopilotSaveInput(
          organizationId,
          queryClient.getQueryData(overviewKey)?.settings ?? settings
        ),
        ...patch,
      }),
    // Refetched even when nobody shows the page anymore: a queued save
    // builds on these settings after a quick navigation.
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: dashboardOrpc.autopilot.key(),
        refetchType: "all",
      }),
    onError: (error) =>
      toast.error(toErrorMessage(error, "Could not save the change")),
  });

  // A job of its own, switched atomically like the automations so it can't
  // undo a toggle made elsewhere a moment before.
  const setPromptCleanup = useMutation({
    mutationFn: (enabled: boolean) =>
      dashboardOrpc.autopilot.setJob.call({
        organizationId,
        kind: "prompts",
        enabled,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: dashboardOrpc.autopilot.key(),
      }),
    onError: (error) =>
      toast.error(toErrorMessage(error, "Could not save the change")),
  });

  const repositoryKey = settings.repository
    ? `${settings.repository.owner}/${settings.repository.name}`
    : null;

  return (
    <div className="flex w-full flex-col gap-8">
      <div className="border-shell-border bg-shell rounded-2xl border p-0.5">
        <div className="divide-table-row-border shadow-table-card bg-table-card border-table-card-border divide-y overflow-hidden rounded-[14px] border">
          <SettingsRow
            htmlFor="autopilot-repository"
            icon={Github01Icon}
            label="Repository"
          >
            {githubConnected ? (
              <AutopilotRepositoryPicker
                className="w-64"
                id="autopilot-repository"
                onChange={(repository) =>
                  save.mutate({
                    repository: {
                      owner: repository.owner,
                      name: repository.name,
                      branch: repository.defaultBranch,
                    },
                  })
                }
                repositories={repositories}
                value={repositoryKey}
              />
            ) : (
              <Button
                loading={installing}
                onClick={installGitHub}
                size="sm"
                variant="outline"
              >
                Connect
              </Button>
            )}
          </SettingsRow>
          <SettingsRow
            description={
              slackIntegration ? AUTOPILOT_SLACK_CHANNEL_HINT : undefined
            }
            htmlFor="autopilot-slack-channel"
            icon={SlackIcon}
            label="Brief channel"
          >
            {slackIntegration ? (
              <Select
                items={channels.map((channel) => ({
                  value: channel.id,
                  label: `#${channel.name}`,
                }))}
                onValueChange={(value) => {
                  const channel = channels.find((row) => row.id === value);
                  if (channel) {
                    save.mutate({
                      slack: {
                        integrationId: slackIntegration.id,
                        channelId: channel.id,
                        channelName: channel.name,
                      },
                    });
                  }
                }}
                value={settings.slackChannelId}
              >
                <SelectTrigger className="w-56" id="autopilot-slack-channel">
                  <SelectValue placeholder="Choose a channel" />
                </SelectTrigger>
                <SelectContent align="end">
                  {channels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      #{channel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Button
                nativeButton={false}
                render={<a href={slackAuthorizeUrl} />}
                size="sm"
                variant="outline"
              >
                Connect
              </Button>
            )}
          </SettingsRow>
          <SettingsRow
            htmlFor="autopilot-brief-hour"
            icon={Clock01Icon}
            label="Brief at"
          >
            <Select
              items={AUTOPILOT_HOUR_OPTIONS}
              onValueChange={(value) =>
                save.mutate({ briefHour: Number(value) })
              }
              value={String(settings.briefHour)}
            >
              <SelectTrigger className="w-28" id="autopilot-brief-hour">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {AUTOPILOT_HOUR_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsRow>
          <SettingsRow
            htmlFor="autopilot-stale-days"
            icon={Archive02Icon}
            label="Close untouched drafts"
          >
            <Select
              items={AUTOPILOT_STALE_OPTIONS}
              onValueChange={(value) =>
                save.mutate({
                  stalePullRequestDays:
                    value === "never" ? null : toStaleDays(Number(value)),
                })
              }
              value={
                settings.stalePullRequestDays === null
                  ? "never"
                  : String(settings.stalePullRequestDays)
              }
            >
              <SelectTrigger className="w-36" id="autopilot-stale-days">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {AUTOPILOT_STALE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsRow>
          <SettingsRow
            htmlFor="autopilot-prompt-cleanup"
            icon={AiChat01Icon}
            label="Suggest pausing dead prompts"
          >
            <Switch
              checked={settings.jobs.prompts}
              id="autopilot-prompt-cleanup"
              onCheckedChange={(checked) => setPromptCleanup.mutate(checked)}
            />
          </SettingsRow>
          <SettingsRow
            htmlFor="autopilot-enabled"
            icon={PowerIcon}
            label="Autopilot"
          >
            <Switch
              checked={settings.enabled}
              id="autopilot-enabled"
              onCheckedChange={(checked) => {
                save.mutate({ enabled: checked });
              }}
            />
          </SettingsRow>
        </div>
      </div>
      <section
        aria-labelledby="autopilot-ignores"
        className="flex flex-col gap-3"
      >
        <div className="flex flex-col gap-0.5 px-1">
          <h3 className="text-sm font-medium" id="autopilot-ignores">
            What Autopilot ignores
          </h3>
          <p className="text-muted-foreground text-xs text-pretty">
            Autopilot never suggests posts for these. Asking @notra on a pull
            request still works.
          </p>
        </div>
        <AutopilotReleaseFiltersSection
          filters={settings.commitFilters}
          githubConnected={githubConnected}
          organizationId={organizationId}
          repositories={repositories}
        />
        <AutopilotRulesSection
          organizationId={organizationId}
          rules={overview.rules}
        />
      </section>
    </div>
  );
}
