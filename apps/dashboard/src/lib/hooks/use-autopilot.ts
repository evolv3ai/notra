"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

import { AUTOPILOT_POLL_INTERVAL_MS } from "@/constants/autopilot";
import { AUTOPILOT_AUTOMATIONS } from "@/constants/autopilot-ui";
import { dashboardOrpc } from "@/lib/orpc/query";
import type { AutopilotAutomationKind } from "@/types/autopilot-metrics";
import type { GitHubMergeMethod } from "@/types/integrations/github";
import { toErrorMessage } from "@/utils/error-message";

/**
 * The workspace's Autopilot state, polled while a run or a write is in
 * flight. Admins sync GitHub once per page visit so merges and closes made
 * there show up.
 */
export function useAutopilotOverview(organizationId: string) {
  const queryClient = useQueryClient();
  const query = useQuery(
    dashboardOrpc.autopilot.get.queryOptions({
      input: { organizationId },
      enabled: organizationId.length > 0,
      refetchInterval: (state) =>
        state.state.data?.runs.some((run) => run.status === "running") ||
        state.state.data?.findings.some((finding) => finding.status === "open")
          ? AUTOPILOT_POLL_INTERVAL_MS
          : false,
    })
  );
  const canSync = Boolean(query.data?.available && query.data.canManage);
  useEffect(() => {
    if (!(organizationId && canSync)) {
      return;
    }
    dashboardOrpc.autopilot.sync
      .call({ organizationId })
      .then(() =>
        queryClient.invalidateQueries({
          queryKey: dashboardOrpc.autopilot.key(),
        })
      )
      .catch(() => undefined);
  }, [canSync, organizationId, queryClient]);
  return query;
}

export function useAutopilotActions(organizationId: string) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: dashboardOrpc.autopilot.key() });

  const runNow = useMutation({
    mutationFn: (kind?: AutopilotAutomationKind) =>
      dashboardOrpc.autopilot.runNow.call({ organizationId, kind }),
    onSuccess: (result, kind) => {
      if (result.alreadyRunning) {
        toast.success("Autopilot is already running");
      } else {
        toast.success(
          kind
            ? `${AUTOPILOT_AUTOMATIONS[kind].name} is running now`
            : "Autopilot is checking your site now"
        );
      }
      invalidate();
    },
    onError: (error) =>
      toast.error(toErrorMessage(error, "Could not start Autopilot")),
  });

  const stop = useMutation({
    mutationFn: (runId: string) =>
      dashboardOrpc.autopilot.stop.call({ organizationId, runId }),
    onSuccess: () => {
      toast.success("Stopped. Steps already underway finish first.");
      invalidate();
    },
    onError: (error) =>
      toast.error(toErrorMessage(error, "Could not stop the run")),
  });

  const writeSuggestion = useMutation({
    mutationFn: (findingId: string) =>
      dashboardOrpc.autopilot.writeSuggestion.call({
        organizationId,
        findingId,
      }),
    onSuccess: () => {
      toast.success("Post queued. The pull request will appear here.");
      invalidate();
    },
    onError: (error) =>
      toast.error(toErrorMessage(error, "Could not start writing")),
  });

  const setJob = useMutation({
    mutationFn: (input: { kind: AutopilotAutomationKind; enabled: boolean }) =>
      dashboardOrpc.autopilot.setJob.call({ organizationId, ...input }),
    onSuccess: (_, input) => {
      toast.success(
        `${AUTOPILOT_AUTOMATIONS[input.kind].name} is ${input.enabled ? "on" : "off"}`
      );
      invalidate();
    },
    onError: (error) =>
      toast.error(toErrorMessage(error, "Could not change the automation")),
  });

  const merge = useMutation({
    mutationFn: (input: { findingId: string; method: GitHubMergeMethod }) =>
      dashboardOrpc.autopilot.merge.call({ organizationId, ...input }),
    onSuccess: () => {
      toast.success("Merged");
      invalidate();
    },
    onError: (error) => toast.error(toErrorMessage(error, "Could not merge")),
  });

  return { runNow, stop, writeSuggestion, setJob, merge };
}
