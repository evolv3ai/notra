"use client";

import type { SiteSuspensionCategory } from "@notra/sites-core/types/sites";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { reportModerationOutcome } from "@/lib/moderation/report-outcome";
import { consoleOrpc } from "@/lib/orpc/query";
import { suspensionOutcome } from "@/utils/moderation-outcome";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Site admin mutations; each refreshes every sites query on success. */
export function useSiteActions() {
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: consoleOrpc.sites.key() });

  const deployLatest = useMutation({
    mutationFn: (input: { siteId: string }) =>
      consoleOrpc.sites.deployments.deployLatest.call(input),
    onSuccess: async () => {
      toast.success("Build queued from the latest commit");
      await refresh();
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Could not start the build")),
  });

  const redeploy = useMutation({
    mutationFn: (input: { siteId: string; deploymentId: string }) =>
      consoleOrpc.sites.deployments.redeploy.call(input),
    onSuccess: async () => {
      toast.success("Redeploy queued");
      await refresh();
    },
    onError: (error) => toast.error(errorMessage(error, "Could not redeploy")),
  });

  const rollback = useMutation({
    mutationFn: (input: { siteId: string; deploymentId: string }) =>
      consoleOrpc.sites.deployments.rollback.call(input),
    onSuccess: async () => {
      toast.success("Deployment restored to production");
      await refresh();
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Could not restore the deployment")),
  });

  const setSuspended = useMutation({
    mutationFn: (input: {
      siteId: string;
      suspended: boolean;
      reason: string;
      category?: SiteSuspensionCategory;
    }) => consoleOrpc.sites.setSuspended.call(input),
    onSuccess: async (result, input) => {
      reportModerationOutcome(
        input.suspended ? "Site suspended" : "Site reactivated",
        suspensionOutcome(result)
      );
      await refresh();
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Could not update the site")),
  });

  return { deployLatest, redeploy, rollback, setSuspended };
}
