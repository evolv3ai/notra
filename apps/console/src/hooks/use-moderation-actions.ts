"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { reportModerationOutcome } from "@/lib/moderation/report-outcome";
import { consoleOrpc } from "@/lib/orpc/query";
import type {
  OrganizationSuspendRequest,
  UserBanRequest,
  UserBanResult,
} from "@/types/moderation";
import { plural, suspensionOutcome } from "@/utils/moderation-outcome";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function banMessage(result: UserBanResult, input: UserBanRequest): string {
  if (!input.banned) {
    return "User unbanned";
  }
  const parts = ["User banned"];
  if (result.revokedSessions !== null) {
    parts.push(
      `${plural(result.revokedSessions, "session", "sessions")} revoked`
    );
  }
  if (input.suspendOrganizations) {
    parts.push(
      `${plural(result.suspendedOrganizations, "workspace", "workspaces")} suspended`
    );
  }
  return parts.join(", ");
}

/** Workspace suspensions and user bans; each refreshes moderation and sites. */
export function useModerationActions() {
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: consoleOrpc.moderation.key() }),
      queryClient.invalidateQueries({ queryKey: consoleOrpc.sites.key() }),
    ]);

  const setOrganizationSuspended = useMutation({
    mutationFn: (input: OrganizationSuspendRequest) =>
      consoleOrpc.moderation.setOrganizationSuspended.call(input),
    onSuccess: async (result, input) => {
      reportModerationOutcome(
        input.suspended
          ? `Workspace suspended, ${plural(result.sites ?? 0, "site", "sites")} taken offline`
          : `Suspension lifted, ${plural(result.sites ?? 0, "site", "sites")} restored`,
        suspensionOutcome(result)
      );
      await refresh();
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Could not update the workspace")),
  });

  const setUserBanned = useMutation({
    mutationFn: (input: UserBanRequest) =>
      consoleOrpc.moderation.setUserBanned.call(input),
    onSuccess: async (result, input) => {
      reportModerationOutcome(banMessage(result, input), result.outcome);
      await refresh();
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Could not update the user")),
  });

  return { setOrganizationSuspended, setUserBanned };
}
