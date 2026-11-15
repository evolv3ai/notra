"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { useInvalidateAutomationRuns } from "@/lib/hooks/use-automation-runs";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { AutomationRow } from "@/types/automation/automations";
import type { GeoAlertAutomation } from "@/types/automation/geo-alerts";
import type { Trigger } from "@/types/triggers/triggers";
import {
  getDefaultEventTriggerValues,
  isAutomationOutputType,
} from "@/utils/event-trigger-form";
import { getOrpcErrorDataCode } from "@/utils/orpc-errors";

export function useAutomationQueries(organizationId: string | undefined) {
  const queryClient = useQueryClient();
  const input = { organizationId: organizationId ?? "" };
  return {
    /** Resolves once the lists are fresh, so callers can wait before navigating. */
    invalidate: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: dashboardOrpc.automation.schedules.list.queryKey({ input }),
        }),
        queryClient.invalidateQueries({
          queryKey: dashboardOrpc.automation.events.list.queryKey({ input }),
        }),
        queryClient.invalidateQueries({
          queryKey: dashboardOrpc.automation.alerts.list.queryKey({ input }),
        }),
        queryClient.invalidateQueries({
          queryKey: dashboardOrpc.automation.runs.key(),
        }),
        organizationId
          ? queryClient.invalidateQueries({
              queryKey: dashboardOrpc.onboarding.get.queryKey({ input }),
            })
          : undefined,
      ]),
  };
}

function setAlertEnabled(
  organizationId: string,
  alert: GeoAlertAutomation,
  enabled: boolean
) {
  return dashboardOrpc.automation.alerts.update.call({
    organizationId,
    triggerId: alert.id,
    name: alert.name,
    sourceConfig: alert.sourceConfig,
    actions: alert.actions,
    enabled,
  });
}

function setRowEnabled(
  organizationId: string,
  row: AutomationRow,
  enabled: boolean
) {
  if (row.kind === "alert") {
    return setAlertEnabled(organizationId, row.alert, enabled);
  }
  const { trigger } = row;
  if (row.kind === "schedule") {
    const cron = trigger.sourceConfig.cron;
    if (!(cron && isAutomationOutputType(trigger.outputType))) {
      throw new Error("Invalid schedule configuration");
    }
    return dashboardOrpc.automation.schedules.update.call({
      organizationId,
      triggerId: trigger.id,
      name: trigger.name,
      sourceType: "cron",
      sourceConfig: { cron },
      targets: trigger.targets,
      outputType: trigger.outputType,
      lookbackWindow: trigger.lookbackWindow ?? "last_7_days",
      outputConfig: trigger.outputConfig ?? {},
      enabled,
      autoPublish: trigger.autoPublish,
    });
  }
  const values = getDefaultEventTriggerValues(trigger);
  return dashboardOrpc.automation.events.update.call({
    organizationId,
    triggerId: trigger.id,
    sourceType: "github_webhook",
    sourceConfig: {
      eventTypes: trigger.sourceConfig.eventTypes ?? [values.eventType],
      includePreReleases: trigger.sourceConfig.includePreReleases ?? true,
      ignoreCommitPatterns: trigger.sourceConfig.ignoreCommitPatterns ?? [],
    },
    targets: trigger.targets,
    outputType: isAutomationOutputType(trigger.outputType)
      ? trigger.outputType
      : values.outputType,
    outputConfig: trigger.outputConfig ?? {},
    enabled,
    autoPublish: trigger.autoPublish,
  });
}

export function useAutomationMutations(organizationId: string | undefined) {
  const t = useTranslations("automation.page");
  const tAlerts = useTranslations("automation.alerts");
  const queryClient = useQueryClient();
  const { invalidate } = useAutomationQueries(organizationId);
  const invalidateRuns = useInvalidateAutomationRuns();
  const orgId = organizationId ?? "";
  const listKeys = {
    alert: dashboardOrpc.automation.alerts.list.queryKey({
      input: { organizationId: orgId },
    }),
    schedule: dashboardOrpc.automation.schedules.list.queryKey({
      input: { organizationId: orgId },
    }),
    event: dashboardOrpc.automation.events.list.queryKey({
      input: { organizationId: orgId },
    }),
  };

  const toggle = useMutation({
    mutationFn: async ({
      row,
      enabled,
    }: {
      row: AutomationRow;
      enabled: boolean;
    }) => {
      await setRowEnabled(orgId, row, enabled);
    },
    // Flip the switch right away; the refetch after settling confirms it.
    onMutate: async ({ row, enabled }) => {
      const key = listKeys[row.kind];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      const flip = <T extends { id: string; enabled: boolean }>(
        items: T[] | undefined
      ) =>
        items?.map((item) =>
          item.id === row.id ? { ...item, enabled } : item
        );
      if (row.kind === "alert") {
        queryClient.setQueryData(
          listKeys.alert,
          (data?: { alerts: GeoAlertAutomation[] }) =>
            data && { ...data, alerts: flip(data.alerts) ?? data.alerts }
        );
      } else {
        queryClient.setQueryData(
          listKeys[row.kind],
          (data?: { triggers: Trigger[] }) =>
            data && { ...data, triggers: flip(data.triggers) ?? data.triggers }
        );
      }
      return { key, previous };
    },
    onError: (error, _variables, context) => {
      if (context) {
        queryClient.setQueryData(context.key, context.previous);
      }
      toast.error(
        getOrpcErrorDataCode(error) === "INTEGRATION_NOT_FOUND"
          ? t("integrationDeleted")
          : t("updateFailed")
      );
    },
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: (row: AutomationRow) => {
      const input = { organizationId: orgId, triggerId: row.id };
      if (row.kind === "alert") {
        return dashboardOrpc.automation.alerts.delete.call(input);
      }
      return row.kind === "schedule"
        ? dashboardOrpc.automation.schedules.delete.call(input)
        : dashboardOrpc.automation.events.delete.call(input);
    },
    onSuccess: () => toast.success(t("removed")),
    onError: () => toast.error(t("deleteFailed")),
    onSettled: invalidate,
  });

  const runNow = useMutation({
    mutationFn: (triggerId: string) =>
      dashboardOrpc.automation.schedules.runNow.call({
        organizationId: orgId,
        triggerId,
      }),
    onSuccess: () => toast.success(t("triggered")),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("runFailed")),
    onSettled: invalidateRuns,
  });

  const sendTest = useMutation({
    mutationFn: (triggerId: string) =>
      dashboardOrpc.automation.alerts.sendTest.call({
        organizationId: orgId,
        triggerId,
      }),
    onSuccess: ({ delivery }) => {
      if (Object.values(delivery).some(Boolean)) {
        toast.success(tAlerts("dialog.testSent"));
      } else {
        toast.error(tAlerts("dialog.testFailed"));
      }
    },
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : tAlerts("dialog.testFailed")
      ),
    onSettled: invalidateRuns,
  });

  return { toggle, remove, runNow, sendTest };
}
